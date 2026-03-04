import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

// CCIP Router addresses — https://docs.chain.link/ccip/supported-networks/v1_2_0/testnet
const CCIP_ROUTERS: Record<string, string> = {
  baseSepolia: "0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93",
  optimismSepolia: "0x114A20A10b43D4115e5aeef7345a1A71d2a60C57",
};

// Sepolia chain selector for CCIP — source chain for all receivers
const SEPOLIA_CHAIN_SELECTOR = "16015286601757825753";

async function deploy(networkName: string) {
  const deploymentsDir = path.join(__dirname, "../../deployments");
  const sepoliaDeployment = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, "sepolia.json"), "utf8")
  );
  const sourceContract: string = sepoliaDeployment.ProofOfPresence;

  const router = CCIP_ROUTERS[networkName];
  if (!router) throw new Error(`No CCIP router configured for network: ${networkName}`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying PoP_CCIP_Receiver on ${networkName} with:`, deployer.address);
  console.log("Source contract (Sepolia):", sourceContract);

  const factory = await ethers.getContractFactory("PoP_CCIP_Receiver");
  const contract = await factory.deploy(router, SEPOLIA_CHAIN_SELECTOR, sourceContract);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`PoP_CCIP_Receiver deployed to (${networkName}):`, address);

  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  const output = {
    network: networkName,
    PoP_CCIP_Receiver: address,
    router,
    sourceChainSelector: SEPOLIA_CHAIN_SELECTOR,
    trustedSourceContract: sourceContract,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const filename = networkName === "baseSepolia" ? "baseSepolia.json" : "optimismSepolia.json";
  fs.writeFileSync(path.join(deploymentsDir, filename), JSON.stringify(output, null, 2));
  console.log(`Saved to deployments/${filename}`);
}

async function main() {
  const network = process.env.HARDHAT_NETWORK || "baseSepolia";
  await deploy(network);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
