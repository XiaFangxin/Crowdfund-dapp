export function assertPublicSupabaseKeys(env={}){
  for(const [name,value] of Object.entries(env)){
    if(!name.startsWith("VITE_SUPABASE_"))continue;
    if(/SERVICE_ROLE|SECRET/i.test(name) && value)throw new Error("Server-only Supabase settings must not use VITE_ variables.");
    if(typeof value!=="string")continue;
    if(value.startsWith("sb_secret_"))throw new Error("Refusing a server-only Supabase key in public configuration.");
    const parts=value.split(".");
    if(parts.length===3){
      let claims;try{claims=JSON.parse(atob(parts[1].replace(/-/g,"+").replace(/_/g,"/")));}catch{}
      if(claims?.role==="service_role")throw new Error("Refusing a legacy service-role key in public configuration.");
    }
  }
}
