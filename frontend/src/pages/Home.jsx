import { useState } from "react";
import useCampaigns from "../hooks/useCampaigns.js";
import useNow from "../hooks/useNow.js";
import CampaignList from "../components/CampaignList.jsx";
import CampaignFilters from "../components/CampaignFilters.jsx";
import { contractConfigured, contractConfigMessage } from "../config/contracts.js";
import { selectCampaigns } from "../utils/campaigns.js";

export function ExploreCampaigns({ wallet, state }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState("newest");
  const now = useNow();
  const ready = contractConfigured && wallet.ethereum && wallet.isSepolia;
  const loaded = ready && state.loaded;
  const campaigns = selectCampaigns(state.campaigns, { query, status, sort }, now);
  const filtered = query.trim() !== "" || status !== "All";
  function reset() { setQuery(""); setStatus("All"); setSort("newest"); }
  return <section className="explore-page" aria-labelledby="explore-heading">
    <div className="explore-heading">
      <div><p className="eyebrow">COMMUNITY FUNDING</p><h1 id="explore-heading">Explore Campaigns</h1><p className="page-subtitle">Discover projects and make an impact.</p></div>
      <a className="button create-link" href="#/create"><span aria-hidden="true">+</span> Create Campaign</a>
    </div>
    <CampaignFilters query={query} status={status} sort={sort} onQuery={setQuery} onStatus={setStatus} onSort={setSort} disabled={!loaded} />
    {!contractConfigured ? <div className="list-state" role="status"><h3>Contract configuration required</h3><p>{contractConfigMessage}</p></div>
      : !wallet.ethereum ? <div className="list-state" role="status"><h3>Connect to explore campaigns</h3><p>Install or enable MetaMask, then refresh this page to read real projects on Sepolia.</p></div>
      : !wallet.isSepolia ? <div className="list-state" role="status"><h3>Switch to Sepolia</h3><p>Select the Sepolia test network to load campaigns.</p><button onClick={wallet.switchToSepolia} disabled={wallet.busy}>Switch to Sepolia</button></div>
      : <>
        {loaded && <div className="results-summary"><span role="status">{campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}{filtered ? ` of ${state.campaigns.length}` : ""}</span><span>Ethereum Sepolia</span></div>}
        <CampaignList campaigns={campaigns} loading={state.loading || (!state.loaded && !state.error)} error={state.error} now={now}
          filtered={filtered && state.campaigns.length > 0} onReset={reset} onRetry={state.reload} />
      </>}
  </section>;
}

export default function Home({ wallet }) {
  const state = useCampaigns(wallet);
  return <ExploreCampaigns wallet={wallet} state={state} />;
}
