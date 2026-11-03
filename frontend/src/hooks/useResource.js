import { useCallback, useEffect, useRef, useState } from "react";
import { contractConfigured, contractKey } from "../config/contracts.js";
import { errorMessage } from "../services/crowdfunding.js";
export default function useResource(wallet, load, dependencies = [], enabled = true) {
  const [revision,setRevision]=useState(0);
  const reload=useCallback(()=>setRevision(x=>x+1),[]);
  const ready=Boolean(enabled && contractConfigured && wallet.ethereum && wallet.isSepolia);
  const identity=JSON.stringify([contractKey,wallet.account,wallet.chainId,wallet.revision,ready,...dependencies],(_key,value)=>typeof value === "bigint" ? `bigint:${value}` : value);
  const key=JSON.stringify([identity,revision]);
  const loader=useRef(load); loader.current=load;
  const [state,setState]=useState({key:"",identity:"",data:null,loading:false,error:""});
  useEffect(()=>{
    const controller=new AbortController();
    if(!ready){setState({key,identity,data:null,loading:false,error:""});return;}
    setState(previous=>({key,identity,data:previous.identity===identity?previous.data:null,loading:true,error:""}));
    Promise.resolve().then(()=>loader.current(controller.signal)).then(data=>{if(!controller.signal.aborted)setState({key,identity,data,loading:false,error:""});},error=>{if(!controller.signal.aborted)setState({key,identity,data:null,loading:false,error:errorMessage(error)});});
    return ()=>controller.abort();
  },[key,ready,wallet.ethereum]);
  return {...(state.key===key ? state : {data:state.identity===identity?state.data:null,loading:ready,error:""}),reload};
}
