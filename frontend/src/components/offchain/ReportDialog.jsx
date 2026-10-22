import { useRef,useState } from "react";
import { useWalletSession } from "../../hooks/useWalletSession.jsx";
import useOffchainAction from "../../hooks/useOffchainAction.js";
import { offchainConfigured } from "../../services/supabase.js";
export default function ReportDialog({campaignKey,commentId=null}){
  const auth=useWalletSession(),action=useOffchainAction();const [open,setOpen]=useState(false),[reason,setReason]=useState("");const request=useRef(null);
  if(!offchainConfigured)return null;
  async function submit(event){event.preventDefault();request.current ??= crypto.randomUUID();const result=await action.run(()=>auth.request("report.create",{...campaignKey,targetKind:commentId?"comment":"campaign",commentId,reason,requestId:request.current}),"Report submitted for review. No on-chain action was taken.");if(result){setOpen(false);setReason("");request.current=null;}}
  return <div><button disabled={!auth.signedIn || action.busy} onClick={()=>setOpen(value=>!value)}>Report {commentId?"comment":"campaign"}</button>{open && <div role="region" aria-label="Report form"><form onSubmit={submit}><label>Reason (10-1000 characters)<textarea value={reason} onChange={event=>setReason(event.target.value)} minLength={10} maxLength={1000} required/></label><button disabled={action.busy}>Submit report (no gas)</button><button type="button" disabled={action.busy} onClick={()=>setOpen(false)}>Cancel</button></form></div>}{action.error && <p role="alert">{action.error}</p>}{action.message && <p role="status">{action.message}</p>}</div>;
}
