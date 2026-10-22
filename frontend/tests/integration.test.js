import test from "node:test";
import assert from "node:assert/strict";
import { resolveContractConfig, V1_ADDRESS } from "../src/config/contracts.js";
import { selectCampaigns, refundable, fundingProgress, campaignStatus } from "../src/utils/campaigns.js";
import { contentURL, validateDocument, fetchDocument } from "../src/services/metadata.js";
import { queryEventRanges } from "../src/services/events.js";
import { waitForTransaction } from "../src/services/transactions.js";

const campaign=(id, overrides={})=>({id:String(id), title:"Garden", description:"Community project", categoryId:"0", goal:100n, amountRaised:1n, deadline:1000, withdrawn:false,paused:false,...overrides});
test("V2 cannot default to V1 or accept its address, and missing/unknown configuration fails closed",()=>{
  assert.equal(resolveContractConfig({}).version,"v1");
  assert.equal(resolveContractConfig({VITE_CROWDFUNDING_VERSION:"v2"}).configured,false);
  assert.equal(resolveContractConfig({VITE_CROWDFUNDING_VERSION:"v2",VITE_CROWDFUNDING_V2_ADDRESS:V1_ADDRESS}).configured,false);
  assert.equal(resolveContractConfig({VITE_CROWDFUNDING_VERSION:"v2",VITE_CROWDFUNDING_ADDRESS:V1_ADDRESS}).configured,false);
  assert.equal(resolveContractConfig({VITE_CROWDFUNDING_VERSION:"v3"}).configured,false);
  assert.equal(resolveContractConfig({VITE_CROWDFUNDING_VERSION:"v2",VITE_CROWDFUNDING_V2_ADDRESS:"0x0000000000000000000000000000000000000001"}).configured,true);
});
test("combined filters accept ID 0 and bigint progress sorting stays exact above Number precision",()=>{
  const large=2n**100n;
  const rows=[campaign(0,{amountRaised:large,goal:large+1n}),campaign(1,{amountRaised:large+1n,goal:large+2n}),campaign(2,{categoryId:"1",paused:true})];
  assert.deepEqual(selectCampaigns(rows,{categoryId:"0",query:"community",sort:"progress"},0).map(c=>c.id),["1","0"]);
  assert.deepEqual(selectCampaigns(rows,{sort:"oldest"},0).map(c=>c.id),["0","1","2"]);
  assert.deepEqual(selectCampaigns(rows,{status:"Paused"},0).map(c=>c.id),["2"]);
  assert.equal(fundingProgress(200n,100n).width,100);
});
test("refund eligibility ignores pause/category state and requires failure, deadline and caller contribution",()=>{
  const row=campaign(0,{paused:true,category:{active:false}});
  assert.equal(refundable(row,2n,1000),true);
  assert.equal(refundable(row,2n,999),false);
  assert.equal(refundable(row,0n,1000),false);
  assert.equal(refundable({...row,amountRaised:100n},2n,1000),false);
  assert.equal(campaignStatus({...row,amountRaised:100n},1000),"Successful");
});
test("off-chain URLs reject dangerous schemes, credentials, private hosts and inline content",()=>{
  for(const uri of ["javascript:alert(1)","data:text/html,<script>","http://example.com/x","https://127.0.0.1/x","https://localhost/x","https://user:pass@example.com/x","https://example.com/with space","https://example.com/a\n","ipfs://../x"])
    assert.throws(()=>contentURL(uri),undefined,uri);
  assert.equal(contentURL("ipfs://bafyexample/metadata.json"),"https://ipfs.io/ipfs/bafyexample/metadata.json");
});
test("metadata treats remote text as text and discards legacy category; update validation enforces fields",()=>{
  const doc=validateDocument({schemaVersion:"1.0",category:"forged",image:"https://example.com/cover.png",summary:"<script>alert(1)</script>",additionalDescription:"Text"});
  assert.equal(doc.category,undefined);assert.equal(doc.summary,"<script>alert(1)</script>");
  assert.throws(()=>validateDocument({schemaVersion:"1.0",image:"https://example.com/a"}));
  assert.throws(()=>validateDocument({schemaVersion:"1.0",images:[],publishedAt:"bad",title:"A",body:"B"},"update"));
});
test("JSON fetch rejects oversized bodies and non-JSON responses without real network",async()=>{
  const previous=globalThis.fetch;
  try{
    globalThis.fetch=async()=>new Response("x",{headers:{"content-type":"text/html"}});
    await assert.rejects(()=>fetchDocument("https://example.com/data"),/application\/json/);
    globalThis.fetch=async()=>new Response("x".repeat(262145),{headers:{"content-type":"application/json"}});
    await assert.rejects(()=>fetchDocument("https://example.com/data"),/256 KB/);
  }finally{globalThis.fetch=previous;}
});
test("event queries shrink RPC ranges, deduplicate and sort without losing blocks",async()=>{
  const visited=new Set();
  const contract={queryFilter:async(_,from,to)=>{
    if(to-from+1>2)throw new Error("RPC range too wide");
    const result=[];for(let b=from;b<=to;b++){visited.add(b);result.push({transactionHash:`0x${b}`,blockNumber:b,index:0});}
    return [...result,...result];
  }};
  const logs=await queryEventRanges(contract,{},0,8,undefined,8);
  assert.equal(visited.size,9);assert.deepEqual(logs.map(log=>log.blockNumber),[0,1,2,3,4,5,6,7,8]);
});
test("failed and aborted queries never report a partial history as successful",async()=>{
  const c={queryFilter:async(_,from)=>{if(from>0)throw new Error("RPC unavailable");return [{transactionHash:"0x0",blockNumber:0,index:0}];}};
  await assert.rejects(()=>queryEventRanges(c,{},0,2,undefined,1),/RPC unavailable/);
  const abort=new AbortController();abort.abort();await assert.rejects(()=>queryEventRanges(c,{},0,2,abort.signal));
});
test("transaction lifecycle tracks signatures, submission and final confirmation",async()=>{
  const states=[];
  const receipt=await waitForTransaction(async()=>({hash:"0xinitial",wait:async()=>({hash:"0xinitial",status:1})}),state=>states.push(state.status));
  assert.equal(receipt.status,1);assert.deepEqual(states,["signature","submitted","confirming","success"]);
});

test("RPC loss after broadcast preserves the hash and never claims a confirmed chain failure",async()=>{
  const states=[];
  await assert.rejects(()=>waitForTransaction(async()=>({hash:"already-broadcast",wait:async()=>{throw new Error("RPC disconnected");}}),state=>states.push(state)),error=>error.code==="CONFIRMATION_UNKNOWN" && /before submitting again/.test(error.message));
  assert.equal(states.at(-1).hash,"already-broadcast");
  assert.ok(!states.some(state=>state.status==="success"));
  await assert.rejects(()=>waitForTransaction(async()=>({hash:"already-broadcast",wait:async()=>null})),error=>error.code==="CONFIRMATION_UNKNOWN");
});
test("replacement follows the final hash; cancellations and reverted receipts fail",async()=>{
  const states=[];
  const result=await waitForTransaction(async()=>({hash:"old",wait:async()=>{throw {code:"TRANSACTION_REPLACED",cancelled:false,replacement:{hash:"new"},receipt:{hash:"new",status:1}};}}),state=>states.push(state));
  assert.equal(result.hash,"new");assert.equal(states.at(-1).hash,"new");
  await assert.rejects(()=>waitForTransaction(async()=>({hash:"old",wait:async()=>{throw {code:"TRANSACTION_REPLACED",cancelled:true};}})),/cancelled/);
  await assert.rejects(()=>waitForTransaction(async()=>({hash:"hash",wait:async()=>({status:0})})),/reverted/);
  await assert.rejects(()=>waitForTransaction(async()=>{throw new Error("user rejected");}),/user rejected/);
});
