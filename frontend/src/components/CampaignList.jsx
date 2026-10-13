import CampaignCard from "./CampaignCard.jsx";
import useNow from "../hooks/useNow.js";

export default function CampaignList({ campaigns, loading, error, now, filtered = false, onReset, onRetry }) {
  const currentTime = useNow();
  if (loading) return <div className="list-state" role="status"><span className="loading-spinner" aria-hidden="true" /><h3>Loading campaigns…</h3><p>Reading projects from Sepolia.</p></div>;
  if (error) return <div className="list-state error-state" role="alert"><h3>Unable to load campaigns</h3><p>{error}</p>{onRetry && <button onClick={onRetry}>Try again</button>}</div>;
  if (!campaigns.length) return <div className="list-state" role="status">
    <h3>{filtered ? "No matching campaigns" : "No campaigns yet"}</h3>
    <p>{filtered ? "Try another keyword or clear your filters." : "Be the first to bring a community project to life."}</p>
    {filtered && onReset ? <button onClick={onReset}>Clear filters</button> : <a className="button" href="#/create">Create Campaign</a>}
  </div>;
  return <div className="campaign-grid">{campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} now={now ?? currentTime} />)}</div>;
}
