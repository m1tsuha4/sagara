// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DigitalRupiah
 * @dev A simple ERC20 token representing Digital Rupiah (DIDR).
 */
contract DigitalRupiah is ERC20, Ownable {
    constructor(address initialOwner) ERC20("Digital Rupiah", "DIDR") Ownable(initialOwner) {
        // Mint an initial supply of 1 billion tokens to the deployer.
        // ERC20 tokens have 18 decimal places by default.
        _mint(msg.sender, 1_000_000_000 * 10**18);
    }
}