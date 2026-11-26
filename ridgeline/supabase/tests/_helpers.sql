-- Test helpers (created inside each test transaction, rolled back afterwards).
create schema tests;
grant usage on schema tests to anon, authenticated;
-- Member id by email prefix, e.g. tests.u('jordan')
create function tests.u(p text) returns uuid language sql stable security definer set search_path = public as
  $$ select user_id from member_private where email::text like p || '%' limit 1 $$;
create function tests.ev(p text) returns uuid language sql stable security definer set search_path = public as
  $$ select id from events where slug = p $$;
create function tests.app(p_user text, p_event text) returns uuid language sql stable security definer set search_path = public as
  $$ select id from applications where user_id = tests.u(p_user) and event_id = tests.ev(p_event) $$;
grant execute on all functions in schema tests to anon, authenticated;

-- Switch to a member's session (role + JWT claims) or back to the superuser.
create procedure tests.login(p text) language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', tests.u(p), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create procedure tests.anon() language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;
create procedure tests.su() language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;
grant execute on procedure tests.login(text), tests.anon(), tests.su() to anon, authenticated;

-- Assert that a statement fails with a message containing p_like.
create function tests.throws(p_sql text, p_like text) returns void language plpgsql as $$
declare v_ok boolean := false;
begin
  begin
    execute p_sql;
    v_ok := true;
  exception when others then
    if sqlerrm not ilike '%' || p_like || '%' then
      raise exception 'Expected error like "%" but got "%" for: %', p_like, sqlerrm, p_sql;
    end if;
  end;
  if v_ok then raise exception 'Expected an error like "%" for: %', p_like, p_sql; end if;
end $$;
create function tests.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'Assertion failed: %', p_msg; end if;
  raise notice 'ok - %', p_msg;
end $$;
grant execute on function tests.throws(text, text), tests.ok(boolean, text) to anon, authenticated;
