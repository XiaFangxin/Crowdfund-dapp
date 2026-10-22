-- Optional verification in the Supabase SQL editor after applying the migration.
-- Read-only assertions: no real wallet data or secrets are selected.
begin;
do $$ declare t record; f record; r text; begin
  for t in select oid,relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'oc\_%' escape '\' loop
    if not t.relrowsecurity then raise exception 'RLS missing on %',t.relname; end if;
    foreach r in array array['anon','authenticated'] loop
      if has_table_privilege(r,t.oid,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Unexpected browser table grant: % %',r,t.relname; end if;
    end loop;
  end loop;
  for f in select oid,proname from pg_proc where pronamespace='public'::regnamespace and proname like 'oc\_%' escape '\' loop
    foreach r in array array['anon','authenticated'] loop
      if has_function_privilege(r,f.oid,'EXECUTE') then raise exception 'Unexpected RPC grant: % %',r,f.proname; end if;
    end loop;
  end loop;
end $$;
rollback;
