import { useEffect } from "react";
import useResource from "./useResource.js";
import { listCategories } from "../services/crowdfunding.js";
import { isV2 } from "../config/contracts.js";
export default function useCategories(wallet) {
  const state=useResource(wallet,signal=>listCategories(wallet.ethereum,signal),[],isV2);
  useEffect(()=>{if(!isV2 || !wallet.isSepolia)return;const timer=setInterval(state.reload,30000);return()=>clearInterval(timer);},[wallet.isSepolia,state.reload]);
  return {...state,categories:state.data ?? []};
}
