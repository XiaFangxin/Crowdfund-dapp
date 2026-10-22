import { useState } from "react";
import useInteractionQuery from "../../hooks/useInteractionQuery.js";
import useOffchainAction from "../../hooks/useOffchainAction.js";
import { useWalletSession } from "../../hooks/useWalletSession.jsx";
import { keyString,sameDeployment } from "../../utils/interactionKey.js";
import { offchainConfigured } from "../../services/supabase.js";
export default function SavedCampaigns({campaigns=[]}){
  const auth=useWalletSession(),action=useOffchainAction();const [offset,setOffset]=useState(0);
  const state=useInteractionQuery(signal=>auth.request("saved.list",{offset},{signal}),[auth.wallet,auth.sessionKey,offset],auth.signedIn);
  if(!offchainConfigured)return null;
  async function unsave(record){const result=await action.run(()=>auth.request("favorite.set",{...record,saved:false}));if(result)state.reload();}
  return <section className="offchain-panel"><h2>Saved Campaigns</h2><p>Saved to your verified wallet across devices. Other deployments are labeled separately and do not link to the current campaign ID.</p>
    {!auth.signedIn?<p>Sign in with your wallet to load saved campaigns.</p>:<><button disabled={state.loading} onClick={state.reload}>Refresh saved campaigns</button>{state.loading && <p>Loading saved campaigns...</p>}{state.error && <p role="alert">{state.error}</p>}<ul className="record-list">{state.data?.map(record=>{const current=sameDeployment(record);const campaign=current?campaigns.find(item=>item.id===record.campaignId):null;return <li key={keyString(record)}>{current?<a href={`#/campaign/${record.campaignId}`}>{campaign?.title ?? `Campaign #${record.campaignId}`}</a>:<strong>Campaign #{record.campaignId} on another deployment</strong>}<p>Chain {record.chainId} / <code>{record.contractAddress}</code></p><button disabled={action.busy} onClick={()=>unsave(record)}>Unsave (no gas)</button></li>;})}</ul>{state.data?.length===0 && <p>No saved campaigns on this page.</p>}
    <div className="toolbar"><button disabled={state.loading || offset===0} onClick={()=>setOffset(value=>Math.max(0,value-20))}>Previous</button><span>Page {offset/20+1}</span><button disabled={state.loading || state.data?.length!==20 || offset>=10000} onClick={()=>setOffset(value=>value+20)}>Next</button></div></>}
    {action.error && <p role="alert">{action.error}</p>}{action.message && <p role="status">{action.message}</p>}
  </section>;
}
