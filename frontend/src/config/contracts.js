import { isAddress, ZeroAddress } from "ethers";

export const crowdfundingAddress = (import.meta.env.VITE_CROWDFUNDING_ADDRESS ?? "").trim();
export const contractConfigured = isAddress(crowdfundingAddress) && crowdfundingAddress.toLowerCase() !== ZeroAddress;
export const contractConfigMessage = !crowdfundingAddress
  ? "Contract not deployed/configured. Add the real Sepolia address to frontend/.env after deployment."
  : !contractConfigured ? "Invalid contract address. Check VITE_CROWDFUNDING_ADDRESS in frontend/.env." : "";
