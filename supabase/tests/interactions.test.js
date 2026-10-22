import test from "node:test";
import assert from "node:assert/strict";
import { Wallet } from "ethers";
import { database } from "./database.js";
import { createHandler } from "../functions/_shared/handler.js";
import { campaignKey, hash, fail } from "../functions/_shared/core.js";

const origin="https://crowdfund.example";
const contractAddress="0x0000000000000000000000000000000000000001";
const otherContract="0x0000000000000000000000000000000000000002";
const key={chainId:11155111,contractAddress,campaignId:"0"};
async function setup(){
  const db=await database();await db.pg.exec("set role service_role");
  const alice=Wallet.createRandom(),bob=Wallet.createRandom();let owner=alice.address.toLowerCase();
  const chain={allow(input){const k=campaignKey(input);if(![contractAddress,otherContract].includes(k.contractAddress)||k.chainId!==11155111){fail(400,"Denied contract");}return k;},async verifyCampaign(input){return this.allow(input);},async assertAdmin(wallet){if(wallet!==owner){fail(403,"Admin denied");}return {wallet,contractAddress,blockNumber:12,chainId:11155111};}};
  const handler=createHandler({db,chain,origins:[origin]});
  const call=async(action,payload={},token=null,extra={})=>{
    const response=await handler(new Request("https://project.supabase.co/functions/v1/interactions",{method:"POST",headers:{"content-type":"application/json",origin,...(token?{authorization:`Bearer ${token}`} : {}),...extra},body:JSON.stringify({action,...payload})}));
    return {status:response.status,...await response.json()};
  };
  const challenge=async wallet=>{const r=await call("auth.challenge",{wallet:wallet.address,chainId:11155111});assert.equal(r.status,200);return r.data;};
  const login=async wallet=>{const c=await challenge(wallet);const r=await call("auth.verify",{id:c.id,signature:await wallet.signMessage(c.message)});assert.equal(r.status,200,JSON.stringify(r));return r.data;};
  return {db,alice,bob,call,challenge,login,chain,setOwner:wallet=>{owner=wallet.toLowerCase();}};
}

test("SIWE signature bindings, nonce replay, expiry, server identity, revocation and random-token rejection",async()=>{
  const s=await setup();try{
    const c=await s.challenge(s.alice);
    assert.match(c.message,/Nonce: [a-f0-9]{64}/);assert.match(c.message,/Expiration Time:/);assert.match(c.message,/Chain ID: 11155111/);assert.match(c.message,/crowdfund.example wants/);
    const wrong=await s.call("auth.verify",{id:c.id,signature:await s.bob.signMessage(c.message)});assert.equal(wrong.status,401);
    const changed=await s.call("auth.verify",{id:c.id,signature:await s.alice.signMessage(c.message.replace("11155111","1"))});assert.equal(changed.status,401);
    const signature=await s.alice.signMessage(c.message);
    const attempts=await Promise.all([s.call("auth.verify",{id:c.id,signature}),s.call("auth.verify",{id:c.id,signature})]);
    assert.deepEqual(attempts.map(r=>r.status).sort(),[200,401]);
    const session=attempts.find(r=>r.status===200).data;
    assert.equal(session.wallet,s.alice.address.toLowerCase());
    const identity=await s.call("auth.session",{wallet:s.bob.address},session.token);assert.equal(identity.data.wallet,s.alice.address.toLowerCase());
    assert.equal((await s.call("auth.session",{},"1".repeat(64))).status,401);
    assert.equal((await s.call("auth.session",{},session.token,{origin:"https://evil.example"})).status,403);
    await s.call("auth.logout",{},session.token);assert.equal((await s.call("auth.session",{},session.token)).status,401);
    const expired=await s.challenge(s.alice);
    await s.db.pg.query("update public.oc_challenges set expires_at='2020-01-01T00:00:00.000Z' where id=$1",[expired.id]);
    assert.equal((await s.call("auth.verify",{id:expired.id,signature:await s.alice.signMessage(expired.message)})).status,401);
    const fresh=await s.login(s.bob);
    await s.db.pg.query("update public.oc_sessions set expires_at=now()-interval '1 second' where token_hash=$1",[await hash(fresh.token)]);
    assert.equal((await s.call("auth.session",{},fresh.token)).status,401);
  }finally{await s.db.pg.close();}
});

test("comments, replies, favorites and reports derive ownership from session and isolate composite keys",async()=>{
  const s=await setup();try{
    const a=await s.login(s.alice),b=await s.login(s.bob);
    assert.equal((await s.call("comment.create",{...key,body:"Unsigned",requestId:crypto.randomUUID()})).status,401);
    const requestId=crypto.randomUUID();const payload={...key,body:"Hello community",requestId,walletAddress:s.bob.address};
    const comment=await s.call("comment.create",payload,a.token);assert.equal(comment.status,200);
    assert.equal((await s.call("comment.create",payload,a.token)).data.id,requestId);
    const list=await s.call("comments",key);assert.equal(list.data.length,1);assert.equal(list.data[0].wallet,a.wallet);
    const isolated=await s.call("comments",{...key,contractAddress:otherContract});assert.equal(isolated.data.length,0);
    const replyId=crypto.randomUUID();assert.equal((await s.call("comment.create",{...key,parentId:requestId,body:"A reply",requestId:replyId},b.token)).status,200);
    assert.equal((await s.call("comment.create",{...key,parentId:replyId,body:"Too deep",requestId:crypto.randomUUID()},b.token)).status,400);
    assert.equal((await s.call("comment.create",{...key,contractAddress:otherContract,parentId:requestId,body:"Wrong contract",requestId:crypto.randomUUID()},b.token)).status,400);
    assert.equal((await s.call("comment.hide",{...key,commentId:requestId,walletAddress:a.wallet},b.token)).status,403);
    await s.call("favorite.set",{...key,saved:true,walletAddress:a.wallet},b.token);
    assert.equal((await s.call("saved.list",{},a.token)).data.length,0);assert.equal((await s.call("saved.list",{},b.token)).data.length,1);
    const bDevice=await s.login(s.bob);assert.equal((await s.call("saved.list",{},bDevice.token)).data.length,1);
    assert.equal((await s.call("favorite.state",{...key,contractAddress:otherContract},b.token)).data.saved,false);
    await s.call("favorite.set",{...key,saved:false},a.token);assert.equal((await s.call("favorite.state",key,b.token)).data.saved,true);
    const report={...key,targetKind:"comment",commentId:requestId,reason:"Abusive comment for review",requestId:crypto.randomUUID()};
    assert.equal((await s.call("report.create",report,b.token)).status,200);assert.equal((await s.call("report.create",{...report,requestId:crypto.randomUUID()},b.token)).status,409);
    assert.equal((await s.call("report.create",{...report,contractAddress:otherContract,requestId:crypto.randomUUID()},b.token)).status,400);
    await s.call("comment.hide",{...key,commentId:requestId},a.token);
    const hidden=await s.call("comments",key);assert.equal(hidden.data[0].body,null);assert.equal(hidden.data[0].hidden,true);
    const replies=await s.call("comments",{...key,parentId:requestId});assert.equal(replies.data[0].body,"A reply");
    assert.equal((await s.call("comment.create",{...key,body:"x".repeat(2001),requestId:crypto.randomUUID()},a.token)).status,400);
  }finally{await s.db.pg.close();}
});

test("moderation rejects forged flags and rechecks current on-chain owner, records audit, never sends transactions",async()=>{
  const s=await setup();try{
    const a=await s.login(s.alice),b=await s.login(s.bob);
    const commentId=crypto.randomUUID();await s.call("comment.create",{...key,body:"Review me",requestId:commentId},b.token);
    const reported=await s.call("report.create",{...key,targetKind:"comment",commentId,reason:"Please review this comment",requestId:crypto.randomUUID()},a.token);
    // The fake chain authority is injected to test the boundary, not a user field.
    const denied=await s.call("reports.list",{isAdmin:true,admin:{wallet:b.wallet}},b.token);assert.notEqual(denied.status,200);
    const list=await s.call("reports.list",{},a.token);assert.equal(list.data[0].id,reported.data.id);
    const moderation={id:reported.data.id,status:"resolved",hideComment:true,requestId:crypto.randomUUID()};
    assert.equal((await s.call("report.moderate",moderation,a.token)).status,200);
    assert.equal((await s.call("comments",key)).data[0].body,null);
    assert.equal((await s.db.pg.query("select count(*) as n from public.oc_moderation_log")).rows[0].n,1);
    s.setOwner(s.bob.address);
    assert.notEqual((await s.call("reports.list",{},a.token)).status,200);assert.equal((await s.call("reports.list",{},b.token)).status,200);
    const tokenHash=await hash(a.token);
    await assert.rejects(()=>s.db.rpc("oc_execute",{p_action:"reports.list",p_hash:tokenHash,p_origin:origin,p:{},p_admin:{contractAddress,blockNumber:1}}),/Administrator verification/);
  }finally{await s.db.pg.close();}
});

test("anonymous views need no wallet, are deduplicated and bounded, with pagination and public-safe metrics",async()=>{
  const s=await setup();try{
    const visitor=await s.call("visitor");assert.equal(visitor.status,200);
    const headers={"x-visitor-token":visitor.data.token};
    assert.equal((await s.call("auth.session",{},visitor.data.token)).status,401);
    const first=await s.call("view",key,null,headers);const again=await s.call("view",key,null,headers);
    assert.deepEqual(first.data,{views:"1",counted:true});assert.deepEqual(again.data,{views:"1",counted:false});
    assert.equal((await s.call("view",key)).status,401);
    const other=await s.call("view",{...key,contractAddress:otherContract},null,headers);assert.equal(other.data.views,"1");
    const stats=await s.call("metrics",{keys:[key,{...key,contractAddress:otherContract}]});assert.equal(stats.data.length,2);assert.equal(stats.data[0].favorites,"0");
    assert.equal((await s.call("metrics",{keys:Array(101).fill(key)})).status,400);
    assert.equal((await s.call("comments",{...key,offset:10001})).status,400);
    for(let n=0;n<23;n++)await s.db.pg.query("insert into public.oc_comments(id,chain_id,contract_address,campaign_id,wallet,body) values($1,11155111,$2,0,$3,$4)",[crypto.randomUUID(),contractAddress,s.alice.address.toLowerCase(),`Page test ${n}`]);
    assert.equal((await s.call("comments",key)).data.length,20);
    assert.equal((await s.call("comments",{...key,offset:20})).data.length,3);
    // Force the next visit to hit the per-visitor server limiter without generating traffic.
    const visitorHash=await hash(visitor.data.token);
    await s.db.pg.query("update public.oc_rate_limits set hits=120 where key=$1",['view-visitor:'+visitorHash]);
    assert.equal((await s.call("view",key,null,headers)).status,429);
  }finally{await s.db.pg.close();}
});
