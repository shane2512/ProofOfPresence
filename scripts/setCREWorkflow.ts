import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * setForwarderAddress.ts
 *
 * Updates the Keystone Forwarder address on the deployed ProofOfPresence contract.
 * Run this after a re-deployment or if the forwarder address changes.
 *
 * Usage:
 *   KEYSTONE_FORWARDER_ADDRESS=0x... npx hardhat run scripts/setCREWorkflow.ts --network sepolia
 */
async function main() {
  const sepoliaPath = path.join(__dirname, "../deployments/sepolia.json");
  const deployment = JSON.parse(fs.readFileSync(sepoliaPath, "utf8"));
  const contractAddress: string = deployment.ProofOfPresence;

  const forwarderAddress = process.env.KEYSTONE_FORWARDER_ADDRESS;
  if (!forwarderAddress) {
    throw new Error(
      "KEYSTONE_FORWARDER_ADDRESS not set.\n" +
      "For Sepolia simulation/staging: 0x15fC6ae953E024d975e77382eEeC56A9101f9F88\n" +
      "For production: see https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory"
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log("Caller (owner):", deployer.address);
  console.log("ProofOfPresence at:", contractAddress);
  console.log("Setting Keystone Forwarder to:", forwarderAddress);

  const contract = await ethers.getContractAt("ProofOfPresence", contractAddress);
  const tx = await contract.setForwarderAddress(forwarderAddress);
  await tx.wait();

  console.log("setForwarderAddress tx hash:", tx.hash);
  console.log("Done — Keystone Forwarder address updated.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
