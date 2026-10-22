import useResource from "./useResource.js";
import { listCampaigns } from "../services/crowdfunding.js";
export default function useCampaigns(wallet, enabled = true) {
  const state=useResource(wallet,signal=>listCampaigns(wallet.ethereum,signal),[],enabled);
  return {...state,campaigns:state.data ?? [],loaded:state.data !== null};
}
