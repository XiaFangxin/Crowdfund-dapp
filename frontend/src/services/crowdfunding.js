import { BrowserProvider, Contract, parseEther } from "ethers";
import v1 from "../contracts/Crowdfunding.json";
import v2 from "../contracts/CrowdfundingV2.json";
import { crowdfundingAddress, contractConfigured, contractConfigMessage, deploymentBlock, isV2, contractKey } from "../config/contracts.js";
import { SEPOLIA_CHAIN_ID } from "../config/network.js";
import { queryEventRanges } from "./events.js";
import { waitForTransaction } from "./transactions.js";
import { validateURI } from "./metadata.js";

export function errorMessage(error) {
  if (error?.code === 4001 || error?.code === "ACTION_REJECTED") return "Request rejected in MetaMask. Nothing was submitted.";
  return error?.reason ?? error?.shortMessage ?? error?.message ?? "Request failed.";
}
export function requireV2() { if (!isV2) throw new Error("This feature requires a separately deployed V2 contract. Current configuration is V1."); }
export async function getContract(ethereum, account) {
  if (!contractConfigured) throw new Error(contractConfigMessage);
  if (!ethereum) throw new Error("Install MetaMask first.");
  const provider = new BrowserProvider(ethereum);
  if ((await provider.getNetwork()).chainId !== BigInt(SEPOLIA_CHAIN_ID)) throw new Error("Switch MetaMask to Sepolia.");
  if (await provider.getCode(crowdfundingAddress) === "0x") throw new Error("No contract at the configured Sepolia address.");
  if (account) {
    const accounts = await ethereum.request({method:"eth_accounts"});
    if (accounts[0]?.toLowerCase() !== account.toLowerCase()) throw new Error("Wallet changed before signing. Reconnect the current account.");
  }
  const contract = new Contract(crowdfundingAddress, (isV2 ? v2 : v1).abi, account ? await provider.getSigner(account) : provider);
  if (isV2) {
    // Fail closed on an older deployment that lacks the current registry interface.
    try {
      const [owner, uriLimit, nameLimit, count] = await Promise.all([contract.owner(), contract.MAX_URI_LENGTH(), contract.MAX_CATEGORY_NAME_LENGTH(), contract.categoryCount()]);
      if (owner === "0x0000000000000000000000000000000000000000" || uriLimit !== 2048n || nameLimit !== 64n || count < 6n) throw new Error("Unsupported V2 interface");
    } catch { throw new Error("Configured address does not expose the expected V2 Category Registry. Check the deployment and ABI."); }
  }
  return contract;
}
const writes = new Set();
async function write(ethereum, account, method, args, emit, v2Only = false) {
  if (v2Only) requireV2();
  if (!account) throw new Error("Connect your wallet first.");
  const key = `${contractKey}:${account.toLowerCase()}`;
  if (writes.has(key)) throw new Error("A transaction for this wallet is still pending. Check MetaMask before retrying.");
  writes.add(key);
  try {
    const contract = await getContract(ethereum, account);
    return await waitForTransaction(async () => {
      // Recheck immediately before asking MetaMask to sign.
      const [accounts, chain] = await Promise.all([ethereum.request({method: "eth_accounts"}), ethereum.request({method: "eth_chainId"})]);
      if (accounts[0]?.toLowerCase() !== account.toLowerCase() || Number(chain) !== SEPOLIA_CHAIN_ID) throw new Error("Wallet or network changed. Retry with the current account.");
      return contract[method](...args);
    }, emit);
  } finally { writes.delete(key); }
}
function campaignModel(id, result) {
  const deadline = Number(result.deadline);
  if (!Number.isSafeInteger(deadline) || deadline > 8640000000000) throw new Error("Campaign deadline is outside the supported date range.");
  return { id: String(id), creator: result.creator, title: result.title, description: result.description,
    goal: result.goal, deadline, amountRaised: result.amountRaised, withdrawn: result.withdrawn, paused: false, categoryId: null, metadataURI: "" };
}
async function readCampaign(contract, id) {
  const campaign = campaignModel(id, await contract.getCampaign(id));
  if (isV2) {
    const [categoryId, paused, metadataURI] = await Promise.all([contract.getCampaignCategoryId(id), contract.campaignPaused(id), contract.getCampaignMetadataURI(id)]);
    const category = await contract.getCategory(categoryId);
    Object.assign(campaign, { categoryId: String(categoryId), category: { name: category.name, active: category.active }, paused, metadataURI });
  }
  return campaign;
}
export async function getCampaign(ethereum, id) {
  if (!/^\d+$/.test(String(id))) throw new Error("Invalid campaign ID.");
  return readCampaign(await getContract(ethereum), id);
}
export async function listCampaigns(ethereum, signal) {
  const contract = await getContract(ethereum);
  const count = await contract.campaignCount();
  const campaigns = [];
  // Sequential enumeration bounds RPC concurrency; an indexer/pagination is a future improvement.
  for (let id = 0n; id < count; id++) { signal?.throwIfAborted(); campaigns.push(await readCampaign(contract, id)); }
  return campaigns;
}
export async function listCategories(ethereum, signal) {
  requireV2();
  const c = await getContract(ethereum); const count = await c.categoryCount(); const result = [];
  for (let id = 0n; id < count; id++) { signal?.throwIfAborted(); const category = await c.getCategory(id); result.push({id: String(id), name: category.name, active: category.active}); }
  return result;
}
export async function getOwnership(ethereum) {
  requireV2(); const c = await getContract(ethereum);
  const [owner, pendingOwner] = await Promise.all([c.owner(), c.pendingOwner()]); return {owner, pendingOwner};
}
export async function getContribution(ethereum, id, account) { return (await getContract(ethereum)).contributions(id, account); }
export async function getWalletContributions(ethereum, campaigns, account, signal) {
  const c = await getContract(ethereum); const values = {};
  for (const campaign of campaigns) { signal?.throwIfAborted(); values[campaign.id] = await c.contributions(campaign.id, account); }
  return values;
}
export async function createCampaign(ethereum, account, {title, description, goal, deadline, categoryId}, emit) {
  const goalWei = parseEther(goal); const timestamp = Math.floor(new Date(deadline).getTime()/1000);
  if (!title.trim() || goalWei <= 0n || !Number.isSafeInteger(timestamp) || timestamp <= Date.now()/1000) throw new Error("Enter a title, positive ETH goal and future deadline.");
  const args = [title.trim(), description.trim(), goalWei, timestamp];
  if (isV2) {
    if (!/^\d+$/.test(String(categoryId))) throw new Error("Select an active category.");
    args.push(BigInt(categoryId));
  }
  const receipt = await write(ethereum, account, "createCampaign", args, emit);
  // A confirmed creation must remain successful even when its ID cannot be read.
  // Returning null lets the UI preserve the receipt and prevent duplicate creation.
  return {receipt, campaignId: campaignIdFromReceipt(receipt)};
}
export function campaignIdFromReceipt(receipt) {
  const abi = new Contract(crowdfundingAddress, (isV2 ? v2 : v1).abi).interface;
  for (const log of Array.isArray(receipt?.logs) ? receipt.logs : []) {
    if (typeof log?.address !== "string" || log.address.toLowerCase() !== crowdfundingAddress.toLowerCase()) continue;
    try {
      const created = abi.parseLog(log);
      const id = created?.name === "CampaignCreated" ? created.args.campaignId : null;
      if (typeof id === "bigint" && id >= 0n) return String(id);
    } catch { /* Malformed logs do not turn a confirmed transaction into a failure. */ }
  }
  return null;
}
export function contribute(ethereum, account, id, amount, emit) {
  const value = parseEther(amount); if (value <= 0n) throw new Error("Contribution must be positive.");
  return write(ethereum, account, "contribute", [id, {value}], emit);
}
export const withdraw = (e,a,id,emit) => write(e,a,"withdraw",[id],emit);
export const refund = (e,a,id,emit) => write(e,a,"refund",[id],emit);
export const setCampaignPaused = (e,a,id,paused,emit) => write(e,a,"setCampaignPaused",[id,paused],emit,true);
function categoryName(name) { if (!/^[!-~](?:[ -~]{0,62}[!-~])?$/.test(name)) throw new Error("Category names: 1-64 printable ASCII characters, no surrounding spaces."); return name; }
export const addCategory = (e,a,name,emit) => write(e,a,"addCategory",[categoryName(name)],emit,true);
export const renameCategory = (e,a,id,name,emit) => write(e,a,"renameCategory",[id,categoryName(name)],emit,true);
export const setCategoryActive = (e,a,id,active,emit) => write(e,a,"setCategoryActive",[id,active],emit,true);
export const setCampaignMetadataURI = (e,a,id,uri,emit) => {validateURI(uri); return write(e,a,"setCampaignMetadataURI",[id,uri],emit,true);};
export const publishCampaignUpdate = (e,a,id,uri,emit) => {validateURI(uri); return write(e,a,"publishCampaignUpdate",[id,uri],emit,true);};
async function eventContext(ethereum) {
  if (!/^\d+$/.test(deploymentBlock) || !Number.isSafeInteger(Number(deploymentBlock))) throw new Error("Set the correct deployment block for the selected contract version to query complete history.");
  const c = await getContract(ethereum); const latest = await c.runner.getBlockNumber(); const start = Number(deploymentBlock);
  if (start > latest) throw new Error("Deployment block is above latest block.");
  return {c,start,latest};
}
async function activity(ethereum, account, all, signal) {
  if (!account) return [];
  const {c,start,latest} = await eventContext(ethereum);
  const filters = [["Donation",c.filters.Contributed(null,account)],["Refund",c.filters.Refunded(null,account)]];
  if (all) filters.push(["Created",c.filters.CampaignCreated(null,account)],["Withdrawal",c.filters.Withdrawn(null,account)]);
  const records = []; const timestamps = new Map();
  for (const [type,filter] of filters) {
    const logs = await queryEventRanges(c,filter,start,latest,signal);
    for (const log of logs) {
      signal?.throwIfAborted();
      if (!timestamps.has(log.blockNumber)) { const block = await c.runner.getBlock(log.blockNumber); if (!block) throw new Error("Historical block not available."); timestamps.set(log.blockNumber, Number(block.timestamp)); }
      records.push({id:`${log.transactionHash}-${log.index}`,type,campaignId:String(log.args.campaignId),amountWei:log.args.amount ?? 0n,transactionHash:log.transactionHash,blockNumber:log.blockNumber,logIndex:log.index,timestamp:timestamps.get(log.blockNumber)});
    }
  }
  return records.sort((a,b) => b.blockNumber-a.blockNumber || b.logIndex-a.logIndex);
}
export const getContributionHistory = (e,a,signal) => activity(e,a,false,signal);
export const getWalletActivity = (e,a,signal) => activity(e,a,true,signal);
export async function getCampaignUpdates(ethereum,id,signal) {
  requireV2(); const {c,start,latest} = await eventContext(ethereum);
  const logs = await queryEventRanges(c,c.filters.CampaignUpdatePublished(id),start,latest,signal);
  const records=[];
  for (const log of logs) { signal?.throwIfAborted(); const block=await c.runner.getBlock(log.blockNumber); if (!block) throw new Error("Block unavailable"); records.push({id:`${log.transactionHash}-${log.index}`,uri:log.args.updateURI,creator:log.args.creator,transactionHash:log.transactionHash,timestamp:Number(block.timestamp)}); }
  return records.reverse();
}
export async function getDonationStatistics(ethereum,signal) {
  const {c,start,latest} = await eventContext(ethereum);
  const snapshot = await c.runner.getBlock(latest);
  if (!snapshot) throw new Error("Statistics snapshot is unavailable.");
  const logs = await queryEventRanges(c,c.filters.Contributed(),start,latest,signal);
  const byCampaign = {};
  for (const log of logs) {
    const id=String(log.args.campaignId);
    const stat=byCampaign[id] ??= {donations:0n,donors:new Set(),total:0n};
    stat.donations++; stat.donors.add(log.args.contributor.toLowerCase()); stat.total+=log.args.amount;
  }
  // Verify complete event coverage against historical totals at the same block.
  // Missing/truncated logs or an incorrect start block must not become fake counts.
  const count=await c.campaignCount({blockTag:latest});
  for(let id=0n;id<count;id++) {
    signal?.throwIfAborted();
    const campaign=await c.getCampaign(id,{blockTag:latest});
    if((byCampaign[String(id)]?.total ?? 0n)!==campaign.amountRaised) throw new Error("Donation event totals do not match the chain snapshot. Check deployment block or RPC log completeness.");
  }
  const finalSnapshot=await c.runner.getBlock(latest);
  if(!finalSnapshot || finalSnapshot.hash!==snapshot.hash) throw new Error("Chain snapshot changed during indexing. Refresh statistics.");
  return {block:latest,byCampaign:Object.fromEntries(Object.entries(byCampaign).map(([id,s]) => [id,{donations:s.donations,donors:BigInt(s.donors.size)}]))};
}
