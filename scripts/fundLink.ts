/**
 * scripts/fundLink.ts
 *
 * Transfers LINK tokens from the deployer wallet to ProofOfPresence so it
 * can pay CCIP fees. 
 *
 * Prerequisites:
 *   - Deployer wallet must hold LINK on Sepolia.
 *   - Get LINK from https://faucets.chain.link
 *
 * Usage:
 *   npx hardhat run scripts/fundLink.ts --network sepolia
 */

import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

// Sepolia LINK token address
const LINK_TOKEN = "0x779877A7B0D9E8603169DdbD7836e478b4624789";

// Amount of LINK to transfer (5 LINK — enough for many CCIP messages)
const AMOUNT = ethers.parseEther("5");

const LINK_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const deploymentsDir = path.join(__dirname, "../deployments");
  const sepoliaDeployment = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, "sepolia.json"), "utf8")
  );
  const popAddress: string = sepoliaDeployment.ProofOfPresence;

  const link = await ethers.getContractAt(LINK_ABI, LINK_TOKEN);

  const deployerBalance = await link.balanceOf(deployer.address);
  console.log(`Deployer LINK balance: ${ethers.formatEther(deployerBalance)} LINK`);

  if (deployerBalance < AMOUNT) {
    console.error(`Insufficient LINK. Need ${ethers.formatEther(AMOUNT)}, have ${ethers.formatEther(deployerBalance)}`);
    console.error("Get LINK from https://faucets.chain.link");
    process.exitCode = 1;
    return;
  }

  console.log(`Sending ${ethers.formatEther(AMOUNT)} LINK to ProofOfPresence at ${popAddress}...`);
  const tx = await link.transfer(popAddress, AMOUNT);
  console.log("Transaction hash:", tx.hash);
  await tx.wait();

  const popBalance = await link.balanceOf(popAddress);
  console.log(`ProofOfPresence LINK balance: ${ethers.formatEther(popBalance)} LINK`);
  console.log("Done. ProofOfPresence is funded for CCIP fees.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
