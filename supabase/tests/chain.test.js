import test from "node:test";
import assert from "node:assert/strict";
import { Interface } from "ethers";
import { createChainAuthority } from "../functions/_shared/chain.js";
const abi=new Interface(["function owner() view returns(address)","function categoryCount() view returns(uint256)","function MAX_URI_LENGTH() view returns(uint256)","function getCampaign(uint256) view returns(tuple(address creator,string title,string description,uint256 goal,uint256 deadline,uint256 amountRaised,bool withdrawn))"]);
const contractAddress="0x0000000000000000000000000000000000000001";
const a="0x0000000000000000000000000000000000000002",b="0x0000000000000000000000000000000000000003";
test("chain authority reads fresh owner, rejects non-V2/missing configuration and fails closed when RPC fails",async()=>{
  let owner=a,network=11155111n,online=true;const calls=[];
  const provider={getNetwork:async()=>({chainId:network}),getBlockNumber:async()=>42,call:async tx=>{
    calls.push(tx);if(!online)throw new Error("RPC offline");
    const fn=abi.parseTransaction({data:tx.data}).name;
    return abi.encodeFunctionResult(fn,{owner:[owner],categoryCount:[6n],MAX_URI_LENGTH:[2048n],getCampaign:[[owner,"Title","",100n,2000000000n,0n,false]]}[fn]);
  }};
  const config={provider,contracts:[{chainId:11155111,address:contractAddress,version:"v2"}],moderationContract:contractAddress};
  const chain=createChainAuthority(config);
  assert.equal((await chain.assertAdmin(a)).wallet,a);
  await assert.rejects(()=>chain.assertAdmin(b),error=>error.status===403);
  owner=b;await assert.rejects(()=>chain.assertAdmin(a),error=>error.status===403);assert.equal((await chain.assertAdmin(b)).blockNumber,42);
  await chain.verifyCampaign({chainId:11155111,contractAddress,campaignId:"0"});
  network=1n;await assert.rejects(()=>chain.assertAdmin(b),error=>error.status===503);
  network=11155111n;online=false;await assert.rejects(()=>chain.assertAdmin(b),error=>error.status===503);
  await assert.rejects(()=>createChainAuthority({...config,moderationContract:null}).assertAdmin(a),error=>error.status===503);
  await assert.rejects(()=>createChainAuthority({...config,contracts:[{chainId:11155111,address:contractAddress,version:"v1"}]}).assertAdmin(a),error=>error.status===503);
  assert.ok(calls.length>0);assert.ok(calls.every(call=>typeof call.data==="string"));
});
