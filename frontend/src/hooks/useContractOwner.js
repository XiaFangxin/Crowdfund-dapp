import { useEffect } from "react";
import useResource from "./useResource.js";
import { getOwnership } from "../services/crowdfunding.js";
import { isV2 } from "../config/contracts.js";
export default function useContractOwner(wallet) {
  const state=useResource(wallet,()=>getOwnership(wallet.ethereum),[],isV2 && Boolean(wallet.account));
  useEffect(()=>{if(!wallet.account || !wallet.isSepolia || !isV2)return;const timer=setInterval(state.reload,15000);return()=>clearInterval(timer);},[wallet.account,wallet.isSepolia,state.reload]);
  return {...state,isOwner:Boolean(state.data && wallet.account && state.data.owner.toLowerCase()===wallet.account.toLowerCase())};
}
