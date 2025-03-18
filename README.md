<h2 align=center>Asset Recovery Tool</h2>

A tool to securely transfer ERC-20 tokens and ERC-721 NFTs from compromised wallets using Flashbots. Works only on the Ethereum Network, preventing frontrunning and ensuring safe asset recovery.

## 📚 Features
- **Supports Asset Recovery**:  
  - 💰 ERC-20 Token Transfers  
  - 🖼️ ERC-721 NFT Transfers  
- **Flashbots Integration**: Prevents frontrunning and enhances security  
- **Automatic Gas Estimation**: Optimizes transaction fees dynamically  
- **Priority Fee Boosting**: Increases chances of successful execution  
- **Safe Wallet Transfers**: Sends funds securely to a designated address  
- **Real-Time Block Monitoring**: Reacts to new blocks for efficient execution

## 📋 Prerequisites  
- Node.js v16+  
- npm/yarn  
- Ethereum wallet with private key

## 📥 Installation  
1. **Install Node.js and npm if not installed already**  
```bash
curl -sSL https://raw.githubusercontent.com/zunxbt/installation/main/node.sh | bash
```
2. **Clone this repository**
```bash
rm -rf asset-recovery-tool && git clone https://github.com/zunxbt/asset-recovery-tool.git && cd asset-recovery-tool
```
3. **Install dependencies**
```bash
npm install @flashbots/ethers-provider-bundle@^0.6.2 dotenv@^16.4.7 ethers@^5.7.2
```
## ⚙️ Configuration
- Modify `.env` file with proper private key using the below command
```bash
nano .env
```
- Now save this file using `Ctrl + X` and then `Y` and then press `Enter`

## ⚡ Run the bot
- Now run the below command
```bash
node bot.js
```

## 📜 Note
- Make sure that you have enough $ETH gas fee in `PRIVATE_KEY_SPONSOR` wallet
- This script will only work on Ethereum Network
- If hacker already drained your funds then, you can't recover it anyhow
