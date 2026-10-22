import { SEPOLIA_CHAIN_ID } from "../config/network.js";
import { crowdfundingAddress,contractConfigured } from "../config/contracts.js";
export function interactionKey(campaignId) {
  if(!contractConfigured || !/^(0|[1-9][0-9]*)$/.test(String(campaignId)))return null;
  return {chainId:SEPOLIA_CHAIN_ID,contractAddress:crowdfundingAddress.toLowerCase(),campaignId:String(campaignId)};
}
export function sameDeployment(key) {return Boolean(key && Number(key.chainId)===SEPOLIA_CHAIN_ID && key.contractAddress.toLowerCase()===crowdfundingAddress.toLowerCase());}
export function keyString(key) {return key ? `${key.chainId}:${key.contractAddress.toLowerCase()}:${key.campaignId}` : "";}
