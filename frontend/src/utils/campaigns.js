export const CAMPAIGN_STATUSES = ["Active", "Paused", "Successful", "Failed", "Withdrawn"];

export function campaignStatus(campaign, now = Date.now() / 1000) {
  if (campaign.withdrawn) return "Withdrawn";
  if (campaign.deadline > now) return campaign.paused ? "Paused" : "Active";
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

// Off-chain counters are optional approximate statistics, separate from chain funding.
export function selectCampaigns(campaigns, { query = "", status = "All", categoryId = "", sort = "newest" } = {}, now = Date.now() / 1000) {
  const keyword = query.trim().toLowerCase();
  return campaigns.filter(campaign =>
    (!keyword || `${campaign.title}\n${campaign.description}`.toLowerCase().includes(keyword)) &&
    (status === "All" || campaignStatus(campaign, now) === status) &&
    (categoryId === "" || String(campaign.categoryId) === String(categoryId))
  ).sort((a, b) => {
    const primary = sort === "oldest" ? compare(BigInt(a.id), BigInt(b.id))
      : sort === "ending" ? compare(a.deadline, b.deadline)
      : sort === "deadline-latest" ? compare(b.deadline, a.deadline)
      : sort === "raised" ? compare(b.amountRaised, a.amountRaised)
      : sort === "progress" ? compare(b.amountRaised * a.goal, a.amountRaised * b.goal)
      : sort === "views" || sort === "favorites" ? compare(b.offchainMetrics?.[sort] ?? -1n,a.offchainMetrics?.[sort] ?? -1n)
      : sort === "donations" || sort === "donors" ? compare(b.statistics?.[sort] ?? -1n, a.statistics?.[sort] ?? -1n) : 0;
    return primary || compare(BigInt(b.id), BigInt(a.id));
  });
}
export function countdown(deadline, now) {
  const seconds=Math.max(0,Math.floor(deadline-now));
  if(!seconds)return "Ended";
  return `${Math.floor(seconds/86400)}d ${Math.floor(seconds%86400/3600)}h ${Math.floor(seconds%3600/60)}m ${seconds%60}s remaining`;
}
export function refundable(campaign, contribution, now) {
  return campaign.deadline<=now && campaign.amountRaised<campaign.goal && contribution>0n;
}
