import { BrowserProvider, Contract, parseEther } from "ethers";
import artifact from "../contracts/Crowdfunding.json";
import { crowdfundingAddress, contractConfigured, contractConfigMessage } from "../config/contracts.js";
import { SEPOLIA_CHAIN_ID } from "../config/network.js";

export function errorMessage(error) {
  return error?.reason ?? error?.shortMessage ?? error?.message ?? "Request failed.";
}

async function getContract(ethereum, account) {
  if (!contractConfigured) throw new Error(contractConfigMessage);
  if (!artifact.abi.length) throw new Error("ABI missing. Run npm run export:abi in smart-contract.");
  if (!ethereum) throw new Error("Install MetaMask first.");
  const provider = new BrowserProvider(ethereum);
  if ((await provider.getNetwork()).chainId !== BigInt(SEPOLIA_CHAIN_ID)) throw new Error("Switch MetaMask to Sepolia.");
  if (await provider.getCode(crowdfundingAddress) === "0x") throw new Error("No contract at this Sepolia address. Check deployment configuration.");
  const runner = account ? await provider.getSigner(account) : provider;
  return new Contract(crowdfundingAddress, artifact.abi, runner);
}

function campaignModel(id, result) {
  return { id: String(id), creator: result.creator, title: result.title, description: result.description,
    goal: result.goal, deadline: Number(result.deadline), amountRaised: result.amountRaised, withdrawn: result.withdrawn };
}

export async function getCampaign(ethereum, id) {
  if (!/^\d+$/.test(String(id))) throw new Error("Invalid campaign ID.");
  const contract = await getContract(ethereum);
  return campaignModel(id, await contract.getCampaign(id));
}

export async function listCampaigns(ethereum) {
  const contract = await getContract(ethereum);
  const count = Number(await contract.campaignCount());
  // Demo enumeration. Replace with pagination/event indexing as the project grows.
  const campaigns = [];
  for (let id = 0; id < count; id++) campaigns.push(campaignModel(id, await contract.getCampaign(id)));
  return campaigns;
}

export async function getContribution(ethereum, id, account) {
  const contract = await getContract(ethereum);
  return contract.contributions(id, account);
}

export async function createCampaign(ethereum, account, { title, description, goal, deadline }) {
  if (!account) throw new Error("Connect your wallet first.");
  const goalWei = parseEther(goal);
  const timestamp = Math.floor(new Date(deadline).getTime() / 1000);
  if (!title.trim() || goalWei <= 0n || !Number.isSafeInteger(timestamp) || timestamp <= Date.now() / 1000)
    throw new Error("Enter a title, a positive ETH goal, and a future deadline.");
  const contract = await getContract(ethereum, account);
  const tx = await contract.createCampaign(title.trim(), description.trim(), goalWei, timestamp);
  return tx.wait();
}

export async function contribute(ethereum, account, id, amount) {
  if (!account) throw new Error("Connect your wallet first.");
  const value = parseEther(amount);
  if (value <= 0n) throw new Error("Contribution must be positive.");
  const contract = await getContract(ethereum, account);
  return (await contract.contribute(id, { value })).wait();
}

export async function withdraw(ethereum, account, id) {
  if (!account) throw new Error("Connect your wallet first.");
  const contract = await getContract(ethereum, account);
  return (await contract.withdraw(id)).wait();
}

export async function refund(ethereum, account, id) {
  if (!account) throw new Error("Connect your wallet first.");
  const contract = await getContract(ethereum, account);
  return (await contract.refund(id)).wait();
}
