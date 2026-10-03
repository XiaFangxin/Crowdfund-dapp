import { contractConfigured, contractConfigMessage } from "../config/contracts.js";

export default function ContractStatus({ wallet }) {
  if (!contractConfigured) return <p role="status">{contractConfigMessage}</p>;
  if (!wallet.ethereum) return <p>MetaMask is required to read the deployed contract.</p>;
  if (!wallet.isSepolia) return <p>Switch to Sepolia to load campaigns.</p>;
  return null;
}
