import useCampaigns from "../hooks/useCampaigns.js";
import CampaignList from "../components/CampaignList.jsx";
import ContractStatus from "../components/ContractStatus.jsx";

export default function Home({ wallet }) {
  const state = useCampaigns(wallet);
  return <section><h2>Home</h2><p>Explore community campaigns. This is a team development demo.</p>
    <ContractStatus wallet={wallet} /><CampaignList {...state} />
  </section>;
}
