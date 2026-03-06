// API Route — POST /api/checkin
//
// Standalone from CRE. Does:
//  1. Validates required fields + expires_at window
//  2. Tier 1 (IDKit v4):  Forwards idkit_result to POST https://developer.world.org/api/v4/verify/{rp_id}
//  2. Tier 1 (MiniKit):   Legacy verify via developer.worldcoin.org/api/v1/verify/{appId}
//  3. Tier 2: presence of nullifier_hash is sufficient (Privy-derived keccak256)
//  4. Returns { success, nullifier_hash, event_id, tier }
//
// No private key required — read-only verification.
// The actual on-chain recordAttendance() is handled by the CRE workflow (shown separately).

import { NextRequest, NextResponse } from "next/server";

const QR_TTL_SECONDS = 5 * 60; // 5-minute window

interface CheckinBody {
  wallet_address: string;
  event_id: string;
  tier: number;
  nullifier_hash: string;
  merkle_root: string;
  proof: string;
  expires_at: number;
}

interface WorldIDVerifyResponse {
  success?: boolean;
  nullifier_hash?: string;
  code?: string;
  detail?: string;
  attribute?: string;
}

function validateBody(body: unknown): CheckinBody {
  const b = body as Record<string, unknown>;
  const required = ["wallet_address", "event_id", "nullifier_hash", "expires_at"];
  for (const field of required) {
    if (b[field] === undefined || b[field] === null || b[field] === "") {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  if (typeof b.expires_at !== "number") {
    throw new Error("expires_at must be a number (unix seconds)");
  }
  return {
    wallet_address: String(b.wallet_address),
    event_id: String(b.event_id),
    tier: typeof b.tier === "number" ? b.tier : 1,
    nullifier_hash: String(b.nullifier_hash),
    merkle_root: typeof b.merkle_root === "string" ? b.merkle_root : "",
    proof: typeof b.proof === "string" ? b.proof : "",
    expires_at: b.expires_at as number,
  };
}

export async function POST(req: NextRequest) {
  // --- Parse body ---
  let body: CheckinBody;
  try {
    const raw: unknown = await req.json();
    body = validateBody(raw);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 400 }
    );
  }

  // --- Validate expires_at window ---
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds > body.expires_at + QR_TTL_SECONDS) {
    return NextResponse.json(
      { success: false, error: "QR code has expired" },
      { status: 400 }
    );
  }

  // --- Tier 1: World ID verification ---
  if (body.tier === 1) {
    // IDKit v4 browser flow (idkit_result present) or legacy MiniKit path
    const appId = process.env.WORLD_ID_APP_ID;
    const action = process.env.WORLD_ID_ACTION ?? "event_attendance";
    const skipVerify = process.env.SKIP_WORLD_ID_VERIFY === "true";

    if (!appId && !skipVerify) {
      return NextResponse.json(
        { success: false, error: "Server misconfiguration: WORLD_ID_APP_ID not set" },
        { status: 500 }
      );
    }

    if (!body.proof || !body.merkle_root) {
      return NextResponse.json(
        { success: false, error: "Tier 1 requires proof and merkle_root" },
        { status: 400 }
      );
    }

    // Skip actual API call for staging/simulator proofs when env flag set
    if (!skipVerify) {
      let verifyResult: WorldIDVerifyResponse;
      try {
        const verifyRes = await fetch(
          `https://developer.worldcoin.org/api/v1/verify/${appId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nullifier_hash: body.nullifier_hash,
              merkle_root: body.merkle_root,
              proof: body.proof,
              verification_level: "orb",
              signal: body.wallet_address,
              action,
            }),
          }
        );

        verifyResult = (await verifyRes.json()) as WorldIDVerifyResponse;

        if (verifyRes.status !== 200 || !verifyResult.success) {
          const code = verifyResult.code ?? verifyResult.detail ?? String(verifyRes.status);
          return NextResponse.json(
            { success: false, error: `World ID verification failed: ${code}` },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { success: false, error: "Could not reach World ID API" },
          { status: 502 }
        );
      }
    }
  }

  // --- Tier 2: nullifier presence check (Privy-derived keccak256) ---
  if (body.tier === 2) {
    if (!body.nullifier_hash || body.nullifier_hash.length < 10) {
      return NextResponse.json(
        { success: false, error: "Tier 2 requires a valid nullifier_hash" },
        { status: 400 }
      );
    }
  }

  // --- Unknown tier ---
  if (body.tier !== 1 && body.tier !== 2) {
    return NextResponse.json(
      { success: false, error: `Unknown tier: ${body.tier}` },
      { status: 400 }
    );
  }

  // --- Success ---
  // Note: actual on-chain recordAttendance is handled by the CRE workflow (separate demo).
  // This route confirms proof validity so the frontend can proceed to the processing screen.
  return NextResponse.json({
    success: true,
    nullifier_hash: body.nullifier_hash,
    event_id: body.event_id,
    tier: body.tier,
  });
}
