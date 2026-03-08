# Proof of Presence

> **Bot-proof, privacy-preserving event attendance** — powered by World ID, Chainlink CRE, CCIP, and ERC-721 Soulbound Tokens.

---

## Overview

Proof of Presence (PoP) lets attendees prove they were physically present at an event without revealing their identity. A single anonymous **nullifier hash** (derived from a World ID ZK proof) is the only thing ever stored on-chain.

When an attendee checks in:

1. **World ID** issues a ZK proof that the attendee is a unique human (anti-Sybil).
2. A **Chainlink CRE workflow** running in a secure enclave verifies the proof, then calls `recordAttendance()` on the Sepolia contract via the Keystone Forwarder.
3. The contract mints a **non-transferable ERC-721 Soulbound Token** (POPB) to the attendee's soul address.
4. A **CCIP message** automatically bridges the attendance record to Base Sepolia and Optimism Sepolia — zero manual bridging required.

---

## Architecture

```
Browser / World App
       │
       │  ZK proof (nullifier hash)
       ▼
┌──────────────────┐      POST /api/cre-simulate
│  Next.js Frontend│ ──────────────────────────────────────────────────────►
│  (Vercel)        │                                                        │
└──────────────────┘                                                        │
                                                               ┌────────────▼──────────────┐
                                                               │  Chainlink CRE Workflow   │
                                                               │  (Secure Enclave)         │
                                                               │                           │
                                                               │  1. Verify World ID proof │
                                                               │  2. writeReport() via     │
                                                               │     Keystone Forwarder    │
                                                               └────────────┬──────────────┘
                                                                            │
                                                               ┌────────────▼──────────────┐
                                                               │  ProofOfPresence.sol      │
                                                               │  (Ethereum Sepolia)       │
                                                               │                           │
                                                               │  • recordAttendance()     │
                                                               │  • Mint ERC-721 SBT       │
                                                               │  • Send CCIP message      │
                                                               └───────────┬───────────────┘
                                                                           │
                                              ┌────────────────────────────┼──────────────────────────┐
                                              │                            │                          │
                                   ┌──────────▼──────────┐     ┌──────────▼──────────┐               │
                                   │  Base Sepolia        │     │  Optimism Sepolia   │  (expandable)
                                   │  PoP_CCIP_Receiver  │     │  PoP_CCIP_Receiver  │
                                   └─────────────────────┘     └─────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Identity | [World ID](https://worldcoin.org/world-id) — ZK Orb proof (Tier 1) / Privy email-phone (Tier 2) |
| Automation | [Chainlink CRE](https://docs.chain.link/chainlink-functions) — secure-enclave workflow |
| Cross-chain | [Chainlink CCIP](https://docs.chain.link/ccip) — automated bridging |
| Smart contract | Solidity 0.8.20, Hardhat, OpenZeppelin |
| NFT standard | ERC-721 Soulbound Token (non-transferable) |
| Frontend | Next.js 15, Tailwind CSS, Geist fonts |
| Wallet / auth | Privy (Tier 2), MiniKit (World App) |

---

## Smart Contracts

### ProofOfPresence — Ethereum Sepolia

**Address:** `0x424F855FcFBCF5544bcfCC1bEF3c60D52632d676`
[View on Etherscan](https://sepolia.etherscan.io/address/0x424F855FcFBCF5544bcfCC1bEF3c60D52632d676)

Key functions:

| Function | Description |
|---|---|
| `receive(bytes32[] calldata, bytes calldata)` | IReceiver entry point — called by Keystone Forwarder |
| `hasAttended(bytes32 nullifierHash, string eventId)` | View: confirm attendance + tier |
| `setCCIPReceivers(CCIPReceiver[])` | Owner: set destination chain receivers |
| `tokenURI(uint256 tokenId)` | ERC-721: returns inline JSON data URI |

**ERC-721 Soulbound Token (POPB)**
- Name: `ProofOfPresence Badge` / Symbol: `POPB`
- Token ID = `uint256(nullifierHash)`
- Owner = `address(uint160(uint256(nullifierHash)))` (soul address)
- Transfers permanently blocked — badge is bound to the soul address forever

### PoP_CCIP_Receiver — Base Sepolia & Optimism Sepolia

Receives bridged records from the Sepolia contract via CCIP and mirrors the `AttendanceRecord` locally.

---

## CRE Workflow

Located in `proofofpresence/my-workflow/`. Four nodes:

| Node | Action |
|---|---|
| 1 | HTTP trigger — receives check-in payload `{nullifier_hash, event_id, tier, proof, merkle_root}` |
| 2 | Verify World ID proof against the World ID API (`skipWorldIdVerify: true` in staging) |
| 3 | ABI-encode the attendance record |
| 4 | `EVMClient.writeReport()` → Keystone Forwarder → `ProofOfPresence.receive()` |

### Staging config (`config/config.staging.json`)

```json
{
  "contractAddress": "0x424F855FcFBCF5544bcfCC1bEF3c60D52632d676",
  "worldIdAppId": "app_ee1886c8f0481e50d3569c6f6ba31c34",
  "worldIdAction": "event_attendance",
  "chainSelectorName": "ethereum-testnet-sepolia",
  "gasLimit": "500000",
  "skipWorldIdVerify": true
}
```

> `skipWorldIdVerify: true` bypasses the real World ID API — safe for simulator/staging proofs only.

---

## Frontend Pages

| Route | Description |
|---|---|
| `/` | Home — choose Tier 1 (World ID Orb) or Tier 2 (email/phone) |
| `/checkin` | World ID QR flow (IDKit v4) or Privy login; submits proof to `/api/checkin` |
| `/processing` | Spawns CRE workflow; live step indicators + elapsed timer |
| `/credential` | Shows issued badge, on-chain confirmation, mint tx hash, CRE log |
| `/vault` | Local credential store — all credentials, no wallet address stored |

### API Routes

| Route | Description |
|---|---|
| `POST /api/checkin` | Validates nullifier uniqueness, saves record to DB / returns success |
| `POST /api/rp-signature` | Signs IDKit v4 RP context with server-side private key |
| `POST /api/cre-simulate` | Spawns `cre workflow simulate --broadcast`, streams result + tx hash |

---

## Verification Tiers

| Tier | Method | Privacy | Sybil resistance |
|---|---|---|---|
| 1 | World ID Orb ZK proof | Highest — only nullifier hash on-chain | One proof per human per event |
| 2 | Privy email / phone | Standard — keccak256(email) as nullifier | One per address |

---

## Local Development

### Prerequisites

- Node.js 18+
- `cre` CLI installed and on PATH
- Hardhat (installed via `npm install`)

### 1. Install dependencies

```bash
cd proofofpresence
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_WORLD_APP_ID=app_...
NEXT_PUBLIC_RP_ID=...
NEXT_PUBLIC_CONTRACT_ADDRESS=0x424F855FcFBCF5544bcfCC1bEF3c60D52632d676
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://...
NEXTAUTH_SECRET=...
RP_SIGNING_KEY=...
```

Also configure `proofofpresence/.env`:

```env
CRE_ETH_PRIVATE_KEY=0x...   # Wallet that pays gas for Keystone Forwarder txs
```

### 3. Install CRE workflow dependencies

```bash
cd proofofpresence/my-workflow
npm install
```

### 4. Run development server

```bash
cd proofofpresence
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

### 5. Run tests

```bash
cd proofofpresence
npx hardhat test
```

---

## Testing the Full Flow (Simulator)

1. Open [http://localhost:3000](http://localhost:3000), choose **Tier 1 — World ID Orb**
2. On the check-in page, a QR code and connector URL appear
3. Open the [World ID Simulator](https://simulator.worldcoin.org), tap **Paste Code**, paste the URL
4. Approve the request in the simulator
5. The processing page auto-triggers `cre workflow simulate --broadcast`
6. Once complete you're redirected to the credential page showing:
   - Gold badge
   - **🏅 Badge Minted** — Sepolia tx hash link
   - On-chain confirmation from `hasAttended()` call
   - Collapsible CRE simulate output log

---

## Deployments

| Network | Contract | Address |
|---|---|---|
| Ethereum Sepolia | ProofOfPresence | `0x424F855FcFBCF5544bcfCC1bEF3c60D52632d676` |
| Ethereum Sepolia | Keystone Forwarder | `0x15fC6ae953E024d975e77382eEeC56A9101f9F88` |
| Ethereum Sepolia | CCIP Router | `0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59` |
| Ethereum Sepolia | LINK Token | `0x779877A7B0D9E8603169DdbD7836e478b4624789` |

> CCIP Receiver contracts on Base Sepolia and Optimism Sepolia are deployed but addresses are stored in the deployment registry only.

---

## Security Notes

- **No wallet addresses stored on-chain** — only the World ID nullifier hash
- **`.env*` files are gitignored** — never committed
- **`secrets.yaml`** (CRE API keys) — gitignored
- **`scripts/`** (Hardhat admin scripts with private key usage) — gitignored
- Soulbound tokens cannot be transferred — `_update()` reverts on any transfer attempt
- CCIP sender is validated — only the registered `ProofOfPresence` contract can emit to receivers

---

## License

MIT
