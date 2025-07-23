const express = require('express');
const { ethers } = require('ethers');
const cors = require('cors');
require('dotenv').config({ path: '../.env' }); // Point to .env in root folder

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURATION ---
const PORT = 3000;
const GANACHE_URL = 'http://127.0.0.1:7545';

// ----------------- IMPORTANT: PASTE YOUR DEPLOYMENT VALUES BELOW -----------------
// 1. Get these addresses from the output of the `npx hardhat run scripts/deploy.js...` command
const DIDR_CONTRACT_ADDRESS = "0xf2180Ea0F29545F992313aEa602B1Af8c6D1Cba4";
const DSGD_CONTRACT_ADDRESS = "0xcEA60c895358C3b9e6276E167757a589cCfBc304";
const SWAP_CONTRACT_ADDRESS = "0x9f179CbdeaE9096722E4b94318A47F6978e8579F";

// 2. Get these private keys from your Ganache UI.
//    - ANI_PRIVATE_KEY is from the SECOND account in the Ganache list.
//    - BOB_PRIVATE_KEY is from the THIRD account in the Ganache list.
const ANI_PRIVATE_KEY = "0x7cad8cf6a6cf82120794bef20f91bf1c8b7a9db78be94e4631342118ab058466";
const BOB_PRIVATE_KEY = "0x21e89e09291cc4de2dbd877963bf46880d8cb6d463788892d126f9eade16e906";
// ---------------------------------------------------------------------------------


// --- PRE-STARTUP CHECKS ---
if (DIDR_CONTRACT_ADDRESS.startsWith("YOUR_") || DSGD_CONTRACT_ADDRESS.startsWith("YOUR_") || SWAP_CONTRACT_ADDRESS.startsWith("YOUR_")) {
    console.error("FATAL: Contract addresses in api/server.js have not been replaced. Please paste the correct addresses from your deployment output.");
    process.exit(1);
}
if (ANI_PRIVATE_KEY.startsWith("YOUR_") || BOB_PRIVATE_KEY.startsWith("YOUR_")) {
    console.error("FATAL: Private keys for Ani and Bob in api/server.js have not been replaced. Please copy them from your Ganache UI.");
    process.exit(1);
}


// --- PROVIDER & SIGNERS SETUP ---
const provider = new ethers.JsonRpcProvider(GANACHE_URL);

// NOTE: In a real app, you would NEVER expose private keys like this.
// They would be managed by a secure wallet (like MetaMask). This is for simulation only.
const walletAni = new ethers.Wallet(ANI_PRIVATE_KEY, provider);
const walletBob = new ethers.Wallet(BOB_PRIVATE_KEY, provider);

// --- Get ABI (Application Binary Interface) from compiled contract artifacts ---
const didrAbi = require('../artifacts/contracts/DigitalRupiah.sol/DigitalRupiah.json').abi;
const dsgdAbi = require('../artifacts/contracts/DigitalSingaporeDollar.sol/DigitalSingaporeDollar.json').abi;
const swapAbi = require('../artifacts/contracts/CrossCurrencySwap.sol/CrossCurrencySwap.json').abi;

// --- CONTRACT INSTANCES ---
const didrContract = new ethers.Contract(DIDR_CONTRACT_ADDRESS, didrAbi, provider);
const dsgdContract = new ethers.Contract(DSGD_CONTRACT_ADDRESS, dsgdAbi, provider);
const swapContract = new ethers.Contract(SWAP_CONTRACT_ADDRESS, swapAbi, provider);

// --- API ENDPOINTS ---

/**
 * @route GET /balances
 * @desc Get the current DIDR and DSGD balances for Ani and Bob.
 */
app.get('/balances', async (req, res) => {
    try {
        const aniDidrBalance = await didrContract.balanceOf(walletAni.address);
        const bobDidrBalance = await didrContract.balanceOf(walletBob.address);

        const aniSgdBalance = await dsgdContract.balanceOf(walletAni.address);
        const bobSgdBalance = await dsgdContract.balanceOf(walletBob.address);
        
        const contractLiquidity = await dsgdContract.balanceOf(SWAP_CONTRACT_ADDRESS);

        res.json({
            ani: {
                address: walletAni.address,
                didr: ethers.formatUnits(aniDidrBalance, 18),
                dsgd: ethers.formatUnits(aniSgdBalance, 18),
            },
            bob: {
                address: walletBob.address,
                didr: ethers.formatUnits(bobDidrBalance, 18),
                dsgd: ethers.formatUnits(bobSgdBalance, 18),
            },
            swapContract: {
                address: SWAP_CONTRACT_ADDRESS,
                dsgd_liquidity: ethers.formatUnits(contractLiquidity, 18)
            }
        });
    } catch (error) {
        console.error("Error fetching balances:", error);
        res.status(500).json({ error: "Failed to fetch balances.", details: error.message });
    }
});


/**
 * @route POST /transfer
 * @desc Transfer DIDR from any account to be swapped for DSGD for any destination account.
 * @body { "origin": "0x...", "originPrivateKey": "0x...", "destination": "0x...", "amount": 1000000 }
 */
app.post('/transfer', async (req, res) => {
    const { amount, recipientAddress } = req.body;

    // --- Input Validation ---
    if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: "Invalid 'amount' provided. Please send a positive number." });
    }
    if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
        return res.status(400).json({ error: "Invalid or missing 'recipientAddress'. Please provide a valid Ethereum address." });
    }

    try {
        console.log(`Received transfer request for ${amount} DIDR to be sent to ${recipientAddress}.`);
        const amountInWei = ethers.parseUnits(amount.toString(), 18);

        // --- ROBUST NONCE HANDLING ---
        // Fetch the latest nonce for Ani's account directly from the blockchain.
        // This prevents state mismatch errors if the server restarts.
        const startingNonce = await provider.getTransactionCount(walletAni.address, "latest");
        console.log(`Current nonce for Ani is: ${startingNonce}. Using this for the next transaction.`);

        // --- Step 1: Ani approves the Swap Contract to spend her DIDR ---
        console.log(`Approving swap contract to spend ${amount} DIDR...`);
        const approveTx = await didrContract.connect(walletAni).approve(SWAP_CONTRACT_ADDRESS, amountInWei, { nonce: startingNonce });
        await approveTx.wait(); // Wait for the transaction to be mined
        console.log(`Approval successful. Tx hash: ${approveTx.hash}`);

        // --- Step 2: Ani calls the swap function on the Swap Contract ---
        // We use the next nonce for the second transaction.
        console.log(`Calling swap function to send SGD to the recipient...`);
        const swapTx = await swapContract.connect(walletAni).swapDIDRtoSGD(recipientAddress, amountInWei, { nonce: startingNonce + 1 });
        await swapTx.wait(); // Wait for the transaction to be mined
        console.log(`Swap successful. Tx hash: ${swapTx.hash}`);

        // --- Respond with success ---
        res.status(200).json({
            message: "Transfer successful!",
            success: true,
            data: {
                from: walletAni.address,
                to: recipientAddress,
                amountSwappedDIDR: amount,
                transactions: {
                    approval: `https://etherscan.io/tx/${approveTx.hash}`, // Example link
                    swap: `https://etherscan.io/tx/${swapTx.hash}`
                }
            }
        });

    } catch (error) {
        console.error("Transfer failed:", error);
        const reason = error.reason || error.message || "An unknown error occurred.";
        res.status(500).json({ error: "Transfer failed.", details: reason });
    }
});


/**
 * @route GET /balance/:address
 * @desc Get the DIDR and DSGD balance for a specific address.
 */
app.get('/user/balance', async (req, res) => {
    const { address } = req.query;
    try {
        const didrBalance = await didrContract.balanceOf(address);
        const dsgdBalance = await dsgdContract.balanceOf(address);
        res.json({
            message: "Balance fetched successfully.",
            success: true,
            data: {
                address,
                didr: ethers.formatUnits(didrBalance, 18),
                dsgd: ethers.formatUnits(dsgdBalance, 18),
            }
        });
    } catch (error) {
        res.status(400).json({ error: "Invalid address or failed to fetch balances.", details: error.message });
    }
});


app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
    console.log("Server is ready.");
});