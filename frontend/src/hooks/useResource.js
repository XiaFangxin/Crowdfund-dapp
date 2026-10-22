import { useCallback, useEffect, useRef, useState } from "react";
import { contractConfigured, contractKey } from "../config/contracts.js";
import { errorMessage } from "../services/crowdfunding.js";
export default function useResource(wallet, load, dependencies = [], enabled = true) {
  const [revision,setRevision]=useState(0);
  const reload=useCallback(()=>setRevision(x=>x+1),[]);
  const ready=Boolean(enabled && contractConfigured && wallet.ethereum && wallet.isSepolia);
  const key=JSON.stringify([contractKey,wallet.account,wallet.chainId,wallet.revision,revision,ready,...dependencies],(_key,value)=>typeof value === "bigint" ? `bigint:${value}` : value);
  const loader=useRef(load); loader.current=load;
  const [state,setState]=useState({key:"",data:null,loading:false,error:""});
  useEffect(()=>{
    const controller=new AbortController();
    if(!ready){setState({key,data:null,loading:false,error:""});return;}
    setState({key,data:null,loading:true,error:""});
    Promise.resolve().then(()=>loader.current(controller.signal)).then(data=>{if(!controller.signal.aborted)setState({key,data,loading:false,error:""});},error=>{if(!controller.signal.aborted)setState({key,data:null,loading:false,error:errorMessage(error)});});
    return ()=>controller.abort();
  },[key,ready,wallet.ethereum]);
  return {...(state.key===key ? state : {data:null,loading:ready,error:""}),reload};
}
