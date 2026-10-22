import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Interface } from "ethers";
import { createServer } from "vite";

test("V2 services read the real ABI registry and campaign additions using only a mock EIP-1193 provider",async()=>{
  const env={VITE_CROWDFUNDING_VERSION:"v2",VITE_CROWDFUNDING_V2_ADDRESS:"0x0000000000000000000000000000000000000001",VITE_CROWDFUNDING_V2_DEPLOY_BLOCK:"0"};
  const previous=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));
  Object.assign(process.env,env);
  const server=await createServer({configFile:false,envFile:false,server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]}});
  const {abi}=JSON.parse(await readFile(new URL("../src/contracts/CrowdfundingV2.json",import.meta.url)));
  const iface=new Interface(abi);const owner="0x0000000000000000000000000000000000000002";
  let badInterface=false; let omitDonation=false; const methods=[];
  const blockHash="0x"+"a".repeat(64);
  const donation=iface.encodeEventLog(iface.getEvent("Contributed"),[0n,owner,12n]);
  const provider={request:async({method,params})=>{
    methods.push(method);
    if(method==="eth_chainId")return "0xaa36a7";
    if(method==="eth_getCode")return "0x60006000";
    if(method==="eth_blockNumber")return "0x10";
    if(method==="eth_getBlockByNumber")return {number:"0x10",hash:blockHash,parentHash:"0x"+"b".repeat(64),timestamp:"0x77359400",nonce:"0x0000000000000000",difficulty:"0x0",gasLimit:"0x1c9c380",gasUsed:"0x0",miner:owner,extraData:"0x",transactions:[],baseFeePerGas:"0x1"};
    if(method==="eth_getLogs")return omitDonation?[]:[{address:env.VITE_CROWDFUNDING_V2_ADDRESS,blockHash,blockNumber:"0x10",transactionHash:"0x"+"c".repeat(64),transactionIndex:"0x0",logIndex:"0x0",removed:false,...donation}];
    if(method==="eth_call"){
      const call=iface.parseTransaction({data:params[0].data});
      const results={owner:[owner],pendingOwner:[owner],MAX_URI_LENGTH:[2048n],MAX_CATEGORY_NAME_LENGTH:[64n],categoryCount:[6n],campaignCount:[1n],getCampaign:[[owner,"Mock campaign","Mock description",100n,2000000000n,12n,false]],getCampaignCategoryId:[0n],campaignPaused:[true],getCampaignMetadataURI:["ipfs://content"],getCategory:[["Education",false]],contributions:[12n]};
      if(badInterface && call.name==="categoryCount")throw new Error("Selector unavailable");
      return iface.encodeFunctionResult(call.name,results[call.name]);
    }
    throw new Error(`Unexpected RPC method: ${method}`);
  }};
  try{
    const service=await server.ssrLoadModule("/src/services/crowdfunding.js");
    const contract=await service.getContract(provider);
    assert.equal(contract.interface.getFunction("createCampaign").inputs.length,5);
    const row=await service.getCampaign(provider,0);
    assert.equal(row.categoryId,"0");assert.equal(row.category.active,false);assert.equal(row.paused,true);assert.equal(row.amountRaised,12n);
    const categories=await service.listCategories(provider);assert.equal(categories.length,6);assert.equal(categories[0].id,"0");
    const statistics=await service.getDonationStatistics(provider);
    assert.equal(statistics.block,16);assert.equal(statistics.byCampaign["0"].donations,1n);assert.equal(statistics.byCampaign["0"].donors,1n);
    omitDonation=true;
    await assert.rejects(()=>service.getDonationStatistics(provider),/do not match/);
    badInterface=true;
    await assert.rejects(()=>service.getContract(provider),/expected V2/);
    assert.ok(!methods.includes("eth_sendTransaction"));assert.ok(!methods.includes("eth_requestAccounts"));
  }finally{await server.close();for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
