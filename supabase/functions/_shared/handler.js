import { address, bearer, buildChallenge, campaignKey, fail, hash, HttpError, page, permittedOrigin, randomToken, text, uuid, verifyChallenge } from "./core.js";
const PUBLIC_ACTIONS = new Set(["auth.challenge","auth.verify","visitor","view","comments","metrics"]);
const ADMIN_ACTIONS = new Set(["reports.list","report.moderate","comment.moderate"]);
const CAMPAIGN_ACTIONS = new Set(["view","comments","favorite.state","favorite.set","comment.create","comment.hide","report.create","comment.moderate"]);
function sanitize(action, body, chain) {
  let payload = {};
  if (CAMPAIGN_ACTIONS.has(action)) payload = chain.allow(campaignKey(body));
  if (["comments","saved.list","reports.list"].includes(action)) Object.assign(payload,page(body));
  if (action === "comments" || action === "comment.create") payload.parentId = body.parentId ? uuid(body.parentId) : null;
  if (["comment.hide","comment.moderate"].includes(action)) payload.commentId = uuid(body.commentId);
  if (action === "comment.create") {payload.id=uuid(body.requestId);payload.body=text(body.body,2000,"comment");}
  if (action === "favorite.set") {if(typeof body.saved!=="boolean")fail(400,"Expected saved boolean.");payload.saved=body.saved;}
  if (action === "report.create") {
    if (!["comment","campaign"].includes(body.targetKind)) fail(400,"Invalid report target.");
    payload.id=uuid(body.requestId);payload.targetKind=body.targetKind;
    payload.commentId=body.targetKind === "comment" ? uuid(body.commentId):null;
    payload.reason=text(body.reason,1000,"report reason");if([...payload.reason].length<10)fail(400,"Use at least 10 characters for a report.");
  }
  if (action === "reports.list") {
    if(body.status && !["open","in_review","resolved","dismissed"].includes(body.status))fail(400,"Invalid status.");
    payload.status=body.status || null;
  }
  if (action === "report.moderate") {
    payload.id=uuid(body.id);payload.requestId=uuid(body.requestId);
    if(!["in_review","resolved","dismissed"].includes(body.status))fail(400,"Invalid status.");
    payload.status=body.status;payload.hideComment=body.hideComment===true;
  }
  if (action === "comment.moderate") payload.requestId=uuid(body.requestId);
  return payload;
}
export function createHandler({db,chain,origins,now=()=>Date.now()}) {
  return async function handle(request) {
    let origin;
    const headers = {"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"};
    try {
      origin=permittedOrigin(request,origins);
      Object.assign(headers,{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, apikey, content-type, x-visitor-token","Access-Control-Allow-Methods":"POST, OPTIONS"});
      if(request.method === "OPTIONS")return new Response(null,{status:204,headers});
      if(request.method !== "POST")fail(405,"POST is required.");
      if(Number(request.headers.get("content-length"))>16384)fail(413,"Request is too large.");
      const reader=request.body?.getReader();if(!reader)fail(400,"JSON body required.");
      let length=0;const chunks=[];
      try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>16384)fail(413,"Request is too large.");chunks.push(value);}}finally{await reader.cancel();}
      const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,"Invalid JSON.");}
      if(!body || typeof body!=="object" || Array.isArray(body))fail(400,"Expected an object.");
      const action=body.action;
      await db.rpc("oc_gate",{p_origin:origin});
      let result;
      if(action === "auth.challenge") {
        const wallet=address(body.wallet);
        if(body.chainId !== 11155111)fail(400,"Sign in on Sepolia (chain ID 11155111).");
        const challenge={id:crypto.randomUUID(),wallet,chain_id:11155111,origin,nonce:randomToken(),issued_at:new Date(now()).toISOString(),expires_at:new Date(now()+300000).toISOString()};
        challenge.message=buildChallenge({wallet,origin,chainId:challenge.chain_id,nonce:challenge.nonce,issuedAt:challenge.issued_at,expiresAt:challenge.expires_at});
        await db.rpc("oc_challenge",{p_data:challenge});
        result={id:challenge.id,message:challenge.message,expiresAt:challenge.expires_at};
      } else if(action === "auth.verify") {
        const challenge=await db.rpc("oc_get_challenge",{p_id:uuid(body.id)});
        if(typeof body.signature!=="string" || body.signature.length>1024)fail(400,"Invalid signature.");
        verifyChallenge(challenge,body.signature,origin,now());
        const token=randomToken();
        const session=await db.rpc("oc_finish_login",{p_id:challenge.id,p_hash:await hash(token),p_origin:origin});
        result={...session,token};
      } else if(action === "visitor") {
        const token=randomToken();
        await db.rpc("oc_public",{p_action:"visitor",p:{visitorHash:await hash(token)},p_origin:origin});
        result={token,expiresAt:new Date(now()+86400000).toISOString()};
      } else if(action === "metrics") {
        if(!Array.isArray(body.keys) || body.keys.length<1 || body.keys.length>100)fail(400,"Use 1-100 campaign keys.");
        result=await db.rpc("oc_public",{p_action:action,p:{keys:body.keys.map(key=>chain.allow(key))},p_origin:origin});
      } else {
        let tokenHash;
        let identity;
        if(!PUBLIC_ACTIONS.has(action)) {
          tokenHash=await hash(bearer(request));
          identity=await db.rpc("oc_identity",{p_hash:tokenHash,p_origin:origin});
        }
        if(action === "auth.session")result=identity;
        else if(action === "auth.logout") {await db.rpc("oc_logout",{p_hash:tokenHash,p_origin:origin});result={ok:true};}
        else {
          const accepted=[...CAMPAIGN_ACTIONS,"saved.list",...ADMIN_ACTIONS];
          if(!accepted.includes(action))fail(400,"Unknown action.");
          const payload=sanitize(action,body,chain);
          if(CAMPAIGN_ACTIONS.has(action)) {
            if(identity && identity.chainId !== payload.chainId)fail(401,"Session chain mismatch.");
            const registered=await db.rpc("oc_registered",{p_chain:payload.chainId,p_address:payload.contractAddress,p_campaign:payload.campaignId});
            if(!registered){await chain.verifyCampaign(payload);await db.rpc("oc_register",{p_chain:payload.chainId,p_address:payload.contractAddress,p_campaign:payload.campaignId});}
          }
          if(action === "view") {
            const visitor=request.headers.get("x-visitor-token");
            if(!visitor || !/^[a-f0-9]{64}$/.test(visitor))fail(401,"Visitor token required.");
            payload.visitorHash=await hash(visitor);
          }
          if(PUBLIC_ACTIONS.has(action))result=await db.rpc("oc_public",{p_action:action,p:payload,p_origin:origin});
          else {
            // Never merge client 'admin', 'walletAddress', or proof fields into this argument.
            const proof=ADMIN_ACTIONS.has(action)?await chain.assertAdmin(identity.wallet):null;
            result=await db.rpc("oc_execute",{p_action:action,p_hash:tokenHash,p_origin:origin,p:payload,p_admin:proof});
          }
        }
      }
      return new Response(JSON.stringify({data:result}),{headers});
    } catch(error) {
      let status=error instanceof HttpError?error.status:500;
      let message=error instanceof HttpError?error.message:"Off-chain service is unavailable. Try again later.";
      if(error.dbCode) {
        if(error.dbCode==="28000"){status=401;message="Session/challenge/visitor expired, revoked, or already used. Authenticate again.";}
        else if(error.dbCode==="42501"){status=403;message="Permission denied.";}
        else if(error.dbCode==="23505"){status=409;message="Already submitted for this object.";}
        else if(error.message?.includes("Rate limit")){status=429;message="Too many requests. Try later.";headers["Retry-After"]="60";}
        else if(["P0001","23503","23514","22P02"].includes(error.dbCode)){status=400;message="Invalid, unavailable, or conflicting interaction. Refresh before retrying.";}
      }
      return new Response(JSON.stringify({error:message}),{status,headers});
    }
  };
}
