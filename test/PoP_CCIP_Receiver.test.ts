import { expect } from "chai";
import { ethers } from "hardhat";

describe("PoP_CCIP_Receiver", function () {
  const trustedSourceChainSelector = 16015286601757825753n;

  async function deployFixture() {
    const [deployer, routerSigner, trustedSourceContract, attacker] = await ethers.getSigners();

    const factory = await ethers.getContractFactory("PoP_CCIP_Receiver");
    const contract = await factory.deploy(
      await routerSigner.getAddress(),
      trustedSourceChainSelector,
      await trustedSourceContract.getAddress()
    );
    await contract.waitForDeployment();

    return { contract, routerSigner, trustedSourceContract, attacker, deployer };
  }

  function buildMessage(params: {
    sourceChainSelector?: bigint;
    senderAddress?: string;
    nullifierHash?: string;
    eventId?: string;
    timestamp?: bigint;
    tier?: number;
    messageIdLabel?: string;
  }) {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const nullifierHash = params.nullifierHash ?? ethers.keccak256(ethers.toUtf8Bytes("test-user-1"));
    const eventId = params.eventId ?? "event-ccip";
    const timestamp = params.timestamp ?? 1700000000n;
    const tier = params.tier ?? 1;
    const senderAddress = params.senderAddress!;

    return {
      messageId: ethers.keccak256(ethers.toUtf8Bytes(params.messageIdLabel ?? `msg-${eventId}-${timestamp.toString()}`)),
      sourceChainSelector: params.sourceChainSelector ?? trustedSourceChainSelector,
      sender: abiCoder.encode(["address"], [senderAddress]),
      data: abiCoder.encode(["bytes32", "string", "uint256", "uint8"], [nullifierHash, eventId, timestamp, tier]),
      destTokenAmounts: [],
    };
  }

  async function expectRevert(action: () => Promise<unknown>, reason: string) {
    try {
      await action();
      expect.fail("Expected transaction to revert");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).to.contain(reason);
    }
  }

  it("writes record for valid CCIP message from trusted source", async function () {
    const { contract, routerSigner, trustedSourceContract } = await deployFixture();
    const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("test-user-1"));
    const eventId = "event-ccip-valid";
    const timestamp = 1701111111n;
    const tier = 1;

    const message = buildMessage({
      senderAddress: await trustedSourceContract.getAddress(),
      nullifierHash,
      eventId,
      timestamp,
      tier,
    });

    await (await contract.connect(routerSigner).ccipReceive(message)).wait();

    const result = await contract.hasAttended(nullifierHash, eventId);
    expect(result[0]).to.equal(true);
    expect(result[1]).to.equal(timestamp);
    expect(result[2]).to.equal(tier);
  });

  it("reverts for wrong sourceChainSelector", async function () {
    const { contract, routerSigner, trustedSourceContract } = await deployFixture();

    const message = buildMessage({
      sourceChainSelector: 999n,
      senderAddress: await trustedSourceContract.getAddress(),
      messageIdLabel: "wrong-chain",
    });

    await expectRevert(
      async () => {
        await contract.connect(routerSigner).ccipReceive(message);
      },
      "PoP: invalid source chain"
    );
  });

  it("reverts for wrong sender contract", async function () {
    const { contract, routerSigner, attacker } = await deployFixture();

    const message = buildMessage({
      senderAddress: await attacker.getAddress(),
      messageIdLabel: "wrong-sender",
    });

    await expectRevert(
      async () => {
        await contract.connect(routerSigner).ccipReceive(message);
      },
      "PoP: invalid source sender"
    );
  });

  it("silently skips duplicate message without revert", async function () {
    const { contract, routerSigner, trustedSourceContract } = await deployFixture();
    const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("test-user-2"));
    const eventId = "event-duplicate";
    const timestamp = 1702222222n;

    const firstMessage = buildMessage({
      senderAddress: await trustedSourceContract.getAddress(),
      nullifierHash,
      eventId,
      timestamp,
      tier: 2,
      messageIdLabel: "dup-1",
    });
    const secondMessage = buildMessage({
      senderAddress: await trustedSourceContract.getAddress(),
      nullifierHash,
      eventId,
      timestamp,
      tier: 2,
      messageIdLabel: "dup-2",
    });

    await (await contract.connect(routerSigner).ccipReceive(firstMessage)).wait();
    const secondTx = await contract.connect(routerSigner).ccipReceive(secondMessage);
    await secondTx.wait();

    const result = await contract.hasAttended(nullifierHash, eventId);
    expect(result[0]).to.equal(true);
    expect(result[1]).to.equal(timestamp);
    expect(result[2]).to.equal(2);
  });

  it("hasAttended() returns true, timestamp, tier after valid CCIP message", async function () {
    const { contract, routerSigner, trustedSourceContract } = await deployFixture();
    const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("test-user-3"));
    const eventId = "event-has-attended";
    const timestamp = 1703333333n;
    const tier = 1;

    const message = buildMessage({
      senderAddress: await trustedSourceContract.getAddress(),
      nullifierHash,
      eventId,
      timestamp,
      tier,
      messageIdLabel: "has-attended",
    });

    await (await contract.connect(routerSigner).ccipReceive(message)).wait();

    const result = await contract.hasAttended(nullifierHash, eventId);
    expect(result[0]).to.equal(true);
    expect(result[1]).to.equal(timestamp);
    expect(result[2]).to.equal(tier);
  });

  it("emits AttendanceReceived on valid message", async function () {
    const { contract, routerSigner, trustedSourceContract } = await deployFixture();
    const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("test-user-4"));
    const eventId = "event-emitted";

    const message = buildMessage({
      senderAddress: await trustedSourceContract.getAddress(),
      nullifierHash,
      eventId,
      messageIdLabel: "event-log",
    });

    const tx = await contract.connect(routerSigner).ccipReceive(message);
    const receipt = await tx.wait();

    const topic0 = ethers.id("AttendanceReceived(bytes32,string)");
    const log = receipt!.logs.find((entry) => entry.topics[0] === topic0);
    expect(log).to.not.equal(undefined);
    expect(log!.topics[1]).to.equal(nullifierHash);
    expect(log!.topics[2]).to.equal(ethers.keccak256(ethers.toUtf8Bytes(eventId)));
  });
});
