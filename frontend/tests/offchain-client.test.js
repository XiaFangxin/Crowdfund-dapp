import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

test("off-chain client rejects malformed success envelopes and metrics from another deployment",async()=>{
  const env={VITE_SUPABASE_URL:"https://example.supabase.co",VITE_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test"};
  const previous=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));
  Object.assign(process.env,env);
  const originalFetch=globalThis.fetch;
  const server=await createServer({configFile:false,envFile:false,server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]}});
  let body;
  globalThis.fetch=async()=>new Response(typeof body==="string"?body:JSON.stringify(body),{status:200,headers:{"Content-Type":"application/json"}});
  try {
    const {invokeInteraction}=await server.ssrLoadModule("/src/services/supabase.js");
    for(body of ["not-json",{},null,{error:"failed"}])await assert.rejects(()=>invokeInteraction("favorite.set"),/Invalid off-chain response/);
    body={data:false};assert.equal(await invokeInteraction("favorite.set"),false);
    const {loadMetrics}=await server.ssrLoadModule("/src/services/interactions.js");
    const key={chainId:11155111,contractAddress:"0x0000000000000000000000000000000000000001",campaignId:"0"};
    body={data:[{...key,views:"42",favorites:"1"}]};assert.equal((await loadMetrics([key]))[0].views,"42");
    for(const changed of [{chainId:1},{campaignId:"1"},{contractAddress:"0x0000000000000000000000000000000000000002"}]){
      body={data:[{...key,...changed,views:"42",favorites:"1"}]};await assert.rejects(()=>loadMetrics([key]),/metric response/);
    }
    body={data:[{...key,views:"42",favorites:"1"},{...key,views:"42",favorites:"1"}]};
    await assert.rejects(()=>loadMetrics([key,{...key,campaignId:"1"}]),/metric response/);
  }finally{globalThis.fetch=originalFetch;await server.close();for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
