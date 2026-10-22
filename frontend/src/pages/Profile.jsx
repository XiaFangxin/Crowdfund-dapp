import WalletSignIn from "../components/offchain/WalletSignIn.jsx";
import SavedCampaigns from "../components/offchain/SavedCampaigns.jsx";
import { formatEther } from "ethers";
import useCampaigns from "../hooks/useCampaigns.js";
import useResource from "../hooks/useResource.js";
import useTransaction from "../hooks/useTransaction.js";
import useNow from "../hooks/useNow.js";
import { CreatedCampaigns } from "./MyCampaigns.jsx";
import MyContributions from "./MyContributions.jsx";
import ContractStatus from "../components/ContractStatus.jsx";
import TransactionStatus from "../components/TransactionStatus.jsx";
import { getWalletContributions, refund } from "../services/crowdfunding.js";
import { refundable } from "../utils/campaigns.js";
export default function Profile({wallet}) {
  const campaigns=useCampaigns(wallet); const tx=useTransaction(); const now=useNow();
  const contributions=useResource(wallet,signal=>getWalletContributions(wallet.ethereum,campaigns.campaigns,wallet.account,signal),[campaigns.data],Boolean(wallet.account && campaigns.loaded));
  const supported=campaigns.campaigns.filter(campaign=>(contributions.data?.[campaign.id] ?? 0n)>0n);
  const canRefund=supported.filter(campaign=>refundable(campaign,contributions.data[campaign.id],now));
  async function claim(id){const receipt=await tx.run(emit=>refund(wallet.ethereum,wallet.account,id,emit));if(receipt){contributions.reload();campaigns.reload();}}
  return <section><h1>Profile</h1><ContractStatus wallet={wallet}/><WalletSignIn wallet={wallet}/>{!wallet.account?<p>Connect your MetaMask wallet. Your address is your identity; no password or email login.</p>:<>
    <p>Current account: <a href={`https://sepolia.etherscan.io/address/${wallet.account}`} target="_blank" rel="noopener noreferrer">{wallet.account}</a></p><p>Changing wallets clears personal data. Submitted transactions cannot be cancelled by switching accounts; inspect MetaMask Activity.</p><button disabled={campaigns.loading} onClick={()=>{campaigns.reload();contributions.reload();}}>Refresh Profile</button>
    <SavedCampaigns campaigns={campaigns.campaigns}/>
    <CreatedCampaigns wallet={wallet} state={campaigns}/>
    <h2>My Contributions / Current Refunds</h2>{contributions.loading && <p>Reading outstanding contributions...</p>}{contributions.error && <p role="alert">{contributions.error}</p>}
    {contributions.data && <><p>{canRefund.length} projects currently refundable. Successful campaign contributions may remain recorded after payout; they are not refundable.</p>{supported.length===0 && <p>No outstanding contribution records.</p>}<ul className="record-list">{supported.map(campaign=><li key={campaign.id}><a href={`#/campaign/${campaign.id}`}>{campaign.title}</a> / {formatEther(contributions.data[campaign.id])} ETH / {refundable(campaign,contributions.data[campaign.id],now)?<button disabled={tx.busy || !wallet.isSepolia} onClick={()=>claim(campaign.id)}>Claim refund</button>:<span>{campaign.amountRaised>=campaign.goal?"Goal reached: no refund":"Awaiting deadline"}</span>}</li>)}</ul></>}
    <TransactionStatus transaction={tx}/><MyContributions key={tx.status==="success"?tx.hash:"history"} wallet={wallet} campaigns={campaigns.campaigns} embedded/>
  </>}</section>;
}
