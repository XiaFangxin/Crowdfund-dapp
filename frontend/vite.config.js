import { defineConfig,loadEnv } from "vite";
import { assertPublicSupabaseKeys } from "./src/config/supabasePublic.js";
import react from "@vitejs/plugin-react";

export default defineConfig(({mode})=>{
  const env={...loadEnv(mode,process.cwd(),"VITE_SUPABASE_"),...Object.fromEntries(Object.entries(process.env).filter(([name])=>name.startsWith("VITE_SUPABASE_")))};
  assertPublicSupabaseKeys(env);
  return {plugins:[react()]};
});
