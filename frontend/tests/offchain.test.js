import { assertPublicSupabaseKeys } from "../src/config/supabasePublic.js";
import test from "node:test";
import assert from "node:assert/strict";
import { resolveOffchainConfig } from "../src/services/supabase.js";
import { validateLoginChallenge } from "../src/utils/walletChallenge.js";
import { interactionKey,keyString,sameDeployment } from "../src/utils/interactionKey.js";
import { selectCampaigns } from "../src/utils/campaigns.js";

test("off-chain configuration is optional and rejects browser service-role/secret keys",()=>{
  assert.throws(()=>assertPublicSupabaseKeys({VITE_SUPABASE_SERVICE_ROLE_KEY:"not-even-used"}));
  assert.throws(()=>assertPublicSupabaseKeys({VITE_SUPABASE_PUBLISHABLE_KEY:"sb_secret_hidden"}));
  assert.equal(resolveOffchainConfig({}).configured,false);
  assert.equal(resolveOffchainConfig({VITE_SUPABASE_URL:"https://project.supabase.co",VITE_SUPABASE_PUBLISHABLE_KEY:"sb_secret_notpublic"}).configured,false);
  const payload=Buffer.from(JSON.stringify({role:"service_role"})).toString("base64url");
  assert.equal(resolveOffchainConfig({VITE_SUPABASE_URL:"https://project.supabase.co",VITE_SUPABASE_ANON_KEY:`test.${payload}.not-a-token`}).configured,false);
  assert.equal(resolveOffchainConfig({VITE_SUPABASE_URL:"https://project.supabase.co",VITE_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_publictest"}).configured,true);
});
test("front-end signs only the expected domain, URI, chain, wallet and fresh challenge",()=>{
  const wallet="0x0000000000000000000000000000000000000001",origin="https://example.com",now=Date.now(),issued=new Date(now).toISOString(),expires=new Date(now+300000).toISOString();
  const message=`example.com wants you to sign in with your Ethereum account:\n${wallet}\n\nSign in to Crowdfund off-chain interactions. This is not a transaction and costs no gas.\n\nURI: ${origin}/\nVersion: 1\nChain ID: 11155111\nNonce: ${"a".repeat(64)}\nIssued At: ${issued}\nExpiration Time: ${expires}`;
  const challenge={message,expiresAt:expires};
  assert.equal(validateLoginChallenge(challenge,wallet,11155111,origin,now),message);
  for(const bad of [message.replace("example.com wants","evil.example wants"),message.replace("Chain ID: 11155111","Chain ID: 1"),message+"\nTransfer funds",message.replace(wallet,"0x0000000000000000000000000000000000000002")])assert.throws(()=>validateLoginChallenge({...challenge,message:bad},wallet,11155111,origin,now));
  assert.throws(()=>validateLoginChallenge(challenge,wallet,11155111,origin,now+300001));
});
test("off-chain identifiers include chain and deployment, and approximate counts sort as bigint",()=>{
  const key=interactionKey("0");assert.ok(key);assert.ok(keyString(key).includes(":0x"));assert.ok(sameDeployment(key));
  assert.notEqual(keyString(key),keyString({...key,contractAddress:"0x0000000000000000000000000000000000000002"}));
  assert.notEqual(keyString(key),keyString({...key,chainId:1}));
  const rows=[{id:"0",title:"A",description:"",deadline:100,goal:1n,amountRaised:0n,offchainMetrics:{views:2n**80n,favorites:1n}},{id:"1",title:"B",description:"",deadline:100,goal:1n,amountRaised:0n,offchainMetrics:{views:2n**80n+1n,favorites:0n}}];
  assert.deepEqual(selectCampaigns(rows,{sort:"views"},0).map(c=>c.id),["1","0"]);
  assert.deepEqual(selectCampaigns(rows,{sort:"favorites"},0).map(c=>c.id),["0","1"]);
});
