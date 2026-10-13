import { useEffect, useMemo, useState } from "react";
import { formatEther } from "ethers";
import useCampaigns from "../hooks/useCampaigns.js";
import ContractStatus from "../components/ContractStatus.jsx";
import { contractConfigured } from "../config/contracts.js";
import { errorMessage, getContributionHistory } from "../services/crowdfunding.js";
import { contributionSummary, filterContributionRecords } from "../utils/contributions.js";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function MyContributions({ wallet }) {
  const { campaigns } = useCampaigns(wallet);
  const [history, setHistory] = useState({ records: [], loading: false, error: "" });
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let active = true;
    if (!contractConfigured || !wallet.ethereum || !wallet.account || !wallet.isSepolia) {
      setHistory({ records: [], loading: false, error: "" });
      return () => { active = false; };
    }
    setHistory({ records: [], loading: true, error: "" });
    getContributionHistory(wallet.ethereum, wallet.account).then((records) => {
      if (active) setHistory({ records, loading: false, error: "" });
    }).catch((error) => {
      if (active) setHistory({ records: [], loading: false, error: errorMessage(error) });
    });
    return () => { active = false; };
  }, [wallet.ethereum, wallet.account, wallet.isSepolia, wallet.revision, refreshKey]);

  const names = useMemo(() => new Map(campaigns.map((campaign) => [String(campaign.id), campaign.title])), [campaigns]);
  const title = (id) => names.get(id) ?? `Campaign #${id}`;
  const { donations, totalDonated, totalRefunded, supportedProjects } = contributionSummary(history.records);
  const filtered = filterContributionRecords(history.records, names, search);
  const state = !wallet.ethereum ? "wallet" : !wallet.account ? "account" : !wallet.isSepolia ? "network" : null;

  return <section className="contributions-page" aria-labelledby="contributions-heading">
    <div className="contributions-heading"><div><p className="eyebrow">WALLET ACTIVITY</p><h1 id="contributions-heading">My Contributions</h1><p>Track your donations and transaction history.</p></div><span className="contributions-network">Sepolia</span></div>
    <ContractStatus wallet={wallet} />
    {state === "wallet" ? <div className="contributions-empty" role="status"><h3>Connect your wallet</h3><p>Install or enable MetaMask to view your contributions.</p></div>
      : state === "account" ? <div className="contributions-empty"><h3>Connect your wallet</h3><p>Connect MetaMask to see your donation history.</p><button onClick={wallet.connect} disabled={wallet.busy}>Connect Wallet</button></div>
      : state === "network" ? <div className="contributions-empty"><h3>Switch to Sepolia</h3><p>Select the Ethereum Sepolia test network to load your history.</p><button onClick={wallet.switchToSepolia} disabled={wallet.busy}>Switch to Sepolia</button></div>
      : <>
        <p className="contributions-account">Wallet: <span title={wallet.account}>{wallet.account.slice(0, 6)}…{wallet.account.slice(-4)}</span></p>
        <div className="contributions-stats"><div className="contributions-stat"><span>Total Donated</span><strong>{formatEther(totalDonated)} ETH</strong></div><div className="contributions-stat"><span>Projects Supported</span><strong>{supportedProjects}</strong></div><div className="contributions-stat"><span>Donation Transactions</span><strong>{donations.length}</strong></div></div>
        <div className="contributions-toolbar"><div><h2>Contribution History</h2><p>{history.records.length} records · Total refunded {formatEther(totalRefunded)} ETH</p></div><button onClick={() => setRefreshKey((value) => value + 1)} disabled={history.loading}>Refresh</button></div>
        <label className="contributions-search-label">Search campaigns or transaction hash<input className="contributions-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search campaigns or transaction hash..." /></label>
        {history.loading ? <div className="list-state" role="status"><span className="loading-spinner" aria-hidden="true" /><h3>Loading contribution history…</h3><p>Reading your transactions from Sepolia.</p></div>
          : history.error ? <div className="list-state error-state" role="alert"><h3>Unable to load contribution history</h3><p>{history.error}</p><button onClick={() => setRefreshKey((value) => value + 1)}>Try again</button></div>
          : !history.records.length ? <div className="contributions-empty"><h3>No contributions yet</h3><p>Explore campaigns and make your first donation.</p><a className="button" href="#/">Explore Campaigns</a></div>
          : <div className="contributions-table-wrap"><table className="contributions-table"><caption className="sr-only">Contribution history</caption><thead><tr><th>Campaign</th><th>Type</th><th>Amount</th><th>Date</th><th>Transaction</th></tr></thead><tbody>{filtered.map((record) => <tr key={record.id}><td><a href={`#/campaign/${record.campaignId}`}>{title(record.campaignId)}</a></td><td><span className={`contribution-type ${record.type === "Refund" ? "refunded" : ""}`}>{record.type}</span></td><td>{record.type === "Refund" ? "−" : "+"}{formatEther(record.amountWei)} ETH</td><td><time dateTime={new Date(record.timestamp * 1000).toISOString()}>{dateFormat.format(new Date(record.timestamp * 1000))}</time></td><td><a href={`https://sepolia.etherscan.io/tx/${record.transactionHash}`} target="_blank" rel="noopener noreferrer">View Tx ↗</a></td></tr>)}</tbody></table>{!filtered.length && <p role="status">No matching transactions found.</p>}</div>}
      </>}
  </section>;
}
