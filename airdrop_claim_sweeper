const { ethers } = require("ethers");
const { FlashbotsBundleProvider } = require("@flashbots/ethers-provider-bundle");
const readline = require("readline");
require("dotenv").config();

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m"
};

const NETWORKS = {
  Mainnet: {
    chainId: 1,
    rpc: "https://ethereum.publicnode.com",
    flashbots: "https://relay.flashbots.net",
    explorer: "https://etherscan.io/address/"
  },
  Testnet: {
    chainId: 11155111,
    rpc: "https://1rpc.io/sepolia",
    flashbots: "https://relay-sepolia.flashbots.net",
    explorer: "https://sepolia.etherscan.io/address/"
  }
};

const erc20ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)"
];

const erc721ABI = [
  "function transferFrom(address from, address to, uint256 tokenId) external",
  "function balanceOf(address owner) external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)"
];

const airdropABI = [
  "function claim() external",
  "function claimableTokens(address account) external view returns (uint256)"
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let assetType;
let contracts = [];
let tokenIds;
let selectedNetwork;
let provider;
let flashbotsProvider;
let sponsorWallet;
let hackedWallet;
let safeWalletAddress;
let currentGasFee;
let gasFeeBoost = 5; // Increased initial boost
const MAX_ATTEMPTS = 50; // Increased attempts
const PARALLEL_BUNDLES = 3; // Number of parallel bundles

function colorLog(color, message) {
  console.log(`${color}%s${colors.reset}`, message);
}

function showHeader() {
  colorLog(colors.blue, "┌──────────────────────────────────────────────────┐");
  colorLog(colors.blue, "│         CRYPTO ASSETS RESCUE & SWEEP TOOL        │");
  colorLog(colors.blue, "│               Created by @Zun2025                │");
  colorLog(colors.blue, "└──────────────────────────────────────────────────┘");
}

async function getUserInput() {
  return new Promise((resolve) => {
    rl.question(`${colors.cyan}${colors.bold}🛜  Choose network ${colors.reset}` +
      `${colors.yellow} \n1) Ethereum Mainnet${colors.green} \n2) Sepolia Testnet\n${colors.cyan}👉 Your Response : `, (networkAnswer) => {    
      
      selectedNetwork = networkAnswer === "1" ? "Mainnet" : "Testnet";
      
      rl.question(`${colors.cyan}\n📒 Enter ERC20 token contract addresses (comma-separated, optional): ${colors.reset}`, (erc20Addresses) => {
        rl.question(`${colors.cyan}\n📝 Enter ERC721 contract addresses (comma-separated, optional): ${colors.reset}`, (erc721Addresses) => {
          rl.question(`${colors.cyan}\n🎁 Enter airdrop contract addresses (comma-separated, optional): ${colors.reset}`, (airdropAddresses) => {
            const result = {
              network: selectedNetwork,
              erc20: erc20Addresses ? erc20Addresses.split(",").map(a => a.trim()) : [],
              erc721: erc721Addresses ? erc721Addresses.split(",").map(a => a.trim()) : [],
              airdrops: airdropAddresses ? airdropAddresses.split(",").map(a => a.trim()) : []
            };
            resolve(result);
            rl.close();
          });
        });
      });
    });
  });
}

async function setupWallets() {
  provider = new ethers.providers.JsonRpcProvider(NETWORKS[selectedNetwork].rpc);
  sponsorWallet = new ethers.Wallet(process.env.PRIVATE_KEY_SPONSOR, provider);
  hackedWallet = new ethers.Wallet(process.env.PRIVATE_KEY_HACKED, provider);
  safeWalletAddress = process.env.SAFE_WALLET_ADDRESS;
  
  const feeData = await provider.getFeeData();
  currentGasFee = feeData.maxPriorityFeePerGas || ethers.utils.parseUnits("2", "gwei");
  
  const authSigner = sponsorWallet;
  flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    NETWORKS[selectedNetwork].flashbots
  );
}

async function prepareAllTransfers(userInput) {
  const allTxs = [];
  const allInfo = [];

  // ERC20 Transfers
  for (const address of userInput.erc20) {
    const contract = new ethers.Contract(address, erc20ABI, provider);
    const balance = await contract.balanceOf(hackedWallet.address);
    if (!balance.isZero()) {
      const symbol = await contract.symbol();
      const decimals = await contract.decimals();
      const data = contract.interface.encodeFunctionData("transfer", [safeWalletAddress, balance]);
      allTxs.push({ to: address, data });
      allInfo.push({ type: "ERC20", amount: balance, symbol, decimals, contract: address });
      colorLog(colors.green, `💰 Found ${ethers.utils.formatUnits(balance, decimals)} ${symbol}`);
    }
  }

  // ERC721 Transfers (sweep all owned tokens)
  for (const address of userInput.erc721) {
    const contract = new ethers.Contract(address, erc721ABI, provider);
    const balance = await contract.balanceOf(hackedWallet.address);
    if (!balance.isZero()) {
      const tokenCount = balance.toNumber();
      for (let i = 0; i < tokenCount; i++) {
        try {
          const tokenId = await contract.tokenOfOwnerByIndex(hackedWallet.address, i);
          const data = contract.interface.encodeFunctionData("transferFrom", [
            hackedWallet.address,
            safeWalletAddress,
            tokenId
          ]);
          allTxs.push({ to: address, data });
          allInfo.push({ type: "ERC721", tokenId, contract: address });
          colorLog(colors.green, `🖼️ Found NFT ${address} tokenId: ${tokenId}`);
        } catch (e) {
          continue;
        }
      }
    }
  }

  // Airdrop Claims
  for (const address of userInput.airdrops) {
    const contract = new ethers.Contract(address, airdropABI, provider);
    try {
      const claimable = await contract.claimableTokens(hackedWallet.address);
      if (!claimable.isZero()) {
        const data = contract.interface.encodeFunctionData("claim", []);
        allTxs.push({ to: address, data });
        allInfo.push({ type: "Airdrop", amount: claimable, contract: address });
        colorLog(colors.green, `🎁 Found claimable airdrop: ${ethers.utils.formatEther(claimable)} from ${address}`);
      }
    } catch (e) {
      colorLog(colors.yellow, `⚠️ Could not check airdrop at ${address}: ${e.message}`);
    }
  }

  return { txs: allTxs, info: allInfo };
}

async function simulateBundle(transferTxs) {
  const gasEstimates = await Promise.all(
    transferTxs.map(tx => provider.estimateGas({
      to: tx.to,
      data: tx.data,
      from: hackedWallet.address
    }))
  );

  const totalGasLimit = gasEstimates.reduce(
    (sum, gas) => sum.add(gas),
    ethers.BigNumber.from(0)
  );

  const baseGasPrice = ethers.utils.parseUnits(
    (parseFloat(ethers.utils.formatUnits(currentGasFee, "gwei")) + gasFeeBoost).toString(),
    "gwei"
  );

  return { gasEstimates, totalGasLimit, baseGasPrice };
}

async function sendAggressiveBundle(transferTxs, transferInfo, simulation) {
  const { gasEstimates, totalGasLimit } = simulation;
  
  let isRescueComplete = false;
  let currentRetryCount = 0;
  let successBlock = null;

  provider.on("block", async (blockNumber) => {
    if (isRescueComplete || currentRetryCount >= MAX_ATTEMPTS) return;

    try {
      currentRetryCount++;
      const gasBoost = gasFeeBoost + (currentRetryCount * 2); // More aggressive gas increase
      const gasGwei = parseFloat(ethers.utils.formatUnits(currentGasFee, "gwei")) + gasBoost;
      const maxFeePerGas = ethers.utils.parseUnits(gasGwei.toString(), "gwei");

      // Submit multiple bundles in parallel
      const bundlePromises = [];
      for (let i = 0; i < PARALLEL_BUNDLES; i++) {
        const targetBlock = blockNumber + 1 + i;
        
        const sponsorNonce = await provider.getTransactionCount(sponsorWallet.address, "pending");
        const hackedNonce = await provider.getTransactionCount(hackedWallet.address, "pending");
        
        const ethNeeded = totalGasLimit.mul(maxFeePerGas);
        const sponsorTx = {
          chainId: NETWORKS[selectedNetwork].chainId,
          to: hackedWallet.address,
          value: ethNeeded,
          type: 2,
          maxFeePerGas,
          maxPriorityFeePerGas: maxFeePerGas,
          gasLimit: 21000,
          nonce: sponsorNonce + i
        };

        const signedSponsorTx = await sponsorWallet.signTransaction(sponsorTx);
        
        const signedTransferTxs = await Promise.all(transferTxs.map(async (tx, idx) => {
          const transferTx = {
            chainId: NETWORKS[selectedNetwork].chainId,
            to: tx.to,
            data: tx.data,
            type: 2,
            maxFeePerGas,
            maxPriorityFeePerGas: maxFeePerGas,
            gasLimit: gasEstimates[idx],
            nonce: hackedNonce + idx
          };
          return await hackedWallet.signTransaction(transferTx);
        }));

        const bundle = [
          { signedTransaction: signedSponsorTx },
          ...signedTransferTxs.map(tx => ({ signedTransaction: tx }))
        ];

        colorLog(colors.cyan, `Sending bundle ${i + 1}/${PARALLEL_BUNDLES} for block ${targetBlock} at ${gasGwei.toFixed(1)} gwei`);
        bundlePromises.push(flashbotsProvider.sendBundle(bundle, targetBlock));
      }

      const responses = await Promise.all(bundlePromises);
      for (const response of responses) {
        response.wait().then(resolution => {
          if (resolution === 0) { // BundleIncluded
            successBlock = blockNumber;
            isRescueComplete = true;
            reportSuccess(transferInfo, successBlock);
            process.exit(0);
          }
        });
      }

    } catch (error) {
      colorLog(colors.red, `Bundle error: ${error.message}`);
    }
  });
}

function reportSuccess(transferInfo, blockNumber) {
  colorLog(colors.green, "\n✅ SWEEP SUCCESSFUL!");
  transferInfo.forEach(info => {
    if (info.type === "ERC20") {
      colorLog(colors.green, `Recovered ${ethers.utils.formatUnits(info.amount, info.decimals)} ${info.symbol}`);
    } else if (info.type === "ERC721") {
      colorLog(colors.green, `Recovered NFT ${info.contract} tokenId: ${info.tokenId}`);
    } else if (info.type === "Airdrop") {
      colorLog(colors.green, `Claimed airdrop ${ethers.utils.formatEther(info.amount)} from ${info.contract}`);
    }
  });
  colorLog(colors.green, `🔗 Check on explorer: ${NETWORKS[selectedNetwork].explorer}${hackedWallet.address}`);
}

async function executeRescue() {
  try {
    showHeader();
    await setupWallets();
    
    const userInput = await getUserInput();
    selectedNetwork = userInput.network;

    colorLog(colors.blue, "\n🔍 Scanning for assets and airdrops...");
    const { txs: transferTxs, info: transferInfo } = await prepareAllTransfers(userInput);

    if (transferTxs.length === 0) {
      colorLog(colors.yellow, "💤 No assets or airdrops found to recover");
      process.exit(0);
    }

    const simulation = await simulateBundle(transferTxs);
    colorLog(colors.blue, "\n🚀 Initiating aggressive rescue operation...");
    await sendAggressiveBundle(transferTxs, transferInfo, simulation);

  } catch (error) {
    colorLog(colors.red, `\n💀 FATAL ERROR: ${error.message}`);
    process.exit(1);
  }
}

(async () => {
  await executeRescue();
})();
