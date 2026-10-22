import WalletSignIn from "../components/offchain/WalletSignIn.jsx";
import Views from "../components/offchain/Views.jsx";
import FavoriteButton from "../components/offchain/FavoriteButton.jsx";
import ReportDialog from "../components/offchain/ReportDialog.jsx";
import CommentSection from "../components/offchain/CommentSection.jsx";
import { interactionKey } from "../utils/interactionKey.js";
﻿import { useState } from "react";
import { formatEther } from "ethers";
import useResource from "../hooks/useResource.js";
import useNow from "../hooks/useNow.js";
import useTransaction from "../hooks/useTransaction.js";
import TransactionStatus from "../components/TransactionStatus.jsx";
import CampaignMetadata from "../components/CampaignMetadata.jsx";
import ContractStatus from "../components/ContractStatus.jsx";
import { getCampaign, getContribution, contribute, withdraw, refund, getCampaignUpdates, setCampaignMetadataURI, publishCampaignUpdate } from "../services/crowdfunding.js";
import { fetchDocument } from "../services/metadata.js";
import { isV2, contractConfigured } from "../config/contracts.js";
import { campaignStatus, fundingProgress, countdown, refundable } from "../utils/campaigns.js";

export default function CampaignDetail({wallet,id}) {
  const offchainKey=interactionKey(id);
  const data=useResource(wallet,async()=>{const [campaign,contribution]=await Promise.all([getCampaign(wallet.ethereum,id),wallet.account?getContribution(wallet.ethereum,id,wallet.account):0n]);return {campaign,contribution};},[id]);
  const updates=useResource(wallet,signal=>getCampaignUpdates(wallet.ethereum,id,signal),[id],isV2);
  const [amount,setAmount]=useState(""); const [metadata,setMetadata]=useState(""); const [update,setUpdate]=useState(""); const [preview,setPreview]=useState(null);
  const now=useNow(); const tx=useTransaction(); const campaign=data.data?.campaign; const contribution=data.data?.contribution ?? 0n;
  const ready=contractConfigured && wallet.account && wallet.isSepolia && !tx.busy;
  const creator=campaign?.creator.toLowerCase()===wallet.account.toLowerCase();
  const ended=campaign && campaign.deadline<=now; const successful=campaign && campaign.amountRaised>=campaign.goal;
  async function transact(action){const receipt=await tx.run(action);if(receipt){data.reload();updates.reload();}}
  const progress=campaign?fundingProgress(campaign.amountRaised,campaign.goal):null;
  return <section><h1>Campaign #{id}</h1><ContractStatus wallet={wallet}/><WalletSignIn wallet={wallet}/>{offchainKey && <><Views campaignKey={offchainKey}/><FavoriteButton campaignKey={offchainKey}/><ReportDialog campaignKey={offchainKey}/></>}<button disabled={data.loading} onClick={()=>{data.reload();updates.reload();}}>Refresh chain data</button>
    {data.loading && <p role="status">Loading campaign...</p>}{data.error && <p role="alert">{data.error}</p>}
    {campaign && <><h2>{campaign.title}</h2><p className="plain-text">{campaign.description}</p>
      {campaign.category && <p>Category: {campaign.category.name} #{campaign.categoryId}{!campaign.category.active && " (inactive for new projects)"}</p>}
      {isV2 && <CampaignMetadata uri={campaign.metadataURI}/>}
      <p>Creator: <a href={`https://sepolia.etherscan.io/address/${campaign.creator}`} target="_blank" rel="noopener noreferrer">{campaign.creator}</a></p>
      <p>Raised: {formatEther(campaign.amountRaised)} / {formatEther(campaign.goal)} ETH (historical total)</p>
      <div className="funding-track" role="progressbar" aria-label="Campaign funding" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.width} aria-valuetext={`${progress.percentage}% funded`}><span className="funding-fill" style={{width:`${progress.width}%`}}/></div>
      <p>{progress.percentage}% funded / {countdown(campaign.deadline,now)}</p><p>Deadline: {new Date(campaign.deadline*1000).toLocaleString()}</p>
      <p>Status: {campaignStatus(campaign,now)}{campaign.paused && ended ? " / new donations paused":""}</p>
      <form onSubmit={event=>{event.preventDefault();void transact(emit=>contribute(wallet.ethereum,wallet.account,id,amount,emit));}}><label>Contribution (ETH)<input value={amount} onChange={event=>setAmount(event.target.value)} required inputMode="decimal"/></label><button disabled={!ready || ended || campaign.paused}>Contribute</button></form>
      <button disabled={!ready || !creator || !ended || !successful || campaign.withdrawn} onClick={()=>transact(emit=>withdraw(wallet.ethereum,wallet.account,id,emit))}>Withdraw</button>{" "}
      <button disabled={!ready || !refundable(campaign,contribution,now)} onClick={()=>transact(emit=>refund(wallet.ethereum,wallet.account,id,emit))}>Refund {formatEther(contribution)} ETH</button>
      <p>{!ended ? "Withdrawals and refunds become available after the deadline.":successful ? campaign.withdrawn?"Funds have already been withdrawn.":"Goal reached: only the creator may withdraw; refunds are unavailable.":contribution>0n?"Your refund is available. Project or category pause does not prevent refunds.":"No outstanding contribution to refund from this wallet."}</p>
      {isV2 && <><h2>Project updates</h2>{updates.loading && <p>Loading update history...</p>}{updates.error && <p role="alert">{updates.error}</p>}{updates.data?.length===0 && <p>No updates published.</p>}{updates.data?.map(record=><article className="update-card" key={record.id}><p>On-chain publication: {new Date(record.timestamp*1000).toLocaleString()} / <a href={`https://sepolia.etherscan.io/tx/${record.transactionHash}`} target="_blank" rel="noopener noreferrer">View transaction</a></p><code>{record.uri}</code><CampaignMetadata uri={record.uri} kind="update"/></article>)}</>}
      {isV2 && creator && <div><h2>Creator tools</h2><p>URI content must already be publicly hosted. Uploads are not implemented. Goal, deadline and category cannot be changed.</p>
        <form onSubmit={event=>{event.preventDefault();void transact(async emit=>{await fetchDocument(metadata);return setCampaignMetadataURI(wallet.ethereum,wallet.account,id,metadata,emit);});}}><label>New metadata URI<input value={metadata} onChange={event=>setMetadata(event.target.value)} required maxLength={2048}/></label><button disabled={!ready}>Update metadata</button><button type="button" disabled={!metadata || tx.busy} onClick={()=>setPreview({uri:metadata,kind:"metadata"})}>Preview metadata</button></form>
        <form onSubmit={event=>{event.preventDefault();void transact(async emit=>{await fetchDocument(update,"update");return publishCampaignUpdate(wallet.ethereum,wallet.account,id,update,emit);});}}><label>New update URI<input value={update} onChange={event=>setUpdate(event.target.value)} required maxLength={2048}/></label><button disabled={!ready}>Publish update</button><button type="button" disabled={!update || tx.busy} onClick={()=>setPreview({uri:update,kind:"update"})}>Preview update</button></form>
        {preview && <CampaignMetadata uri={preview.uri} kind={preview.kind}/>}</div>}
    </>}
    {offchainKey && <CommentSection campaignKey={offchainKey} wallet={wallet}/>}
    <TransactionStatus transaction={tx}/>
  </section>;
}
