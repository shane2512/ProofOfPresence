// API Route — POST /api/rp-signature
//
// Signs an IDKit v4 request using the RP signing key stored in RP_SIGNING_KEY.
// Never expose RP_SIGNING_KEY client-side.

import { NextRequest, NextResponse } from "next/server";
import { signRequest } from "@worldcoin/idkit";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { action?: string };
  const action = body.action;

  if (!action || typeof action !== "string") {
    return NextResponse.json(
      { error: "Missing required field: action" },
      { status: 400 }
    );
  }

  const signingKey = process.env.RP_SIGNING_KEY;
  if (!signingKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: RP_SIGNING_KEY not set" },
      { status: 500 }
    );
  }

  const { sig, nonce, createdAt, expiresAt } = signRequest(action, signingKey);

  return NextResponse.json({
    sig,
    nonce,
    created_at: createdAt,
    expires_at: expiresAt,
  });
}
