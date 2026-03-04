// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// This file exists solely to force Hardhat to compile CCIPLocalSimulator
// and make it available as a deployable artifact in tests.
// It is never deployed to a live network.
import "@chainlink/local/src/ccip/CCIPLocalSimulator.sol";
