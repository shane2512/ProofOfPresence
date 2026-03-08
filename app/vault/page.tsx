"use client";

// Screen 5 — Credential Vault
// Reads credentials from localStorage (keyed by nullifier hash).
// No wallet address stored or shown anywhere.

import { useEffect, useState } from "react";
import Link from "next/link";

interface Credential {
  nullifier_hash: string;
  event_id: string;
  event_label: string;
  tier: number;
  timestamp: number; // unix seconds
  txHash?: string;
}

const EVENT_LABELS: Record<string, string> = {
  "devcon-2025-day1": "Devcon 2025 — Day 1",
};

const SEPOLIA_CONTRACT = "0x424F855FcFBCF5544bcfCC1bEF3c60D52632d676";

export default function VaultPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pop_credentials");
      if (raw) {
        const parsed = JSON.parse(raw) as Credential[];
        setCredentials(parsed);
      }
    } catch {
      // localStorage unavailable — silently ignore
    }
  }, []);

  const filtered = credentials.filter(
    (c) =>
      !filter ||
      c.event_id.includes(filter) ||
      c.event_label.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="dot-grid relative flex min-h-screen flex-col overflow-hidden bg-black px-6 py-12 font-sans text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-500/8 blur-[100px]" />
      </div>

      <div className="relative mx-auto w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-1.5">
          <Link href="/" className="mb-2 self-start text-xs text-zinc-600 transition hover:text-zinc-400">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold">Credential Vault</h1>
          <p className="text-sm text-zinc-400">
            Your anonymous attendance record — no wallet address stored.
          </p>
        </div>

        {/* Filter */}
        <input
          type="text"
          placeholder="Filter by event…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="mb-6 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
        />

        {/* Credential list */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-900 text-4xl ring-1 ring-zinc-800">
              🗂️
            </div>
            <div>
              <p className="font-medium text-zinc-300">
                {credentials.length === 0 ? "No credentials yet" : "No results found"}
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                {credentials.length === 0
                  ? "Check in to an event to earn your first badge."
                  : "Try clearing the filter."}
              </p>
            </div>
            <Link
              href="/"
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white"
            >
              Go to Check-In →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((c) => (
              <div
                key={`${c.nullifier_hash}-${c.event_id}`}
                className={`flex flex-col gap-3 rounded-2xl border p-4 transition-all duration-200 ${
                  c.tier === 1
                    ? "border-yellow-500/20 bg-yellow-500/5 hover:border-yellow-500/30"
                    : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                }`}
              >
                {/* Header row */}
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl shadow-lg ${
                    c.tier === 1
                      ? "bg-gradient-to-br from-yellow-400 to-amber-600 shadow-yellow-500/20"
                      : "bg-gradient-to-br from-zinc-500 to-zinc-700"
                  }`}>
                    ❆
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">
                      {EVENT_LABELS[c.event_id] ?? c.event_id}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {new Date(c.timestamp * 1000).toLocaleString()}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    c.tier === 1 ? "bg-yellow-500/20 text-yellow-300" : "bg-zinc-800 text-zinc-400"
                  }`}>
                    {c.tier === 1 ? "🥇 Orb" : "🥈 Email"}
                  </span>
                </div>

                {/* Mint tx — primary CTA */}
                {c.txHash ? (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${c.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-yellow-500/20 bg-yellow-500/8 px-3 py-2 text-xs transition hover:bg-yellow-500/15"
                  >
                    <span className="text-yellow-400">🎖️ Badge minted</span>
                    <span className="font-mono text-zinc-500">{c.txHash.slice(0, 10)}…{c.txHash.slice(-6)} ↗</span>
                  </a>
                ) : (
                  <a
                    href={`https://sepolia.etherscan.io/address/${SEPOLIA_CONTRACT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-zinc-800 px-3 py-2 text-xs text-zinc-500 transition hover:text-zinc-300"
                  >
                    <span>Contract</span>
                    <span className="font-mono">{SEPOLIA_CONTRACT.slice(0, 10)}… ↗</span>
                  </a>
                )}

                {/* Nullifier (truncated) */}
                <div className="text-xs text-zinc-700">
                  {c.nullifier_hash.slice(0, 20)}…
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <Link href="/" className="text-sm text-zinc-700 transition hover:text-zinc-400">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
