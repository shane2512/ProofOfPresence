// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Local copy of @chainlink/contracts-ccip CCIPReceiver that uses
 *      @openzeppelin/contracts v4/v5 IERC165 from the project's installed version.
 *      This avoids the @openzeppelin/contracts@5.0.2 import-path resolution issue
 *      that arises when mixing ccip@1.4.0 with a v4/v5 OZ install in Hardhat.
 *
 *      Source of truth:
 *      node_modules/@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol
 *      — only the IERC165 import is changed.
 */

import {IAny2EVMMessageReceiver} from "@chainlink/contracts-ccip/contracts/interfaces/IAny2EVMMessageReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title CCIPReceiverLocal – base for CCIP receiver applications (OZ-v5-agnostic).
abstract contract CCIPReceiverLocal is IAny2EVMMessageReceiver, IERC165 {
    address internal immutable i_ccipRouter;

    constructor(address router) {
        if (router == address(0)) revert InvalidRouter(address(0));
        i_ccipRouter = router;
    }

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId) public pure virtual override returns (bool) {
        return
            interfaceId == type(IAny2EVMMessageReceiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

    /// @inheritdoc IAny2EVMMessageReceiver
    function ccipReceive(Client.Any2EVMMessage calldata message)
        external
        virtual
        override
        onlyRouter
    {
        _ccipReceive(message);
    }

    /// @notice Override this in the implementing contract.
    function _ccipReceive(Client.Any2EVMMessage memory message) internal virtual;

    function getRouter() public view virtual returns (address) {
        return i_ccipRouter;
    }

    error InvalidRouter(address router);

    modifier onlyRouter() {
        if (msg.sender != getRouter()) revert InvalidRouter(msg.sender);
        _;
    }
}
