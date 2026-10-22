import { createContext,useContext,useEffect,useRef,useState } from "react";
import { hexlify,toUtf8Bytes } from "ethers";
import { invokeInteraction,offchainConfigured,offchainMessage } from "../services/supabase.js";
import { validateLoginChallenge } from "../utils/walletChallenge.js";
const WalletSessionContext=createContext({signedIn:false,wallet:"",sessionKey:"",busy:false,error:"",pendingSignouts:0,login:async()=>{},logout:async()=>{},request:async()=>{throw new Error("Wallet sign-in is required.");},retrySignouts:async()=>{}});
export const useWalletSession=()=>useContext(WalletSessionContext);
export function WalletSessionProvider({wallet,children}){
  const [session,setSession]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [pendingSignouts,setPendingSignouts]=useState(0);
  const current=useRef(null),walletRef=useRef(wallet),generation=useRef(0),loginLock=useRef(false),revocations=useRef(new Set());
  walletRef.current=wallet;
  async function revoke(token){
    revocations.current.add(token);setPendingSignouts(revocations.current.size);
    try{await invokeInteraction("auth.logout",{},{token});revocations.current.delete(token);}
    catch(error){if(error.status===401)revocations.current.delete(token);else setError("Local session cleared; server sign-out could not be confirmed. Retry when online. Server sessions expire after one hour.");}
    setPendingSignouts(revocations.current.size);
  }
  function clear(){const previous=current.current;current.current=null;generation.current++;setSession(null);if(previous)void revoke(previous.token);}
  useEffect(()=>{clear();setError("");},[wallet.account,wallet.chainId]);
  useEffect(()=>{
    const provider=wallet.ethereum;if(!provider)return;
    const changed=()=>clear();
    provider.on?.("accountsChanged",changed);provider.on?.("chainChanged",changed);provider.on?.("disconnect",changed);
    return()=>{provider.removeListener?.("accountsChanged",changed);provider.removeListener?.("chainChanged",changed);provider.removeListener?.("disconnect",changed);};
  },[wallet.ethereum]);
  useEffect(()=>{if(!session)return;const timer=setTimeout(()=>{if(current.current?.token===session.token){clear();setError("Off-chain session expired. Sign in again.");}},Math.max(0,Date.parse(session.expiresAt)-Date.now()));return()=>clearTimeout(timer);},[session]);
  async function retrySignouts(){for(const token of [...revocations.current])await revoke(token);}
  useEffect(()=>{const online=()=>{void retrySignouts();};window.addEventListener("online",online);return()=>window.removeEventListener("online",online);},[]);
  async function login(){
    if(loginLock.current)return;loginLock.current=true;setBusy(true);setError("");const attempt=++generation.current;
    const account=walletRef.current.account;const provider=walletRef.current.ethereum;
    let issued;
    try{
      if(!offchainConfigured)throw new Error(offchainMessage);
      if(!account || !provider || !walletRef.current.isSepolia)throw new Error("Connect MetaMask on Sepolia first.");
      const challenge=await invokeInteraction("auth.challenge",{wallet:account,chainId:11155111});
      const message=validateLoginChallenge(challenge,account,11155111,window.location.origin);
      if(attempt!==generation.current)throw new Error("Wallet context changed before signing.");
      const [accounts,chain]=await Promise.all([provider.request({method:"eth_accounts"}),provider.request({method:"eth_chainId"})]);
      if(accounts[0]?.toLowerCase()!==account.toLowerCase() || Number(chain)!==11155111)throw new Error("Wallet context changed.");
      const signature=await provider.request({method:"personal_sign",params:[hexlify(toUtf8Bytes(message)),account]});
      if(attempt!==generation.current)throw new Error("Wallet changed during sign-in.");
      issued=await invokeInteraction("auth.verify",{id:challenge.id,signature});
      if(attempt!==generation.current || walletRef.current.account.toLowerCase()!==account.toLowerCase() || !walletRef.current.isSepolia){throw new Error("Wallet changed; new session was revoked.");}
      if(typeof issued.token!=="string" || !/^[a-f0-9]{64}$/.test(issued.token) || !Number.isFinite(Date.parse(issued.expiresAt)) || Date.parse(issued.expiresAt)<=Date.now() || issued.wallet!==account.toLowerCase() || issued.chainId!==11155111)throw new Error("Server identity mismatch.");
      current.current=issued;setSession(issued);
    }catch(error){if(issued && current.current?.token!==issued.token)void revoke(issued.token);setError(error.code===4001?"Sign-in signature rejected. No gas was paid.":error.message);}
    finally{loginLock.current=false;setBusy(false);}
  }
  async function request(action,payload={},options={}){
    const s=current.current;const currentWallet=walletRef.current;
    if(!s || s.wallet!==currentWallet.account.toLowerCase() || !currentWallet.isSepolia || Date.parse(s.expiresAt)<=Date.now()){clear();throw new Error("Sign in with your current wallet first.");}
    try{return await invokeInteraction(action,payload,{...options,token:s.token});}
    catch(error){if(error.status===401 && current.current?.token===s.token){clear();setError("Server session expired or was revoked. Sign in again.");}throw error;}
  }
  const signedIn=Boolean(session && session.wallet===wallet.account.toLowerCase() && wallet.isSepolia);
  return <WalletSessionContext.Provider value={{signedIn,wallet:signedIn?session.wallet:"",sessionKey:signedIn?session.expiresAt:"",busy,error,pendingSignouts,login,logout:clear,retrySignouts,request}}>{children}</WalletSessionContext.Provider>;
}
