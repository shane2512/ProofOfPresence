import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * ProofOfPresence tests using @chainlink/local CCIPLocalSimulator.
 *
 * CCIPLocalSimulator deploys the real MockCCIPRouter from @chainlink/contracts-ccip
 * and a real LinkToken. ccipSend() on the mock router synchronously delivers
 * the message to the receiver in the same transaction — so CCIP bridging can be
 * fully tested locally without a live network.
 *
 * Deployment chain:
 *   CCIPLocalSimulator → real MockCCIPRouter + real LinkToken
 *   PoP_CCIP_Receiver  → deployed with mockRouter + sepoliaChainSelector=CHAIN_SELECTOR
 *                         trustedSourceContract = ProofOfPresence address
 *   ProofOfPresence    → deployed with forwarder + mockRouter + linkToken
 *   setCCIPReceivers() → wires up the CCIP receiver destination
 *   LINK faucet        → fund ProofOfPresence with LINK for CCIP fees
 */
describe("ProofOfPresence", function () {
  async function deployFixture() {
    const [owner, forwarder, otherUser] = await ethers.getSigners();

    // ── 1. Deploy CCIPLocalSimulator (real MockRouter + real LinkToken) ────
    const SimulatorFactory = await ethers.getContractFactory("CCIPLocalSimulator");
    const simulator = await SimulatorFactory.deploy();
    await simulator.waitForDeployment();

    const [chainSelector, sourceRouter, , , linkToken] = await simulator.configuration();
    const routerAddr = sourceRouter as string;
    const linkAddr = linkToken as string;

    // ── 2. Deploy ProofOfPresence ──────────────────────────────────────────
    const PoP = await ethers.getContractFactory("ProofOfPresence");
    const pop = await PoP.deploy(await forwarder.getAddress(), routerAddr, linkAddr);
    await pop.waitForDeployment();
    const popAddr = await pop.getAddress();

    // ── 3. Deploy PoP_CCIP_Receiver (trusts ProofOfPresence as source) ────
    const Receiver = await ethers.getContractFactory("PoP_CCIP_Receiver");
    const receiver = await Receiver.deploy(routerAddr, chainSelector, popAddr);
    await receiver.waitForDeployment();
    const receiverAddr = await receiver.getAddress();

    // ── 4. Wire: tell ProofOfPresence to bridge to the receiver ───────────
    await (await pop.setCCIPReceivers([
      { receiver: receiverAddr, chainSelector: chainSelector },
    ])).wait();

    // ── 5. Fund ProofOfPresence with LINK so it can pay CCIP fees ─────────
    const fundAmount = ethers.parseEther("10");
    await (await simulator.requestLinkFromFaucet(popAddr, fundAmount)).wait();

    return { pop, receiver, simulator, owner, forwarder, otherUser, chainSelector };
  }

  /** ABI-encodes a report exactly as the CRE workflow does. */
  function encodeReport(nullifierHash: string, eventId: string, tier: number): string {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "string", "uint8"],
      [nullifierHash, eventId, tier]
    );
  }

  /** Minimal metadata bytes (unused by contract logic but required by IReceiver). */
  const METADATA = "0x";

  // ── Core write tests ─────────────────────────────────────────────────────

  it("onReport() writes the correct record on Sepolia and bridges via CCIP to receiver", async function () {
    const { pop, receiver, forwarder } = await deployFixture();
    const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("test-user-1"));
    const eventId = "event-alpha";
    const tier = 1;

    const tx = await pop.connect(forwarder).onReport(METADATA, encodeReport(nullifierHash, eventId, tier));
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);

    // Primary record on Sepolia (ProofOfPresence)
    const [exists, timestamp, recordTier] = await pop.hasAttended(nullifierHash, eventId);
    expect(exists).to.equal(true);
    expect(timestamp).to.equal(block!.timestamp);
    expect(recordTier).to.equal(tier);

    // Bridged record on receiver (delivered synchronously by MockCCIPRouter)
    const [rExists, rTimestamp, rTier] = await receiver.hasAttended(nullifierHash, eventId);
    expect(rExists).to.equal(true);
    expect(rTimestamp).to.equal(block!.timestamp);
    expect(rTier).to.equal(tier);
  });

  it("onReport() silently skips duplicate nullifier + eventId (no revert)", async function () {
    const { pop, forwarder } = await deployFixture();
    const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("test-user-1"));
    const eventId = "event-duplicate";

    await (await pop.connect(forwarder).onReport(METADATA, encodeReport(nullifierHash, eventId, 1))).wait();

    // Second call must NOT revert
    await expect(
      pop.connect(forwarder).onReport(METADATA, encodeReport(nullifierHash, eventId, 1))
    ).to.not.be.reverted;

    const [exists, , recordTier] = await pop.hasAttended(nullifierHash, eventId);
    expect(exists).to.equal(true);
    expect(recordTier).to.equal(1);
  });

  it("onReport() reverts with OnlyForwarder when caller is not the forwarder", async function () {
    const { pop, otherUser } = await deployFixture();
    const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("test-user-1"));

    await expect(
      pop.connect(otherUser).onReport(METADATA, encodeReport(nullifierHash, "event-auth", 1))
    ).to.be.revertedWithCustomError(pop, "OnlyForwarder");
  });

  it("onReport() allows same nullifier for a different eventId", async function () {
    const { pop, forwarder } = await deployFixture();
    const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("test-user-1"));

    await (await pop.connect(forwarder).onReport(METADATA, encodeReport(nullifierHash, "event-a", 1))).wait();
    await (await pop.connect(forwarder).onReport(METADATA, encodeReport(nullifierHash, "event-b", 2))).wait();

    const [aExists, , aTier] = await pop.hasAttended(nullifierHash, "event-a");
    const [bExists, , bTier] = await pop.hasAttended(nullifierHash, "event-b");

    expect(aExists).to.equal(true);
    expect(aTier).to.equal(1);
    expect(bExists).to.equal(true);
    expect(bTier).to.equal(2);
  });

  it("hasAttended() returns true with timestamp and tier after write", async function () {
    const { pop, forwarder } = await deployFixture();
    const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("test-user-2"));
    const eventId = "event-view";

    const tx = await pop.connect(forwarder).onReport(METADATA, encodeReport(nullifierHash, eventId, 2));
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);

    const [exists, timestamp, tier] = await pop.hasAttended(nullifierHash, eventId);
    expect(exists).to.equal(true);
    expect(timestamp).to.equal(block!.timestamp);
    expect(tier).to.equal(2);
  });

  it("hasAttended() returns false, 0, 0 for unknown entry", async function () {
    const { pop } = await deployFixture();
    const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("test-user-3"));

    const [exists, timestamp, tier] = await pop.hasAttended(nullifierHash, "event-missing");
    expect(exists).to.equal(false);
    expect(timestamp).to.equal(0n);
    expect(tier).to.equal(0);
  });

  it("AttendanceRecorded event emits with correct indexed and value fields", async function () {
    const { pop, forwarder } = await deployFixture();
    const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("test-user-1"));
    const eventId = "event-emit";
    const tier = 1;

    const tx = await pop.connect(forwarder).onReport(METADATA, encodeReport(nullifierHash, eventId, tier));
    const receipt = await tx.wait();

    const eventTopic = ethers.id("AttendanceRecorded(bytes32,string,uint256,uint8)");
    const log = receipt!.logs.find((l) => l.topics[0] === eventTopic);
    expect(log).to.not.be.undefined;

    expect(log!.topics[1]).to.equal(nullifierHash);
    expect(log!.topics[2]).to.equal(ethers.keccak256(ethers.toUtf8Bytes(eventId)));

    const [, tier_] = ethers.AbiCoder.defaultAbiCoder().decode(["uint256", "uint8"], log!.data);
    expect(tier_).to.equal(tier);
  });

  it("CrossChainBridged event emits on successful CCIP send", async function () {
    const { pop, forwarder, chainSelector } = await deployFixture();
    const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("test-user-bridge"));
    const eventId = "event-bridge";

    const tx = await pop.connect(forwarder).onReport(METADATA, encodeReport(nullifierHash, eventId, 1));
    const receipt = await tx.wait();

    const bridgeTopic = ethers.id("CrossChainBridged(bytes32,string,uint64,bytes32)");
    const log = receipt!.logs.find((l) => l.topics[0] === bridgeTopic);
    expect(log).to.not.be.undefined;
    expect(log!.topics[1]).to.equal(nullifierHash);
    expect(log!.topics[3]).to.not.equal(ethers.ZeroHash); // non-zero messageId from MockRouter
  });

  // ── Admin tests ───────────────────────────────────────────────────────────

  it("setForwarderAddress() updates address when called by owner", async function () {
    const { pop, otherUser } = await deployFixture();
    await (await pop.setForwarderAddress(await otherUser.getAddress())).wait();
    expect(await pop.keystoneForwarder()).to.equal(await otherUser.getAddress());
  });

  it("setForwarderAddress() reverts when called by non-owner", async function () {
    const { pop, forwarder } = await deployFixture();
    await expect(
      pop.connect(forwarder).setForwarderAddress(await forwarder.getAddress())
    ).to.be.revertedWithCustomError(pop, "OwnableUnauthorizedAccount");
  });

  it("setCCIPReceivers() replaces receiver list", async function () {
    const { pop } = await deployFixture();
    expect(await pop.getCCIPReceiversCount()).to.equal(1);

    await (await pop.setCCIPReceivers([])).wait();
    expect(await pop.getCCIPReceiversCount()).to.equal(0);

    // No CCIP bridge when receivers list is empty — onReport still writes the primary record
    const [owner] = await ethers.getSigners();
    const SimulatorFactory = await ethers.getContractFactory("CCIPLocalSimulator");
    const sim = await SimulatorFactory.deploy();
    const [cs, router, , , link] = await sim.configuration();
    const PoP = await ethers.getContractFactory("ProofOfPresence");
    const pop2 = await PoP.deploy(await owner.getAddress(), router as string, link as string);
    await pop2.waitForDeployment();
    // No receivers registered — onReport must not revert
    const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("no-bridge-user"));
    await expect(
      pop2.onReport(METADATA, encodeReport(nullifierHash, "ev", 1))
    ).to.not.be.reverted;
    const [exists] = await pop2.hasAttended(nullifierHash, "ev");
    expect(exists).to.equal(true);
  });

  it("supportsInterface() returns true for IReceiver selector 0x50be76c9", async function () {
    const { pop } = await deployFixture();
    expect(await pop.supportsInterface("0x50be76c9")).to.equal(true);
  });

  it("constructor reverts if forwarder address is zero", async function () {
    const [owner] = await ethers.getSigners();
    const SimulatorFactory = await ethers.getContractFactory("CCIPLocalSimulator");
    const sim = await SimulatorFactory.deploy();
    const [, router, , , link] = await sim.configuration();

    const factory = await ethers.getContractFactory("ProofOfPresence");
    const validInst = await factory.deploy(
      await owner.getAddress(),
      router as string,
      link as string
    );
    await validInst.waitForDeployment();

    await expect(
      factory.deploy(ethers.ZeroAddress, router as string, link as string)
    ).to.be.revertedWithCustomError(validInst, "InvalidForwarderAddress");
  });
});
