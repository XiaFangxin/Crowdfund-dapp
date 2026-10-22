import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
test("configured social components render anonymous states without signing or making real requests",async()=>{
  const settings={VITE_SUPABASE_URL:"https://placeholder-project.supabase.co",VITE_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_not_a_real_project_key"};
  const previous=Object.fromEntries(Object.keys(settings).map(key=>[key,process.env[key]]));Object.assign(process.env,settings);
  const server=await createServer({configFile:false,envFile:false,esbuild:{jsx:"automatic"},server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]}});
  const wallet={account:"",ethereum:null,chainId:null,isSepolia:false,revision:0};
  const campaignKey={chainId:11155111,contractAddress:"0x0000000000000000000000000000000000000001",campaignId:"0"};
  try{
    for(const name of ["WalletSignIn","Views","FavoriteButton","ReportDialog","CommentSection","SavedCampaigns","AdminReports"]){
      const {default:Component}=await server.ssrLoadModule(`/src/components/offchain/${name}.jsx`);
      const html=renderToStaticMarkup(createElement(Component,{wallet,campaignKey,onPause:()=>{throw new Error("No automatic transactions");}}));
      assert.ok(html.length>0,name);
      assert.ok(!html.includes("sb_publishable_not_a_real_project_key"));
      if(name==="FavoriteButton" || name==="ReportDialog")assert.ok(html.includes("disabled"));
      if(name==="AdminReports")assert.ok(html.includes("Sign in"));
    }
  }finally{await server.close();for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
