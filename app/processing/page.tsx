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
  const calledRef = useRef(false);

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-12 font-sans text-white">
      <main className="flex w-full max-w-sm flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-5xl">{timedOut ? "⚠️" : "⏳"}</div>
          <h1 className="text-xl font-bold">{timedOut ? "Timed Out" : "Processing…"}</h1>
          <p className="text-sm text-zinc-400">
            {timedOut
              ? "The request took too long. Please retry."
              : "Running CRE workflow — this takes 30–90 s"}
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

        {/* CRE debug log — only visible when present */}
        {creLog && (
          <details className="w-full">
            <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-400">
              CRE output log
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-400 whitespace-pre-wrap">
              {creLog}
            </pre>
          </details>
        )}

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
