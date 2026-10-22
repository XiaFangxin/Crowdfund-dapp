import { useRef,useState } from "react";
import useInteractionQuery from "../../hooks/useInteractionQuery.js";
import useOffchainAction from "../../hooks/useOffchainAction.js";
import { useWalletSession } from "../../hooks/useWalletSession.jsx";
import useContractOwner from "../../hooks/useContractOwner.js";
import { invokeInteraction,offchainConfigured,offchainMessage } from "../../services/supabase.js";
import { keyString } from "../../utils/interactionKey.js";
import ReportDialog from "./ReportDialog.jsx";
function ActionFeedback({action}){return <>{action.error && <p role="alert">{action.error}</p>}{action.message && <p role="status">{action.message}</p>}</>;}
function CommentForm({campaignKey,parentId=null,onCreated}){
  const auth=useWalletSession(),action=useOffchainAction();const [body,setBody]=useState("");const request=useRef(null);
  async function submit(event){
    event.preventDefault();if(!request.current || request.current.body!==body)request.current={body,id:crypto.randomUUID()};
    const result=await action.run(()=>auth.request("comment.create",{...campaignKey,parentId,body,requestId:request.current.id}),"Comment posted off chain.");
    if(result){setBody("");request.current=null;onCreated();}
  }
  return <form onSubmit={submit}><label>{parentId?"Reply":"Comment"} (up to 2000 characters)<textarea value={body} onChange={event=>setBody(event.target.value)} required maxLength={2000} disabled={!auth.signedIn || action.busy}/></label><button disabled={!auth.signedIn || action.busy || !body.trim()}>Post {parentId?"reply":"comment"} (no gas)</button><ActionFeedback action={action}/></form>;
}
function CommentCard({record,campaignKey,mayModerate,onChanged,parentId}){
  const auth=useWalletSession(),action=useOffchainAction();const [reply,setReply]=useState(false),[replies,setReplies]=useState(false);
  async function hide(moderate){
    if(!window.confirm(moderate?"Hide this comment for all readers? This is an off-chain moderation action.":"Hide your comment? Replies and report records will remain."))return;
    const result=await action.run(()=>auth.request(moderate?"comment.moderate":"comment.hide",{...campaignKey,commentId:record.id,...(moderate?{requestId:crypto.randomUUID()}:{})}),"Comment hidden.");if(result)onChanged();
  }
  return <article className="offchain-comment"><header><span title={record.wallet}>{record.wallet.slice(0,6)}...{record.wallet.slice(-4)}</span> <time dateTime={record.createdAt}>{new Date(record.createdAt).toLocaleString()}</time></header>
    <p className="plain-text">{record.hidden?"This comment has been hidden.":record.body}</p>
    {auth.signedIn && auth.wallet===record.wallet && !record.hidden && <button disabled={action.busy} onClick={()=>hide(false)}>Hide my comment</button>}
    {mayModerate && !record.hidden && <button disabled={action.busy} onClick={()=>hide(true)}>Hide as moderator</button>}
    {!record.hidden && <ReportDialog campaignKey={campaignKey} commentId={record.id}/>}
    {!parentId && <><button onClick={()=>setReplies(value=>!value)}>{replies?"Close replies":"View replies"}</button>{auth.signedIn && !record.hidden && <button onClick={()=>setReply(value=>!value)}>Reply</button>}
      {reply && <CommentForm campaignKey={campaignKey} parentId={record.id} onCreated={()=>{setReply(false);setReplies(true);onChanged();}}/>}
      {replies && <CommentList campaignKey={campaignKey} parentId={record.id} mayModerate={mayModerate}/>}</>}
    <ActionFeedback action={action}/>
  </article>;
}
function CommentList({campaignKey,parentId=null,mayModerate=false}){
  const [offset,setOffset]=useState(0);
  const state=useInteractionQuery(signal=>invokeInteraction("comments",{...campaignKey,parentId,offset},{signal}),[keyString(campaignKey),parentId,offset]);
  return <div>{state.loading && <p role="status">Loading comments...</p>}{state.error && <p role="alert">{state.error}</p>}<button disabled={state.loading} onClick={state.reload}>Refresh {parentId?"replies":"comments"}</button>
    {state.data?.map(record=><CommentCard key={record.id} record={record} campaignKey={campaignKey} parentId={parentId} mayModerate={mayModerate} onChanged={state.reload}/>)}
    {state.data?.length===0 && <p>No {parentId?"replies":"comments"} on this page.</p>}
    <div className="toolbar"><button disabled={state.loading || offset===0} onClick={()=>setOffset(value=>Math.max(0,value-20))}>Previous</button><span>Page {offset/20+1}</span><button disabled={state.loading || state.data?.length!==20 || offset>=10000} onClick={()=>setOffset(value=>value+20)}>Next</button></div>
  </div>;
}
export default function CommentSection({campaignKey,wallet}){
  const auth=useWalletSession();const owner=useContractOwner(wallet);const [revision,setRevision]=useState(0);
  if(!offchainConfigured)return <section className="offchain-panel"><h2>Comments</h2><p>{offchainMessage}</p></section>;
  return <section className="offchain-panel"><h2>Comments & Replies</h2><p>Plain-text comments are stored off chain. Sign in to post, reply or report. One level of replies; 20 comments per page.</p>
    {!auth.signedIn && <p>Use the wallet sign-in button above to participate without paying gas.</p>}
    <CommentForm campaignKey={campaignKey} onCreated={()=>setRevision(value=>value+1)}/>
    <CommentList key={`${keyString(campaignKey)}:${revision}`} campaignKey={campaignKey} mayModerate={owner.isOwner && auth.signedIn}/>
  </section>;
}
