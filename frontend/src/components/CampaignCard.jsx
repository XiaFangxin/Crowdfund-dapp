import CampaignMetadata from "./CampaignMetadata.jsx";
import { formatEther } from "ethers";
import { campaignStatus, fundingProgress, countdown } from "../utils/campaigns.js";

const deadlineFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function CampaignCard({ campaign, now }) {
  const status = campaignStatus(campaign, now);
  const progress = fundingProgress(campaign.amountRaised, campaign.goal);
  const date = new Date(campaign.deadline * 1000);
  return <article className="campaign-card">
    <div className="card-topline">
      <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>
      <span className="campaign-id">#{campaign.id}</span>
    </div>
    {campaign.metadataURI && <CampaignMetadata uri={campaign.metadataURI} compact />}
    {campaign.category && <p>{campaign.category.name} #{campaign.categoryId}{campaign.category.active ? "" : " (category inactive)"}</p>}
    <p>{countdown(campaign.deadline,now)}</p>
    {campaign.offchainMetrics && <p>{String(campaign.offchainMetrics.views)} approximate views / {String(campaign.offchainMetrics.favorites)} saves (off chain)</p>}
    {campaign.statistics && <p>{String(campaign.statistics.donations)} donations / {String(campaign.statistics.donors)} unique donors</p>}
    <h3 className="campaign-title" title={campaign.title}>{campaign.title}</h3>
    <p className="campaign-description" title={campaign.description}>{campaign.description || "No description provided."}</p>
    <div className="campaign-funding">
      <div className="campaign-amounts">
        <strong>{formatEther(campaign.amountRaised)} ETH raised</strong>
        <span>{formatEther(campaign.goal)} ETH goal</span>
      </div>
      <div className="funding-track" role="progressbar" aria-label={`Funding for ${campaign.title}`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.width} aria-valuetext={`${progress.percentage}% funded`}>
        <span className="funding-fill" style={{ width: `${progress.width}%` }} />
      </div>
      <div className="campaign-meta">
        <span>{progress.percentage}% funded</span>
        <time dateTime={date.toISOString()}>{campaign.deadline > now ? "Ends" : "Ended"} {deadlineFormat.format(date)}</time>
      </div>
    </div>
    <a className="button card-link" href={`#/campaign/${campaign.id}`} aria-label={`View campaign: ${campaign.title}`}>
      View Campaign <span aria-hidden="true">→</span>
    </a>
    {campaign.withdrawn && <span className="sr-only">Raised amount is the historical total, not the remaining balance.</span>}
  </article>;
}
