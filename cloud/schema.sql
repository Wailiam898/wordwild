-- Wordwild cloud saves + anonymous play counter.
-- Lives in the Whisker Academy Supabase project (qevfbqsutnhgpvnyfopb) next to
-- the wa_* tables, with its own ww_* tables. Safe to run more than once.
--
-- Sign-in is a player name plus a 4-digit secret code, like Whisker Academy.
-- The game sends a hash of name+code; unlike Whisker, the check happens HERE,
-- so a save can't be read or overwritten by someone who only knows the name.
-- The tables are locked: the public key can only call the ww_* functions below.

create table if not exists public.ww_saves (
  name_key     text primary key check (char_length(name_key) between 2 and 32),
  pin_hash     text not null,
  data         jsonb not null,
  saved_at     bigint not null default 0,
  fails        int not null default 0,
  locked_until timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.ww_saves enable row level security;
revoke all on public.ww_saves from anon, authenticated;

create or replace function public.ww_key(p_name text)
returns text language sql immutable as $$
  select lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'))
$$;

-- Does this player name already have a save? (No data returned.)
create or replace function public.ww_exists(p_name text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.ww_saves where name_key = public.ww_key(p_name))
$$;

-- Shared code check: 5 wrong codes lock the name for 30 seconds.
create or replace function public.ww_auth(k text, p_pin text)
returns text language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select pin_hash, fails, locked_until into r from public.ww_saves where name_key = k for update;
  if not found then return 'none'; end if;
  if r.locked_until is not null and r.locked_until > now() then return 'locked'; end if;
  if r.pin_hash = p_pin then
    update public.ww_saves set fails = 0, locked_until = null where name_key = k;
    return 'ok';
  end if;
  update public.ww_saves
     set fails = case when r.fails + 1 >= 5 then 0 else r.fails + 1 end,
         locked_until = case when r.fails + 1 >= 5 then now() + interval '30 seconds' else null end
   where name_key = k;
  return 'bad';
end $$;

-- Load: {status:'ok', data, saved_at} | {status:'bad'|'locked'|'none'}
create or replace function public.ww_load(p_name text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k text := public.ww_key(p_name); st text; r record;
begin
  st := public.ww_auth(k, p_pin);
  if st <> 'ok' then return jsonb_build_object('status', st); end if;
  select data, saved_at into r from public.ww_saves where name_key = k;
  return jsonb_build_object('status', 'ok', 'data', r.data, 'saved_at', r.saved_at);
end $$;

-- Save. Creates the player on first save (that save sets the code).
-- p_base = the cloud saved_at this device last synced with; if another device
-- has saved since, the write is refused so the game can merge first.
create or replace function public.ww_save(p_name text, p_pin text, p_data jsonb, p_saved_at bigint, p_base bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k text := public.ww_key(p_name); st text; cur bigint;
begin
  if char_length(k) < 2 or char_length(k) > 32 then raise exception 'bad name'; end if;
  if p_pin is null or char_length(p_pin) < 4 or char_length(p_pin) > 64 then raise exception 'bad code'; end if;
  if pg_column_size(p_data) > 2000000 then raise exception 'save too large'; end if;
  st := public.ww_auth(k, p_pin);
  if st = 'none' then
    insert into public.ww_saves (name_key, pin_hash, data, saved_at) values (k, p_pin, p_data, p_saved_at)
    on conflict (name_key) do nothing;
    if not found then return jsonb_build_object('ok', false, 'status', 'taken'); end if;
    return jsonb_build_object('ok', true, 'saved_at', p_saved_at);
  end if;
  if st <> 'ok' then return jsonb_build_object('ok', false, 'status', st); end if;
  select saved_at into cur from public.ww_saves where name_key = k for update;
  if cur > coalesce(p_base, 0) then
    return jsonb_build_object('ok', false, 'status', 'conflict', 'saved_at', cur);
  end if;
  update public.ww_saves set data = p_data, saved_at = p_saved_at, updated_at = now() where name_key = k;
  return jsonb_build_object('ok', true, 'saved_at', p_saved_at);
end $$;

-- Change the secret code (needs the current one).
create or replace function public.ww_set_pin(p_name text, p_pin text, p_new text)
returns boolean language plpgsql security definer set search_path = public as $$
declare k text := public.ww_key(p_name);
begin
  if p_new is null or char_length(p_new) < 4 or char_length(p_new) > 64 then return false; end if;
  if public.ww_auth(k, p_pin) <> 'ok' then return false; end if;
  update public.ww_saves set pin_hash = p_new where name_key = k;
  return true;
end $$;

-- Anonymous play counter (same rules as wa_hits: random device id, no names).
create table if not exists public.ww_hits (
  id         bigint generated always as identity primary key,
  visitor    text not null,
  new_device boolean not null default false,
  ref_host   text,
  mode       text,
  width      int,
  at         timestamptz not null default now()
);
alter table public.ww_hits enable row level security;
revoke all on public.ww_hits from anon, authenticated;
create index if not exists ww_hits_at_idx on public.ww_hits (at desc);
create index if not exists ww_hits_visitor_idx on public.ww_hits (visitor, at desc);

create or replace function public.ww_hit(p_visitor text, p_new boolean default false,
  p_ref text default null, p_mode text default null, p_w int default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_visitor is null or char_length(p_visitor) not between 6 and 64 then return; end if;
  if exists (select 1 from public.ww_hits h where h.visitor = p_visitor and h.at > now() - interval '30 minutes') then
    return;
  end if;
  insert into public.ww_hits (visitor, new_device, ref_host, mode, width)
  values (p_visitor, coalesce(p_new, false), nullif(left(coalesce(p_ref, ''), 64), ''),
          nullif(left(coalesce(p_mode, ''), 16), ''), case when p_w between 100 and 10000 then p_w end);
end $$;

-- Only the RPC entry points are public. ww_auth stays internal.
revoke all on function public.ww_auth(text, text) from public, anon, authenticated;
revoke all on function public.ww_exists(text) from public;
revoke all on function public.ww_load(text, text) from public;
revoke all on function public.ww_save(text, text, jsonb, bigint, bigint) from public;
revoke all on function public.ww_set_pin(text, text, text) from public;
revoke all on function public.ww_hit(text, boolean, text, text, int) from public;
grant execute on function public.ww_exists(text) to anon;
grant execute on function public.ww_load(text, text) to anon;
grant execute on function public.ww_save(text, text, jsonb, bigint, bigint) to anon;
grant execute on function public.ww_set_pin(text, text, text) to anon;
grant execute on function public.ww_hit(text, boolean, text, text, int) to anon;
