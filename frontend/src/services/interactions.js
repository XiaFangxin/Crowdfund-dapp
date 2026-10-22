import { invokeInteraction, offchainEndpoint } from "./supabase.js";
import { keyString } from "../utils/interactionKey.js";
const visitorStorageKey=`crowdfund:visitor:${offchainEndpoint}`;
let visitorPromise;
let memoryVisitor;
function cachedVisitor(){if(memoryVisitor && Date.parse(memoryVisitor.expiresAt)>Date.now()+5000)return memoryVisitor;try{const value=JSON.parse(localStorage.getItem(visitorStorageKey));return value && /^[a-f0-9]{64}$/.test(value.token) && Date.parse(value.expiresAt)>Date.now()+5000 ? value:null;}catch{return null;}}
async function visitor(){
  const existing=cachedVisitor();if(existing)return existing;
  if(!visitorPromise)visitorPromise=invokeInteraction("visitor").then(value=>{memoryVisitor=value;try{localStorage.setItem(visitorStorageKey,JSON.stringify(value));}catch{}return value;}).finally(()=>{visitorPromise=null;});
  return visitorPromise;
}
export async function recordView(key,signal){
  const value=await visitor();
  try{return await invokeInteraction("view",key,{visitorToken:value.token,signal});}
  catch(error){if(error.status!==401)throw error;memoryVisitor=null;try{localStorage.removeItem(visitorStorageKey);}catch{}const fresh=await visitor();return invokeInteraction("view",key,{visitorToken:fresh.token,signal});}
}
export async function loadMetrics(keys,signal){
  const results=[];
  for(let offset=0;offset<keys.length;offset+=100){signal?.throwIfAborted();results.push(...await invokeInteraction("metrics",{keys:keys.slice(offset,offset+100)},{signal}));}
  const expected=new Set(keys.map(keyString));
  const received=new Set();
  if(results.length!==keys.length || results.some(value=>{
    if(!value || !/^\d+$/.test(value.views) || !/^\d+$/.test(value.favorites))return true;
    const identity=keyString(value);
    if(!expected.has(identity) || received.has(identity))return true;
    received.add(identity);return false;
  }))throw new Error("Invalid off-chain metric response.");
  return results;
}
