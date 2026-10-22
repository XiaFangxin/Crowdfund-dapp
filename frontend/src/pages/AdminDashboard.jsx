import WalletSignIn from "../components/offchain/WalletSignIn.jsx";
import AdminReports from "../components/offchain/AdminReports.jsx";
import { useState } from "react";
import { formatEther } from "ethers";
import useContractOwner from "../hooks/useContractOwner.js";
import useResource from "../hooks/useResource.js";
import useTransaction from "../hooks/useTransaction.js";
import TransactionStatus from "../components/TransactionStatus.jsx";
import ContractStatus from "../components/ContractStatus.jsx";
import { listCampaigns, listCategories, setCampaignPaused, addCategory, renameCategory, setCategoryActive } from "../services/crowdfunding.js";
import { isV2 } from "../config/contracts.js";
import { campaignStatus } from "../utils/campaigns.js";
import useNow from "../hooks/useNow.js";
export default function AdminDashboard({wallet}) {
  const ownership=useContractOwner(wallet); const tx=useTransaction(); const now=useNow();
  const data=useResource(wallet,async signal=>{const campaigns=await listCampaigns(wallet.ethereum,signal);const categories=await listCategories(wallet.ethereum,signal);return {campaigns,categories};},[],ownership.isOwner);
  const [name,setName]=useState(""); const [names,setNames]=useState({});
  const campaigns=data.data?.campaigns ?? []; const categories=data.data?.categories ?? [];
  async function act(action){const receipt=await tx.run(action);if(receipt){data.reload();ownership.reload();setName("");setNames({});}}
  if(!isV2)return <section><h1>Admin Dashboard</h1><ContractStatus wallet={wallet}/><p>V2 deployment and configuration are required for administrator tools.</p></section>;
  return <section><h1>Admin Dashboard</h1><ContractStatus wallet={wallet}/><p>Connected account: <code>{wallet.account || "Not connected"}</code></p>
    {ownership.loading && <p>Reading contract administrator...</p>}{ownership.error && <p role="alert">{ownership.error}</p>}
    {ownership.data && <><p>On-chain owner: <code>{ownership.data.owner}</code></p><p>Pending owner: <code>{ownership.data.pendingOwner}</code></p></>}
    <button onClick={()=>{ownership.reload();data.reload();}} disabled={tx.busy}>Refresh permissions and data</button>
    <WalletSignIn wallet={wallet}/>
    {!ownership.isOwner ? <p role="status">{ownership.loading ? "Checking administrator permissions..." : ownership.data ? "Permission denied. Only the current on-chain administrator can access these controls. A pending ownership nomination does not grant permission." : "Administrator access is unavailable until a wallet is connected on Sepolia and contract permissions are successfully read."}</p>:<>
      <p>Administrative access verified on chain. Contract checks remain authoritative. No administrative function can seize campaign funds.</p>
      {data.loading && <p>Loading platform data...</p>}{data.error && <p role="alert">{data.error}</p>}
      {data.data && <><div className="contributions-stats"><div className="contributions-stat"><span>Campaigns</span><strong>{campaigns.length}</strong></div><div className="contributions-stat"><span>Historical raised</span><strong>{formatEther(campaigns.reduce((sum,c)=>sum+c.amountRaised,0n))} ETH</strong></div><div className="contributions-stat"><span>Paused campaigns / Enabled categories</span><strong>{campaigns.filter(c=>c.paused).length} / {categories.filter(c=>c.active).length}</strong></div></div><p>Historical raised is not the current escrow balance, platform revenue or an amount the administrator can withdraw.</p>
      <h2>All campaigns</h2><ul className="record-list">{campaigns.map(campaign=><li key={campaign.id}><a href={`#/campaign/${campaign.id}`}>#{campaign.id} {campaign.title}</a><p>{campaignStatus(campaign,now)} / Category {campaign.category.name} #{campaign.categoryId} / New contributions {campaign.paused?"paused":"not paused"}</p><button disabled={tx.busy} onClick={()=>act(emit=>setCampaignPaused(wallet.ethereum,wallet.account,campaign.id,!campaign.paused,emit))}>{campaign.paused?"Resume":"Pause"} new contributions</button><p>Existing withdrawal and refund eligibility is unaffected.</p></li>)}</ul>
      <h2>Category management</h2><p>Names: 1-64 printable ASCII characters, no surrounding spaces. Stable IDs cannot be deleted; disabling affects new campaigns only.</p>
      <form onSubmit={event=>{event.preventDefault();void act(emit=>addCategory(wallet.ethereum,wallet.account,name,emit));}}><label>New category name<input value={name} onChange={event=>setName(event.target.value)} required maxLength={64}/></label><button disabled={tx.busy}>Add category</button></form>
      <ul className="record-list">{categories.map(category=><li key={category.id}><p>#{category.id}: {category.name} / {category.active?"Enabled":"Inactive"}</p><form onSubmit={event=>{event.preventDefault();void act(emit=>renameCategory(wallet.ethereum,wallet.account,category.id,names[category.id] ?? category.name,emit));}}><label>Rename category #{category.id}<input value={names[category.id] ?? category.name} onChange={event=>setNames(previous=>({...previous,[category.id]:event.target.value}))} required maxLength={64}/></label><button disabled={tx.busy || (names[category.id] ?? category.name)===category.name}>Rename</button></form><button disabled={tx.busy} onClick={()=>act(emit=>setCategoryActive(wallet.ethereum,wallet.account,category.id,!category.active,emit))}>{category.active?"Disable":"Restore"} category</button></li>)}</ul></>}
      <AdminReports transactionBusy={tx.busy} onPause={id=>act(emit=>setCampaignPaused(wallet.ethereum,wallet.account,id,true,emit))}/>
      <TransactionStatus transaction={tx}/>
    </>}
  </section>;
}
