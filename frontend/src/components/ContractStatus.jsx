import { contractConfigured, contractConfigMessage, contractVersion, crowdfundingAddress, isV2 } from "../config/contracts.js";
export default function ContractStatus({wallet}) {
  return <div className="contract-status" role="status"><p>{contractVersion.toUpperCase()} / Sepolia {contractConfigured && <a href={`https://sepolia.etherscan.io/address/${crowdfundingAddress}`} target="_blank" rel="noopener noreferrer">{crowdfundingAddress}</a>}</p>{!contractConfigured ? <p>{contractConfigMessage}</p>: !wallet.ethereum ? <p>MetaMask is required to read chain data.</p>:!wallet.isSepolia ? <p>Switch to Sepolia to load chain data.</p>:null}{!isV2 && <p>Category management, metadata, project updates and admin controls require a separately deployed V2. Existing V1 funds remain on V1.</p>}</div>;
}
