/**
 * scripts/setCCIPReceivers.ts
 *
 * After deploying ProofOfPresence (Sepolia) and both PoP_CCIP_Receiver contracts
 * (Base Sepolia + Optimism Sepolia), run this script to register the receivers in
 * ProofOfPresence so it will auto-bridge every attendance record cross-chain.
 *
 * Usage:
 *   npx hardhat run scripts/setCCIPReceivers.ts --network sepolia
 */

import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

// CCIP chain selectors for destination chains
// Source: https://docs.chain.link/ccip/supported-networks/v1_2_0/testnet
const CHAIN_SELECTORS = {
  baseSepolia: "10344971235874465080",
  optimismSepolia: "5224473277236331295",
} as const;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Running setCCIPReceivers with:", deployer.address);

  const deploymentsDir = path.join(__dirname, "../deployments");

  // Load deployment addresses
  const sepoliaDeployment = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, "sepolia.json"), "utf8")
  );
  const baseDeployment = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, "baseSepolia.json"), "utf8")
  );
  const optimismDeployment = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, "optimismSepolia.json"), "utf8")
  );

  const popAddress: string = sepoliaDeployment.ProofOfPresence;
  const baseReceiverAddress: string = baseDeployment.PoP_CCIP_Receiver;
  const optimismReceiverAddress: string = optimismDeployment.PoP_CCIP_Receiver;

  console.log("\nProofOfPresence (Sepolia):          ", popAddress);
  console.log("PoP_CCIP_Receiver (Base Sepolia):    ", baseReceiverAddress);
  console.log("PoP_CCIP_Receiver (Optimism Sepolia):", optimismReceiverAddress);

  // Attach to ProofOfPresence on Sepolia
  const pop = await ethers.getContractAt("ProofOfPresence", popAddress);

  const receivers = [
    {
      receiver: baseReceiverAddress,
      chainSelector: BigInt(CHAIN_SELECTORS.baseSepolia),
    },
    {
      receiver: optimismReceiverAddress,
      chainSelector: BigInt(CHAIN_SELECTORS.optimismSepolia),
    },
  ];

  console.log("\nCalling setCCIPReceivers() with 2 destinations...");
  const tx = await pop.setCCIPReceivers(receivers);
  console.log("Transaction hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt?.blockNumber);

  // Verify
  const count = await pop.getCCIPReceiversCount();
  console.log(`\nCCIP receivers registered: ${count}`);

  for (let i = 0n; i < count; i++) {
    const r = await pop.ccipReceivers(i);
    console.log(`  [${i}] chainSelector=${r.chainSelector} receiver=${r.receiver}`);
  }

  console.log("\nDone. ProofOfPresence will now bridge to Base Sepolia and Optimism Sepolia.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
