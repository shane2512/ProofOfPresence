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

const SEPOLIA_CONTRACT = "0xbA985984B1319451968f42281b1a92Ca709cF820";

function tierLabel(tier: number) {
  return tier === 1 ? "Tier 1 — World ID Orb" : "Tier 2 — Email / Phone";
}

function tierColor(tier: number) {
  return tier === 1 ? "text-yellow-300 bg-yellow-500/20" : "text-zinc-300 bg-zinc-700";
}

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
    <div className="flex min-h-screen flex-col bg-black px-6 py-12 font-sans text-white">
      <div className="mx-auto w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-1">
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
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="text-4xl">🗂️</div>
            <p className="text-sm text-zinc-500">
              {credentials.length === 0
                ? "No credentials yet. Check in to an event first."
                : "No credentials match that filter."}
            </p>
            <Link
              href="/"
              className="text-sm text-zinc-400 underline underline-offset-4 hover:text-white"
            >
              Go to Check-In →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((c) => (
              <div
                key={`${c.nullifier_hash}-${c.event_id}`}
                className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-white">
                      {EVENT_LABELS[c.event_id] ?? c.event_id}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {new Date(c.timestamp * 1000).toLocaleString()}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${tierColor(c.tier)}`}
                  >
                    {tierLabel(c.tier)}
                  </span>
                </div>

                <div className="flex flex-col gap-1 text-xs text-zinc-600">
                  <span className="break-all">
                    Nullifier: {c.nullifier_hash.slice(0, 18)}…
                  </span>
                </div>

                <div className="flex gap-3 text-xs">
                  <a
                    href={`https://sepolia.etherscan.io/address/${SEPOLIA_CONTRACT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 underline underline-offset-2 hover:text-white"
                  >
                    Sepolia explorer
                  </a>
                  {c.txHash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${c.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-400 underline underline-offset-2 hover:text-white"
                    >
                      Tx hash
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-300">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
