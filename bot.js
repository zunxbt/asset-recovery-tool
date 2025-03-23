const { ethers } = require("ethers");
const { FlashbotsBundleProvider, FlashbotsBundleResolution } = require("@flashbots/ethers-provider-bundle");
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
  "function balanceOf(address owner) external view returns (uint256)"
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let assetType;
let contract;
let tokenIds;
let selectedNetwork;
let provider;
let flashbotsProvider;
let sponsorWallet;
let hackedWallet;
let safeWalletAddress;
let currentGasFee;
let gasFeeBoost = 3;
const MAX_ATTEMPTS = 30;  // You can increase or decrease your attempts

function colorLog(color, message) {
  console.log(`${color}%s${colors.reset}`, message);
}

function showHeader() {
  colorLog(colors.blue, "┌──────────────────────────────────────────────────┐");
  colorLog(colors.blue, "│             CRYPTO ASSETS RESCUE TOOL            │");
  colorLog(colors.blue, "│               Created by @Zun2025                │");
  colorLog(colors.blue, "└──────────────────────────────────────────────────┘");
}

async function getUserInput() {
  return new Promise((resolve) => {
    rl.question(`${colors.cyan}${colors.bold}🛜  Choose network ${colors.reset}` +
      `${colors.yellow} \n1) Ethereum Mainnet${colors.green} \n2) Sepolia Testnet\n${colors.cyan}👉 Your Response : `, (networkAnswer) => {    
      
      selectedNetwork = networkAnswer === "1" ? "Mainnet" : "Testnet";
      
      rl.question(`${colors.cyan}${colors.bold}\n🪙  Choose asset type${colors.reset}\n` +
        `${colors.yellow}1. Tokens (ERC20)\n${colors.green}2. NFTs (ERC721)\n${colors.cyan}👉 Your Response : `, (answer) => {      
        if (answer === "1") {
          rl.question(`${colors.cyan}\n📒 Enter ERC20 token contract address : ${colors.reset}`, (contractAddress) => {
            resolve({ 
              network: selectedNetwork,
              type: "ERC20", 
              contractAddress 
            });
            rl.close();
          });
        } else if (answer === "2") {
          rl.question(`${colors.cyan}\n📝 Enter ERC721 Token (NFTs) contract address : ${colors.reset}`, (contractAddress) => {
            rl.question(`${colors.cyan}📄 Enter token IDs to transfer (comma-separated): ${colors.reset}`, (tokenIdsInput) => {
              const tokenIdArray = tokenIdsInput.split(",").map(id => id.trim());
              resolve({ 
                network: selectedNetwork,
                type: "ERC721", 
                contractAddress, 
                tokenIds: tokenIdArray 
              });
              rl.close();
            });
          });
        } else {
          colorLog(colors.red, "❌ Invalid choice. Please enter 1 or 2");
          resolve(getUserInput());
        }
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
  const currentGasGwei = parseFloat(ethers.utils.formatUnits(currentGasFee, "gwei"));
  
  colorLog(colors.yellow, `⛽ Current gas price: ${currentGasGwei.toFixed(2)} GWEI`);
  colorLog(colors.yellow, `⛽ Initial gas boost: +${gasFeeBoost} GWEI`);
  
  const authSigner = sponsorWallet;
  flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    NETWORKS[selectedNetwork].flashbots
  );
}


async function prepareTransferTxs() {
  if (assetType === "ERC20") {
    const balance = await contract.balanceOf(hackedWallet.address);
    if (balance.isZero()) {
      colorLog(colors.yellow, "💤 Wallet has zero token balance");
      return { txs: [], info: null };
    }
    
    const symbol = await contract.symbol();
    const decimals = await contract.decimals();
    const formattedBalance = ethers.utils.formatUnits(balance, decimals);
    colorLog(colors.green, `💰 Discovered balance: ${formattedBalance} ${symbol}\n`);
    
    const data = contract.interface.encodeFunctionData("transfer", [safeWalletAddress, balance]);
    const tx = { to: contract.address, data };
    const info = { type: "ERC20", amount: balance, symbol, decimals };
    return { txs: [tx], info };
  } else if (assetType === "ERC721") {
    if (!tokenIds || tokenIds.length === 0) {
      colorLog(colors.red, "🚫 No token IDs provided");
      return { txs: [], info: null };
    }
    
    colorLog(colors.cyan, `🖼️  Preparing to transfer ${tokenIds.length} NFTs`);
    
    const txs = [];
    for (const tokenId of tokenIds) {
      const data = contract.interface.encodeFunctionData("transferFrom", [
        hackedWallet.address,
        safeWalletAddress,
        tokenId
      ]);
      txs.push({ to: contract.address, data });
    }
    
    const info = { type: "ERC721", tokenIds };
    return { txs, info };
  }
  
  return { txs: [], info: null };
}

async function simulateInitialBundle(transferTxs) {
  colorLog(colors.blue, "\n🔄 Running initial bundle simulation...");
  
  try {
    const gasEstimates = await Promise.all(
      transferTxs.map(tx =>
        provider.estimateGas({
          to: tx.to,
          data: tx.data,
          from: hackedWallet.address
        })
      )
    );

    const totalGasLimit = gasEstimates.reduce(
      (sum, gas) => sum.add(gas), 
      ethers.BigNumber.from(0)
    );
    
    const baseGasPrice = ethers.utils.parseUnits(
      (parseFloat(ethers.utils.formatUnits(currentGasFee, "gwei")) + gasFeeBoost).toString(), 
      "gwei"
    );
    
    const ethNeeded = totalGasLimit.mul(baseGasPrice);
    
    const sponsorTx = {
      chainId: NETWORKS[selectedNetwork].chainId,
      to: hackedWallet.address,
      value: ethNeeded,
      type: 2,
      maxFeePerGas: baseGasPrice,
      maxPriorityFeePerGas: baseGasPrice,
      gasLimit: 21000,
      nonce: await provider.getTransactionCount(sponsorWallet.address)
    };
    
    const signedSponsorTx = await sponsorWallet.signTransaction(sponsorTx);
    
    const hackedNonce = await provider.getTransactionCount(hackedWallet.address);
    const signedTransferTxs = [];
    
    for (let i = 0; i < transferTxs.length; i++) {
      const tx = transferTxs[i];
      const transferTx = {
        chainId: NETWORKS[selectedNetwork].chainId,
        to: tx.to,
        data: tx.data,
        type: 2,
        maxFeePerGas: baseGasPrice,
        maxPriorityFeePerGas: baseGasPrice,
        gasLimit: gasEstimates[i],
        nonce: hackedNonce + i
      };
      
      const signedTx = await hackedWallet.signTransaction(transferTx);
      signedTransferTxs.push(signedTx);
    }
    
    const simulationBundle = [signedSponsorTx, ...signedTransferTxs];
    const targetBlock = await provider.getBlockNumber() + 1;
    const simulation = await flashbotsProvider.simulate(
      simulationBundle, 
      `0x${targetBlock.toString(16)}`, 
      "latest"
    );
    
    if (simulation.firstRevert) {
      colorLog(colors.red, `💣 Simulation failed: ${simulation.firstRevert.error}`);
      return { success: false, error: simulation.firstRevert.error };
    }
    
    colorLog(colors.green, "✅ Initial simulation successful");
    return { 
      success: true, 
      gasEstimates, 
      totalGasLimit,
      baseGasPrice,
      ethNeeded 
    };
  } catch (error) {
    colorLog(colors.red, `💣 Simulation error: ${error.message}`);
    return { success: false, error: error.message };
  }
}


async function sendBundle(transferTxs, transferInfo, simulation) {
  const gasEstimates = simulation.gasEstimates;
  const totalGasLimit = simulation.totalGasLimit;
  
  try {
    colorLog(colors.blue, "\n🚀 Starting bundle submission...");
    let isRescueComplete = false;
    let currentRetryCount = 0;
    let successBlock = null;
    
    provider.on("block", async (blockNumber) => {
      if (isRescueComplete) return;
      
      try {
        currentRetryCount++;
        
        if (currentRetryCount > MAX_ATTEMPTS) {
          colorLog(colors.red, `\n⚠️ Maximum attempts (${MAX_ATTEMPTS}) reached. Consider increasing gas price or try again later.`);
          process.exit(1);
        }
        
        const gasBoostForThisAttempt = gasFeeBoost + Math.floor(currentRetryCount / 2);
        const gasGwei = parseFloat(ethers.utils.formatUnits(currentGasFee, "gwei")) + gasBoostForThisAttempt;
        const maxFeePerGas = ethers.utils.parseUnits(gasGwei.toString(), "gwei");
        const maxPriorityFeePerGas = maxFeePerGas;
        
        const targetBlock = blockNumber + 1;
        
        colorLog(colors.cyan, `Sending bundle in ${targetBlock} block at ${gasGwei.toFixed(1)} gwei (attempt ${currentRetryCount}/${MAX_ATTEMPTS})`);
        
        const sponsorNonce = await provider.getTransactionCount(sponsorWallet.address, "pending");
        const hackedNonce = await provider.getTransactionCount(hackedWallet.address, "pending");
        
        const ethNeeded = totalGasLimit.mul(maxFeePerGas);
        const sponsorTx = {
          chainId: NETWORKS[selectedNetwork].chainId,
          to: hackedWallet.address,
          value: ethNeeded,
          type: 2,
          maxFeePerGas,
          maxPriorityFeePerGas,
          gasLimit: 21000,
          nonce: sponsorNonce
        };
        
        const signedSponsorTx = await sponsorWallet.signTransaction(sponsorTx);
        
        const signedTransferTxs = [];
        for (let i = 0; i < transferTxs.length; i++) {
          const tx = transferTxs[i];
          const transferTx = {
            chainId: NETWORKS[selectedNetwork].chainId,
            to: tx.to,
            data: tx.data,
            type: 2,
            maxFeePerGas,
            maxPriorityFeePerGas,
            gasLimit: gasEstimates[i],
            nonce: hackedNonce + i
          };
          
          const signedTx = await hackedWallet.signTransaction(transferTx);
          signedTransferTxs.push(signedTx);
        }
        
        const bundle = [
          { signedTransaction: signedSponsorTx },
          ...signedTransferTxs.map(tx => ({ signedTransaction: tx }))
        ];
        
        const bundleResponse = await flashbotsProvider.sendBundle(bundle, targetBlock);
        
        bundleResponse.wait().then(resolution => {
          if (resolution === FlashbotsBundleResolution.BundleIncluded) {
            successBlock = targetBlock;
            isRescueComplete = true;
            
            if (transferInfo.type === "ERC20") {
              const formattedAmount = ethers.utils.formatUnits(transferInfo.amount, transferInfo.decimals);
              colorLog(colors.green, `\n✅ You have successfully recovered ${formattedAmount} ${transferInfo.symbol} in ${successBlock} block`);
            } else if (transferInfo.type === "ERC721") {
              colorLog(colors.green, `\n✅ You have successfully recovered ${transferInfo.tokenIds.length} NFTs in ${successBlock} block`);
            }
            
            colorLog(colors.green, `🔗 Check it out on explorer : ${NETWORKS[selectedNetwork].explorer}${hackedWallet.address}\n`);
            
            process.exit(0);
          }
        });
      } catch (blockError) {
        colorLog(colors.red, `Error in block processing: ${blockError.message}`);
      }
    });
  } catch (error) {
    colorLog(colors.red, `Error in bundle sending: ${error.message}`);
    process.exit(1);
  }
}


async function executeSafeTransfer() {
  try {
    showHeader();
    
    colorLog(colors.green, "\n🔐 Initializing Flashbots rescue module...");
    await setupWallets();
    
    colorLog(colors.blue, "\n🔍 Scanning for assets...");
    const { txs: transferTxs, info: transferInfo } = await prepareTransferTxs();
    
    if (transferTxs.length === 0) {
      colorLog(colors.yellow, "💤 No transferable assets found. Exiting...");
      process.exit(0);
    }
    
    const simulation = await simulateInitialBundle(transferTxs);
    if (!simulation.success) {
      colorLog(colors.red, "💣 Initial simulation failed. Exiting...");
      process.exit(1);
    }
    
    colorLog(colors.blue, "\n📡 Starting rescue operation...");
    colorLog(colors.yellow, "⚠️  Press CTRL+C to abort the operation\n");
    
    await sendBundle(transferTxs, transferInfo, simulation);
    
  } catch (error) {
    colorLog(colors.red, `\n💀 FATAL ERROR: ${error.message}\n`);
    process.exit(1);
  }
}


(async () => {
  try {
    const userInput = await getUserInput();
    selectedNetwork = userInput.network;
    assetType = userInput.type;
    
    provider = new ethers.providers.JsonRpcProvider(NETWORKS[selectedNetwork].rpc);
    
    if (assetType === "ERC20") {
      const code = await provider.getCode(userInput.contractAddress);
      if (code === '0x') {
        colorLog(colors.red, "\n❌ The provided address is not a contract address.\n");
        process.exit(1);
      }
      contract = new ethers.Contract(userInput.contractAddress, erc20ABI, provider);
    } else if (assetType === "ERC721") {
      const code = await provider.getCode(userInput.contractAddress);
      if (code === '0x') {
        colorLog(colors.red, "\n❌ The provided address is not a contract address.\n");
        process.exit(1);
      }
      contract = new ethers.Contract(userInput.contractAddress, erc721ABI, provider);
      tokenIds = userInput.tokenIds;
    }
    
    await executeSafeTransfer();
  } catch (error) {
    colorLog(colors.red, `\n🔥 INITIALIZATION FAILED: ${error.message}\n`);
    process.exit(1);
  }
})();
