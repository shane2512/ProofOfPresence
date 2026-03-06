// Screen 1 — Home / Pre-registration
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-12 font-sans text-white">
      <main className="flex w-full max-w-sm flex-col items-center gap-10">
        {/* Logo / badge */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-4xl shadow-lg">
            ✦
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Proof of Presence</h1>
          <p className="text-center text-sm text-zinc-400">
            Privacy-preserving event attendance
            <br />
            powered by World ID + Chainlink CRE
          </p>
        </div>

        {/* Tier selection */}
        <div className="flex w-full flex-col gap-4">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Choose verification method
          </p>

          {/* Tier 1 — World ID Orb */}
          <Link
            href="/checkin?event=devcon-2025-day1&tier=1"
            className="flex w-full items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 transition hover:bg-emerald-500/20"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-2xl">
              🌐
            </div>
            <div>
              <div className="font-semibold text-emerald-300">Tier 1 — World ID Orb</div>
              <div className="text-sm text-zinc-400">
                Full ZK proof of personhood · highest privacy
              </div>
            </div>
          </Link>

          {/* Tier 2 — Email / Phone */}
          <Link
            href="/checkin?event=devcon-2025-day1&tier=2"
            className="flex w-full items-center gap-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-4 transition hover:bg-zinc-800"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-2xl">
              📧
            </div>
            <div>
              <div className="font-semibold text-zinc-200">Tier 2 — Email / Phone</div>
              <div className="text-sm text-zinc-400">
                Privy-verified identity · standard privacy
              </div>
            </div>
          </Link>
        </div>

        {/* Vault link */}
        <Link
          href="/vault"
          className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-300"
        >
          View my credential vault →
        </Link>
      </main>
    </div>
  );
}
