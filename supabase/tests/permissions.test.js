import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";
import { database } from "./database.js";

test("migration executes in PostgreSQL and all browser roles lack table/RPC access",async()=>{
  const db=await database();
  try{
    const tables=await db.pg.query("select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'oc_%'");
    assert.equal(tables.rows.length,10);assert.ok(tables.rows.every(row=>row.relrowsecurity));
    for(const role of ["anon","authenticated"]){
      const grants=await db.pg.query("select has_table_privilege($1,'public.oc_comments','select') as can_read,has_table_privilege($1,'public.oc_favorites','insert') as can_write,has_function_privilege($1,'public.oc_finish_login(uuid,text,text)','execute') as can_login",[role]);
      assert.deepEqual(grants.rows[0],{can_read:false,can_write:false,can_login:false});
      const functions=await db.pg.query("select count(*)::integer as n from pg_proc where pronamespace='public'::regnamespace and proname like 'oc_%' and has_function_privilege($1,oid,'execute')",[role]);
      assert.equal(functions.rows[0].n,0);
      await db.pg.exec(`set role ${role}`);
      await assert.rejects(()=>db.pg.query("select * from public.oc_sessions"),/permission denied/);
      await assert.rejects(()=>db.rpc("oc_execute",{p_action:"saved.list",p_hash:"a".repeat(64),p_origin:"https://app.example",p:{}}),/permission denied/);
      await db.pg.exec("reset role");
    }
    // Even an accidental future SELECT grant remains subject to default-deny RLS.
    await db.pg.exec("insert into public.oc_campaigns(chain_id,contract_address,campaign_id) values(11155111,'0x0000000000000000000000000000000000000001',0)");
    await db.pg.query("insert into public.oc_comments(id,chain_id,contract_address,campaign_id,wallet,body) values($1,11155111,'0x0000000000000000000000000000000000000001',0,'0x0000000000000000000000000000000000000002','Private test')",[crypto.randomUUID()]);
    await db.pg.exec("begin; grant select on public.oc_comments to anon; set local role anon;");
    const invisible=await db.pg.query("select count(*)::integer as n from public.oc_comments");assert.equal(invisible.rows[0].n,0);
    await db.pg.exec("rollback");
    await db.pg.exec(await readFile(new URL("./verify_permissions.sql",import.meta.url),"utf8"));
    await db.pg.exec("set role service_role");await db.rpc("oc_gate",{p_origin:"https://app.example"});
  }finally{await db.pg.close();}
});
