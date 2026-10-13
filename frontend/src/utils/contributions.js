export function contributionSummary(records) {
  const donations = records.filter((record) => record.type === "Donation");
  const refunds = records.filter((record) => record.type === "Refund");
  return {
    donations,
    refunds,
    totalDonated: donations.reduce((total, record) => total + record.amountWei, 0n),
    totalRefunded: refunds.reduce((total, record) => total + record.amountWei, 0n),
    supportedProjects: new Set(donations.map((record) => record.campaignId)).size,
  };
}

export function filterContributionRecords(records, names, query) {
  const keyword = query.trim().toLowerCase();
  return records.filter((record) => `${names.get(record.campaignId) ?? `Campaign #${record.campaignId}`} ${record.transactionHash}`.toLowerCase().includes(keyword));
}
