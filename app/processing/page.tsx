"use client";

// Screen 3 — Processing
// 1. Reads the verified checkin payload from sessionStorage (saved by checkin page).
// 2. Calls POST /api/cre-simulate which spawns `cre workflow simulate --broadcast`.
// 3. Advances step indicators as CRE progresses; passes real txHash to /credential.

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";

const STEPS = [
  { label: "Verifying identity", detail: "World ID ZK proof checked in CRE secure enclave" },
  { label: "Recording on-chain", detail: "Attendance written to Sepolia via Keystone Forwarder" },
  { label: "Bridging cross-chain", detail: "CCIP message sent to Base Sepolia + Optimism Sepolia" },
];

const TIMEOUT_MS = 120_000;

type StepState = "pending" | "active" | "done" | "error";

interface CREPayload {
  wallet_address: string;
  event_id: string;
  tier: number;
  nullifier_hash: string;
  merkle_root: string;
  proof: string;
  expires_at: number;
}

function ProcessingContent() {
  const params = useSearchParams();
  const router = useRouter();
  const eventId = params.get("event") ?? "";
  const tier = params.get("tier") ?? "1";
  const nullifier = params.get("nullifier") ?? "";

  const [stepStates, setStepStates] = useState<StepState[]>(["active", "pending", "pending"]);
  const [timedOut, setTimedOut] = useState(false);
  const [creLog, setCreLog] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const calledRef = useRef(false);

  // Elapsed counter — ticks every second while CRE is running
  useEffect(() => {
    if (timedOut) return;
    const t = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [timedOut]);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    // Read the full verified payload saved by the checkin page
    let payload: CREPayload | null = null;
    try {
      const raw = sessionStorage.getItem("pop_checkin_payload");
      if (raw) payload = JSON.parse(raw) as CREPayload;
    } catch {
      // SSR or storage unavailable
    }

    // Fallback if sessionStorage was cleared (e.g. page refresh)
    if (!payload) {
      payload = {
        wallet_address: "0x0000000000000000000000000000000000000000",
        event_id: eventId,
        tier: Number(tier),
        nullifier_hash: nullifier,
        merkle_root: "",
        proof: "",
        expires_at: Math.floor(Date.now() / 1000) + 300,
      };
    }

    const finalPayload = payload;

    // Timeout guard — caps the wait at TIMEOUT_MS
    const timeoutTimer = setTimeout(() => {
      setTimedOut(true);
      setStepStates((prev) => prev.map((s) => (s === "active" ? "error" : s)));
    }, TIMEOUT_MS);

    // Advance step 1 → step 2 after a short delay (CRE enclave verify takes ~5 s)
    const step2Timer = setTimeout(() => {
      setStepStates(["done", "active", "pending"]);
    }, 6_000);

    // POST to /api/cre-simulate — blocks until `cre workflow simulate` finishes
    fetch("/api/cre-simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalPayload),
    })
      .then((r) => r.json())
      .then((data: { success: boolean; txHash?: string; error?: string; output?: string }) => {
        clearTimeout(timeoutTimer);
        clearTimeout(step2Timer);

        if (data.output) setCreLog(data.output.slice(-800));

        if (data.success) {
          setStepStates(["done", "done", "active"]);
          setTimeout(() => {
            setStepStates(["done", "done", "done"]);
            try {
              sessionStorage.removeItem("pop_checkin_payload");
              // Persist full CRE log for the credential page to display
              sessionStorage.setItem("pop_cre_log", JSON.stringify({
                success: true,
                txHash: data.txHash ?? "",
                output: data.output ?? "",
              }));
            } catch { /* ok */ }
            setTimeout(() => {
              const txParam = data.txHash ? `&txHash=${encodeURIComponent(data.txHash)}` : "";
              router.push(
                `/credential?event=${encodeURIComponent(eventId)}&tier=${tier}&nullifier=${encodeURIComponent(nullifier)}${txParam}`
              );
            }, 1_200);
          }, 3_000);
        } else {
          // Save failed log so credential page can show what went wrong
          try {
            sessionStorage.setItem("pop_cre_log", JSON.stringify({
              success: false,
              txHash: "",
              output: data.output ?? data.error ?? "CRE simulation failed",
            }));
          } catch { /* ok */ }
          setStepStates((prev) => prev.map((s) => (s === "active" ? "error" : s)));
          setTimedOut(true);
        }
      })
      .catch(() => {
        clearTimeout(timeoutTimer);
        clearTimeout(step2Timer);
        setTimedOut(true);
        setStepStates((prev) => prev.map((s) => (s === "active" ? "error" : s)));
      });

    return () => {
      clearTimeout(timeoutTimer);
      clearTimeout(step2Timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRetry() {
    router.push(`/checkin?event=${encodeURIComponent(eventId)}&tier=${tier}`);
  }

  return (
      <div className="dot-grid relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-6 py-12 font-sans text-white">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className={`absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px] transition-colors duration-1000 ${
          timedOut ? "bg-red-500/10" : "bg-cyan-500/10"
        }`} />
      </div>

      <main className="relative flex w-full max-w-sm flex-col items-center gap-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          {timedOut ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-4xl ring-1 ring-red-500/30">
              ⚠️
            </div>
          ) : (
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute h-16 w-16 animate-ping rounded-full bg-cyan-500/25 [animation-duration:2s]" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/20 text-3xl ring-1 ring-cyan-500/30">
                ⏳
              </div>
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{timedOut ? "Timed Out" : "Processing…"}</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {timedOut
                ? "The request took too long. Please retry."
                : `CRE workflow running \u2014 ${elapsed}s elapsed`}
            </p>
          </div>
        </div>

        {/* Step indicators with vertical connector lines */}
        <div className="flex w-full flex-col">
          {STEPS.map((step, i) => {
            const state = stepStates[i];
            return (
              <div key={step.label} className="flex gap-3">
                {/* Left: icon + connector line */}
                <div className="flex flex-col items-center">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-500 ${
                    state === "done"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/30"
                      : state === "active"
                      ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/30"
                      : state === "error"
                      ? "bg-red-500 text-white"
                      : "bg-zinc-800 text-zinc-500"
                  }`}>
                    {state === "done"
                      ? "✓"
                      : state === "active"
                      ? <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />
                      : state === "error"
                      ? "✕"
                      : i + 1}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`mt-1 w-0.5 min-h-4 flex-1 transition-colors duration-700 ${
                      state === "done" ? "bg-emerald-500/40" : "bg-zinc-800"
                    }`} />
                  )}
                </div>
                {/* Right: card content */}
                <div className={`mb-3 flex-1 rounded-xl px-4 py-3 transition-all duration-500 ${
                  state === "done"
                    ? "border border-emerald-500/30 bg-emerald-500/10"
                    : state === "active"
                    ? "border border-cyan-500/40 bg-cyan-500/10 shadow-sm shadow-cyan-500/10"
                    : state === "error"
                    ? "border border-red-500/30 bg-red-500/10"
                    : "border border-zinc-800/60 bg-zinc-900/50"
                }`}>
                  <div className={`text-sm font-medium ${
                    state === "done" ? "text-emerald-300"
                    : state === "active" ? "text-cyan-300"
                    : state === "error" ? "text-red-400"
                    : "text-zinc-600"
                  }`}>
                    {step.label}
                  </div>
                  <div className="truncate text-xs text-zinc-600">{step.detail}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CRE debug log */}
        {creLog && (
          <details className="w-full">
            <summary className="cursor-pointer select-none text-xs text-zinc-600 hover:text-zinc-400">
              CRE output log ▸
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400 whitespace-pre-wrap">
              {creLog}
            </pre>
          </details>
        )}

        {timedOut && (
          <button
            onClick={handleRetry}
            className="w-full rounded-2xl bg-white px-6 py-3 font-semibold text-black shadow-lg shadow-white/10 transition hover:bg-zinc-100"
          >
            Retry Check-In
          </button>
        )}
      </main>
    </div>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense>
      <ProcessingContent />
    </Suspense>
  );
}
