import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../services/crowdfunding.js";
export default function useTransaction() {
  const [state,setState]=useState({status:"idle",hash:"",error:""});
  const active=useRef(true); const busy=useRef(false);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  async function run(action) {
    if(busy.current)return null;
    busy.current=true;
    if(active.current)setState({status:"signature",hash:"",error:""});
    try { return await action(update=>{if(!active.current && update.status === "signature") throw new Error("Page or wallet context changed before submission."); if(active.current)setState(update);}); }
    catch(error) {if(active.current)setState(previous=>({...previous,status:error.code==="CONFIRMATION_UNKNOWN"?"unknown":"failed",error:errorMessage(error)}));return null;}
    finally {busy.current=false;}
  }
  return {...state,busy:["signature","submitted","confirming"].includes(state.status),run};
}
