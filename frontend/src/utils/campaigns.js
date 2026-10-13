export const CAMPAIGN_STATUSES = ["Active", "Successful", "Failed", "Withdrawn"];

export function campaignStatus(campaign, now = Date.now() / 1000) {
  if (campaign.withdrawn) return "Withdrawn";
  if (campaign.deadline > now) return "Active";
  return campaign.amountRaised >= campaign.goal ? "Successful" : "Failed";
}

export function fundingProgress(amountRaised, goal) {
  if (goal <= 0n || amountRaised <= 0n) return { percentage: "0", width: 0 };
  // Convert only the capped bar value to Number; money arithmetic stays bigint.
  const basisPoints = amountRaised * 10000n / goal;
  const whole = basisPoints / 100n;
  const decimals = (basisPoints % 100n).toString().padStart(2, "0").replace(/0+$/, "");
  const percentage = basisPoints === 0n ? "<0.01" : `${whole}${decimals ? `.${decimals}` : ""}`;
  return { percentage, width: Number(basisPoints > 10000n ? 10000n : basisPoints) / 100 };
}

function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

export function selectCampaigns(campaigns, { query = "", status = "All", sort = "newest" } = {}, now = Date.now() / 1000) {
  const keyword = query.trim().toLowerCase();
  return campaigns.filter((campaign) =>
    (!keyword || `${campaign.title}\n${campaign.description}`.toLowerCase().includes(keyword)) &&
    (status === "All" || campaignStatus(campaign, now) === status),
  ).sort((a, b) => {
    const primary = sort === "ending" ? compare(a.deadline, b.deadline)
      : sort === "raised" ? compare(b.amountRaised, a.amountRaised) : 0;
    return primary || compare(BigInt(b.id), BigInt(a.id));
  });
}
