// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CrossCurrencySwap
 * @dev This contract facilitates the atomic swap of DIDR for DSGD.
 * It acts as a decentralized exchange with a fixed rate and its own liquidity pool.
 */
contract CrossCurrencySwap is Ownable, ReentrancyGuard {
    IERC20 public immutable tokenDIDR;
    IERC20 public immutable tokenSGD;

    // The exchange rate. To avoid floating point math, we define how many DIDR are needed for 1 SGD.
    // Example: If 1 SGD = 11,500 IDR, this value would be 11500.
    // The rate is stored with 18 decimals of precision to match the tokens.
    // rate = (Amount of DIDR per 1 SGD) * 10^18
    uint256 public exchangeRateDIDRperSGD;

    event RateUpdated(uint256 newRate);
    event Swapped(address indexed from, address indexed to, uint256 amountIn, uint256 amountOut);

    /**
     * @param _didrAddress The contract address of the Digital Rupiah (DIDR) token.
     * @param _sgdAddress The contract address of the Digital Singapore Dollar (DSGD) token.
     * @param _initialRate The initial number of DIDR (with 18 decimals) required to buy 1 SGD (with 18 decimals).
     */
    constructor(address _didrAddress, address _sgdAddress, uint256 _initialRate, address initialOwner) Ownable(initialOwner) {
        require(_didrAddress != address(0) && _sgdAddress != address(0), "Invalid token address");
        tokenDIDR = IERC20(_didrAddress);
        tokenSGD = IERC20(_sgdAddress);
        exchangeRateDIDRperSGD = _initialRate;
    }

    /**
     * @notice Updates the exchange rate. Only the owner can call this.
     * @param _newRate The new rate, formatted with 18 decimals.
     */
    function setExchangeRate(uint256 _newRate) external onlyOwner {
        require(_newRate > 0, "Rate must be positive");
        exchangeRateDIDRperSGD = _newRate;
        emit RateUpdated(_newRate);
    }

    /**
     * @notice Swaps a specific amount of DIDR for SGD and sends it to a recipient.
     * @dev The caller (Ani) must first approve this contract to spend `amountDIDR` on their behalf.
     * @param recipient The address that will receive the SGD (Bob).
     * @param amountDIDR The amount of DIDR to swap (with 18 decimals).
     */
    function swapDIDRtoSGD(address recipient, uint256 amountDIDR) external nonReentrant {
        require(amountDIDR > 0, "Amount must be positive");
        require(recipient != address(0), "Invalid recipient address");

        // Calculate the amount of SGD to send out.
        // amountOut = amountIn / rate
        // To maintain precision: (amountIn * 10^18) / (rate * 10^18) = amountIn / rate
        // We multiply by 10**18 before dividing to handle decimals correctly.
        uint256 amountSGD = (amountDIDR * 10**18) / exchangeRateDIDRperSGD;
        require(amountSGD > 0, "Amount results in zero output");

        // Check if this contract has enough SGD liquidity to perform the swap.
        uint256 contractSgdBalance = tokenSGD.balanceOf(address(this));
        require(contractSgdBalance >= amountSGD, "Insufficient SGD liquidity in contract");

        // Pull the DIDR from the sender (Ani) into this contract.
        // This will fail if Ani has not approved the contract first.
        bool sent = tokenDIDR.transferFrom(msg.sender, address(this), amountDIDR);
        require(sent, "DIDR transfer failed");

        // Send the calculated SGD amount from this contract to the recipient (Bob).
        bool received = tokenSGD.transfer(recipient, amountSGD);
        require(received, "SGD transfer failed");

        emit Swapped(msg.sender, recipient, amountDIDR, amountSGD);
    }

    /**
     * @notice A function for the owner to withdraw accumulated DIDR tokens.
     */
    function withdrawDIDR() external onlyOwner {
        uint256 balance = tokenDIDR.balanceOf(address(this));
        tokenDIDR.transfer(owner(), balance);
    }

    /**
     * @notice A function for the owner to withdraw excess SGD liquidity.
     */
    function withdrawSGD() external onlyOwner {
        uint256 balance = tokenSGD.balanceOf(address(this));
        tokenSGD.transfer(owner(), balance);
    }
}