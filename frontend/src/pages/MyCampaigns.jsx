import useCampaigns from "../hooks/useCampaigns.js";
import CampaignList from "../components/CampaignList.jsx";
import ContractStatus from "../components/ContractStatus.jsx";

export default function MyCampaigns({ wallet }) {
  const state = useCampaigns(wallet);
  const campaigns = state.campaigns.filter((campaign) => campaign.creator.toLowerCase() === wallet.account.toLowerCase());
  return <section><h2>My Campaigns</h2><ContractStatus wallet={wallet} />
    {!wallet.account ? <p>Connect your wallet to view campaigns you created.</p> : <CampaignList {...state} campaigns={campaigns} />}
  </section>;
}
