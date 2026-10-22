export function resolveOffchainConfig(env = {}) {
  const url = (env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? "").trim();
  let message = "";
  if (!url || !key) message = "Off-chain interactions are not configured. Chain funding features remain available.";
  else {
    try { const parsed=new URL(url); if(parsed.username || parsed.password || parsed.pathname!=="/" || parsed.search || parsed.hash || !(parsed.protocol==="https:" || parsed.protocol==="http:" && ["localhost","127.0.0.1"].includes(parsed.hostname)))throw new Error(); }
    catch {message="Invalid public Supabase URL.";}
    if(key.startsWith("sb_secret_"))message="A server secret must never be used as the public Supabase key.";
    else if(!key.startsWith("sb_publishable_")) {
      try { if(JSON.parse(atob(key.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).role!=="anon")throw new Error(); }
      catch {message="Use only a Supabase publishable key or legacy anon key in the browser.";}
    }
  }
  return {url,key,configured:!message,message};
}
const config=resolveOffchainConfig(import.meta.env);
export const offchainConfigured=config.configured;
export const offchainMessage=config.message;
export const offchainEndpoint=config.url;
export async function invokeInteraction(action,payload={},options={}) {
  if(!config.configured)throw new Error(config.message);
  const timeout=AbortSignal.timeout(20000);
  const response=await fetch(`${config.url}/functions/v1/interactions`,{
    method:"POST",credentials:"omit",referrerPolicy:"no-referrer",signal:options.signal?AbortSignal.any([options.signal,timeout]):timeout,
    headers:{"Content-Type":"application/json",apikey:config.key,...(options.token?{Authorization:`Bearer ${options.token}`} : {}),...(options.visitorToken?{"x-visitor-token":options.visitorToken}:{})},
    body:JSON.stringify({...payload,action})
  });
  const result=await response.json().catch(()=>({error:"Invalid off-chain response."}));
  if(!response.ok){const error=new Error(result.error ?? "Off-chain request failed.");error.status=response.status;throw error;}
  if(!result || typeof result!=="object" || Array.isArray(result) || result.error || !Object.hasOwn(result,"data"))throw new Error("Invalid off-chain response. The operation could not be confirmed.");
  return result.data;
}
