require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    ganache: {
      url: "http://127.0.0.1:7545", // Your Ganache RPC Server URL
      // accounts: [process.env.GANACHE_PRIVATE_KEY_DEPLOYER] // Use private key from .env
    }
  }
};
