import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("pages render safe wallet/configuration states without making chain requests", async()=>{
  const server=await createServer({configFile:false,envFile:false,esbuild:{jsx:"automatic"},server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]}});
  try {
    const wallet={ethereum:null,account:"",chainId:null,isSepolia:false,revision:0,busy:false};
    for(const name of ["Home","CreateCampaign","CampaignDetail","Profile","MyCampaigns","MyContributions","AdminDashboard"]){
      const {default:Component}=await server.ssrLoadModule(`/src/pages/${name}.jsx`);
      const html=renderToStaticMarkup(createElement(Component,{wallet,id:"0"}));
      assert.ok(html.includes("MetaMask") || html.includes("Sepolia"),name);
    }
    const {default:Card}=await server.ssrLoadModule("/src/components/CampaignCard.jsx");
    const {CreatedCampaigns}=await server.ssrLoadModule("/src/pages/MyCampaigns.jsx");
    const state={campaigns:[],loaded:false,loading:false,error:"",reload(){}};
    const missingWallet=renderToStaticMarkup(createElement(CreatedCampaigns,{wallet,state}));
    assert.ok(missingWallet.includes("Connect your wallet"));assert.ok(!missingWallet.includes("No campaigns yet"));
    const pending=renderToStaticMarkup(createElement(CreatedCampaigns,{wallet:{...wallet,ethereum:{},account:"0x0000000000000000000000000000000000000001",isSepolia:true},state}));
    assert.ok(pending.includes("Loading campaigns"));assert.ok(!pending.includes("No campaigns yet"));
    const html=renderToStaticMarkup(createElement(Card,{now:0,campaign:{id:"0",title:"<script>alert(1)</script>",description:"<img onerror=alert(1)>",goal:100n,amountRaised:25n,deadline:1000,withdrawn:false}}));
    assert.ok(html.includes("&lt;script&gt;"));assert.ok(!html.includes("<script>"));assert.ok(html.includes('role="progressbar"'));
  }finally{await server.close();}
});
