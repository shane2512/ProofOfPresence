"use client";

// Screen 2 — Check In
// Tier 1 in World App:  MiniKit.commandsAsync.verify → POST /api/checkin
// Tier 1 in browser:    IDKit v4 IDKit.request() → connectorURI → pollUntilCompletion → POST /api/checkin
// Tier 2:               Privy email/phone login → keccak256(email) nullifier → POST /api/checkin

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { MiniKit, VerificationLevel, type MiniAppVerifyActionSuccessPayload } from "@worldcoin/minikit-js";
import { usePrivy } from "@privy-io/react-auth";
import { IDKit, orbLegacy } from "@worldcoin/idkit";
import { QRCodeSVG } from "qrcode.react";
import { keccak256, toBytes } from "viem";

// IDKit v4 pollUntilCompletion() always returns a wrapped { success, result } object
// result.responses[0].nullifier is the nullifier hash field
interface IDKitV4Result {
  protocol_version: string;
  nonce: string;
  action: string;
  environment: string;
  responses: Array<{
    identifier: string;
    signal_hash?: string;
    proof: string;
    merkle_root?: string;
    nullifier: string;
  }>;
}

const EVENT_LABELS: Record<string, string> = {
  "devcon-2025-day1": "Devcon 2025 — Day 1",
};

function CheckInContent() {
  const params = useSearchParams();
  const router = useRouter();
  const eventId = params.get("event") ?? "unknown-event";
  const tier = Number(params.get("tier") ?? "1");
  const eventLabel = EVENT_LABELS[eventId] ?? eventId;

  const { login, authenticated, user } = usePrivy();
  const [status, setStatus] = useState<"idle" | "signing" | "ready" | "verifying" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [connectUrl, setConnectUrl] = useState("");

  const appId = (process.env.NEXT_PUBLIC_WORLD_APP_ID ?? "app_ee1886c8f0481e50d3569c6f6ba31c34") as `app_${string}`;
  const rpId = process.env.NEXT_PUBLIC_RP_ID ?? "";

  // Redirect to processing once Privy auth succeeds (Tier 2)
  useEffect(() => {
    if (tier !== 2 || !authenticated || !user) return;
    const email = user.email?.address ?? user.phone?.number ?? "";
    if (!email) {
      setErrorMsg("No email or phone found on Privy account.");
      setStatus("error");
      return;
    }
    const nullifierHash = keccak256(toBytes(email));
    const expiresAt = Math.floor(Date.now() / 1000) + 300;

    setStatus("verifying");
    fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet_address: "0x0000000000000000000000000000000000000000",
        event_id: eventId,
        tier: 2,
        nullifier_hash: nullifierHash,
        merkle_root: "",
        proof: "",
        expires_at: expiresAt,
      }),
    })
      .then((r) => r.json())
      .then((data: { success: boolean; error?: string; nullifier_hash?: string }) => {
        if (data.success) {
          router.push(
            `/processing?event=${encodeURIComponent(eventId)}&tier=2&nullifier=${encodeURIComponent(nullifierHash)}`
          );
        } else {
          setErrorMsg(data.error ?? "Check-in failed");
          setStatus("error");
        }
      })
      .catch(() => {
        setErrorMsg("Network error — please retry");
        setStatus("error");
      });
  }, [authenticated, user, tier, eventId, router]);

  // IDKit v4 browser flow: fetch RP sig → IDKit.request() → show connectorURI → poll
  async function handleTier1Browser() {
    setStatus("signing");
    setErrorMsg("");
    try {
      // 1. Get RP signature from backend
      const rpSigRes = await fetch("/api/rp-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: `event_${eventId}` }),
      });
      const rpSig = (await rpSigRes.json()) as {
        sig: string;
        nonce: string;
        created_at: string;
        expires_at: string;
        error?: string;
      };
      if (rpSig.error) {
        setErrorMsg(rpSig.error);
        setStatus("error");
        return;
      }

      // 2. Create IDKit v4 request with environment: "staging" for simulator
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const idkitRequest = await (IDKit as any)
        .request({
          app_id: appId,
          action: `event_${eventId}`,
          rp_context: {
            rp_id: rpId,
            nonce: rpSig.nonce,
            created_at: rpSig.created_at,
            expires_at: rpSig.expires_at,
            signature: rpSig.sig,
          },
          allow_legacy_proofs: true,
          environment: "staging",
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .preset((orbLegacy as any)());

      // 3. Show connector URL — user pastes this into the simulator
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setConnectUrl((idkitRequest as any).connectorURI as string);
      setStatus("ready");

      // 4. Poll until user completes in simulator
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pollResponse = (await (idkitRequest as any).pollUntilCompletion()) as
        | { success: true; result: IDKitV4Result }
        | { success: false; error: string };

      if (!pollResponse.success) {
        throw new Error(`Verification ${(pollResponse as { success: false; error: string }).error}`);
      }
      const result = (pollResponse as { success: true; result: IDKitV4Result }).result;

      // 5. Submit to backend — v4 result uses responses[].nullifier
      setStatus("verifying");
      const resp0 = result.responses?.[0];
      const nullifier = resp0?.nullifier ?? "";
      const expiresAt = Math.floor(Date.now() / 1000) + 300;

      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: "0x0000000000000000000000000000000000000000",
          event_id: eventId,
          tier: 1,
          nullifier_hash: nullifier || `staging-${Date.now()}`,
          merkle_root: resp0?.merkle_root ?? "",
          proof: resp0?.proof ?? "",
          expires_at: expiresAt,
        }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        // Persist the full verified payload so the processing page can trigger
        // `cre workflow simulate` with the real proof fields.
        const checkinPayload = {
          wallet_address: "0x0000000000000000000000000000000000000000",
          event_id: eventId,
          tier: 1,
          nullifier_hash: nullifier || `staging-${Date.now()}`,
          merkle_root: resp0?.merkle_root ?? "",
          proof: resp0?.proof ?? "",
          expires_at: expiresAt,
        };
        try {
          sessionStorage.setItem("pop_checkin_payload", JSON.stringify(checkinPayload));
        } catch {
          // sessionStorage not available (SSR guard) — processing page will use URL params
        }
        router.push(
          `/processing?event=${encodeURIComponent(eventId)}&tier=1&nullifier=${encodeURIComponent(nullifier || `staging-${Date.now()}`)}`
        );
      } else {
        setErrorMsg(data.error ?? "Check-in failed");
        setStatus("error");
      }
    } catch (err) {
      setErrorMsg((err as Error).message || "Unexpected error — please retry");
      setStatus("error");
    }
  }

  async function handleTier1MiniKit() {
    setStatus("verifying");
    setErrorMsg("");
    try {
      const walletAddress =
        (MiniKit.user as { walletAddress?: string })?.walletAddress ??
        "0x0000000000000000000000000000000000000000";
      const expiresAt = Math.floor(Date.now() / 1000) + 300;

      const result = await MiniKit.commandsAsync.verify({
        action: `event_${eventId}`,
        signal: walletAddress,
        verification_level: VerificationLevel.Orb,
      });

      const rawPayload = result.finalPayload as { status: string; nullifier_hash?: string; merkle_root?: string; proof?: string };
      if (rawPayload.status === "error") {
        setErrorMsg("World ID verification was cancelled or failed.");
        setStatus("error");
        return;
      }
      const finalPayload = rawPayload as MiniAppVerifyActionSuccessPayload;

      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: walletAddress,
          event_id: eventId,
          tier: 1,
          nullifier_hash: finalPayload.nullifier_hash,
          merkle_root: finalPayload.merkle_root,
          proof: finalPayload.proof,
          expires_at: expiresAt,
        }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        router.push(
          `/processing?event=${encodeURIComponent(eventId)}&tier=1&nullifier=${encodeURIComponent(finalPayload.nullifier_hash)}`
        );
      } else {
        setErrorMsg(data.error ?? "Check-in failed");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Unexpected error — please retry");
      setStatus("error");
    }
  }

  const inWorldApp = typeof window !== "undefined" && MiniKit.isInstalled();
  const isLoading = status === "signing" || status === "verifying";

  return (
      <div className="dot-grid relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-6 py-12 font-sans text-white">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className={`absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px] ${
          tier === 1 ? "bg-emerald-500/10" : "bg-blue-500/10"
        }`} />
      </div>

      <main className="relative flex w-full max-w-sm flex-col items-center gap-8">
        {/* Back + header */}
        <div className="flex w-full flex-col items-center gap-3 text-center">
          <a href="/" className="self-start text-xs text-zinc-600 transition hover:text-zinc-400">
            ← Back
          </a>
          <div className={`flex h-14 w-14 items-center justify-center rounded-full text-3xl ring-1 ${
            tier === 1 ? "bg-emerald-500/20 ring-emerald-500/30" : "bg-blue-500/20 ring-blue-500/30"
          }`}>
            {tier === 1 ? "🌐" : "📧"}
          </div>
          <div>
            <h1 className="text-xl font-bold">Check In</h1>
            <p className="text-sm text-zinc-400">{eventLabel}</p>
          </div>
          <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ring-1 ${
            tier === 1
              ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30"
              : "bg-zinc-800 text-zinc-300 ring-zinc-700"
          }`}>
            {tier === 1 ? "Tier 1 — World ID Orb" : "Tier 2 — Email / Phone"}
          </span>
        </div>

        {status === "error" && (
          <div className="flex w-full items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            <span className="shrink-0">⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {tier === 1 ? (
          inWorldApp ? (
            // Inside World App — use MiniKit
            <button
              onClick={handleTier1MiniKit}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-6 py-4 font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50"
            >
              {isLoading
                ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                : <span className="text-lg">🌐</span>
              }
              {isLoading ? "Verifying…" : "Verify with World ID"}
            </button>
          ) : status === "ready" ? (
            // Show QR code + numbered steps for simulator flow
            <div className="flex w-full flex-col items-center gap-4">
              {/* Numbered instruction steps */}
              <div className="flex w-full flex-col gap-2">
                {[
                  { n: "1", text: "Open the World ID Simulator" },
                  { n: "2", text: 'Tap \u201cPaste Code\u201d and paste the URL below' },
                  { n: "3", text: "Approve the request in the simulator" },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-center gap-3 text-sm text-zinc-400">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-emerald-400 ring-1 ring-zinc-700">{n}</span>
                    {text}
                  </div>
                ))}
              </div>

              {/* QR code */}
              {connectUrl && (
                <div className="rounded-2xl border border-emerald-500/20 bg-white p-4 shadow-2xl shadow-emerald-500/10">
                  <QRCodeSVG value={connectUrl} size={192} />
                </div>
              )}

              {/* Copyable URL */}
              <div className="flex w-full items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 p-3">
                <code className="flex-1 overflow-hidden text-ellipsis text-xs text-zinc-300 whitespace-nowrap">
                  {connectUrl}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(connectUrl)}
                  className="shrink-0 rounded-lg bg-zinc-700 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-600"
                >
                  Copy
                </button>
              </div>

              {/* Open simulator link */}
              <a
                href="https://simulator.worldcoin.org"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-center text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/20"
              >
                Open World ID Simulator ↗
              </a>

              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
                Waiting for simulator proof…
              </div>
            </div>
          ) : (
            // Browser — start IDKit v4 flow
            <button
              onClick={handleTier1Browser}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-6 py-4 font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50"
            >
              {isLoading
                ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                : <span className="text-lg">🌐</span>
              }
              {status === "signing" ? "Preparing…" : status === "verifying" ? "Verifying…" : "Verify with World ID"}
            </button>
          )
        ) : (
          <button
            onClick={login}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 font-semibold text-black shadow-lg shadow-white/10 transition hover:bg-zinc-100 disabled:opacity-50"
          >
            {isLoading
              ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
              : <span className="text-lg">📧</span>
            }
            {isLoading ? "Processing…" : "Continue with Email / Phone"}
          </button>
        )}

        <p className="text-center text-xs text-zinc-600">
          Your identity is never stored on-chain.
          <br />
          Only an anonymous nullifier hash is recorded.
        </p>
      </main>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense>
      <CheckInContent />
    </Suspense>
  );
}
