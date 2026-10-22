import useInteractionQuery from "../hooks/useInteractionQuery.js";
import { loadMetrics } from "../services/interactions.js";
import { offchainConfigured } from "../services/supabase.js";
import { interactionKey,keyString } from "../utils/interactionKey.js";
import { useState } from "react";
import useCampaigns from "../hooks/useCampaigns.js";
import useCategories from "../hooks/useCategories.js";
import useResource from "../hooks/useResource.js";
import { getDonationStatistics } from "../services/crowdfunding.js";
import { isV2 } from "../config/contracts.js";
import ContractStatus from "../components/ContractStatus.jsx";
import useNow from "../hooks/useNow.js";
import CampaignList from "../components/CampaignList.jsx";
import CampaignFilters from "../components/CampaignFilters.jsx";
import { contractConfigured, contractConfigMessage } from "../config/contracts.js";
import { selectCampaigns } from "../utils/campaigns.js";

export function ExploreCampaigns({ wallet, state }) {
  const categories = useCategories(wallet);
  const interactionMetrics=useInteractionQuery(signal=>loadMetrics(state.campaigns.map(campaign=>interactionKey(campaign.id)),signal),[state.campaigns.map(c=>c.id).join(",")],state.loaded && offchainConfigured);
  const metrics=new Map((interactionMetrics.data ?? []).map(metric=>[keyString(metric),{views:BigInt(metric.views),favorites:BigInt(metric.favorites)}]));
  const [categoryId,setCategoryId] = useState("");
  const [loadStats,setLoadStats] = useState(false);
  const statistics = useResource(wallet,signal=>getDonationStatistics(wallet.ethereum,signal),[state.data],loadStats && state.loaded);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState("newest");
  const now = useNow();
  const ready = contractConfigured && wallet.ethereum && wallet.isSepolia;
  const loaded = ready && state.loaded;
  const campaigns = selectCampaigns(state.campaigns.map(campaign=>({...campaign,offchainMetrics: metrics.get(keyString(interactionKey(campaign.id))),statistics: statistics.data ? statistics.data.byCampaign[campaign.id] ?? {donations:0n,donors:0n} : null})), { query, status, categoryId, sort: (!statistics.data && ["donations","donors"].includes(sort) || !interactionMetrics.data && ["views","favorites"].includes(sort)) ? "newest" : sort }, now);
  const filtered = query.trim() !== "" || status !== "All" || categoryId !== "";
  function reset() { setCategoryId(""); setQuery(""); setStatus("All"); setSort("newest"); }
  return <section className="explore-page" aria-labelledby="explore-heading">
    <div className="explore-heading">
      <div><p className="eyebrow">COMMUNITY FUNDING</p><h1 id="explore-heading">Explore Campaigns</h1><p className="page-subtitle">Discover projects and make an impact.</p></div>
      <a className="button create-link" href="#/create"><span aria-hidden="true">+</span> Create Campaign</a>
    </div>
    <ContractStatus wallet={wallet} />
    {isV2 && categories.error && <p role="alert">Categories: {categories.error}<button onClick={categories.reload}>Retry categories</button></p>}
    <div className="toolbar"><button disabled={statistics.loading || !loaded} onClick={()=>loadStats ? statistics.reload():setLoadStats(true)}>{statistics.loading?"Loading full donation history...":"Load / refresh donation statistics"}</button><button disabled={state.loading || !ready} onClick={()=>{state.reload();interactionMetrics.reload();}}>Refresh campaigns</button>{statistics.data && <span>Donation statistics through block {statistics.data.block}; recent blocks may reorganize.</span>}</div>
    {statistics.error && <p role="alert">Statistics unavailable: {statistics.error}</p>}
    {interactionMetrics.error && <p role="alert">Off-chain counters unavailable: {interactionMetrics.error}</p>}
    <CampaignFilters offchainReady={Boolean(interactionMetrics.data)} categories={categories.categories} categoryId={categoryId} onCategory={isV2?setCategoryId:undefined} statisticsReady={Boolean(statistics.data)} query={query} status={status} sort={sort} onQuery={setQuery} onStatus={setStatus} onSort={setSort} disabled={!loaded} />
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
