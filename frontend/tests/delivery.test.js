import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { Interface } from "ethers";
import { readFile } from "node:fs/promises";
import { pendingKey, savePending, readPending, clearPending, assertPendingStorage } from "../src/services/pendingTransactions.js";

const address="0x0000000000000000000000000000000000000001";
const owner="0x0000000000000000000000000000000000000002";
const candidate="0x0000000000000000000000000000000000000003";
const hash=`0x${"a".repeat(64)}`;
function mockStorage() {
  const values=new Map();
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}

test("saved hashes survive module reload and isolate wallet, chain and deployment; unavailable storage blocks submission",async()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:mockStorage()});
  try {
    const key=pendingKey(11155111,address,owner);
    assertPendingStorage(key); savePending(key,{hash,method:"contribute",nonce:2});
    const reloaded=await import(`../src/services/pendingTransactions.js?reload=${Date.now()}`);
    assert.equal(reloaded.readPending(key).hash,hash);
    for(const other of [pendingKey(1,address,owner),pendingKey(11155111,candidate,owner),pendingKey(11155111,address,candidate)])assert.equal(reloaded.readPending(other),null);
    clearPending(key); assert.equal(reloaded.readPending(key),null);
    Object.defineProperty(globalThis,"localStorage",{configurable:true,value:null});
    assert.throws(()=>assertPendingStorage(key),/storage is unavailable/);
  } finally { if(previous)Object.defineProperty(globalThis,"localStorage",previous);else delete globalThis.localStorage; }
});

test("handover exposes acceptance to pending owner, validates targets and disables stale permission actions",async()=>{
  const server=await createServer({configFile:false,envFile:false,esbuild:{jsx:"automatic"},server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]}});
  try {
    const {default:Controls}=await server.ssrLoadModule("/src/components/OwnershipControls.jsx");
    const {ownershipTarget}=await server.ssrLoadModule("/src/services/crowdfunding.js");
    assert.throws(()=>ownershipTarget("0x0000000000000000000000000000000000000000"),/cannot be zero/);
    assert.throws(()=>ownershipTarget("bad"),/valid administrator/);
    assert.equal(ownershipTarget(` ${candidate} `),candidate);
    const props={wallet:{account:candidate,isSepolia:true},ownership:{data:{owner,pendingOwner:candidate},isOwner:false,loading:false,error:""},transaction:{busy:false,status:"idle"},onAction:()=>{throw new Error("SSR cannot send");}};
    let html=renderToStaticMarkup(createElement(Controls,props));
    assert.match(html,/>Accept administrator role</);assert.doesNotMatch(html,/Nominate administrator/);
    html=renderToStaticMarkup(createElement(Controls,{...props,ownership:{...props.ownership,loading:true}}));
    assert.match(html,/<button disabled="">Accept administrator role/);
    html=renderToStaticMarkup(createElement(Controls,{...props,wallet:{account:address,isSepolia:true}}));assert.equal(html,"");
  } finally {await server.close();}
});

test("receipt recovery retains pending hashes, rejects unrelated replacements and recovers campaign zero without resending",async()=>{
  const settings={VITE_CROWDFUNDING_VERSION:"v2",VITE_CROWDFUNDING_V2_ADDRESS:address};
  const previous=Object.fromEntries(Object.keys(settings).map(key=>[key,process.env[key]]));Object.assign(process.env,settings);
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,"localStorage");Object.defineProperty(globalThis,"localStorage",{configurable:true,value:mockStorage()});
  const server=await createServer({configFile:false,envFile:false,server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]}});
  try {
    const {abi}=JSON.parse(await readFile(new URL("../src/contracts/CrowdfundingV2.json",import.meta.url)));const iface=new Interface(abi);
    const event=iface.encodeEventLog(iface.getEvent("CampaignCreated"),[0n,owner,"Demo",1n,2000000000n]);
    let receipt=null;let calls=0;
    const provider={request:async({method,params})=>{
      if(method==="eth_chainId")return "0xaa36a7";
      if(method==="eth_getCode")return "0x6000";
      if(method==="eth_call"){const call=iface.parseTransaction({data:params[0].data});return iface.encodeFunctionResult(call.name,{owner:[owner],MAX_URI_LENGTH:[2048n],MAX_CATEGORY_NAME_LENGTH:[64n],categoryCount:[6n]}[call.name]);}
      if(method==="eth_getTransactionReceipt")return receipt;
      if(method==="eth_getTransactionByHash")return null;
      calls++;throw new Error(`Unexpected RPC ${method}`);
    }};
    const pending=await server.ssrLoadModule("/src/services/pendingTransactions.js");
    const service=await server.ssrLoadModule("/src/services/crowdfunding.js");
    const key=pending.pendingKey(11155111,address,owner);pending.savePending(key,{hash,method:"createCampaign",nonce:0});
    assert.equal((await service.recoverPendingTransaction(provider,owner)).status,"pending");assert.ok(pending.readPending(key));
    await assert.rejects(()=>service.contribute(provider,owner,"0","1"),/unresolved transaction/);
    await assert.rejects(()=>service.recoverPendingTransaction(provider,owner,`0x${"b".repeat(64)}`),/same wallet/);
    const blockHash=`0x${"c".repeat(64)}`;
    receipt={transactionHash:hash,transactionIndex:"0x0",blockHash,blockNumber:"0x10",from:owner,to:address,cumulativeGasUsed:"0x5208",gasUsed:"0x5208",effectiveGasPrice:"0x1",logsBloom:`0x${"0".repeat(512)}`,status:"0x1",type:"0x2",logs:[{...event,address,blockHash,blockNumber:"0x10",transactionHash:hash,transactionIndex:"0x0",logIndex:"0x0",removed:false}]};
    const result=await service.recoverPendingTransaction(provider,owner);assert.equal(result.status,"success");assert.equal(result.campaignId,"0");assert.equal(pending.readPending(key),null);assert.equal(calls,0);
    pending.savePending(key,{hash,method:"contribute",nonce:0});
    receipt={...receipt,from:candidate};
    await assert.rejects(()=>service.recoverPendingTransaction(provider,owner),/does not match/);assert.ok(pending.readPending(key));
    receipt={...receipt,from:owner,status:"0x0",logs:[]};
    assert.equal((await service.recoverPendingTransaction(provider,owner)).status,"failed");assert.equal(pending.readPending(key),null);
  } finally {await server.close();for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}if(descriptor)Object.defineProperty(globalThis,"localStorage",descriptor);else delete globalThis.localStorage;}
});

test("resource refresh preserves same-wallet data but clears identity changes, failures and aborted responses",async()=>{
  const original=process.env.VITE_CROWDFUNDING_ADDRESS;process.env.VITE_CROWDFUNDING_ADDRESS=address;
  const server=await createServer({configFile:false,envFile:false,server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]},plugins:[{
    name:"controlled-resource-hooks",enforce:"pre",
    resolveId(source){if(source==="virtual:resource-hooks")return "\0controlled-hooks";},
    transform(code,id){if(id.replaceAll("\\","/").endsWith("/hooks/useResource.js"))return code.replace('from "react"','from "virtual:resource-hooks"');},
    load(id){if(id!=="\0controlled-hooks")return;return `
      let slots=[],cursor=0,effects=[];
      export function begin(){cursor=0;}
      export function flush(){const list=effects;effects=[];for(const effect of list)effect();}
      export function useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];}
      export function useRef(value){const index=cursor++;return slots[index]??=( {current:value} );}
      export function useCallback(value){const index=cursor++;return slots[index]??=value;}
      export function useEffect(callback,deps){const index=cursor++;const old=slots[index];if(!old||deps.some((value,i)=>!Object.is(value,old.deps[i]))){old?.cleanup?.();slots[index]={deps};effects.push(()=>{slots[index].cleanup=callback();});}}
    `;}
  }]});
  try {
    const hooks=await server.ssrLoadModule("virtual:resource-hooks");const {default:useResource}=await server.ssrLoadModule("/src/hooks/useResource.js");
    const wallet={account:owner,chainId:11155111,revision:0,ethereum:{},isSepolia:true};
    let resolve;let result;
    const loader=()=>new Promise(done=>{resolve=done;});
    const render=(current=wallet,load=loader)=>{hooks.begin();result=useResource(current,load);return result;};
    const tick=()=>new Promise(done=>setImmediate(done));
    render();hooks.flush();await tick();resolve({draft:"keep"});await tick();assert.equal(render().data.draft,"keep");
    result.reload();assert.equal(render().data.draft,"keep");assert.equal(result.loading,true);hooks.flush();await tick();
    const stale=resolve;
    const next={...wallet,account:candidate};assert.equal(render(next).data,null);hooks.flush();await tick();
    stale({draft:"old wallet"});await tick();assert.equal(render(next).data,null);
    resolve({draft:"new wallet"});await tick();assert.equal(render(next).data.draft,"new wallet");
    result.reload();render(next,()=>Promise.reject(new Error("RPC unavailable")));hooks.flush();await tick();
    assert.equal(render(next).data,null);assert.match(result.error,/RPC unavailable/);
  } finally {await server.close();if(original===undefined)delete process.env.VITE_CROWDFUNDING_ADDRESS;else process.env.VITE_CROWDFUNDING_ADDRESS=original;}
});
