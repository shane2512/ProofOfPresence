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
  const mintTxHash = txHash || creLog?.txHash;

  return (
      <div className="dot-grid relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-6 py-12 font-sans text-white">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className={`absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px] ${
          isOrb ? "bg-yellow-500/10" : "bg-zinc-500/8"
        }`} />
      </div>

      <main className="relative flex w-full max-w-sm flex-col items-center gap-6">
        {/* Badge with glow rings */}
        <div className="relative flex items-center justify-center py-4">
          {isOrb && (
            <>
              <div className="absolute h-40 w-40 animate-pulse rounded-full bg-yellow-400/15 blur-xl" />
              <div className="absolute h-32 w-32 rounded-full bg-yellow-400/10" />
            </>
          )}
          <div className={`relative flex h-28 w-28 items-center justify-center rounded-full text-5xl shadow-2xl ring-4 ${
            isOrb
              ? "bg-gradient-to-br from-yellow-400 to-amber-600 ring-yellow-500/40 shadow-yellow-500/25"
              : "bg-gradient-to-br from-zinc-400 to-zinc-600 ring-zinc-600/30"
          }`}>
            ✦
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="text-2xl font-bold">Credential Issued!</h1>
          <p className="text-base text-zinc-300">{eventLabel}</p>
          <span className={`mt-0.5 rounded-full px-3 py-0.5 text-xs font-semibold ring-1 ${
            isOrb
              ? "bg-yellow-500/20 text-yellow-300 ring-yellow-500/30"
              : "bg-zinc-800 text-zinc-300 ring-zinc-700"
          }`}>
            {isOrb ? "🥇 Tier 1 — World ID Orb" : "🥈 Tier 2 — Email / Phone"}
          </span>
        </div>

        {/* Badge Minted — primary CTA */}
        {mintTxHash && (
          <a
            href={`https://sepolia.etherscan.io/tx/${mintTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group w-full rounded-2xl border border-yellow-500/40 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 p-4 text-center transition-all duration-200 hover:border-yellow-500/60 hover:from-yellow-500/15 hover:to-amber-500/15"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400">🏅 Badge Minted</p>
            <p className="mt-1 text-xs text-zinc-400">Soul-bound token issued on Sepolia</p>
            <p className="mt-2 break-all font-mono text-xs text-yellow-300">{mintTxHash}</p>
            <p className="mt-1 text-xs text-zinc-500 transition group-hover:text-zinc-400">View transaction on Etherscan ↗</p>
          </a>
        )}

        {/* On-chain verification panel */}
        <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            On-Chain Record
          </p>
          {onChainStatus === "checking" && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
              Verifying on Sepolia…
            </div>
          )}
          {onChainStatus === "confirmed" && (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 font-medium text-emerald-400">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-xs">✓</span>
                Confirmed on-chain
              </div>
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <span className="text-zinc-500">Recorded</span>
                <span className="text-right text-zinc-200">{onChainTimestamp}</span>
                <span className="text-zinc-500">Tier</span>
                <span className="text-right text-zinc-200">{onChainTier === 1 ? "Orb" : "Email/Phone"}</span>
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

        {/* CRE Simulation log — collapsible */}
        <details className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/80">
          <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                creLog === null ? "bg-zinc-800 text-zinc-500"
                : creLog.success ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
              }`}>
                {creLog === null ? "?" : creLog.success ? "✓" : "✕"}
              </span>
              <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">CRE Simulate Output</span>
            </div>
            <span className="text-xs text-zinc-600">▸</span>
          </summary>
          <div className="border-t border-zinc-800 px-4 py-3">
            {creLog === null ? (
              <p className="text-xs text-zinc-600">Log not available (page was refreshed?)</p>
            ) : (
              <pre className="max-h-56 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-zinc-300 whitespace-pre-wrap">
                {creLog.output || "(no output)"}
              </pre>
            )}
          </div>
        </details>

        {/* Contract fallback link */}
        {!mintTxHash && (
          <a
            href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-600 underline underline-offset-4 transition hover:text-zinc-400"
          >
            View contract on Sepolia Etherscan →
          </a>
        )}

        {/* Actions */}
        <div className="flex w-full flex-col gap-3 pt-2">
          <button
            onClick={() => router.push("/vault")}
            className="w-full rounded-2xl bg-white px-6 py-3 font-semibold text-black shadow-lg shadow-white/10 transition hover:bg-zinc-100"
          >
            View Credential Vault
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-zinc-600 transition hover:text-zinc-400"
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
