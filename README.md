# NFT Ticket DApp

A beginner-friendly ERC-721 ticket minter for Ethereum Sepolia. Each wallet can mint one free ticket.

## 1. Deploy `TicketNFT.sol` with Remix

1. Open [Remix](https://remix.ethereum.org), create `TicketNFT.sol`, and paste in the contents of the root `TicketNFT.sol` file.
2. Open **Solidity Compiler**, select compiler `0.8.20` or newer in the `0.8.x` range, and compile `TicketNFT.sol`. Remix resolves the OpenZeppelin npm import automatically.
3. Install MetaMask, select **Sepolia**, and obtain some Sepolia ETH from a faucet for gas.
4. Open **Deploy & Run Transactions** in Remix.
5. Set **Environment** to `Injected Provider - MetaMask`. Verify that Remix shows Sepolia (chain ID `11155111`) and the intended wallet.
6. Select `TicketNFT` and click **Deploy**, then confirm in MetaMask.
7. After confirmation, copy the address shown under **Deployed Contracts**.

Do not use the deploying wallet's address or the transaction hash—the frontend needs the **deployed contract address**.

## 2. Configure and run the frontend

Requirements: Node.js 20.19+ (or 22.12+) and MetaMask.

```bash
cd nft-ticket-dapp
cp .env.example .env
```

Open `.env` and paste the Remix deployment address:

```env
VITE_CONTRACT_ADDRESS=0x1234...your_contract_address
```

Then install and run:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Connect MetaMask and approve switching to Sepolia if prompted. Click **Mint Ticket**, confirm the transaction, and the transaction hash/Etherscan link will appear.

After changing `.env`, restart the Vite development server. Never put a seed phrase or private key in `.env`; this app only needs the public contract address.

## Production build

```bash
npm run build
npm run preview
```

The deployable static build is written to `dist/`. Set `VITE_CONTRACT_ADDRESS` in the hosting provider's environment before building.

## Project structure

```text
TicketNFT.sol          Remix-compatible smart contract
src/contract.js        Contract address, ABI, and Sepolia chain ID
src/App.jsx            Wallet connection and mint flow
src/styles.css         UI styling
.env.example           Environment variable template
```

## Contract security choices

- One mint per address is enforced on-chain with `hasMinted`.
- State is updated before `_safeMint`, preventing receiver callback re-entry from minting twice.
- `_safeMint` verifies that contract recipients support ERC-721 receipt.
- Solidity 0.8.x checks arithmetic by default; the small `unchecked` increment is safe because reaching `uint256` exhaustion is infeasible and each prior ID is consumed once.
- `mint` is free and there is no withdrawal or privileged owner logic, keeping the attack surface small.
