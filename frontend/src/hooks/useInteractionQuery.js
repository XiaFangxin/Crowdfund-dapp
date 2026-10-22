import { useCallback,useEffect,useRef,useState } from "react";
import { offchainConfigured } from "../services/supabase.js";
export default function useInteractionQuery(load,deps=[],enabled=true){
  const [revision,setRevision]=useState(0);const reload=useCallback(()=>setRevision(n=>n+1),[]);
  const ready=offchainConfigured && enabled;const key=JSON.stringify([ready,revision,...deps]);
  const fn=useRef(load);fn.current=load;const [state,setState]=useState({key:null,data:null,error:"",loading:false});
  useEffect(()=>{const controller=new AbortController();if(!ready){setState({key,data:null,error:"",loading:false});return;}
    setState({key,data:null,error:"",loading:true});
    Promise.resolve().then(()=>fn.current(controller.signal)).then(data=>{if(!controller.signal.aborted)setState({key,data,error:"",loading:false});},error=>{if(!controller.signal.aborted)setState({key,data:null,error:error.message,loading:false});});
    return()=>controller.abort();
  },[key,ready]);
  return {...(state.key===key?state:{data:null,error:"",loading:ready}),reload};
}
