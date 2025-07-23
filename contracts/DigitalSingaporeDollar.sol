// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DigitalSingaporeDollar
 * @dev A simple ERC20 token representing Digital Singapore Dollar (DSGD).
 */
contract DigitalSingaporeDollar is ERC20, Ownable {
    constructor(address initialOwner) ERC20("Digital Singapore Dollar", "DSGD") Ownable(initialOwner) {
        // Mint an initial supply of 100 million tokens to the deployer.
        _mint(msg.sender, 100_000_000 * 10**18);
    }
}