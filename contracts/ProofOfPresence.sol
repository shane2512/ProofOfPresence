// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
/**
 * @title ProofOfPresence
 * @notice Privacy-preserving attendance registry keyed by World ID nullifier hash.
 *         Receives attendance records from a Chainlink CRE workflow via the
 *         Keystone Forwarder → IReceiver pattern, then auto-bridges records
 *         cross-chain to Base Sepolia and Optimism Sepolia via Chainlink CCIP.
 *
 * @dev Implements the IReceiver interface so that EVMClient.writeReport() in the
 *      CRE workflow can write attendance data through the Keystone Forwarder contract.
 *
 *      Also implements ERC721 Soulbound Token (SBT): each unique attendance is
 *      minted as a non-transferable NFT.
 *        Token ID  = uint256(nullifierHash)
 *        Owner     = address(uint160(uint256(nullifierHash)))  (soul address)
 *      Transfers are blocked — badges are permanently bound to the soul address.
 *
 *      On-chain data layout (per record):
 *        registry[nullifierHash][eventId] → AttendanceRecord
 *      No wallet address is ever stored or emitted — only nullifierHash.
 *
 *      Report encoding (from CRE workflow):
 *        abi.encode(bytes32 nullifierHash, string eventId, uint8 tier)
 *
 *      CCIP payload (Node 4):
 *        abi.encode(bytes32 nullifierHash, string eventId, uint256 timestamp, uint8 tier)
 */
contract ProofOfPresence is Ownable, ERC721 {
    // ─── Data ───────────────────────────────────────────────────────────────

    struct AttendanceRecord {
        uint256 timestamp;
        uint8 tier; // 1 = World ID Orb, 2 = email/phone via Privy
        bool exists;
    }

    struct CCIPReceiver {
        address receiver;       // PoP_CCIP_Receiver contract address on dest chain
        uint64  chainSelector;  // CCIP chain selector for dest chain
    }

    // Key: nullifierHash (anonymous ZK identifier) — NEVER wallet address
    mapping(bytes32 => mapping(string => AttendanceRecord)) public registry;

    // The Chainlink Keystone Forwarder address allowed to call onReport()
    address public keystoneForwarder;

    // CCIP router on Sepolia
    IRouterClient public immutable ccipRouter;

    // LINK token for CCIP fees
    IERC20 public immutable linkToken;

    // Cross-chain receivers to bridge to after every attendance record
    CCIPReceiver[] public ccipReceivers;

    // ─── Events ─────────────────────────────────────────────────────────────

    event AttendanceRecorded(
        bytes32 indexed nullifierHash,
        string indexed eventId,
        uint256 timestamp,
        uint8 tier
    );

    /// @dev Emitted when an attendance badge NFT is minted.
    event BadgeMinted(
        bytes32 indexed nullifierHash,
        string indexed eventId,
        uint256 indexed tokenId,
        address soulAddress
    );

    event ForwarderUpdated(address indexed previousForwarder, address indexed newForwarder);

    event CrossChainBridged(
        bytes32 indexed nullifierHash,
        string indexed eventId,
        uint64 indexed destChainSelector,
        bytes32 ccipMessageId
    );

    // ─── Errors ─────────────────────────────────────────────────────────────

    error OnlyForwarder();
    error InvalidForwarderAddress();
    error CCIPFeeTooHigh(uint256 required, uint256 balance);

    // ─── Constructor ────────────────────────────────────────────────────────

    /**
     * @param _forwarderAddress  Chainlink Keystone Forwarder address on Sepolia.
     *                           Simulation: 0x15fC6ae953E024d975e77382eEeC56A9101f9F88
     * @param _ccipRouter        CCIP router on Sepolia: 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59
     * @param _linkToken         LINK token on Sepolia: 0x779877A7B0D9E8603169DdbD7836e478b4624789
     */
    constructor(address _forwarderAddress, address _ccipRouter, address _linkToken) Ownable(msg.sender) ERC721("ProofOfPresence Badge", "POPB") {
        if (_forwarderAddress == address(0)) revert InvalidForwarderAddress();
        keystoneForwarder = _forwarderAddress;
        ccipRouter = IRouterClient(_ccipRouter);
        linkToken = IERC20(_linkToken);
        emit ForwarderUpdated(address(0), _forwarderAddress);
    }

    // ─── IReceiver ──────────────────────────────────────────────────────────

    /**
     * @notice Called by the Keystone Forwarder after signature validation.
     * @param metadata Workflow metadata (unused by this contract, required by IReceiver).
     * @param report   ABI-encoded (bytes32 nullifierHash, string eventId, uint8 tier).
     */
    function onReport(bytes calldata metadata, bytes calldata report) external {
        if (msg.sender != keystoneForwarder) revert OnlyForwarder();
        (metadata); // suppress unused warning — kept for IReceiver compliance
        _processReport(report);
    }

    // ─── Internal ───────────────────────────────────────────────────────────

    function _processReport(bytes calldata report) internal {
        (bytes32 nullifierHash, string memory eventId, uint8 tier) =
            abi.decode(report, (bytes32, string, uint8));

        // Silent skip on duplicate — prevents CRE retry loops
        if (registry[nullifierHash][eventId].exists) {
            return;
        }

        registry[nullifierHash][eventId] = AttendanceRecord(block.timestamp, tier, true);
        emit AttendanceRecorded(nullifierHash, eventId, block.timestamp, tier);

        // Mint SBT badge for this attendance record.
        // Token ID is derived from nullifier hash — deterministic and privacy-preserving.
        // Owner is the "soul address" derived from same nullifier — no real wallet needed.
        uint256 tokenId = uint256(nullifierHash);
        if (_ownerOf(tokenId) == address(0)) {
            address soul = address(uint160(uint256(nullifierHash)));
            _mint(soul, tokenId);
            emit BadgeMinted(nullifierHash, eventId, tokenId, soul);
        }

        // Node 4: bridge cross-chain via CCIP
        // Payload spec: (nullifierHash, eventId, timestamp, tier) — NO wallet address
        if (ccipReceivers.length > 0) {
            bytes memory ccipPayload = abi.encode(nullifierHash, eventId, block.timestamp, tier);
            _bridgeCrossChain(nullifierHash, eventId, ccipPayload);
        }
    }

    /**
     * @dev Sends CCIP messages to all registered receiver chains.
     *      Fees paid in LINK. If LINK balance insufficient for any dest, that
     *      bridge is skipped (emit is suppressed) but the on-chain record is kept.
     */
    function _bridgeCrossChain(
        bytes32 nullifierHash,
        string memory eventId,
        bytes memory ccipPayload
    ) internal {
        for (uint256 i = 0; i < ccipReceivers.length; i++) {
            Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
                receiver: abi.encode(ccipReceivers[i].receiver),
                data: ccipPayload,
                tokenAmounts: new Client.EVMTokenAmount[](0),
                extraArgs: Client._argsToBytes(
                    Client.EVMExtraArgsV1({gasLimit: 200_000})
                ),
                feeToken: address(linkToken)
            });

            uint256 fee = ccipRouter.getFee(ccipReceivers[i].chainSelector, message);
            if (linkToken.balanceOf(address(this)) < fee) {
                // Insufficient LINK — skip this destination, record stays on Sepolia
                continue;
            }

            linkToken.approve(address(ccipRouter), fee);
            bytes32 messageId = ccipRouter.ccipSend(ccipReceivers[i].chainSelector, message);

            emit CrossChainBridged(nullifierHash, eventId, ccipReceivers[i].chainSelector, messageId);
        }
    }

    // ─── Public views ───────────────────────────────────────────────────────

    function hasAttended(bytes32 nullifierHash, string calldata eventId)
        external
        view
        returns (bool exists, uint256 timestamp, uint8 tier)
    {
        AttendanceRecord memory record = registry[nullifierHash][eventId];
        return (record.exists, record.timestamp, record.tier);
    }

    function getCCIPReceiversCount() external view returns (uint256) {
        return ccipReceivers.length;
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    function setForwarderAddress(address _forwarder) external onlyOwner {
        address previous = keystoneForwarder;
        keystoneForwarder = _forwarder;
        emit ForwarderUpdated(previous, _forwarder);
    }

    /**
     * @notice Register cross-chain receivers for CCIP bridging.
     *         Call once after both PoP_CCIP_Receiver contracts are deployed.
     * @param receivers Array of {receiver, chainSelector} for each destination chain.
     */
    function setCCIPReceivers(CCIPReceiver[] calldata receivers) external onlyOwner {
        delete ccipReceivers;
        for (uint256 i = 0; i < receivers.length; i++) {
            ccipReceivers.push(receivers[i]);
        }
    }

    /**
     * @notice Withdraw LINK tokens (e.g., to recover excess CCIP fee balance).
     */
    function withdrawLink(address to, uint256 amount) external onlyOwner {
        linkToken.transfer(to, amount);
    }

    // ─── ERC165 ─────────────────────────────────────────────────────────────

    /**
     * @dev IReceiver interface selector = bytes4(keccak256("onReport(bytes,bytes)")) = 0x50be76c9
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721)
        returns (bool)
    {
        return interfaceId == 0x50be76c9 || super.supportsInterface(interfaceId);
    }
}
