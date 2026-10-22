import { isAddress, ZeroAddress } from "ethers";
export const V1_ADDRESS = "0xbdF615493ce21B7Ae54E6464D44c507C76b85B6C";
export function resolveContractConfig(env = {}) {
  const version = (env.VITE_CROWDFUNDING_VERSION ?? "v1").trim().toLowerCase();
  const address = (version === "v2" ? env.VITE_CROWDFUNDING_V2_ADDRESS : env.VITE_CROWDFUNDING_ADDRESS ?? V1_ADDRESS)?.trim() ?? "";
  const block = (version === "v2" ? env.VITE_CROWDFUNDING_V2_DEPLOY_BLOCK : env.VITE_CROWDFUNDING_DEPLOY_BLOCK)?.trim() ?? "";
  let message = "";
  if (!["v1", "v2"].includes(version)) message = "Select v1 or v2 in VITE_CROWDFUNDING_VERSION.";
  else if (!address) message = `${version.toUpperCase()} is not deployed/configured. No transactions are available.`;
  else if (!isAddress(address) || address.toLowerCase() === ZeroAddress) message = "Invalid contract address.";
  else if (version === "v2" && address.toLowerCase() === V1_ADDRESS.toLowerCase()) message = "Blocked: the V1 address cannot use the V2 ABI.";
  return { version, address, block, configured: !message, message };
}
const config = resolveContractConfig(import.meta.env);
export const contractVersion = config.version;
export const isV2 = contractVersion === "v2";
export const crowdfundingAddress = config.address;
export const deploymentBlock = config.block;
export const contractConfigured = config.configured;
export const contractConfigMessage = config.message;
export const contractKey = `${contractVersion}:${crowdfundingAddress.toLowerCase()}`;
