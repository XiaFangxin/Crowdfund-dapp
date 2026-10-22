import { useState } from "react";
import { useWalletSession } from "../../hooks/useWalletSession.jsx";
import useInteractionQuery from "../../hooks/useInteractionQuery.js";
import useOffchainAction from "../../hooks/useOffchainAction.js";
import { sameDeployment } from "../../utils/interactionKey.js";
import { isV2 } from "../../config/contracts.js";
import { offchainConfigured } from "../../services/supabase.js";
export default function AdminReports({onPause,transactionBusy=false}){
  const auth=useWalletSession(),action=useOffchainAction();const [offset,setOffset]=useState(0),[status,setStatus]=useState("open"),[hide,setHide]=useState({});
  const state=useInteractionQuery(signal=>auth.request("reports.list",{offset,status},{signal}),[auth.wallet,auth.sessionKey,offset,status],auth.signedIn);
  if(!offchainConfigured)return null;
  async function moderate(record,newStatus){
    const result=await action.run(()=>auth.request("report.moderate",{id:record.id,status:newStatus,hideComment:newStatus==="resolved" && hide[record.id]===true,requestId:crypto.randomUUID()}),"Report status updated off chain. No on-chain transaction was sent.");if(result)state.reload();
  }
  function pause(record){if(window.confirm(`Submit a Sepolia transaction to pause NEW contributions for campaign #${record.campaignId}? MetaMask will request your explicit signature. Refunds and withdrawals are unaffected.`))onPause(record.campaignId);}
  return <section className="offchain-panel"><h2>Reports & Moderation</h2><p>The server rechecks the current V2 owner for every report read and moderation request. Resolving a report never pauses funding automatically.</p>
    {!auth.signedIn?<p>Sign in to the off-chain service with your administrator wallet first.</p>:<><label>Report status<select value={status} onChange={event=>{setStatus(event.target.value);setOffset(0);}}>{["open","in_review","resolved","dismissed"].map(value=><option key={value}>{value}</option>)}<option value="">All</option></select></label><button disabled={state.loading} onClick={state.reload}>Refresh reports</button>
      {state.loading && <p>Verifying server permissions and loading reports...</p>}{state.error && <p role="alert">{state.error}</p>}{state.data?.length===0 && <p>No reports on this page.</p>}
      <ul className="record-list">{state.data?.map(record=><li key={record.id}><h3>{record.targetKind} report / {record.status}</h3><p>Campaign #{record.campaignId} / Chain {record.chainId} / <code>{record.contractAddress}</code></p><p>Reported by {record.wallet.slice(0,6)}...{record.wallet.slice(-4)} / {new Date(record.createdAt).toLocaleString()}</p><p className="plain-text">{record.reason}</p>{record.commentBody && <blockquote className="plain-text">{record.commentBody}</blockquote>}
        {record.targetKind==="comment" && <label><input type="checkbox" checked={hide[record.id]===true} onChange={event=>setHide(previous=>({...previous,[record.id]:event.target.checked}))}/>Hide comment when resolving</label>}
        {[['in_review','Mark in review'],['resolved','Resolve'],['dismissed','Dismiss']].map(([value,label])=><button key={value} disabled={action.busy || record.status===value} onClick={()=>moderate(record,value)}>{label}</button>)}
        {record.targetKind==="campaign" && (isV2 && sameDeployment(record)?<button disabled={transactionBusy || action.busy} onClick={()=>pause(record)}>Pause new contributions (on-chain)</button>:<p>On-chain pause unavailable for a different deployment or V1. Select the correct V2 deployment separately.</p>)}
      </li>)}</ul><div className="toolbar"><button disabled={state.loading || offset===0} onClick={()=>setOffset(value=>Math.max(0,value-20))}>Previous</button><span>Page {offset/20+1}</span><button disabled={state.loading || state.data?.length!==20 || offset>=10000} onClick={()=>setOffset(value=>value+20)}>Next</button></div></>}
    {action.error && <p role="alert">{action.error}</p>}{action.message && <p role="status">{action.message}</p>}
  </section>;
}
