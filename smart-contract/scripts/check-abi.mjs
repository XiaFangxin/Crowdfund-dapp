import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Interface } from "ethers";

async function abi(path) { return JSON.parse(await readFile(new URL(path,import.meta.url),"utf8")).abi; }
const compiled=await abi("../artifacts/contracts/Crowdfunding.sol/Crowdfunding.json");
const exported=await abi("../../frontend/src/contracts/CrowdfundingV2.json");
assert.deepEqual(exported,compiled,"V2 ABI is stale: compile and run export:abi.");
const current=new Interface(exported);
const legacy=new Interface(await abi("../../frontend/src/contracts/Crowdfunding.json"));
const creation=current.fragments.filter(fragment=>fragment.type==="function" && fragment.name==="createCampaign");
assert.equal(creation.length,1,"Only one classified creation entry point is allowed.");
assert.equal(creation[0].format("sighash"),"createCampaign(string,string,uint256,uint256,uint256)");
for(const fragment of legacy.fragments.filter(fragment=>["function","event"].includes(fragment.type) && fragment.name!=="createCampaign")) {
  const found=fragment.type==="event"?current.getEvent(fragment.format("sighash")):current.getFunction(fragment.format("sighash"));
  assert.ok(found,`Missing V1 interface: ${fragment.name}`);
  assert.equal(found.format("full"),fragment.format("full"),`Changed V1 interface: ${fragment.name}`);
}
// Check every backend read against the exported ABI, including return tuple types.
const source=await readFile(new URL("../../supabase/functions/_shared/chain.js",import.meta.url),"utf8");
const backend=new Interface(JSON.parse(source.match(/const ABI = (\[[^;]+\]);/)[1]));
for(const fragment of backend.fragments)assert.equal(current.getFunction(fragment.name).format("sighash"),fragment.format("sighash"));
for(const fragment of backend.fragments)assert.deepEqual(current.getFunction(fragment.name).outputs.map(output=>output.format("sighash")),fragment.outputs.map(output=>output.format("sighash")));
console.log("ABI verified: compiled V2 = frontend export; classified creation; preserved V1 functions/events; backend reads.");
