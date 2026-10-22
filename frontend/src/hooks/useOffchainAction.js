import { useEffect,useRef,useState } from "react";
export default function useOffchainAction(){
  const lock=useRef(false),active=useRef(true);const [state,setState]=useState({busy:false,error:"",message:""});
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  async function run(action,message="Saved off chain. No gas paid."){
    if(lock.current)return null;lock.current=true;if(active.current)setState({busy:true,error:"",message:""});
    try{const result=await action();if(active.current)setState({busy:false,error:"",message});return result;}
    catch(error){if(active.current)setState({busy:false,error:error.message,message:""});return null;}
    finally{lock.current=false;}
  }
  return {...state,run};
}
