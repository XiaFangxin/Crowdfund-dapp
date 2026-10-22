import { createHandler } from "../_shared/handler.js";
import { createChainAuthority } from "../_shared/chain.js";

function required(name: string): string {
  const value=Deno.env.get(name);
  if(!value)throw new Error(`Missing server setting ${name}`);
  return value;
}
const originValues=JSON.parse(required("APP_ORIGINS"));
if(!Array.isArray(originValues) || !originValues.length || originValues.some((value: unknown)=>typeof value!=="string" || new URL(value).origin!==value || !(value.startsWith("https://") || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(value))))throw new Error("Configure exact HTTPS APP_ORIGINS (localhost HTTP is development only).");
const supabaseURL=required("SUPABASE_URL");
const serviceKey=required("SUPABASE_SERVICE_ROLE_KEY");
const db={async rpc(name: string,args: Record<string, unknown>) {
  const response=await fetch(`${supabaseURL}/rest/v1/rpc/${name}`,{method:"POST",headers:{"Content-Type":"application/json",apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});
  const data=await response.json().catch(()=>null);
  if(!response.ok){throw Object.assign(new Error(data?.message ?? "Database unavailable"),{dbCode:data?.code});}
  return data;
}};
const chain=createChainAuthority({rpcURL:required("CHAIN_RPC_URL"),contracts:JSON.parse(required("CAMPAIGN_CONTRACTS")),moderationContract:Deno.env.get("MODERATION_CONTRACT_ADDRESS")});
Deno.serve(createHandler({db,chain,origins:originValues}));
