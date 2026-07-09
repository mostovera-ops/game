-- ═══ Sunnyside: one-time bootstrap ═══
-- Вставить в Supabase SQL Editor (проект pvautnecztynbnzrrdra) и выполнить.
-- Создаёт RPC-мост для применения миграций через секретный ключ.
-- Доступен ТОЛЬКО роли service_role (secret key); anon/authenticated доступа не имеют.

create or replace function public.claude_exec_sql(sql text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  execute sql;
  return 'ok';
end;
$$;

revoke all on function public.claude_exec_sql(text) from public;
revoke all on function public.claude_exec_sql(text) from anon;
revoke all on function public.claude_exec_sql(text) from authenticated;
grant execute on function public.claude_exec_sql(text) to service_role;

-- перечитать схему PostgREST, чтобы RPC стал виден сразу
notify pgrst, 'reload schema';
