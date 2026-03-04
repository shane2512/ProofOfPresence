// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CCIPReceiverLocal} from "./CCIPReceiverLocal.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

contract PoP_CCIP_Receiver is CCIPReceiverLocal {
    struct AttendanceRecord {
        uint256 timestamp;
        uint8 tier;
        bool exists;
    }

    mapping(bytes32 => mapping(string => AttendanceRecord)) public registry;

    uint64 public immutable trustedSourceChainSelector;
    address public immutable trustedSourceContract;

    event AttendanceReceived(bytes32 indexed nullifierHash, string indexed eventId);

    constructor(address router, uint64 sourceChainSelector, address sourceContract) CCIPReceiverLocal(router) {
        trustedSourceChainSelector = sourceChainSelector;
        trustedSourceContract = sourceContract;
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        require(message.sourceChainSelector == trustedSourceChainSelector, "PoP: invalid source chain");

        address sender = abi.decode(message.sender, (address));
        require(sender == trustedSourceContract, "PoP: invalid source sender");

        (bytes32 nullifierHash, string memory eventId, uint256 timestamp, uint8 tier) = abi.decode(
            message.data,
            (bytes32, string, uint256, uint8)
        );

        if (registry[nullifierHash][eventId].exists) {
            return;
        }

        registry[nullifierHash][eventId] = AttendanceRecord(timestamp, tier, true);
        emit AttendanceReceived(nullifierHash, eventId);
    }

    function hasAttended(bytes32 nullifierHash, string calldata eventId)
        external
        view
        returns (bool exists, uint256 timestamp, uint8 tier)
    {
        AttendanceRecord memory record = registry[nullifierHash][eventId];
        return (record.exists, record.timestamp, record.tier);
    }
}
