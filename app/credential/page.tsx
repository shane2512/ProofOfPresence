"use client";

// Screen 4 — Credential Issued
// Shows gold (Tier 1) or silver (Tier 2) badge.
// Calls hasAttended() on-chain to confirm record exists.

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { createPublicClient, http, keccak256, toBytes } from "viem";
import { sepolia } from "viem/chains";

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0x424F855FcFBCF5544bcfCC1bEF3c60D52632d676") as `0x${string}`;

const HAS_ATTENDED_ABI = [
  {
    name: "hasAttended",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "nullifierHash", type: "bytes32" },
      { name: "eventId", type: "string" },
    ],
    outputs: [
      { name: "exists", type: "bool" },
      { name: "timestamp", type: "uint256" },
      { name: "tier", type: "uint8" },
    ],
  },
] as const;

const EVENT_LABELS: Record<string, string> = {
  "devcon-2025-day1": "Devcon 2025 — Day 1",
};

function CredentialContent() {
  const params = useSearchParams();
  const router = useRouter();
  const eventId = params.get("event") ?? "";
  const tier = Number(params.get("tier") ?? "1");
  const nullifier = params.get("nullifier") ?? "";
  const txHash = params.get("txHash") ?? "";
  const eventLabel = EVENT_LABELS[eventId] ?? eventId;

  const [onChainStatus, setOnChainStatus] = useState<"checking" | "confirmed" | "not-found" | "error">(
    "checking"
  );
  const [onChainTimestamp, setOnChainTimestamp] = useState<string>("");
  const [onChainTier, setOnChainTier] = useState<number>(0);
  const [creLog, setCreLog] = useState<{ success: boolean; txHash: string; output: string } | null>(null);

  // Load CRE log saved by the processing page
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("pop_cre_log");
      if (raw) {
        setCreLog(JSON.parse(raw) as { success: boolean; txHash: string; output: string });
        sessionStorage.removeItem("pop_cre_log");
      }
    } catch { /* ok */ }
  }, []);

  useEffect(() => {
    if (!nullifier) return;

    const rpcUrl =
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia.rpc.subquery.network/public";

    const client = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const nullifierBytes32 = /^0x[0-9a-fA-F]{64}$/.test(nullifier)
      ? (nullifier as `0x${string}`)
      : keccak256(toBytes(nullifier));

    client
      .readContract({
        address: CONTRACT_ADDRESS,
        abi: HAS_ATTENDED_ABI,
        functionName: "hasAttended",
        args: [nullifierBytes32, eventId],
      })
      .then(([exists, timestamp, t]) => {
        if (exists) {
          setOnChainStatus("confirmed");
          setOnChainTimestamp(new Date(Number(timestamp) * 1000).toLocaleString());
          setOnChainTier(t);
        } else {
          setOnChainStatus("not-found");
        }
      })
      .catch(() => setOnChainStatus("error"));
  }, [nullifier, eventId]);

  const isOrb = tier === 1;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-12 font-sans text-white">
      <main className="flex w-full max-w-sm flex-col items-center gap-8">
        {/* Badge */}
        <div
          className={`flex h-32 w-32 flex-col items-center justify-center rounded-full text-6xl shadow-2xl ${
            isOrb
              ? "bg-gradient-to-br from-yellow-400 to-amber-600"
              : "bg-gradient-to-br from-zinc-400 to-zinc-600"
          }`}
        >
          ✦
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Credential Issued!</h1>
          <p className="text-base text-zinc-300">{eventLabel}</p>
          <span
            className={`mt-1 rounded-full px-3 py-0.5 text-xs font-semibold ${
              isOrb ? "bg-yellow-500/20 text-yellow-300" : "bg-zinc-700 text-zinc-300"
            }`}
          >
            {isOrb ? "🥇 Tier 1 — World ID Orb" : "🥈 Tier 2 — Email / Phone"}
          </span>
        </div>

        {/* On-chain verification panel */}
        <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            On-Chain Record
          </p>
          {onChainStatus === "checking" && (
            <p className="text-sm text-zinc-400">Verifying on Sepolia…</p>
          )}
          {onChainStatus === "confirmed" && (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-emerald-400">
                <span>✅</span>
                <span className="font-medium">Confirmed on-chain</span>
              </div>
              <div className="text-zinc-400">
                Recorded: <span className="text-zinc-200">{onChainTimestamp}</span>
              </div>
              <div className="text-zinc-400">
                Tier: <span className="text-zinc-200">{onChainTier === 1 ? "Orb" : "Email/Phone"}</span>
              </div>
            </div>
          )}
          {onChainStatus === "not-found" && (
            <p className="text-sm text-yellow-400">
              Record not yet indexed — CCIP propagation may still be in progress.
            </p>
          )}
          {onChainStatus === "error" && (
            <p className="text-sm text-red-400">Could not reach Sepolia RPC.</p>
          )}
        </div>

        {/* CRE Simulation log */}
        <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            CRE Simulate Output
          </p>
          {creLog === null ? (
            <p className="text-xs text-zinc-600">Log not available (page was refreshed?)</p>
          ) : (
            <>
              <div className={`mb-2 flex items-center gap-2 text-sm font-medium ${
                creLog.success ? "text-emerald-400" : "text-red-400"
              }`}>
                <span>{creLog.success ? "✅" : "❌"}</span>
                <span>{creLog.success ? "Simulation succeeded" : "Simulation failed"}</span>
              </div>
              {creLog.txHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${creLog.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-2 block break-all font-mono text-xs text-cyan-400 underline underline-offset-2"
                >
                  {creLog.txHash}
                </a>
              )}
              <pre className="max-h-64 overflow-auto rounded-lg bg-black p-3 text-xs text-zinc-300 whitespace-pre-wrap">
                {creLog.output || "(no output)"}
              </pre>
            </>
          )}
        </div>

        {/* Badge minting transaction */}
        {(txHash || creLog?.txHash) && (
          <a
            href={`https://sepolia.etherscan.io/tx/${txHash || creLog?.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-center hover:bg-yellow-500/20 transition"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400">
              🏅 Badge Minted — View Transaction
            </p>
            <p className="mt-1 break-all font-mono text-xs text-yellow-300">
              {txHash || creLog?.txHash}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Sepolia Etherscan →</p>
          </a>
        )}

        {/* Contract link — shown only as small secondary link if no tx hash */}
        {!txHash && !creLog?.txHash && (
          <a
            href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-300"
          >
            View contract on Sepolia Etherscan →
          </a>
        )}

        {/* Actions */}
        <div className="flex w-full flex-col gap-3">
          <button
            onClick={() => router.push("/vault")}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-6 py-3 font-semibold text-white transition hover:bg-zinc-800"
          >
            View Credential Vault
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-zinc-600 hover:text-zinc-400"
          >
            Back to Home
          </button>
        </div>
      </main>
    </div>
  );
}

export default function CredentialPage() {
  return (
    <Suspense>
      <CredentialContent />
    </Suspense>
  );
}
