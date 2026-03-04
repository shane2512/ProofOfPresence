/**
 * Proof of Presence â€” CRE Workflow  (TypeScript SDK v1.0.9)
 *
 * Flow:
 *  1. HTTP Trigger  â€” frontend POSTs { wallet_address, event_id, tier,
 *                     nullifier_hash, merkle_root, proof, expires_at }
 *  2. Validate expiry â€” reject if QR code is older than 5 minutes.
 *  3. World ID verify â€” ConfidentialHTTPClient inside CRE enclave.
 *                       nullifier_hash, merkle_root, proof, wallet_address
 *                       and any API credentials NEVER leave the enclave.
 *                       Only the boolean `verified` field is returned.
 *  4. On-chain write  â€” runtime.report() + EVMClient.writeReport() â†’
 *                       Keystone Forwarder â†’ ProofOfPresence.onReport()
 *                       Records (nullifierHash, eventId, tier) on Sepolia.
 *  5. Response        â€” returns { success, nullifier_hash, event_id, tier, txHash }
 *
 * Privacy guarantees (per design spec):
 *  - wallet_address is used only as the ZK signal â€” never stored on-chain.
 *  - nullifier_hash is the only on-chain identifier (anonymous by design).
 *  - CCIP bridge payload: (nullifierHash, eventId, timestamp, tier) â€” no wallet.
 */

import {
  HTTPCapability,
  ConfidentialHTTPClient,
  EVMClient,
  handler,
  Runner,
  getNetwork,
  prepareReportRequest,
  hexToBase64,
  bytesToHex,
  TxStatus,
  decodeJson,
  type Runtime,
  type HTTPPayload,
} from "@chainlink/cre-sdk";
import {
  encodeAbiParameters,
  parseAbiParameters,
  type Address,
} from "viem";
import type { Config, TriggerPayload, WorldIDVerifyResponse } from "./types/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum age of a QR-code proof: 5 minutes in milliseconds. */
const QR_TTL_MS = 5 * 60 * 1000;

/**
 * Chain selector name for Ethereum Sepolia.
 * Must match the chain-name defined in project.yaml rpcs section.
 */
const SEPOLIA_CHAIN_SELECTOR_NAME = "ethereum-testnet-sepolia";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse and validate the raw HTTP body into our typed payload. */
function parseTriggerPayload(raw: unknown): TriggerPayload {
  const p = raw as Record<string, unknown>;
  if (
    typeof p.wallet_address !== "string" ||
    typeof p.event_id !== "string" ||
    typeof p.nullifier_hash !== "string" ||
    typeof p.expires_at !== "number"
  ) {
    throw new Error("PoP: malformed trigger payload â€” missing required fields");
  }
  return {
    wallet_address: p.wallet_address,
    event_id: p.event_id,
    tier: typeof p.tier === "number" ? p.tier : 1,
    nullifier_hash: p.nullifier_hash,
    merkle_root: typeof p.merkle_root === "string" ? p.merkle_root : "",
    proof: typeof p.proof === "string" ? p.proof : "",
    expires_at: p.expires_at,
  };
}

/**
 * Convert nullifier_hash to a 0x-prefixed 64-char hex bytes32 value.
 * World ID nullifiers may arrive as decimal strings or 0x-hex strings.
 */
function toBytes32Hex(nullifierHash: string): `0x${string}` {
  if (/^0x[0-9a-fA-F]{64}$/.test(nullifierHash)) {
    return nullifierHash as `0x${string}`;
  }
  if (nullifierHash.startsWith("0x")) {
    const padded = nullifierHash.slice(2).padStart(64, "0");
    return `0x${padded}` as `0x${string}`;
  }
  // Decimal string â€” convert via BigInt
  try {
    const hex = BigInt(nullifierHash).toString(16).padStart(64, "0");
    return `0x${hex}` as `0x${string}`;
  } catch {
    throw new Error(`PoP: invalid nullifier_hash â€” cannot convert: ${nullifierHash}`);
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
  // â”€â”€ Step 1: Parse & validate expiry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const rawBody = decodeJson(payload.input) as unknown;
  const data = parseTriggerPayload(rawBody);

  const nowMs = runtime.now().getTime();
  const expiresMs = data.expires_at * 1000; // unix seconds â†’ ms

  // expires_at is when the QR code expires; reject if now is too far past that
  if (nowMs > expiresMs + QR_TTL_MS) {
    runtime.log(`PoP: QR code expired | expires_at=${data.expires_at} | nowMs=${nowMs}`);
    return JSON.stringify({ success: false, error: "QR code has expired" });
  }

  runtime.log(
    `PoP: trigger received | event=${data.event_id} | tier=${data.tier} | ` +
    `nullifier=${data.nullifier_hash.slice(0, 18)}...`
  );

  // â”€â”€ Step 2: World ID verification (confidential HTTP inside enclave) â”€â”€â”€â”€â”€
  //
  // The ConfidentialHTTPClient runs inside a CRE TEE enclave.
  // wallet_address (ZK signal), nullifier_hash, merkle_root, proof, and
  // any API credentials never leave the enclave.
  // Only the boolean verified result exits.

  let verified = false;

  if (data.tier === 1) {
    // Tier 1: ZK orb proof â€” call World ID /verify API
    const verifyUrl =
      `https://developer.worldcoin.org/api/v1/verify/${runtime.config.worldIdAppId}`;

    const verifyBody = JSON.stringify({
      nullifier_hash: data.nullifier_hash,
      merkle_root: data.merkle_root,
      proof: data.proof,
      verification_level: "orb",
      signal: data.wallet_address, // wallet as ZK signal only â€” not stored
      action: runtime.config.worldIdAction,
    });

    runtime.log(`PoP: calling World ID verify | action=${runtime.config.worldIdAction}`);

    // ConfidentialHTTPClient: runs in CRE secure enclave
    // vaultDonSecrets tells the enclave which secrets to make available
    // for template substitution or auth header injection
    const confHttp = new ConfidentialHTTPClient();
    const verifyResponse = confHttp.sendRequest(runtime, {
      // WORLD_ID_API_KEY injected by enclave if needed for future authenticated endpoints
      vaultDonSecrets: [
        { key: "WORLD_ID_API_KEY", namespace: "WORLD_ID_API_KEY_ALL" },
      ],
      request: {
        url: verifyUrl,
        method: "POST",
        bodyString: verifyBody,
        multiHeaders: {
          "Content-Type": { values: ["application/json"] },
        },
      },
    }).result();

    // Response body is Uint8Array â€” decode to string then parse JSON
    const responseText = new TextDecoder().decode(verifyResponse.body);
    runtime.log(`PoP: World ID response status=${verifyResponse.statusCode}`);

    if (verifyResponse.statusCode === 200) {
      const parsed = JSON.parse(responseText) as WorldIDVerifyResponse;
      if (parsed.success === true || parsed.nullifier_hash !== undefined) {
        verified = true;
        runtime.log("PoP: World ID verification succeeded");
      } else {
        runtime.log(`PoP: World ID returned non-success body: ${responseText.slice(0, 200)}`);
        return JSON.stringify({
          success: false,
          error: `World ID verification failed: ${parsed.code ?? "unknown"}`,
        });
      }
    } else {
      // World ID verify API returns 200 on success, 4xx on failure
      let errorCode = "unknown";
      try {
        const errBody = JSON.parse(responseText) as WorldIDVerifyResponse;
        errorCode = errBody.code ?? errBody.detail ?? String(verifyResponse.statusCode);
      } catch {
        errorCode = String(verifyResponse.statusCode);
      }
      runtime.log(`PoP: World ID verification failed | code=${errorCode}`);
      return JSON.stringify({
        success: false,
        error: `World ID verification failed: ${errorCode}`,
      });
    }
  } else if (data.tier === 2) {
    // Tier 2: Privy email/phone â€” presence of nullifier_hash is sufficient
    if (data.nullifier_hash && data.nullifier_hash.length > 0) {
      verified = true;
      runtime.log("PoP: Tier 2 (Privy) â€” nullifier present, marking verified");
    } else {
      runtime.log("PoP: Tier 2 â€” missing nullifier_hash");
      return JSON.stringify({ success: false, error: "Missing nullifier_hash for Tier 2" });
    }
  } else {
    return JSON.stringify({ success: false, error: `Unknown tier: ${data.tier}` });
  }

  if (!verified) {
    return JSON.stringify({ success: false, error: "Verification failed" });
  }

  // â”€â”€ Step 3: On-chain write via Keystone Forwarder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // CRE writes use: runtime.report() + EVMClient.writeReport()
  // The Keystone Forwarder receives the signed report and calls
  // ProofOfPresence.onReport(metadata, encodedReport).
  // The contract decodes (bytes32 nullifierHash, string eventId, uint8 tier)
  // and writes to the registry.
  //
  // Only nullifier_hash, event_id, and tier go on-chain.
  // wallet_address is NEVER included.

  const nullifierBytes32 = toBytes32Hex(data.nullifier_hash);

  runtime.log(
    `PoP: recording attendance on-chain | contract=${runtime.config.contractAddress} | ` +
    `nullifier=${nullifierBytes32.slice(0, 18)}... | event=${data.event_id} | tier=${data.tier}`
  );

  // Resolve chain selector for Sepolia
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: SEPOLIA_CHAIN_SELECTOR_NAME,
    isTestnet: true,
  });
  if (!network) {
    throw new Error(`PoP: could not resolve network for ${SEPOLIA_CHAIN_SELECTOR_NAME}`);
  }

  const evmClient = new EVMClient(network.chainSelector.selector);

  // ABI-encode the report data to match _processReport in ProofOfPresence.sol:
  //   abi.decode(report, (bytes32, string, uint8))
  const reportData = encodeAbiParameters(
    parseAbiParameters("bytes32 nullifierHash, string eventId, uint8 tier"),
    [nullifierBytes32 as `0x${string}`, data.event_id, data.tier]
  );

  // Generate a consensus-signed report
  const reportResponse = runtime
    .report(prepareReportRequest(reportData))
    .result();

  // Submit the report to the ProofOfPresence contract via Keystone Forwarder
  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: runtime.config.contractAddress as Address,
      report: reportResponse,
      gasConfig: {
        gasLimit: runtime.config.gasLimit,
      },
    })
    .result();

  const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
  runtime.log(`PoP: on-chain tx | status=${writeResult.txStatus} | hash=${txHash}`);

  if (writeResult.txStatus !== TxStatus.SUCCESS) {
    runtime.log(`PoP: transaction failed | status=${writeResult.txStatus} | error=${writeResult.errorMessage ?? ""}`);
    return JSON.stringify({
      success: false,
      error: `On-chain write failed: ${writeResult.errorMessage ?? writeResult.txStatus}`,
    });
  }

  // â”€â”€ Done â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return JSON.stringify({
    success: true,
    nullifier_hash: data.nullifier_hash,
    event_id: data.event_id,
    tier: data.tier,
    txHash,
  });
};

// ---------------------------------------------------------------------------
// Workflow registration
// ---------------------------------------------------------------------------

const initWorkflow = (_config: Config) => {
  const http = new HTTPCapability();
  return [
    handler(http.trigger({}), onHttpTrigger),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();

