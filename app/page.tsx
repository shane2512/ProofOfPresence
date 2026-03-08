// Screen 1 — Home / Pre-registration
import Link from "next/link";

export default function Home() {
  return (
    <div className="dot-grid relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-6 py-12 font-sans text-white">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/15 blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full bg-cyan-500/10 blur-[80px]" />
        <div className="absolute left-1/4 bottom-1/3 h-48 w-48 rounded-full bg-violet-500/8 blur-[60px]" />
      </div>

      <main className="relative flex w-full max-w-sm flex-col items-center gap-10">
        {/* Logo / badge */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="absolute h-20 w-20 animate-ping rounded-full bg-emerald-500/20 [animation-duration:3s]" />
            <div className="absolute h-20 w-20 rounded-full bg-emerald-500/10" />
            <div className="float relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-4xl shadow-xl shadow-emerald-500/30">
              ✦
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight">Proof of Presence</h1>
            <p className="text-center text-sm text-zinc-400">
              Bot-proof, privacy-preserving event attendance
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">World ID</span>
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400">Chainlink CRE</span>
            <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-400">CCIP</span>
          </div>
        </div>

        {/* Tier selection */}
        <div className="flex w-full flex-col gap-3">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Choose verification method
          </p>

          {/* Tier 1 — World ID Orb */}
          <Link
            href="/checkin?event=devcon-2025-day1&tier=1"
            className="group flex w-full items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 transition-all duration-200 hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/10"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-2xl ring-1 ring-emerald-500/30">
              🌐
            </div>
            <div className="flex-1">
              <div className="font-semibold text-emerald-300">Tier 1 — World ID Orb</div>
              <div className="text-sm text-zinc-400">Full ZK proof · highest privacy</div>
            </div>
            <span className="text-zinc-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-emerald-400">→</span>
          </Link>

          {/* Tier 2 — Email / Phone */}
          <Link
            href="/checkin?event=devcon-2025-day1&tier=2"
            className="group flex w-full items-center gap-4 rounded-2xl border border-zinc-700/60 bg-zinc-900 p-4 transition-all duration-200 hover:border-zinc-600 hover:bg-zinc-800"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-2xl ring-1 ring-zinc-700">
              📧
            </div>
            <div className="flex-1">
              <div className="font-semibold text-zinc-200">Tier 2 — Email / Phone</div>
              <div className="text-sm text-zinc-400">Privy-verified identity · standard privacy</div>
            </div>
            <span className="text-zinc-600 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-zinc-300">→</span>
          </Link>
        </div>

        {/* Divider */}
        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-xs text-zinc-600">already checked in?</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        {/* Vault link */}
        <Link
          href="/vault"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700/60 bg-zinc-900/70 px-4 py-3 text-sm font-medium text-zinc-300 backdrop-blur-sm transition-all duration-200 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
        >
          🗂️ View my credential vault
        </Link>

        {/* Tech stack footer */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          {["World ID", "Chainlink CRE", "CCIP", "ERC-721 SBT", "Sepolia"].map((t) => (
            <span key={t} className="text-[10px] text-zinc-700">{t}</span>
          ))}
        </div>
      </main>
    </div>
  );
}
