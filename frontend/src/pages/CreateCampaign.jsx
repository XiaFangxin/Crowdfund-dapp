import { useState } from "react";
import useCategories from "../hooks/useCategories.js";
import useTransaction from "../hooks/useTransaction.js";
import TransactionStatus from "../components/TransactionStatus.jsx";
import CampaignMetadata from "../components/CampaignMetadata.jsx";
import { fetchDocument } from "../services/metadata.js";
import { createCampaign, setCampaignMetadataURI } from "../services/crowdfunding.js";
import { contractConfigured, isV2 } from "../config/contracts.js";
import ContractStatus from "../components/ContractStatus.jsx";

export default function CreateCampaign({wallet}) {
  const categories=useCategories(wallet); const transaction=useTransaction();
  const [uri,setURI]=useState(""); const [preview,setPreview]=useState(""); const [created,setCreated]=useState(null); const [attached,setAttached]=useState(false);
  const ready=contractConfigured && wallet.account && wallet.isSepolia && !transaction.busy;
  async function submit(event) {
    event.preventDefault(); const values=Object.fromEntries(new FormData(event.currentTarget));
    const result=await transaction.run(async emit=>{
      if(isV2 && uri)await fetchDocument(uri);
      return createCampaign(wallet.ethereum,wallet.account,values,emit);
    });
    if(result)setCreated(result);
  }
  async function attach() {
    const result=await transaction.run(async emit=>{
      await fetchDocument(uri);
      return setCampaignMetadataURI(wallet.ethereum,wallet.account,created.campaignId,uri,emit);
    });
    if(result)setAttached(true);
  }
  return <section><h1>Create Campaign</h1><ContractStatus wallet={wallet}/>
    <p>Connect with MetaMask. No email or password account is required.</p>
    {created ? <div className="notice"><h2>Campaign #{created.campaignId} created</h2><p>The campaign is already open for contributions. Do not create it again if metadata attachment fails.</p><a href={`#/campaign/${created.campaignId}`}>View campaign</a>
      {isV2 && !attached && <><label>Metadata URI<input value={uri} onChange={event=>setURI(event.target.value)} maxLength={2048}/></label><button disabled={!ready || !uri} onClick={attach}>Attach metadata (second transaction)</button></>}{attached && <p>Metadata attached.</p>}</div>
    : <form onSubmit={submit}>
      <fieldset disabled={!ready}><label>Title<input name="title" required maxLength={120}/></label><label>Description<textarea name="description" maxLength={2000}/></label><label>Goal (ETH)<input name="goal" required inputMode="decimal" placeholder="0.1"/></label><label>Deadline (local time)<input name="deadline" required type="datetime-local"/></label>
      {isV2 && <><label>Category<select name="categoryId" required defaultValue=""><option value="">Select an enabled category</option>{categories.categories.filter(category=>category.active).map(category=><option key={category.id} value={category.id}>{category.name} #{category.id}</option>)}</select></label>
      {categories.loading && <p>Loading categories...</p>}{categories.error && <p role="alert">{categories.error}</p>}{!categories.loading && !categories.categories.some(c=>c.active) && <p>No enabled categories are available.</p>}
      <label>Metadata URI (optional)<input value={uri} onChange={event=>{setURI(event.target.value);setPreview("");}} maxLength={2048} placeholder="ipfs://... or https://..."/></label><button type="button" disabled={!uri} onClick={()=>setPreview(uri)}>Validate and preview JSON</button></>}
      <button disabled={isV2 && (categories.loading || Boolean(categories.error) || !categories.categories.some(c=>c.active))}>Create campaign{isV2 && uri?" (step 1 of 2)":""}</button></fieldset>
    </form>}
    {isV2 && <><p>No image upload service is implemented. Host and pin your image and JSON first, then paste the public JSON URI. Category is selected on chain, not in JSON. Remote content must permit browser CORS access. Metadata is validated again before submission.</p><button disabled={categories.loading} onClick={categories.reload}>Refresh categories</button></>}
    {isV2 && <details><summary>Expected metadata JSON</summary><pre>{JSON.stringify({schemaVersion:"1.0",image:"ipfs://YOUR_IMAGE_CID/cover.png",summary:"Short summary",additionalDescription:"Detailed project description"},null,2)}</pre></details>}
    {preview && <CampaignMetadata uri={preview}/>}
    <TransactionStatus transaction={transaction}/>
  </section>;
}
