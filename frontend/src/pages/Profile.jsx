import { useId, useRef, useState } from "react";
import { formatEther } from "ethers";
import WalletSignIn from "../components/offchain/WalletSignIn.jsx";
import SavedCampaigns from "../components/offchain/SavedCampaigns.jsx";
import CampaignList from "../components/CampaignList.jsx";
import ContractStatus from "../components/ContractStatus.jsx";
import TransactionStatus from "../components/TransactionStatus.jsx";
import MyContributions from "./MyContributions.jsx";
import useCampaigns from "../hooks/useCampaigns.js";
import useResource from "../hooks/useResource.js";
import useTransaction from "../hooks/useTransaction.js";
import useNow from "../hooks/useNow.js";
import { contractConfigured } from "../config/contracts.js";
import { getWalletActivity, getWalletContributions, refund } from "../services/crowdfunding.js";
import { offchainConfigured } from "../services/supabase.js";
import { contributionSummary } from "../utils/contributions.js";
import { profileCampaigns } from "../utils/profile.js";

const tabs = [
  { id: "created", label: "Created campaigns" },
  { id: "contributions", label: "Contributions & history" },
  { id: "refunds", label: "Available refunds" },
  { id: "saved", label: "Saved campaigns" },
];

export default function Profile({ wallet }) {
  const campaigns = useCampaigns(wallet, Boolean(wallet.account));
  const contributions = useResource(wallet,
    signal => getWalletContributions(wallet.ethereum, campaigns.campaigns, wallet.account, signal),
    [campaigns.data], Boolean(wallet.account && campaigns.loaded));
  const history = useResource(wallet,
    signal => getWalletActivity(wallet.ethereum, wallet.account, signal), [], Boolean(wallet.account));
  const tx = useTransaction();
  const now = useNow();
  const [activeTab, setActiveTab] = useState("created");
  const [copyFeedback, setCopyFeedback] = useState("");
  const tabRefs = useRef([]);
  const prefix = useId();
  const ready = Boolean(wallet.account && wallet.ethereum && wallet.isSepolia && contractConfigured);
  const overview = profileCampaigns(campaigns.campaigns, wallet.account, contributions.data, now);
  const summary = history.data !== null ? contributionSummary(history.data) : null;
  const refundReady = ready && campaigns.loaded && contributions.data !== null;
  const loading = campaigns.loading || contributions.loading || history.loading;
  const refundLoading = ready && (campaigns.loading || contributions.loading || !campaigns.loaded && !campaigns.error);
  const refundError = campaigns.error || contributions.error;
  const refundLocked = tx.busy || tx.status === "unknown";
  const counts = { created: ready && campaigns.loaded ? overview.created.length : null, refunds: refundReady ? overview.refundable.length : null };

  function refreshProfile() {
    campaigns.reload();
    contributions.reload();
    history.reload();
  }

  async function copyAddress() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(wallet.account);
      setCopyFeedback("Address copied.");
    } catch {
      setCopyFeedback("Unable to copy automatically. Select and copy the address above.");
    }
  }

  function moveTab(event, index) {
    const last = tabs.length - 1;
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index + last) % tabs.length
      : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault();
    setActiveTab(tabs[next].id);
    tabRefs.current[next]?.focus();
  }

  async function claim(id) {
    if (!refundReady || refundLocked) return;
    const receipt = await tx.run(emit => refund(wallet.ethereum, wallet.account, id, emit));
    if (receipt) refreshProfile();
  }

  return <section className="profile-page">
    <header className="profile-header">
      <div><p className="profile-eyebrow">YOUR CROWDFUND ACTIVITY</p><h1>My Profile</h1><p>Manage your projects, contributions and refunds in one place.</p></div>
      {wallet.account && <button className="profile-refresh button-secondary" disabled={!ready || loading || tx.busy} onClick={refreshProfile}>{loading ? "Refreshing profile…" : "Refresh profile"}</button>}
    </header>

    {!wallet.account ? <>
      <ContractStatus wallet={wallet} />
      <div className="profile-panel profile-empty">
        <span className="profile-wallet-icon" aria-hidden="true">◈</span>
        <h2>Connect your wallet to get started</h2>
        <p>Your MetaMask address is your account. Connect on Sepolia to see the campaigns you created and supported.</p>
        {wallet.ethereum && <button disabled={wallet.busy} onClick={wallet.connect}>{wallet.busy ? "Connecting…" : "Connect MetaMask"}</button>}
        {!wallet.ethereum && <p>Open this site in a browser with MetaMask installed, then connect using the navigation bar.</p>}
        <a href="#/">Explore campaigns</a>
      </div>
    </> : <>
      <div className="profile-account-card">
        <div className="profile-account-identity">
          <span className="profile-wallet-icon" aria-hidden="true">◈</span>
          <div><p className="profile-account-label">CONNECTED WALLET</p><a className="profile-address" href={`https://sepolia.etherscan.io/address/${wallet.account}`} target="_blank" rel="noopener noreferrer">{wallet.account}</a>
            <div className="profile-account-actions"><button className="button-secondary" onClick={copyAddress}>Copy address</button><a href={`https://sepolia.etherscan.io/address/${wallet.account}`} target="_blank" rel="noopener noreferrer">View on Etherscan ↗</a></div>
            <p className="profile-copy-feedback" role="status">{copyFeedback}</p>
          </div>
        </div>
        <span className={`profile-network${wallet.isSepolia ? " is-connected" : ""}`}>{wallet.isSepolia ? "Sepolia test network" : "Switch to Sepolia"}</span>
      </div>
      <p className="profile-account-note">Activity is shown for this wallet and the current contract. Switching accounts clears personal data. Submitted transactions remain on chain.</p>
      {!ready && <div className="profile-notice"><ContractStatus wallet={wallet} />{wallet.ethereum && !wallet.isSepolia && <button disabled={wallet.busy} onClick={wallet.switchToSepolia}>Switch to Sepolia</button>}</div>}
      {ready && <details className="profile-contract-details"><summary>Contract details</summary><ContractStatus wallet={wallet} /></details>}

      <div className="profile-stats" aria-label="Wallet activity overview">
        <div className="profile-stat"><span>Campaigns created</span><strong>{counts.created ?? (campaigns.loading ? "Loading…" : "Unavailable")}</strong><small>Projects started by this wallet</small></div>
        <div className="profile-stat"><span>Total donated</span><strong>{ready && summary ? `${formatEther(summary.totalDonated)} ETH` : history.loading ? "Loading…" : "Unavailable"}</strong><small>Historical donations, before refunds</small></div>
        <div className="profile-stat"><span>Available to refund</span><strong>{refundReady ? `${formatEther(overview.totalRefundable)} ETH` : refundLoading ? "Loading…" : "Unavailable"}</strong><small>{refundReady ? `${overview.refundable.length} eligible ${overview.refundable.length === 1 ? "campaign" : "campaigns"}` : "Calculated from current chain balances"}</small></div>
      </div>

      <div className="profile-tabs" role="tablist" aria-label="Profile sections">
        {tabs.map((tab, index) => <button key={tab.id} type="button" role="tab" id={`${prefix}-tab-${tab.id}`} aria-controls={`${prefix}-panel-${tab.id}`} aria-selected={activeTab === tab.id} tabIndex={activeTab === tab.id ? 0 : -1} ref={node => { tabRefs.current[index] = node; }} onClick={() => setActiveTab(tab.id)} onKeyDown={event => moveTab(event, index)}>
          {tab.label}{counts[tab.id] !== null && counts[tab.id] !== undefined && <span className="profile-tab-count">{counts[tab.id]}</span>}
        </button>)}
      </div>
      <TransactionStatus transaction={tx} />
      {tx.status === "unknown" && <p className="profile-notice">Check the linked transaction in Etherscan or MetaMask Activity before making another refund request. Refund requests are locked on this page while confirmation is unknown.</p>}

      <section className="profile-panel" role="tabpanel" id={`${prefix}-panel-created`} aria-labelledby={`${prefix}-tab-created`} hidden={activeTab !== "created"} tabIndex={0}>
        <div className="profile-panel-heading"><div><h2>My created campaigns</h2><p>Follow the progress of projects you started.</p></div><a className="button" href="#/create">Create Campaign</a></div>
        {!ready ? <p className="profile-notice">Connect your wallet on Sepolia to load your campaigns.</p>
          : campaigns.loaded && !overview.created.length ? <div className="profile-empty"><h3>You haven’t created a campaign yet</h3><p>Start a project and share your funding goal with the community.</p><a href="#/create">Create your first campaign →</a></div>
          : <CampaignList {...campaigns} campaigns={overview.created} loading={campaigns.loading || !campaigns.loaded && !campaigns.error} onRetry={campaigns.reload} />}
      </section>

      <section className="profile-panel" role="tabpanel" id={`${prefix}-panel-contributions`} aria-labelledby={`${prefix}-tab-contributions`} hidden={activeTab !== "contributions"} tabIndex={0}>
        <MyContributions wallet={wallet} campaigns={campaigns.campaigns} history={history} embedded />
      </section>

      <section className="profile-panel" role="tabpanel" id={`${prefix}-panel-refunds`} aria-labelledby={`${prefix}-tab-refunds`} hidden={activeTab !== "refunds"} tabIndex={0}>
        <div className="profile-panel-heading"><div><h2>Available refunds</h2><p>Claim your contribution when a campaign ends below its funding goal.</p></div></div>
        {!ready ? <p className="profile-notice">Connect your wallet on Sepolia to check refunds.</p>
          : refundLoading ? <div className="profile-empty" role="status"><span className="loading-spinner" aria-hidden="true" /><p>Checking campaign outcomes and your contribution balances…</p></div>
          : refundError ? <div className="profile-empty" role="alert"><h3>Unable to check refunds</h3><p>{refundError}</p><button onClick={refreshProfile}>Try again</button></div>
          : refundReady && <>
            {overview.refundable.length > 0 ? <>
              <div className="profile-refund-summary"><strong>{formatEther(overview.totalRefundable)} ETH available</strong><p>Each campaign requires a separate refund transaction.</p></div>
              <ul className="profile-refund-list">{overview.refundable.map(campaign => <li className="profile-refund-item" key={campaign.id}>
                <div className="profile-refund-info"><small>CAMPAIGN #{campaign.id} · GOAL NOT REACHED</small><h3><a href={`#/campaign/${campaign.id}`}>{campaign.title}</a></h3><p>Ended {new Date(campaign.deadline * 1000).toLocaleString()}</p></div>
                <div className="profile-refund-action"><strong>{formatEther(contributions.data[campaign.id])} ETH</strong><button disabled={refundLocked || !ready} aria-label={`Claim refund for ${campaign.title}`} onClick={() => claim(campaign.id)}>Claim refund</button></div>
              </li>)}</ul>
            </> : <div className="profile-empty"><h3>No refunds available right now</h3><p>Refunds become available after a campaign’s deadline if its goal was not reached and you still have an outstanding contribution.</p><a href="#/">Explore campaigns →</a></div>}
          </>}
        <p className="profile-refund-help">Successful campaigns are not refundable. A refund returns your outstanding contribution; MetaMask may charge a Sepolia network gas fee. Historical donation records remain visible after a refund.</p>
      </section>

      <section className="profile-panel" role="tabpanel" id={`${prefix}-panel-saved`} aria-labelledby={`${prefix}-tab-saved`} hidden={activeTab !== "saved"} tabIndex={0}>
        {offchainConfigured ? <><WalletSignIn wallet={wallet} /><SavedCampaigns campaigns={campaigns.campaigns} /></>
          : <><div className="profile-panel-heading"><div><h2>Saved campaigns</h2><p>Keep the projects you want to revisit in one place.</p></div></div><div className="profile-empty"><h3>Saved campaigns are not available yet</h3><p>The off-chain interaction service is not configured for this app. Wallet connection, on-chain donations and refunds remain available.</p><p>Once the service is configured, sign in with your wallet to save projects across devices. Saving does not require a gas fee.</p><a href="#/">Explore campaigns →</a></div></>}
      </section>
    </>}
  </section>;
}
