import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

// Chainlink Keystone Forwarder addresses
// Source: https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory
const FORWARDER_ADDRESSES: Record<string, string> = {
  sepolia: "0x15fC6ae953E024d975e77382eEeC56A9101f9F88", // Ethereum Sepolia (simulation + staging)
};

// Chainlink CCIP Router addresses
// Source: https://docs.chain.link/ccip/supported-networks/v1_2_0/testnet
const CCIP_ROUTER_ADDRESSES: Record<string, string> = {
  sepolia: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
};

// Chainlink LINK Token addresses
// Source: https://docs.chain.link/resources/link-token-contracts
const LINK_TOKEN_ADDRESSES: Record<string, string> = {
  sepolia: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ProofOfPresence with:", deployer.address);

  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "sepolia" : network.name;

  const forwarderAddress =
    process.env.KEYSTONE_FORWARDER_ADDRESS ||
    FORWARDER_ADDRESSES[networkName] ||
    FORWARDER_ADDRESSES["sepolia"];

  const ccipRouter =
    process.env.CCIP_ROUTER_ADDRESS ||
    CCIP_ROUTER_ADDRESSES[networkName] ||
    CCIP_ROUTER_ADDRESSES["sepolia"];

  const linkToken =
    process.env.LINK_TOKEN_ADDRESS ||
    LINK_TOKEN_ADDRESSES[networkName] ||
    LINK_TOKEN_ADDRESSES["sepolia"];

  console.log(`Network:          ${networkName}`);
  console.log(`Keystone Forwarder: ${forwarderAddress}`);
  console.log(`CCIP Router:        ${ccipRouter}`);
  console.log(`LINK Token:         ${linkToken}`);

  const factory = await ethers.getContractFactory("ProofOfPresence");
  const contract = await factory.deploy(forwarderAddress, ccipRouter, linkToken);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("ProofOfPresence deployed to:", address);

  const deploymentsDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  const output = {
    network: networkName,
    ProofOfPresence: address,
    keystoneForwarder: forwarderAddress,
    ccipRouter,
    linkToken,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(deploymentsDir, "sepolia.json"), JSON.stringify(output, null, 2));
  console.log("Saved to deployments/sepolia.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
