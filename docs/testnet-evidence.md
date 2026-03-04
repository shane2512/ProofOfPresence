# Proof of Presence — Testnet Evidence

## Deployed Contracts

| Contract | Network | Address | Explorer |
|----------|---------|---------|---------|
| ProofOfPresence | Sepolia | `0xbA985984B1319451968f42281b1a92Ca709cF820` | [Etherscan](https://sepolia.etherscan.io/address/0xbA985984B1319451968f42281b1a92Ca709cF820#code) |
| PoP_CCIP_Receiver | Base Sepolia | `0x508eC020139E6fcdA3878B18898F0E372D906b1a` | [Basescan](https://sepolia.basescan.org/address/0x508eC020139E6fcdA3878B18898F0E372D906b1a#code) |
| PoP_CCIP_Receiver | Optimism Sepolia | `0xd01fac0953530D7833bA8eB0cc3CcCa2433BCD0b` | [OP Explorer](https://sepolia-optimism.etherscan.io/address/0xd01fac0953530D7833bA8eB0cc3CcCa2433BCD0b#code) |

## Transaction Evidence

| Event | Tx Hash | Explorer Link |
|-------|---------|---------------|
| recordAttendance (Sepolia) — CRE broadcast | `0x52185c66df8ae57d23e889321a9d84128acab33fdc9633c8fc979c74e214970d` | [Etherscan](https://sepolia.etherscan.io/tx/0x52185c66df8ae57d23e889321a9d84128acab33fdc9633c8fc979c74e214970d) |
| setCCIPReceivers (Sepolia) | `0x6525b2f61cc7eb25312f8599cb33b14c994874e6276c1e9c6f86dc45bd2e6a9a` | [Etherscan](https://sepolia.etherscan.io/tx/0x6525b2f61cc7eb25312f8599cb33b14c994874e6276c1e9c6f86dc45bd2e6a9a) |
| CCIP message (Base Sepolia) | _(CCIP lane may take 10-20 min to deliver to Base)_ | [CCIP Explorer](https://ccip.chain.link/) |
| CCIP message (Optimism Sepolia) | _(CCIP lane may take 10-20 min to deliver to Optimism)_ | [CCIP Explorer](https://ccip.chain.link/) |

## ProofOfPresence Configuration

| Setting | Value |
|---------|-------|
| Chainlink Keystone Forwarder | `0x15fC6ae953E024d975e77382eEeC56A9101f9F88` |
| CCIP Router (Sepolia) | `0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59` |
| LINK Token (Sepolia) | `0x779877A7B0D9E8603169DdbD7836e478b4624789` |
| LINK Balance | 5.0 LINK (funded) |
| CCIP Receivers | Base Sepolia (10344971235874465080) + Optimism Sepolia (5224473277236331295) |
| World ID App | `app_ee1886c8f0481e50d3569c6f6ba31c34` |

## CRE Simulate Output

Simulation result (Tier 2 path, `--broadcast`):
```json
{
  "success": true,
  "nullifier_hash": "0x2a4b6c8d9e1f2034567890abcdef1234567890abcdef1234567890abcdef1234",
  "event_id": "devcon-2025-day1",
  "tier": 2,
  "txHash": "0x52185c66df8ae57d23e889321a9d84128acab33fdc9633c8fc979c74e214970d"
}
```

Screenshot: `docs/simulate-output.png` _(fill after Phase 3)_

## Video

YouTube/Loom link: _(fill after Phase 5)_

## GitHub

Repo URL: _(fill before submission)_

## Moltbook

Post URL: _(fill after Phase 6)_
