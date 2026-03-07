// API Route — POST /api/cre-simulate
//
// Spawns `cre workflow simulate` with the verified check-in payload after
// World ID verification completes in the browser. Runs with --broadcast so
// real transactions are sent to Sepolia (and CCIP to Base + Optimism).
//
// Returns { success, txHash, output } once the simulation finishes.
// Typical runtime: 30–90 seconds.

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Allow up to 120 s — Next.js default is 30 s for serverless; ignored in local dev
export const maxDuration = 120;
export const dynamic = "force-dynamic";

interface CREPayload {
  wallet_address: string;
  event_id: string;
  tier: number;
  nullifier_hash: string;
  merkle_root: string;
  proof: string;
  expires_at: number;
}

export async function POST(req: NextRequest) {
  let payload: CREPayload;
  try {
    payload = (await req.json()) as CREPayload;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.event_id || !payload.nullifier_hash) {
    return NextResponse.json(
      { success: false, error: "Missing event_id or nullifier_hash" },
      { status: 400 }
    );
  }

  // CRE project lives in the nested proofofpresence/ subfolder relative to
  // the Next.js app root (d:\Proof of Presence\proofofpresence\proofofpresence)
  const creCwd = path.resolve(process.cwd(), "proofofpresence");

  // Write payload to a temp file — avoids Windows shell quote-mangling JSON
  // when passing inline via --http-payload "...json...".
  const tmpFile = path.join(tmpdir(), `pop-cre-${Date.now()}.json`);
  writeFileSync(tmpFile, JSON.stringify(payload), "utf-8");

  return new Promise<NextResponse>((resolve) => {
    const child = spawn(
      "cre",
      [
        "workflow",
        "simulate",
        "./my-workflow",
        "--broadcast",
        "--non-interactive",
        "--trigger-index",
        "0",
        "--http-payload",
        tmpFile,        // file path — no shell quoting issues
        "-T",
        "staging-settings",
      ],
      { cwd: creCwd, shell: true }   // shell: true needed on Windows for .cmd shims
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      child.kill();
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
      resolve(
        NextResponse.json(
          { success: false, error: "CRE simulate timed out after 120 s", output: stdout },
          { status: 504 }
        )
      );
    }, 120_000);

    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      try { unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }

      const combined = stdout + "\n" + stderr;

      // Parse tx hash from the JSON result line the workflow returns, e.g.:
      // { "success": true, "txHash": "0xabc..." }
      let txHash = "";
      const m1 = combined.match(/"txHash"\s*:\s*"(0x[a-fA-F0-9]{40,})"/);
      if (m1) txHash = m1[1];
      // Fallback: bare "0x..." after text "hash" or "tx"
      if (!txHash) {
        const m2 = combined.match(/(?:[Tt]x|[Hh]ash)[:\s]+(0x[a-fA-F0-9]{40,})/);
        if (m2) txHash = m2[1];
      }

      if (code === 0 || (code !== 0 && txHash)) {
        resolve(NextResponse.json({ success: true, txHash, output: stdout }));
      } else {
        resolve(
          NextResponse.json(
            {
              success: false,
              error: `CRE simulate exited with code ${code ?? "null"}`,
              output: combined,
            },
            { status: 500 }
          )
        );
      }
    });
  });
}
