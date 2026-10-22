import { Contract, FetchRequest, JsonRpcProvider } from "ethers";
import { address, campaignKey, fail } from "./core.js";
const V1 = "0xbdf615493ce21b7ae54e6464d44c507c76b85b6c";
const ABI = ["function getCampaign(uint256) view returns (tuple(address creator,string title,string description,uint256 goal,uint256 deadline,uint256 amountRaised,bool withdrawn))","function owner() view returns(address)","function categoryCount() view returns(uint256)","function MAX_URI_LENGTH() view returns(uint256)"];
export function createChainAuthority({rpcURL, contracts, moderationContract, provider: suppliedProvider}) {
  const allowed = contracts.map(entry => ({chainId:Number(entry.chainId),contractAddress:address(entry.address),version:entry.version}));
  if (!allowed.length || allowed.some(entry => entry.chainId !== 11155111 || !["v1","v2"].includes(entry.version) || entry.version === "v2" && entry.contractAddress === V1)) throw new Error("Invalid server contract allowlist.");
  const provider = suppliedProvider ?? new JsonRpcProvider(Object.assign(new FetchRequest(rpcURL),{timeout:10000}), undefined, {batchMaxCount:1});
  function allow(input) {
    const key = campaignKey(input);
    if (!allowed.some(entry => entry.chainId === key.chainId && entry.contractAddress === key.contractAddress)) fail(400, "Contract is not enabled on this server.");
    return key;
  }
  async function network() {
    try { if ((await provider.getNetwork()).chainId !== 11155111n) throw new Error(); }
    catch { fail(503, "Server chain RPC is unavailable or on the wrong network."); }
  }
  async function verifyCampaign(input) {
    const key = allow(input); await network();
    try {
      const c = new Contract(key.contractAddress,ABI,provider);
      const campaign = await c.getCampaign(key.campaignId);
      if (campaign.creator === "0x0000000000000000000000000000000000000000") throw new Error();
    } catch { fail(400, "Campaign could not be verified on the allowed contract."); }
    return key;
  }
  async function assertAdmin(wallet) {
    if (!moderationContract) fail(503,"V2 moderation contract is not configured. Moderation is disabled.");
    const contractAddress = address(moderationContract);
    if (!allowed.some(entry => entry.contractAddress === contractAddress && entry.version === "v2")) fail(503,"Moderation requires an allowlisted V2 deployment.");
    await network();
    try {
      const blockNumber = await provider.getBlockNumber();
      const c = new Contract(contractAddress,ABI,provider);
      const [owner,count,uriLimit] = await Promise.all([c.owner({blockTag:blockNumber}),c.categoryCount({blockTag:blockNumber}),c.MAX_URI_LENGTH({blockTag:blockNumber})]);
      if (count < 6n || uriLimit !== 2048n) fail(503,"Unsupported moderation contract.");
      if (owner.toLowerCase() !== wallet.toLowerCase()) fail(403,"Only the current V2 on-chain owner may moderate.");
      return {wallet:owner.toLowerCase(),chainId:11155111,contractAddress,blockNumber,checkedAt:new Date().toISOString()};
    } catch (error) { if (error.status) throw error; fail(503,"Unable to verify V2 owner. Moderation was not authorized."); }
  }
  return {allow,verifyCampaign,assertAdmin};
}
