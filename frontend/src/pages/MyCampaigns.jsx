import { contractConfigured } from "../config/contracts.js";
import useCampaigns from "../hooks/useCampaigns.js";
import CampaignList from "../components/CampaignList.jsx";
import ContractStatus from "../components/ContractStatus.jsx";
export function CreatedCampaigns({wallet,state}) {
  const campaigns=state.campaigns.filter(campaign=>campaign.creator.toLowerCase()===(wallet.account ?? "").toLowerCase());
  return <div><h2>My Created Campaigns</h2>{wallet.ethereum && wallet.account && wallet.isSepolia && contractConfigured ? <CampaignList {...state} loading={state.loading || (!state.loaded && !state.error)} campaigns={campaigns} onRetry={state.reload}/>:<p>Connect your wallet on Sepolia to see created campaigns.</p>}</div>;
}
export default function MyCampaigns({wallet}) {
  const state=useCampaigns(wallet);
  return <section><ContractStatus wallet={wallet}/><p><a href="#/profile">Open your full Profile</a></p><CreatedCampaigns wallet={wallet} state={state}/></section>;
}
