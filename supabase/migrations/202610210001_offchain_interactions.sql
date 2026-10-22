-- All interaction tables are private to the Edge service role. No browser JWT is trusted here.
create table public.oc_campaigns (
  chain_id bigint not null check (chain_id > 0),
  contract_address text not null check (contract_address ~ '^0x[0-9a-f]{40}$'),
  campaign_id numeric(78,0) not null check (campaign_id >= 0 and campaign_id < power(2::numeric,256)),
  views bigint not null default 0 check (views >= 0),
  verified_at timestamptz not null default now(),
  primary key (chain_id, contract_address, campaign_id)
);
create table public.oc_challenges (
  id uuid primary key,
  wallet text not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  chain_id bigint not null check (chain_id > 0), origin text not null,
  nonce text not null unique check (nonce ~ '^[a-f0-9]{64}$'), message text not null,
  issued_at text not null, expires_at text not null,
  consumed_at timestamptz, created_at timestamptz not null default now()
);
create index oc_challenges_cleanup on public.oc_challenges(created_at);
create table public.oc_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  wallet text not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  chain_id bigint not null, origin text not null,
  expires_at timestamptz not null, created_at timestamptz not null default now()
);
create index oc_sessions_expiry on public.oc_sessions(expires_at);
create table public.oc_visitors (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  origin text not null, expires_at timestamptz not null default (now() + interval '1 day')
);
create index oc_visitors_expiry on public.oc_visitors(expires_at);
create table public.oc_comments (
  id uuid primary key,
  chain_id bigint not null, contract_address text not null, campaign_id numeric(78,0) not null,
  wallet text not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  parent_id uuid,
  body text not null check (char_length(btrim(body)) between 1 and 2000 and body !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]'),
  author_hidden boolean not null default false, moderator_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique(id, chain_id, contract_address, campaign_id),
  foreign key(chain_id,contract_address,campaign_id) references public.oc_campaigns,
  foreign key(parent_id,chain_id,contract_address,campaign_id) references public.oc_comments(id,chain_id,contract_address,campaign_id)
);
create index oc_comments_page on public.oc_comments(chain_id,contract_address,campaign_id,parent_id,created_at desc,id desc);
create table public.oc_favorites (
  wallet text not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  chain_id bigint not null, contract_address text not null, campaign_id numeric(78,0) not null,
  created_at timestamptz not null default now(),
  primary key(wallet,chain_id,contract_address,campaign_id),
  foreign key(chain_id,contract_address,campaign_id) references public.oc_campaigns
);
create index oc_favorites_campaign on public.oc_favorites(chain_id,contract_address,campaign_id);
create index oc_favorites_page on public.oc_favorites(wallet,created_at desc);
create table public.oc_reports (
  id uuid primary key, wallet text not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  chain_id bigint not null, contract_address text not null, campaign_id numeric(78,0) not null,
  target_kind text not null check (target_kind in ('campaign','comment')), comment_id uuid,
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  status text not null default 'open' check (status in ('open','in_review','resolved','dismissed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((target_kind='comment' and comment_id is not null) or (target_kind='campaign' and comment_id is null)),
  foreign key(chain_id,contract_address,campaign_id) references public.oc_campaigns,
  foreign key(comment_id,chain_id,contract_address,campaign_id) references public.oc_comments(id,chain_id,contract_address,campaign_id)
);
create unique index oc_report_campaign_once on public.oc_reports(wallet,chain_id,contract_address,campaign_id) where target_kind='campaign';
create unique index oc_report_comment_once on public.oc_reports(wallet,comment_id) where target_kind='comment';
create index oc_reports_page on public.oc_reports(status,created_at desc,id desc);
create table public.oc_moderation_log (
  id uuid primary key, wallet text not null, report_id uuid references public.oc_reports,
  comment_id uuid references public.oc_comments, action text not null, proof jsonb not null,
  created_at timestamptz not null default now()
);
create table public.oc_view_windows (
  chain_id bigint not null, contract_address text not null, campaign_id numeric(78,0) not null,
  visitor_hash text not null references public.oc_visitors(token_hash) on delete cascade,
  window_id bigint not null,
  primary key(chain_id,contract_address,campaign_id,visitor_hash,window_id),
  foreign key(chain_id,contract_address,campaign_id) references public.oc_campaigns
);
create index oc_view_visitor_cleanup on public.oc_view_windows(visitor_hash);
create table public.oc_rate_limits (
  key text not null, bucket bigint not null, hits integer not null, expires_at timestamptz not null,
  primary key(key,bucket)
);
create index oc_rates_expiry on public.oc_rate_limits(expires_at);

-- Grant no table access and no permissive RLS policies to either browser role.
do $$ declare t text; begin
  foreach t in array array['oc_campaigns','oc_challenges','oc_sessions','oc_visitors','oc_comments','oc_favorites','oc_reports','oc_moderation_log','oc_view_windows','oc_rate_limits'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public, anon, authenticated',t);
    execute format('grant all on table public.%I to service_role',t);
  end loop;
end $$;

create function public.oc_limit(p_key text,p_max integer,p_seconds integer) returns void
language plpgsql security invoker set search_path='' as $$
declare n integer; b bigint := floor(extract(epoch from now()) / p_seconds);
begin
  insert into public.oc_rate_limits(key,bucket,hits,expires_at) values(p_key,b,1,now()+p_seconds*interval '1 second')
  on conflict(key,bucket) do update set hits=public.oc_rate_limits.hits+1 returning hits into n;
  if n > p_max then raise exception 'Rate limit exceeded' using errcode='P0001'; end if;
end $$;
create function public.oc_gate(p_origin text) returns void language plpgsql security invoker set search_path='' as $$
begin perform public.oc_limit('requests:'||p_origin,600,60); end $$;

create function public.oc_identity(p_hash text,p_origin text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s public.oc_sessions;
begin
  select * into s from public.oc_sessions where token_hash=p_hash and origin=p_origin and expires_at>now() for share;
  if not found then raise exception 'Session expired or revoked' using errcode='28000'; end if;
  return jsonb_build_object('wallet',s.wallet,'chainId',s.chain_id,'expiresAt',s.expires_at);
end $$;
create function public.oc_finish_login(p_id uuid,p_hash text,p_origin text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.oc_challenges; expiry timestamptz := now()+interval '1 hour';
begin
  -- One atomic conditional update prevents concurrent reuse after signature verification.
  update public.oc_challenges set consumed_at=now() where id=p_id and origin=p_origin and consumed_at is null and expires_at::timestamptz>now() returning * into c;
  if not found then raise exception 'Challenge expired or consumed' using errcode='28000'; end if;
  insert into public.oc_sessions(token_hash,wallet,chain_id,origin,expires_at) values(p_hash,c.wallet,c.chain_id,c.origin,expiry);
  return jsonb_build_object('wallet',c.wallet,'chainId',c.chain_id,'expiresAt',expiry);
end $$;
create function public.oc_challenge(p_data jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
  perform public.oc_limit('challenge:'||(p_data->>'wallet'),5,600);
  perform public.oc_limit('challenges-global',120,3600);
  insert into public.oc_challenges(id,wallet,chain_id,origin,nonce,message,issued_at,expires_at)
  values((p_data->>'id')::uuid,p_data->>'wallet',(p_data->>'chain_id')::bigint,p_data->>'origin',p_data->>'nonce',p_data->>'message',p_data->>'issued_at',p_data->>'expires_at');
end $$;
create function public.oc_get_challenge(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$
  select to_jsonb(c) from public.oc_challenges c where id=p_id;
$$;
create function public.oc_logout(p_hash text,p_origin text) returns void language sql security invoker set search_path='' as $$
  delete from public.oc_sessions where token_hash=p_hash and origin=p_origin;
$$;
create function public.oc_register(p_chain bigint,p_address text,p_campaign numeric) returns void
language sql security invoker set search_path='' as $$
  insert into public.oc_campaigns(chain_id,contract_address,campaign_id) values(p_chain,p_address,p_campaign) on conflict do nothing;
$$;
create function public.oc_registered(p_chain bigint,p_address text,p_campaign numeric) returns boolean
language sql security invoker set search_path='' as $$
  select exists(select 1 from public.oc_campaigns where chain_id=p_chain and contract_address=p_address and campaign_id=p_campaign);
$$;

create function public.oc_public(p_action text,p jsonb,p_origin text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c bigint := (p->>'chainId')::bigint; a text := p->>'contractAddress'; i numeric := (p->>'campaignId')::numeric;
  result jsonb; changed integer; visitor text := p->>'visitorHash';
  off integer := coalesce((p->>'offset')::integer,0);
begin
  if off<0 or off>10000 then raise exception 'Invalid page offset'; end if;
  if p_action='visitor' then
    perform public.oc_limit('visitors:'||p_origin,200,3600);
    insert into public.oc_visitors(token_hash,origin) values(visitor,p_origin);
    return jsonb_build_object('ok',true);
  elsif p_action='view' then
    if not exists(select 1 from public.oc_visitors where token_hash=visitor and origin=p_origin and expires_at>now()) then raise exception 'Visitor expired' using errcode='28000'; end if;
    perform public.oc_limit('view-visitor:'||visitor,120,3600);
    insert into public.oc_view_windows values(c,a,i,visitor,floor(extract(epoch from now())/1800)) on conflict do nothing;
    get diagnostics changed=row_count;
    if changed=1 then perform public.oc_limit('views-campaign:'||c||':'||a||':'||i,200,3600); end if;
    update public.oc_campaigns set views=views+changed where chain_id=c and contract_address=a and campaign_id=i returning jsonb_build_object('views',views::text,'counted',changed=1) into result;
    return result;
  elsif p_action='comments' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
      select id,wallet,parent_id as "parentId",case when author_hidden or moderator_hidden then null else body end as body,
        (author_hidden or moderator_hidden) as hidden,created_at as "createdAt"
      from public.oc_comments where chain_id=c and contract_address=a and campaign_id=i and parent_id is not distinct from (p->>'parentId')::uuid
      order by created_at desc,id desc limit 20 offset off
    ) x;
    return result;
  elsif p_action='metrics' then
    select coalesce(jsonb_agg(jsonb_build_object('chainId',(k->>'chainId')::bigint,'contractAddress',k->>'contractAddress','campaignId',k->>'campaignId',
      'views',coalesce((select views::text from public.oc_campaigns where chain_id=(k->>'chainId')::bigint and contract_address=k->>'contractAddress' and campaign_id=(k->>'campaignId')::numeric),'0'),
      'favorites',(select count(*)::text from public.oc_favorites where chain_id=(k->>'chainId')::bigint and contract_address=k->>'contractAddress' and campaign_id=(k->>'campaignId')::numeric))),'[]'::jsonb)
      into result from jsonb_array_elements(p->'keys') k;
    return result;
  end if;
  raise exception 'Unknown public action';
end $$;

create function public.oc_execute(p_action text,p_hash text,p_origin text,p jsonb,p_admin jsonb default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare identity jsonb := public.oc_identity(p_hash,p_origin); w text := identity->>'wallet';
  c bigint := (p->>'chainId')::bigint; a text := p->>'contractAddress'; i numeric := (p->>'campaignId')::numeric;
  cid uuid := (p->>'commentId')::uuid; rid uuid := (p->>'id')::uuid;
  parent uuid := (p->>'parentId')::uuid; off integer := coalesce((p->>'offset')::integer,0);
  result jsonb; existing public.oc_comments; report public.oc_reports;
begin
  if off<0 or off>10000 then raise exception 'Invalid page offset'; end if;
  if c is not null and c<>(identity->>'chainId')::bigint then raise exception 'Session chain mismatch' using errcode='28000'; end if;
  perform public.oc_limit('wallet:'||w,60,60);
  if p_action='favorite.state' then
    return jsonb_build_object('saved',exists(select 1 from public.oc_favorites where wallet=w and chain_id=c and contract_address=a and campaign_id=i));
  elsif p_action='favorite.set' then
    if (p->>'saved')::boolean then
      insert into public.oc_favorites(wallet,chain_id,contract_address,campaign_id) values(w,c,a,i) on conflict do nothing;
    else delete from public.oc_favorites where wallet=w and chain_id=c and contract_address=a and campaign_id=i; end if;
    return jsonb_build_object('saved',(p->>'saved')::boolean);
  elsif p_action='saved.list' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
      select chain_id as "chainId",contract_address as "contractAddress",campaign_id::text as "campaignId",created_at as "createdAt"
      from public.oc_favorites where wallet=w order by created_at desc,chain_id,contract_address,campaign_id limit 20 offset off
    ) x; return result;
  elsif p_action='comment.create' then
    select * into existing from public.oc_comments where id=rid;
    if found then
      if existing.wallet=w and existing.chain_id=c and existing.contract_address=a and existing.campaign_id=i and existing.body=p->>'body' and existing.parent_id is not distinct from parent then return jsonb_build_object('id',rid); end if;
      raise exception 'Request ID conflict';
    end if;
    perform public.oc_limit('comments:'||w,10,60);
    perform public.oc_limit('comments-day:'||w,100,86400);
    if parent is not null and not exists(select 1 from public.oc_comments where id=parent and chain_id=c and contract_address=a and campaign_id=i and parent_id is null and not author_hidden and not moderator_hidden) then raise exception 'Reply parent unavailable'; end if;
    insert into public.oc_comments(id,chain_id,contract_address,campaign_id,wallet,parent_id,body) values(rid,c,a,i,w,parent,p->>'body');
    return jsonb_build_object('id',rid);
  elsif p_action='comment.hide' then
    update public.oc_comments set author_hidden=true where id=cid and wallet=w and chain_id=c and contract_address=a and campaign_id=i;
    if not found then raise exception 'Comment ownership denied' using errcode='42501'; end if;
    return jsonb_build_object('ok',true);
  elsif p_action='report.create' then
    if p->>'targetKind'='comment' and not exists(select 1 from public.oc_comments where id=cid and chain_id=c and contract_address=a and campaign_id=i) then raise exception 'Report comment not found'; end if;
    perform public.oc_limit('reports:'||w,10,86400);
    if exists(select 1 from public.oc_reports where wallet=w and chain_id=c and contract_address=a and campaign_id=i and target_kind=p->>'targetKind' and comment_id is not distinct from cid) then raise exception 'Already reported' using errcode='23505'; end if;
    insert into public.oc_reports(id,wallet,chain_id,contract_address,campaign_id,target_kind,comment_id,reason) values(rid,w,c,a,i,p->>'targetKind',cid,p->>'reason');
    return jsonb_build_object('id',rid);
  elsif p_action in ('reports.list','report.moderate','comment.moderate') then
    -- Only the service role can call this RPC. The Edge supplies a fresh on-chain proof separately from user payload.
    if p_admin is null or p_admin->>'wallet' is distinct from w or p_admin->>'contractAddress' is null or p_admin->>'blockNumber' is null then raise exception 'Administrator verification required' using errcode='42501'; end if;
    if p_action='reports.list' then
      select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
        select r.id,r.wallet,r.chain_id as "chainId",r.contract_address as "contractAddress",r.campaign_id::text as "campaignId",r.target_kind as "targetKind",r.comment_id as "commentId",r.reason,r.status,r.created_at as "createdAt",cm.body as "commentBody"
        from public.oc_reports r left join public.oc_comments cm on cm.id=r.comment_id
        where (p->>'status' is null or r.status=p->>'status') order by r.created_at desc,r.id desc limit 20 offset off
      ) x; return result;
    end if;
    if exists(select 1 from public.oc_moderation_log where id=(p->>'requestId')::uuid) then
      if not exists(select 1 from public.oc_moderation_log where id=(p->>'requestId')::uuid and wallet=w and action=p_action and report_id is not distinct from case when p_action='report.moderate' then rid end and comment_id is not distinct from case when p_action='comment.moderate' then cid end) then raise exception 'Moderation request ID conflict'; end if;
      return jsonb_build_object('ok',true);
    end if;
    if p_action='comment.moderate' then
      update public.oc_comments set moderator_hidden=true where id=cid and chain_id=c and contract_address=a and campaign_id=i;
      if not found then raise exception 'Comment not found'; end if;
    else
      if p->>'status' not in ('in_review','resolved','dismissed') then raise exception 'Invalid report status'; end if;
      select * into report from public.oc_reports where id=rid for update;
      if not found then raise exception 'Report not found'; end if;
      update public.oc_reports set status=p->>'status',updated_at=now() where id=rid;
      if coalesce((p->>'hideComment')::boolean,false) then
        if report.target_kind<>'comment' then raise exception 'Only comment reports can hide a comment'; end if;
        update public.oc_comments set moderator_hidden=true where id=report.comment_id;
      end if;
    end if;
    insert into public.oc_moderation_log(id,wallet,report_id,comment_id,action,proof) values((p->>'requestId')::uuid,w,case when p_action='report.moderate' then rid end,case when p_action='comment.moderate' then cid end,p_action,p_admin || jsonb_build_object('status',p->>'status','hideComment',p->'hideComment'));
    return jsonb_build_object('ok',true);
  end if;
  raise exception 'Unknown authenticated action';
end $$;

-- Maintenance is service-role only. Run daily via a trusted scheduler / SQL editor.
create function public.oc_cleanup() returns void language plpgsql security invoker set search_path='' as $$
begin
  delete from public.oc_challenges where created_at<now()-interval '1 day';
  delete from public.oc_sessions where expires_at<now();
  delete from public.oc_visitors where expires_at<now();
  delete from public.oc_rate_limits where expires_at<now();
end $$;

-- Do not revoke permissions on unrelated functions in an existing project.
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'oc\_%' escape '\' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
