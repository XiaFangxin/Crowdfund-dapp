import { useMemo, useState } from "react";
import { formatEther } from "ethers";
import useCampaigns from "../hooks/useCampaigns.js";
import useResource from "../hooks/useResource.js";
import ContractStatus from "../components/ContractStatus.jsx";
import { getWalletActivity } from "../services/crowdfunding.js";
import { contributionSummary, filterContributionRecords } from "../utils/contributions.js";
export default function MyContributions({wallet,campaigns:provided,embedded=false}) {
  const ownCampaigns=useCampaigns(wallet,provided===undefined);
  const campaigns=provided ?? ownCampaigns.campaigns;
  const history=useResource(wallet,signal=>getWalletActivity(wallet.ethereum,wallet.account,signal),[],Boolean(wallet.account));
  const [search,setSearch]=useState("");
  const records=history.data ?? [];
  const names=useMemo(()=>new Map(campaigns.map(campaign=>[campaign.id,campaign.title])),[campaigns]);
  const summary=contributionSummary(records);
  const filtered=filterContributionRecords(records,names,search);
  return <section className="contributions-page"><h2>My Contributions & Transaction History</h2>{!embedded && <><ContractStatus wallet={wallet}/><a href="#/profile">Open Profile</a></>}
    {!wallet.account ? <p>Connect MetaMask to view your transactions.</p>:<><p>Wallet: <code>{wallet.account}</code></p><div className="contributions-stats"><div className="contributions-stat"><span>Total donated</span><strong>{history.data?`${formatEther(summary.totalDonated)} ETH`:"Unavailable"}</strong></div><div className="contributions-stat"><span>Projects supported</span><strong>{history.data?summary.supportedProjects:"Unavailable"}</strong></div><div className="contributions-stat"><span>Total refunded</span><strong>{history.data?`${formatEther(summary.totalRefunded)} ETH`:"Unavailable"}</strong></div></div>
    <p>Donation counts are transaction events, not unique people. Historical contributions remain visible after withdrawal or refund.</p><button onClick={history.reload} disabled={history.loading}>Refresh history</button>
    <label>Search campaign or transaction hash<input value={search} onChange={event=>setSearch(event.target.value)}/></label>
    {history.loading && <p role="status">Loading complete wallet event history...</p>}{history.error && <p role="alert">{history.error} No partial history is shown.</p>}
    {history.data && <><p>{summary.donations.length} donations / {records.length} wallet event records</p><div className="contributions-table-wrap"><table className="contributions-table"><caption>On-chain wallet activity</caption><thead><tr><th>Campaign</th><th>Action</th><th>Amount</th><th>On-chain time</th><th>Transaction</th></tr></thead><tbody>{filtered.map(record=><tr key={record.id}><td><a href={`#/campaign/${record.campaignId}`}>{names.get(record.campaignId) ?? `Campaign #${record.campaignId}`}</a></td><td>{record.type}</td><td>{record.type==="Created"?"--":`${formatEther(record.amountWei)} ETH`}</td><td>{new Date(record.timestamp*1000).toLocaleString()}</td><td><a href={`https://sepolia.etherscan.io/tx/${record.transactionHash}`} target="_blank" rel="noopener noreferrer">View transaction</a></td></tr>)}</tbody></table>{!filtered.length && <p>No matching transactions.</p>}</div></>}
    </>}
  </section>;
}
