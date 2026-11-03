import { useId, useMemo, useState } from "react";
import { formatEther } from "ethers";
import useCampaigns from "../hooks/useCampaigns.js";
import useResource from "../hooks/useResource.js";
import ContractStatus from "../components/ContractStatus.jsx";
import { contractConfigured } from "../config/contracts.js";
import { getWalletActivity } from "../services/crowdfunding.js";
import { contributionSummary, filterContributionRecords } from "../utils/contributions.js";

export default function MyContributions({
  wallet,
  campaigns: provided,
  history: providedHistory,
  embedded = false,
}) {
  const ownCampaigns = useCampaigns(wallet, provided === undefined);
  const campaigns = provided ?? ownCampaigns.campaigns;
  const ownHistory = useResource(
    wallet,
    (signal) => getWalletActivity(wallet.ethereum, wallet.account, signal),
    [],
    providedHistory === undefined && Boolean(wallet.account),
  );
  const history = providedHistory ?? ownHistory;
  const [search, setSearch] = useState("");
  const searchId = useId();
  const ready = Boolean(wallet.ethereum && wallet.account && wallet.isSepolia && contractConfigured);
  const hasData = ready && Array.isArray(history.data);
  const loading = ready && history.loading;
  const records = hasData ? history.data : [];
  const names = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign.title])),
    [campaigns],
  );
  const summary = contributionSummary(records);
  const filtered = filterContributionRecords(records, names, search);
  const unavailable = loading ? "Loading…" : "Unavailable";

  let unavailableMessage = "";
  if (!wallet.ethereum) unavailableMessage = "Install MetaMask to view your on-chain wallet activity.";
  else if (!wallet.account) unavailableMessage = "Connect MetaMask to view your transactions.";
  else if (!wallet.isSepolia) unavailableMessage = "Switch your wallet to Sepolia to load your transaction history.";
  else if (!contractConfigured) unavailableMessage = "Transaction history is unavailable until the crowdfunding contract is configured.";

  return (
    <section className="contributions-page">
      <h2>My Contributions & Transaction History</h2>
      {!embedded && (
        <>
          <ContractStatus wallet={wallet} />
          <a href="#/profile">Open Profile</a>
          {wallet.account && <p>Wallet: <code>{wallet.account}</code></p>}
        </>
      )}

      <p>Review your donations, withdrawals and refunds from this contract on Sepolia.</p>
      <div className="contributions-stats">
        <div className="contributions-stat">
          <span>Total donated</span>
          <strong>{hasData ? `${formatEther(summary.totalDonated)} ETH` : unavailable}</strong>
        </div>
        <div className="contributions-stat">
          <span>Projects supported</span>
          <strong>{hasData ? summary.supportedProjects : unavailable}</strong>
        </div>
        <div className="contributions-stat">
          <span>Total refunded</span>
          <strong>{hasData ? `${formatEther(summary.totalRefunded)} ETH` : unavailable}</strong>
        </div>
      </div>
      <p>Donation counts are transaction events, not unique people. Historical contributions remain visible after withdrawal or refund.</p>

      <div className="history-toolbar">
        <div className="history-search">
          <label htmlFor={searchId}>Search campaign or transaction hash</label>
          <input
            id={searchId}
            type="search"
            placeholder="Campaign title or transaction hash"
            value={search}
            disabled={!hasData || records.length === 0}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <button type="button" onClick={history.reload} disabled={!ready || loading}>
          {loading ? "Refreshing history…" : "Refresh history"}
        </button>
      </div>

      <div className="history-results" aria-busy={loading}>
        {!ready && <p role="status">{unavailableMessage}</p>}
        {loading && <p role="status">Loading complete wallet event history…</p>}
        {ready && history.error && <p role="alert">{history.error} No partial history is shown. Use Refresh history to try again.</p>}
        {hasData && (
          <>
            <p className="history-count" role="status">
              {summary.donations.length} donations · {records.length} wallet event records
              {search.trim() && ` · ${filtered.length} matching records`}
            </p>
            {records.length === 0 ? (
              <div className="profile-empty">
                <h3>No transactions yet</h3>
                <p>Your activity on this contract will appear here after a transaction is confirmed.</p>
                <a href="#/">Explore campaigns</a>
              </div>
            ) : filtered.length === 0 ? (
              <div className="profile-empty">
                <h3>No matching transactions</h3>
                <p>Try a different campaign title or transaction hash.</p>
                <button type="button" onClick={() => setSearch("")}>Clear search</button>
              </div>
            ) : (
              <div className="contributions-table-wrap">
                <table className="contributions-table">
                  <caption>On-chain wallet activity</caption>
                  <thead>
                    <tr>
                      <th scope="col">Campaign</th>
                      <th scope="col">Action</th>
                      <th scope="col">Amount</th>
                      <th scope="col">On-chain time</th>
                      <th scope="col">Transaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((record) => {
                      const date = new Date(record.timestamp * 1000);
                      const shortHash = `${record.transactionHash.slice(0, 6)}…${record.transactionHash.slice(-4)}`;
                      return (
                        <tr key={record.id}>
                          <td><a href={`#/campaign/${record.campaignId}`}>{names.get(record.campaignId) ?? `Campaign #${record.campaignId}`}</a></td>
                          <td>{record.type}</td>
                          <td>{record.type === "Created" ? "—" : `${formatEther(record.amountWei)} ETH`}</td>
                          <td><time dateTime={date.toISOString()}>{date.toLocaleString()}</time></td>
                          <td>
                            <a
                              href={`https://sepolia.etherscan.io/tx/${record.transactionHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`View transaction ${record.transactionHash} on Sepolia Etherscan (opens in new tab)`}
                            >
                              {shortHash} ↗
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
