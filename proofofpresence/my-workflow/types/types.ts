// Proof of Presence — CRE Workflow Types

export type Config = {
  contractAddress: string;   // ProofOfPresence.sol on Sepolia
  worldIdAppId: string;      // app_staging_xxx from developer.worldcoin.org
  worldIdAction: string;     // event_attendance
  chainSelectorName: string; // "ethereum-testnet-sepolia" — used by getNetwork()
  gasLimit: string;          // e.g. "500000" — gas for Keystone Forwarder call
  skipWorldIdVerify?: boolean; // true in staging: skip real World ID API call (simulator proofs are invalid against production)
};

// Payload arriving from the HTTP Trigger (frontend POST)
export type TriggerPayload = {
  wallet_address: string;    // used as ZK signal only — never stored on-chain
  event_id: string;          // the event to record attendance for
  tier: number;              // 1 = World ID Orb, 2 = email/phone via Privy
  nullifier_hash: string;    // bytes32 ZK-derived anonymous identifier
  merkle_root: string;       // World ID merkle root
  proof: string;             // ZK proof (Tier 1) or empty string (Tier 2)
  expires_at: number;        // unix timestamp — QR code expiry
};

// Response shape from World ID verify API
export type WorldIDVerifyResponse = {
  success?: boolean;
  nullifier_hash?: string;
  code?: string;             // present on error e.g. "invalid_proof"
  detail?: string;
};