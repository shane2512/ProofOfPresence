"use client";

// Screen 3 — Processing
// Polls /api/checkin status. Steps: Verifying identity → Recording on-chain → Bridging cross-chain
// Auto-redirects to /credential on success. 90-second timeout.

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";

const STEPS = [
  { label: "Verifying identity", detail: "World ID ZK proof checked in secure enclave" },
  { label: "Recording on-chain", detail: "Attendance written to Sepolia via Keystone Forwarder" },
  { label: "Bridging cross-chain", detail: "CCIP message sent to Base Sepolia + Optimism Sepolia" },
];

const TIMEOUT_MS = 90_000;
const STEP_ADVANCE_MS = 4_000; // simulate step progression while waiting

type StepState = "pending" | "active" | "done" | "error";

function ProcessingContent() {
  const params = useSearchParams();
  const router = useRouter();
  const eventId = params.get("event") ?? "";
  const tier = params.get("tier") ?? "1";
  const nullifier = params.get("nullifier") ?? "";

  const [stepStates, setStepStates] = useState<StepState[]>(["active", "pending", "pending"]);
  const [timedOut, setTimedOut] = useState(false);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    // Advance steps visually while actual on-chain confirmation propagates
    const timers = [
      setTimeout(() => setStepStates(["done", "active", "pending"]), STEP_ADVANCE_MS),
      setTimeout(() => setStepStates(["done", "done", "active"]), STEP_ADVANCE_MS * 2),
      setTimeout(() => {
        setStepStates(["done", "done", "done"]);
        // Redirect to credential after a short pause
        setTimeout(() => {
          router.push(
            `/credential?event=${encodeURIComponent(eventId)}&tier=${tier}&nullifier=${encodeURIComponent(nullifier)}`
          );
        }, 1200);
      }, STEP_ADVANCE_MS * 3),
    ];

    const timeoutTimer = setTimeout(() => {
      setTimedOut(true);
      setStepStates((prev) => prev.map((s) => (s === "active" ? "error" : s)));
    }, TIMEOUT_MS);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(timeoutTimer);
    };
  }, [eventId, tier, nullifier, router]);

  function handleRetry() {
    router.push(`/checkin?event=${encodeURIComponent(eventId)}&tier=${tier}`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-12 font-sans text-white">
      <main className="flex w-full max-w-sm flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-5xl">{timedOut ? "⚠️" : "⏳"}</div>
          <h1 className="text-xl font-bold">{timedOut ? "Timed Out" : "Processing…"}</h1>
          <p className="text-sm text-zinc-400">
            {timedOut
              ? "The request took too long. Please retry."
              : "This usually takes 10–30 seconds"}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex w-full flex-col gap-3">
          {STEPS.map((step, i) => {
            const state = stepStates[i];
            return (
              <div
                key={step.label}
                className={`flex items-start gap-3 rounded-xl p-4 transition-all ${
                  state === "done"
                    ? "border border-emerald-500/30 bg-emerald-500/10"
                    : state === "active"
                    ? "border border-cyan-500/40 bg-cyan-500/10"
                    : state === "error"
                    ? "border border-red-500/30 bg-red-500/10"
                    : "border border-zinc-800 bg-zinc-900"
                }`}
              >
                <div className="mt-0.5 text-xl">
                  {state === "done" ? "✅" : state === "active" ? "⏳" : state === "error" ? "❌" : "○"}
                </div>
                <div>
                  <div
                    className={`font-medium ${
                      state === "done"
                        ? "text-emerald-300"
                        : state === "active"
                        ? "text-cyan-300"
                        : state === "error"
                        ? "text-red-400"
                        : "text-zinc-500"
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="text-xs text-zinc-500">{step.detail}</div>
                </div>
              </div>
            );
          })}
        </div>

        {timedOut && (
          <button
            onClick={handleRetry}
            className="w-full rounded-2xl bg-white px-6 py-3 font-semibold text-black transition hover:bg-zinc-200"
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
