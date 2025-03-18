const { ethers } = require("ethers");
const { FlashbotsBundleProvider, FlashbotsBundleResolution } = require("@flashbots/ethers-provider-bundle");
const readline = require("readline");
require("dotenv").config();

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m"
};

const CHAIN_ID = 1;
const RPC_URL = "https://ethereum.publicnode.com";
const FLASHBOTS_ENDPOINT = "https://rpc.titanbuilder.xyz";

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const sponsorWallet = new ethers.Wallet(process.env.PRIVATE_KEY_SPONSOR, provider);
const hackedWallet = new ethers.Wallet(process.env.PRIVATE_KEY_HACKED, provider);
const safeWalletAddress = process.env.SAFE_WALLET_ADDRESS;

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

function colorLog(color, message) {
  console.log(`${color}%s${colors.reset}`, message);
}

function showHeader() {
  colorLog(colors.blue, "┌──────────────────────────────────────────────────┐");
  colorLog(colors.blue, "│             CRYPTO ASSETS RESCUE TOOL            │");
  colorLog(colors.blue, "│                 Made by @Zun2025                 │");
  colorLog(colors.blue, "└──────────────────────────────────────────────────┘");
}

async function getUserInput() {
  return new Promise((resolve) => {
    rl.question(`${colors.cyan}Choose asset type\n${colors.reset}` +
      `${colors.yellow}1.  Tokens (ERC20)\n${colors.green}2.  NFTs (ERC721)\n${colors.cyan}➤ `, (answer) => {
      if (answer === "1") {
        rl.question(`${colors.cyan}Enter ERC20 contract address: ${colors.reset}`, (contractAddress) => {
          resolve({ type: "ERC20", contractAddress });
          rl.close();
        });
      } else if (answer === "2") {
        rl.question(`${colors.cyan}🖼️  Enter ERC721 contract address: ${colors.reset}`, (contractAddress) => {
          rl.question(`${colors.cyan}🔢 Enter token IDs to transfer (comma-separated): ${colors.reset}`, (tokenIdsInput) => {
            const tokenIdArray = tokenIdsInput.split(",").map(id => id.trim());
            resolve({ type: "ERC721", contractAddress, tokenIds: tokenIdArray });
            rl.close();
          });
        });
      } else {
        colorLog(colors.red, "❌ Invalid choice. Please enter 1 or 2");
        resolve(getUserInput());
      }
    });
  });
}

async function prepareTransferTxs() {
  if (assetType === "ERC20") {
    colorLog(colors.magenta, "⚖️  Checking ERC20 balance...");
    const balance = await contract.balanceOf(hackedWallet.address);
    if (balance.isZero()) {
      colorLog(colors.yellow, "💤 Wallet has zero token balance");
      return { txs: [], info: null };
    }
    const symbol = await contract.symbol();
    const decimals = await contract.decimals();
    const formattedBalance = ethers.utils.formatUnits(balance, decimals);
    colorLog(colors.green, `💰 Discovered balance: ${formattedBalance} ${symbol}`);
    const data = contract.interface.encodeFunctionData("transfer", [safeWalletAddress, balance]);
    const tx = { to: contract.address, data };
    const info = { type: "ERC20", amount: balance, symbol, decimals };
    return { txs: [tx], info };
  } else if (assetType === "ERC721") {
    if (!tokenIds || tokenIds.length === 0) {
      colorLog(colors.red, "🚫 No token IDs provided");
      return { txs: [], info: null };
    }
    colorLog(colors.cyan, `🖼️  Preparing to transfer ${tokenIds.length} NFTs:`);
    tokenIds.forEach((id) => colorLog(colors.yellow, ` ▸ Token ID #${id}`));
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

async function executeSafeTransfer() {
  try {
    showHeader();
    colorLog(colors.green, "\n🔐 Initializing Flashbots rescue module...");

    const authSigner = sponsorWallet;
    const flashbotsProvider = await FlashbotsBundleProvider.create(
      provider,
      authSigner,
      FLASHBOTS_ENDPOINT
    );

    let priorityFeeBoost = 0;
    let totalAttempts = 0;
    const maxAttempts = 30;

    colorLog(colors.blue, "\n📡 Listening for new blocks...");
    colorLog(colors.yellow, "⚠️  Press CTRL+C to abort the operation\n");

    provider.on("block", async (blockNumber) => {
      totalAttempts++;
      if (totalAttempts >= maxAttempts) {
        colorLog(colors.red, `\n⛔ Maximum attempts (${maxAttempts}) reached. Shutting down...`);
        process.exit(1);
      }

      try {
        const currentBlock = blockNumber + 1;
        const targetBlockHex = `0x${currentBlock.toString(16)}`;
        const feeData = await provider.getFeeData();

        const baseMaxPriorityFee = feeData.maxPriorityFeePerGas || ethers.utils.parseUnits("1", "gwei");
        const baseMaxFeePerGas = feeData.maxFeePerGas || ethers.utils.parseUnits("2", "gwei");
        const maxPriorityFeePerGas = baseMaxPriorityFee.add(
          ethers.utils.parseUnits(priorityFeeBoost.toString(), "gwei")
        );
        const maxFeePerGas = baseMaxFeePerGas.add(
          ethers.utils.parseUnits(priorityFeeBoost.toString(), "gwei")
        );

        colorLog(colors.magenta, `\n═══════════════════════════════════════════════════`);
        colorLog(colors.cyan, `🌀 Attempt #${totalAttempts} | Target Block: ${currentBlock}`);
        colorLog(colors.yellow, `⛽ Max Fee: ${ethers.utils.formatUnits(maxFeePerGas, "gwei")} Gwei | Boost: +${priorityFeeBoost} Gwei`);

        colorLog(colors.blue, "\n🔍 Scanning for assets...");
        const { txs: transferTxs, info: transferInfo } = await prepareTransferTxs();
        if (transferTxs.length === 0) {
          colorLog(colors.yellow, "💤 No transferable assets found. Skipping block...");
          return;
        }
        colorLog(colors.green, `📦 Prepared ${transferTxs.length} transactions for bundling`);

        colorLog(colors.blue, "\n🧮 Calculating gas requirements...");
        const gasEstimates = await Promise.all(
          transferTxs.map(tx =>
            provider.estimateGas({
              to: tx.to,
              data: tx.data,
              from: hackedWallet.address
            })
          )
        );

        const totalGasLimit = gasEstimates.reduce((sum, gas) => sum.add(gas), ethers.BigNumber.from(0));
        const ethNeeded = totalGasLimit.mul(maxFeePerGas);
        colorLog(colors.cyan, `⛽ Total Gas: ${totalGasLimit.toString()} | 💰 ETH Required: ${ethers.utils.formatEther(ethNeeded)}`);

        const [sponsorNonce, hackedNonce] = await Promise.all([
          provider.getTransactionCount(sponsorWallet.address, "pending"),
          provider.getTransactionCount(hackedWallet.address, "pending")
        ]);

        colorLog(colors.blue, "\n🔏 Signing transactions...");
        const sponsorTx = {
          chainId: CHAIN_ID,
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
          const gasLimit = gasEstimates[i];
          const transferTx = {
            chainId: CHAIN_ID,
            to: tx.to,
            data: tx.data,
            type: 2,
            maxFeePerGas,
            maxPriorityFeePerGas,
            gasLimit,
            nonce: hackedNonce + i
          };
          const signedTx = await hackedWallet.signTransaction(transferTx);
          signedTransferTxs.push(signedTx);
        }
        colorLog(colors.green, `✅ Successfully signed ${signedTransferTxs.length + 1} transactions`);

        const simulationBundle = [signedSponsorTx, ...signedTransferTxs];

        colorLog(colors.blue, "\n🔄 Running bundle simulation...");
        try {
          const simulation = await flashbotsProvider.simulate(simulationBundle, targetBlockHex, "latest");
          if (simulation.firstRevert) {
            colorLog(colors.red, `💣 Simulation failed: Transaction reverted - ${simulation.firstRevert.error}`);
            priorityFeeBoost += 1;
            colorLog(colors.yellow, `📈 Boosting priority fee to +${priorityFeeBoost} Gwei`);
            return;
          }
          colorLog(colors.green, "✅ Simulation successful");
        } catch (simError) {
          colorLog(colors.red, `💣 Simulation error: ${simError.message}`);
          priorityFeeBoost += 1;
          colorLog(colors.yellow, `📈 Boosting priority fee to +${priorityFeeBoost} Gwei`);
          return;
        }

        colorLog(colors.blue, "\n🚀 Launching bundle...");
        const sendBundle = [
          { signedTransaction: signedSponsorTx },
          ...signedTransferTxs.map(signedTx => ({ signedTransaction: signedTx }))
        ];

        const bundleResponse = await flashbotsProvider.sendBundle(sendBundle, currentBlock);
        const resolution = await bundleResponse.wait();

        let statusMessage;
        let statusColor;
        if (resolution === FlashbotsBundleResolution.BundleIncluded) {
          statusMessage = "✅ Bundle Included";
          statusColor = colors.green;
        } else if (resolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
          statusMessage = "❌ Bundle Not Included";
          statusColor = colors.red;
        } else {
          statusMessage = `⚠️ Bundle Status: ${FlashbotsBundleResolution[resolution]}`;
          statusColor = colors.yellow;
        }
        colorLog(statusColor, statusMessage);

        if (resolution === FlashbotsBundleResolution.BundleIncluded) {
          if (transferInfo.type === "ERC20") {
            const formattedAmount = ethers.utils.formatUnits(transferInfo.amount, transferInfo.decimals);
            colorLog(colors.green, `\n🎉🎉🎉 CONGRATS! You have successfully recovered ${formattedAmount} ${transferInfo.symbol} 🎉🎉🎉`);
          } else if (transferInfo.type === "ERC721") {
            colorLog(colors.green, `\n🎉🎉🎉 CONGRATS! You have successfully recovered ${transferInfo.tokenIds.length} NFTs 🎉🎉🎉`);
          }
          colorLog(colors.green, `🔗 Block Number: ${currentBlock}`);
          process.exit(0);
        } else {
          colorLog(colors.yellow, "\n⏳ Bundle not yet included. Retrying...");
          priorityFeeBoost += 1;
        }
      } catch (blockError) {
        colorLog(colors.red, `\n⚠️ Error in block processing: ${blockError.message}`);
        priorityFeeBoost += 1;
      }
    });
  } catch (mainError) {
    colorLog(colors.red, `\n💀 FATAL ERROR: ${mainError.message}`);
    process.exit(1);
  }
}

(async () => {
  try {
    const userInput = await getUserInput();
    assetType = userInput.type;
    if (assetType === "ERC20") {
      contract = new ethers.Contract(userInput.contractAddress, erc20ABI, provider);
    } else if (assetType === "ERC721") {
      contract = new ethers.Contract(userInput.contractAddress, erc721ABI, provider);
      tokenIds = userInput.tokenIds;
    }
    await executeSafeTransfer();
  } catch (error) {
    colorLog(colors.red, `\n🔥 INITIALIZATION FAILED: ${error.message}`);
    process.exit(1);
  }
})();
