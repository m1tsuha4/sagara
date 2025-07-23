const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  console.log("Starting deployment...");

  // 1. GET SIGNERS
  // getSigners() returns an array of wallet objects for all accounts from the connected network.
  // We'll use the first three accounts from Ganache for our simulation.
  const [deployer, ani, bob] = await ethers.getSigners();

  // Check if we have enough accounts
  if (!bob) {
    console.error("Error: Not enough accounts in Ganache. Please ensure you have at least 3 accounts.");
    process.exit(1);
  }

  console.log("Deployer address:", deployer.address);
  console.log("Ani's address:", ani.address);
  console.log("Bob's address:", bob.address);
  console.log("----------------------------------------------------");


  // 2. DEPLOY TOKEN CONTRACTS
  console.log("Deploying DigitalRupiah (DIDR)...");
  const DigitalRupiah = await ethers.getContractFactory("DigitalRupiah");
  const didr = await DigitalRupiah.deploy(deployer.address);
  await didr.waitForDeployment();
  const didrAddress = await didr.getAddress();
  console.log(`DIDR token deployed to: ${didrAddress}`);

  console.log("Deploying DigitalSingaporeDollar (DSGD)...");
  const DigitalSingaporeDollar = await ethers.getContractFactory("DigitalSingaporeDollar");
  const dsgd = await DigitalSingaporeDollar.deploy(deployer.address);
  await dsgd.waitForDeployment();
  const dsgdAddress = await dsgd.getAddress();
  console.log(`DSGD token deployed to: ${dsgdAddress}`);
  console.log("----------------------------------------------------");

  // 3. DEPLOY THE SWAP CONTRACT
  // Let's set an exchange rate: 1 SGD = 11,500 IDR
  // Since tokens have 18 decimals, we represent this as: 11500 * 10^18
  const exchangeRate = ethers.parseUnits("11500", 18);

  console.log("Deploying CrossCurrencySwap contract...");
  const CrossCurrencySwap = await ethers.getContractFactory("CrossCurrencySwap");
  const swapContract = await CrossCurrencySwap.deploy(didrAddress, dsgdAddress, exchangeRate, deployer.address);
  await swapContract.waitForDeployment();
  const swapContractAddress = await swapContract.getAddress();
  console.log(`CrossCurrencySwap contract deployed to: ${swapContractAddress}`);
  console.log("----------------------------------------------------");

  // 4. INITIAL TOKEN DISTRIBUTION & LIQUIDITY SETUP
  console.log("Setting up initial token balances...");

  // Transfer 10,000,000 DIDR from Deployer to Ani
  const aniInitialDIDR = ethers.parseUnits("10000000", 18); // 10 million
  await didr.connect(deployer).transfer(ani.address, aniInitialDIDR);
  console.log(`Transferred ${ethers.formatUnits(aniInitialDIDR, 18)} DIDR to Ani.`);

  // Fund the Swap contract with 50,000 DSGD to provide liquidity
  const contractInitialSGD = ethers.parseUnits("50000", 18); // 50 thousand
  await dsgd.connect(deployer).transfer(swapContractAddress, contractInitialSGD);
  console.log(`Transferred ${ethers.formatUnits(contractInitialSGD, 18)} DSGD to the Swap Contract for liquidity.`);
  console.log("----------------------------------------------------");

  // 5. VERIFY BALANCES
  console.log("Verifying initial state...");
  const aniDidrBalance = await didr.balanceOf(ani.address);
  const bobSgdBalance = await dsgd.balanceOf(bob.address);
  const contractSgdBalance = await dsgd.balanceOf(swapContractAddress);

  console.log(`Ani's initial DIDR balance: ${ethers.formatUnits(aniDidrBalance, 18)}`);
  console.log(`Bob's initial DSGD balance: ${ethers.formatUnits(bobSgdBalance, 18)}`);
  console.log(`Swap contract's DSGD liquidity: ${ethers.formatUnits(contractSgdBalance, 18)}`);
  console.log("----------------------------------------------------");
  console.log("✅ Deployment and setup complete!");
  console.log("Use the following addresses in your .env or API server:");
  console.log(`DIDR_CONTRACT_ADDRESS=${didrAddress}`);
  console.log(`DSGD_CONTRACT_ADDRESS=${dsgdAddress}`);
  console.log(`SWAP_CONTRACT_ADDRESS=${swapContractAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});