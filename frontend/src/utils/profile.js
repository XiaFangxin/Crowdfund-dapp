import { refundable } from "./campaigns.js";

export function profileCampaigns(campaigns, account, contributions, now) {
  const created = account ? campaigns.filter(campaign => campaign.creator.toLowerCase() === account.toLowerCase()) : [];
  // A missing balance response means unknown, rather than a zero balance.
  if (contributions === null) return { created, supported: null, refundable: null, totalRefundable: null };
  const supported = campaigns.filter(campaign => (contributions[campaign.id] ?? 0n) > 0n);
  const eligible = supported.filter(campaign => refundable(campaign, contributions[campaign.id], now));
  return {
    created,
    supported,
    refundable: eligible,
    totalRefundable: eligible.reduce((total, campaign) => total + contributions[campaign.id], 0n),
  };
}
