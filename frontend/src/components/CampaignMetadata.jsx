import { useEffect, useState } from "react";
import { fetchDocument } from "../services/metadata.js";
export function SafeImage({src,alt="Campaign cover"}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[src]);
  return failed ? <p>Image unavailable.</p> : <img className="campaign-cover" src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)} />;
}
export default function CampaignMetadata({uri,kind="metadata",compact=false}) {
  const [state,setState]=useState({uri:null,kind:null,data:null,error:""});
  useEffect(()=>{const controller=new AbortController();setState({uri,kind,data:null,error:""});if(uri)fetchDocument(uri,kind,controller.signal).then(data=>{if(!controller.signal.aborted)setState({uri,kind,data,error:""});}).catch(error=>{if(!controller.signal.aborted)setState({uri,kind,data:null,error:error.message});});return()=>controller.abort();},[uri,kind]);
  if(!uri)return compact?null:<p>No off-chain content has been published.</p>;
  if(state.uri!==uri || state.kind!==kind || !state.data)return <p role={state.error?"alert":"status"}>{state.error ? `Off-chain content unavailable: ${state.error}`:"Loading off-chain content..."}</p>;
  const doc=state.data;
  return <div className="metadata-content">{kind==="metadata" ? <><SafeImage src={doc.image} /><p>{doc.summary}</p>{!compact && <p className="plain-text">{doc.additionalDescription}</p>}</> : <><h3>{doc.title}</h3><p className="plain-text">{doc.body}</p>{doc.images.map((src,index)=><SafeImage key={`${src}:${index}`} src={src} alt="Project update" />)}</>}</div>;
}
