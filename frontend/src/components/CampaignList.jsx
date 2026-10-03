import { formatEther } from "ethers";

export default function CampaignList({ campaigns, loading, error }) {
  if (loading) return <p role="status">Loading campaigns…</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!campaigns.length) return <p>No campaigns to display.</p>;
  return <ul>{campaigns.map((campaign) => <li key={campaign.id}>
    <a href={`#/campaign/${campaign.id}`}>{campaign.title}</a>
    {" — "}{formatEther(campaign.amountRaised)} / {formatEther(campaign.goal)} ETH
  </li>)}</ul>;
}
