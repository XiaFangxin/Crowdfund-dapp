import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
export async function database() {
  const pg=new PGlite();
  await pg.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await pg.exec(await readFile(new URL("../migrations/202610210001_offchain_interactions.sql",import.meta.url),"utf8"));
  const rpc=async(name,args={})=>{
    const entries=Object.entries(args);const sql=`select public.${name}(${entries.map(([key],i)=>`${key} => $${i+1}`).join(",")}) as data`;
    try {const result=await pg.query(sql,entries.map(([,value])=>value && typeof value === "object"?JSON.stringify(value):value));return result.rows[0]?.data;}
    catch(error){error.dbCode=error.code;throw error;}
  };
  return {pg,rpc};
}
