"Crypto Assets Rescue & Sweep Tool":
markdown

# Crypto Assets Rescue & Sweep Tool

A powerful tool designed to help recover ERC20 tokens, ERC721 NFTs, and claim airdrops from compromised Ethereum wallets using Flashbots to prevent frontrunning. This tool aggressively sweeps assets to a safe wallet before a compromiser can act.

## Features
- Supports Ethereum Mainnet and Sepolia Testnet
- Recovers:
  - ERC20 tokens (fungible tokens)
  - ERC721 NFTs (non-fungible tokens)
  - Airdrop claims
- Aggressive transaction strategy:
  - Parallel bundle submission
  - Dynamic gas price boosting
  - Flashbots protection against frontrunning
- Comprehensive asset sweeping
- Colored console output for clear status updates

## Prerequisites
- Node.js (v16 or higher recommended)
- npm (Node Package Manager)
- An Ethereum wallet with some ETH for gas (sponsor wallet)
- The private key of the compromised wallet
- A safe wallet address to receive assets

## Installation
1. Clone the repository:
```bash
git clone https://github.com/yourusername/crypto-rescue-tool.git
cd crypto-rescue-tool

Install dependencies:

bash

npm install

Install required packages:

bash

npm install ethers @flashbots/ethers-provider-bundle readline dotenv

Create a .env file in the root directory with:

PRIVATE_KEY_SPONSOR=your_sponsor_wallet_private_key
PRIVATE_KEY_HACKED=your_compromised_wallet_private_key
SAFE_WALLET_ADDRESS=your_safe_wallet_address

Usage
Run the tool:

bash

node rescue.js

Follow the prompts:

Choose network (1 for Mainnet, 2 for Sepolia Testnet)

Enter ERC20 contract addresses (comma-separated, optional)

Enter ERC721 contract addresses (comma-separated, optional)

Enter airdrop contract addresses (comma-separated, optional)

The tool will:

Scan for assets and claimable airdrops

Simulate the rescue operation

Submit aggressive bundles to recover all specified assets

Report success with explorer links

Example:

🛜  Choose network 
1) Ethereum Mainnet
2) Sepolia Testnet
👉 Your Response : 1

📒 Enter ERC20 token contract addresses (comma-separated, optional): 0x6b175474e89094c44da98b954eedeac495271d0f
📝 Enter ERC721 contract addresses (comma-separated, optional): 0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d
🎁 Enter airdrop contract addresses (comma-separated, optional): 0x...

Configuration
gasFeeBoost: Initial gas price boost (default: 5 GWEI)

MAX_ATTEMPTS: Maximum bundle submission attempts (default: 50)

PARALLEL_BUNDLES: Number of parallel bundles sent (default: 3)

Modify these constants in rescue.js to adjust the tool's aggressiveness.
Safety Notes
Keep your .env file secure and never share private keys

Test on Sepolia Testnet first

Ensure sponsor wallet has sufficient ETH for gas

Verify all contract addresses before running

The tool assumes airdrop contracts use a simple claim() function - adjust airdropABI if needed

How It Works
Collects user input for assets to recover

Sets up wallets and Flashbots provider

Scans for:
ERC20 balances

All owned ERC721 tokens

Claimable airdrops

Creates a sponsor transaction to fund gas

Submits multiple parallel Flashbots bundles with increasing gas prices

Monitors for success and reports results

Troubleshooting
"Simulation failed": Increase gas prices or check contract addresses

"Insufficient funds": Ensure sponsor wallet has enough ETH

"No assets found": Verify wallet ownership and contract addresses

Network errors: Check RPC endpoints in NETWORKS

