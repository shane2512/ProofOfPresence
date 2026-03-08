// Landing Page — Proof of Presence
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Shield, Lock, Globe, Zap, ExternalLink, Menu, X } from "lucide-react";

const WORDS = ["there", "present", "verified", "real"];

const STEPS = [
  {
    numeral: "I",
    title: "Verify with World ID",
    description:
      "Scan the venue QR inside World App. World ID generates a ZK proof on your device — proving you're a unique human without sharing any personal data.",
    code: `// World ID — client-side ZK proof
const { status } = await MiniKit.commandsAsync.verify({
  action: "event_" + eventId,
  verification_level: VerificationLevel.Orb,
  signal: walletAddress,
});
// ✓ Zero personal data leaves your device`,
    badge: "ZK Proof",
    color: "emerald",
  },
  {
    numeral: "II",
    title: "CRE Securely Records",
    description:
      "Chainlink CRE verifies the ZK proof inside a Confidential Computing enclave and calls recordAttendance() — writing a nullifier hash, never a wallet address.",
    code: `// Chainlink CRE — secure enclave
// confidential_inputs: proof, nullifier_hash
// public_output: verified (bool only)

proofOfPresence.recordAttendance(
  nullifierHash, // ← NOT wallet address
  eventId,
  tier,          // 1=Orb, 2=Email
)`,
    badge: "Chainlink CRE",
    color: "blue",
  },
  {
    numeral: "III",
    title: "Credential Bridged Cross-Chain",
    description:
      "Your attendance is auto-bridged to Base Sepolia and Optimism Sepolia via Chainlink CCIP. One credential that lives on every chain, privately.",
    code: `// Chainlink CCIP cross-chain bridge
const payload = abi.encode(
  nullifierHash, // ZK identifier
  eventId,       // event slug
  timestamp,     // block.timestamp
  tier,          // badge level
);
// → Base Sepolia + Optimism Sepolia`,
    badge: "Chainlink CCIP",
    color: "purple",
  },
];

const FEATURES = [
  {
    num: "01",
    title: "ZK Privacy",
    description:
      "No wallet address is ever stored on-chain. Only a nullifier hash — a ZK identifier that can't be reverse-engineered or linked to your identity.",
    icon: Shield,
    color: "emerald",
  },
  {
    num: "02",
    title: "Chainlink CRE",
    description:
      "World ID proofs are verified inside a Confidential Computing enclave. Even Chainlink node operators can't see your sensitive proof data.",
    icon: Lock,
    color: "blue",
  },
  {
    num: "03",
    title: "CCIP Cross-Chain",
    description:
      "Attendance records are automatically bridged to Base Sepolia and Optimism via Chainlink CCIP. Same credential, every chain.",
    icon: Globe,
    color: "purple",
  },
  {
    num: "04",
    title: "Bot-Proof",
    description:
      "World ID Orb biometric verification proves unique humanity. One human, one credential per event. No farming bots, ever.",
    icon: Zap,
    color: "yellow",
  },
];

const CONTRACT = "0x424F855FcFBCF5544bcfCC1bEF3c60D52632d676";
const GITHUB = "https://github.com/shane2512/ProofOfPresence";

const colorMap: Record<
  string,
  { border: string; bg: string; text: string; glow: string }
> = {
  emerald: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    glow: "shadow-emerald-500/20",
  },
  blue: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    glow: "shadow-blue-500/20",
  },
  purple: {
    border: "border-purple-500/30",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    glow: "shadow-purple-500/20",
  },
  yellow: {
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    glow: "shadow-yellow-500/20",
  },
};

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [wordVisible, setWordVisible] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordVisible(false);
      setTimeout(() => {
        setWordIndex((i) => (i + 1) % WORDS.length);
        setWordVisible(true);
      }, 250);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((s) => (s + 1) % STEPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dot-grid min-h-screen bg-black text-white font-sans overflow-x-hidden">
      {/* ── NAVIGATION ── */}
      <nav
        className={`fixed top-3 left-3 right-3 z-50 transition-all duration-500 rounded-2xl ${
          scrolled
            ? "bg-black/85 backdrop-blur-xl border border-zinc-800/80 shadow-xl shadow-black/40"
            : "bg-transparent border border-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2 font-bold text-base text-white">
            <span className="text-emerald-400 text-lg">✦</span>
            <span className="hidden sm:inline">Proof of Presence</span>
            <span className="sm:hidden">PoP</span>
          </a>

          <div className="hidden md:flex items-center gap-7 text-sm text-zinc-400">
            <a href="#how-it-works" className="hover:text-white transition-colors duration-150">How it works</a>
            <a href="#features" className="hover:text-white transition-colors duration-150">Features</a>
            <a href="#tech-stack" className="hover:text-white transition-colors duration-150">Tech Stack</a>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/vault"
              className="hidden md:block text-sm text-zinc-400 hover:text-white transition-colors duration-150 px-3 py-1.5"
            >
              View Vault
            </Link>
            <Link
              href="/checkin?event=devcon-2025-day1&tier=1"
              className="text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-full transition-all duration-200 flex items-center gap-1.5"
            >
              Check In
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              className="md:hidden ml-1 p-1.5 text-zinc-400 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-800/80 px-5 py-4 flex flex-col gap-2 text-sm">
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-zinc-300 hover:text-white py-1.5">How it works</a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-zinc-300 hover:text-white py-1.5">Features</a>
            <a href="#tech-stack" onClick={() => setMobileMenuOpen(false)} className="text-zinc-300 hover:text-white py-1.5">Tech Stack</a>
            <Link href="/vault" onClick={() => setMobileMenuOpen(false)} className="text-zinc-300 hover:text-white py-1.5">View Vault</Link>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-28 pb-20 px-6">
        {/* Grid lines */}
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="absolute inset-x-0 top-1/4 h-px bg-gradient-to-r from-transparent via-zinc-800/60 to-transparent" />
          <div className="absolute inset-x-0 top-2/4 h-px bg-gradient-to-r from-transparent via-zinc-800/60 to-transparent" />
          <div className="absolute inset-x-0 top-3/4 h-px bg-gradient-to-r from-transparent via-zinc-800/60 to-transparent" />
          <div className="absolute inset-y-0 left-1/4 w-px bg-gradient-to-b from-transparent via-zinc-800/60 to-transparent" />
          <div className="absolute inset-y-0 left-2/4 w-px bg-gradient-to-b from-transparent via-zinc-800/60 to-transparent" />
          <div className="absolute inset-y-0 left-3/4 w-px bg-gradient-to-b from-transparent via-zinc-800/60 to-transparent" />
        </div>

        {/* Ambient glow orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[160px]" />
          <div className="absolute right-1/4 bottom-1/3 h-72 w-72 rounded-full bg-cyan-500/8 blur-[120px]" />
          <div className="absolute left-1/4 top-1/3 h-56 w-56 rounded-full bg-violet-500/8 blur-[100px]" />
        </div>

        <div className="relative text-center max-w-5xl mx-auto">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-400 mb-10 tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live on Sepolia · Chainlink CRE · World ID
          </div>

          {/* Headline */}
          <h1 className="text-[clamp(2.8rem,10vw,7rem)] font-bold leading-none tracking-tighter mb-6">
            The proof that
            <br />
            <span className="text-zinc-400">you were </span>
            <span
              className={`text-emerald-400 inline-block transition-all duration-300 ${
                wordVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
              }`}
            >
              {WORDS[wordIndex]}
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Bot-proof, privacy-preserving event credentials. Verified by{" "}
            <span className="text-zinc-300">World ID ZK proofs</span> and
            recorded on-chain by{" "}
            <span className="text-zinc-300">Chainlink CRE</span>.{" "}
            No wallet exposure. No tracking. No bots.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <Link
              href="/checkin?event=devcon-2025-day1&tier=1"
              className="group w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-8 py-3.5 rounded-full text-base transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
            >
              Verify with World ID
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/checkin?event=devcon-2025-day1&tier=2"
              className="w-full sm:w-auto flex items-center justify-center gap-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white px-8 py-3.5 rounded-full text-base transition-all duration-200"
            >
              Verify with Email
            </Link>
            <Link
              href="/vault"
              className="w-full sm:w-auto flex items-center justify-center gap-2 text-zinc-500 hover:text-zinc-300 px-6 py-3.5 rounded-full text-base transition-colors duration-200"
            >
              View Vault →
            </Link>
          </div>

          {/* Tech badges */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { label: "World ID", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
              { label: "Chainlink CRE", cls: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
              { label: "CCIP Bridge", cls: "border-purple-500/30 bg-purple-500/10 text-purple-400" },
              { label: "Sepolia", cls: "border-zinc-700 bg-zinc-900 text-zinc-400" },
              { label: "Base Sepolia", cls: "border-zinc-700 bg-zinc-900 text-zinc-400" },
              { label: "Optimism", cls: "border-red-500/30 bg-red-500/10 text-red-400" },
            ].map((b) => (
              <span key={b.label} className={`rounded-full border px-3 py-0.5 text-xs font-medium ${b.cls}`}>
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="relative py-24 px-6 border-t border-zinc-900">
        <div className="absolute inset-0 bg-emerald-950/20 pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

        <div className="relative max-w-6xl mx-auto">
          <div className="mb-14">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500 mb-3">How it works</div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Three steps to a
              <br />
              <span className="text-emerald-400">verified credential</span>
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* Step list */}
            <div className="flex flex-col gap-3">
              {STEPS.map((step, i) => {
                const c = colorMap[step.color];
                const isActive = activeStep === i;
                return (
                  <button
                    key={step.numeral}
                    onClick={() => setActiveStep(i)}
                    className={`text-left rounded-2xl border p-5 transition-all duration-300 ${
                      isActive
                        ? `${c.border} ${c.bg} shadow-lg ${c.glow}`
                        : "border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <span className={`text-xs font-mono font-semibold mt-0.5 shrink-0 ${isActive ? c.text : "text-zinc-600"}`}>
                        {step.numeral}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold mb-1 ${isActive ? "text-white" : "text-zinc-400"}`}>
                          {step.title}
                        </div>
                        {isActive && (
                          <p className="text-sm text-zinc-400 leading-relaxed">{step.description}</p>
                        )}
                      </div>
                      <span className={`text-xs rounded-full border px-2.5 py-0.5 font-medium shrink-0 ${isActive ? `${c.border} ${c.bg} ${c.text}` : "border-zinc-800 text-zinc-600"}`}>
                        {step.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Code panel */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/60">
                <div className="h-3 w-3 rounded-full bg-zinc-700" />
                <div className="h-3 w-3 rounded-full bg-zinc-700" />
                <div className="h-3 w-3 rounded-full bg-zinc-700" />
                <span className="ml-2 text-xs text-zinc-500 font-mono">
                  {STEPS[activeStep].badge.toLowerCase().replace(/\s/g, "-")}.ts
                </span>
              </div>
              <pre className="p-5 text-xs leading-relaxed text-zinc-400 font-mono overflow-x-auto whitespace-pre min-h-[160px]">
                <code>{STEPS[activeStep].code}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="relative py-24 px-6 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto">
          <div className="mb-14">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-3">Built different</div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              What makes PoP
              <br />
              <span className="text-zinc-400">different from POAP</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {FEATURES.map((f) => {
              const c = colorMap[f.color];
              const Icon = f.icon;
              return (
                <div
                  key={f.num}
                  className="group rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7 hover:border-zinc-700 hover:bg-zinc-900/60 transition-all duration-300"
                >
                  <div className="flex items-start gap-5">
                    <span className="text-xl font-mono font-bold text-zinc-700 shrink-0">{f.num}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-xl ${c.bg} ${c.border} border`}>
                          <Icon className={`w-4 h-4 ${c.text}`} />
                        </div>
                        <h3 className="font-semibold text-white">{f.title}</h3>
                      </div>
                      <p className="text-sm text-zinc-400 leading-relaxed">{f.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── TECH STACK ── */}
      <section id="tech-stack" className="relative py-20 px-6 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-3">Infrastructure</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Best-in-class Web3 stack</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: "World ID",       sub: "ZK Identity",           cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",  sub_cls: "text-emerald-600" },
              { name: "Chainlink CRE", sub: "Confidential Compute",  cls: "border-blue-500/30 bg-blue-500/10 text-blue-300",           sub_cls: "text-blue-600" },
              { name: "CCIP",          sub: "Cross-Chain Bridge",    cls: "border-purple-500/30 bg-purple-500/10 text-purple-300",      sub_cls: "text-purple-600" },
              { name: "Sepolia",       sub: "Primary Chain",         cls: "border-zinc-700 bg-zinc-900 text-zinc-300",                  sub_cls: "text-zinc-600" },
              { name: "Base",          sub: "CCIP Destination",      cls: "border-blue-400/30 bg-blue-400/10 text-blue-200",           sub_cls: "text-blue-700" },
              { name: "Optimism",      sub: "CCIP Destination",      cls: "border-red-500/30 bg-red-500/10 text-red-300",              sub_cls: "text-red-600" },
            ].map((t) => (
              <div
                key={t.name}
                className={`rounded-2xl border ${t.cls} p-5 flex flex-col gap-1.5 transition-all duration-200 hover:scale-[1.03]`}
              >
                <span className="font-semibold text-sm">{t.name}</span>
                <span className={`text-xs ${t.sub_cls}`}>{t.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-28 px-6 border-t border-zinc-900 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/12 blur-[120px]" />
        </div>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500 mb-6">Ready to check in?</div>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Prove you were there.
            <br />
            <span className="text-emerald-400">Privately.</span>
          </h2>
          <p className="text-lg text-zinc-400 mb-10 max-w-xl mx-auto leading-relaxed">
            Verify with World ID, and receive a bot-proof attendance
            credential bridged across chains — with zero personal data exposed.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/checkin?event=devcon-2025-day1&tier=1"
              className="group w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-10 py-4 rounded-full text-base transition-all duration-200 shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40"
            >
              Check In with World ID
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/vault"
              className="w-full sm:w-auto flex items-center justify-center border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white px-10 py-4 rounded-full text-base transition-all duration-200"
            >
              View My Vault
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative py-14 px-6 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold text-white">
                <span className="text-emerald-400">✦</span>
                Proof of Presence
              </div>
              <p className="text-xs text-zinc-600 max-w-xs leading-relaxed">
                Bot-proof, privacy-preserving event credentials.
                <br />
                Built with World ID + Chainlink CRE + CCIP.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-10 gap-y-3 text-sm">
              <a href="#how-it-works" className="text-zinc-500 hover:text-zinc-300 transition-colors">How it works</a>
              <Link href="/checkin?event=devcon-2025-day1&tier=1" className="text-zinc-500 hover:text-zinc-300 transition-colors">Check In</Link>
              <Link href="/vault" className="text-zinc-500 hover:text-zinc-300 transition-colors">Vault</Link>
              <a
                href={GITHUB}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
              >
                GitHub <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-zinc-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs text-zinc-600">
              Contract:{" "}
              <a
                href={`https://sepolia.etherscan.io/address/${CONTRACT}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:text-zinc-400 transition-colors"
              >
                {CONTRACT}
              </a>
            </div>
            <div className="text-xs text-zinc-700">
              Hackathon · Chainlink CRE Privacy + World Mini App tracks
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

