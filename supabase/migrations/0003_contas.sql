-- LABTECH · contas sem depender do painel do Supabase.
-- Pode ser executado mais de uma vez sem efeito colateral.

alter table public.membros add column if not exists nome text;
alter table public.membros add column if not exists email text;

-- Cada pessoa pertence a uma única empresa.
create unique index if not exists membros_usuario_unico on public.membros (usuario_id);

-- Quem acabou de criar a conta e ainda não pertence a nenhuma empresa
-- cria a sua e se torna o administrador dela.
create or replace function public.criar_empresa(nome_empresa text, nome_usuario text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid());
  nova uuid;
begin
  if eu is null then
    raise exception 'login necessario' using errcode = 'LT401';
  end if;
  if exists (select 1 from public.membros m where m.usuario_id = eu) then
    raise exception 'usuario ja pertence a uma empresa' using errcode = 'LT409';
  end if;
  if length(trim(coalesce(nome_empresa, ''))) = 0 then
    raise exception 'nome da empresa obrigatorio' using errcode = 'LT400';
  end if;
  insert into public.empresas (nome) values (trim(nome_empresa)) returning id into nova;
  insert into public.membros (usuario_id, empresa_id, papel, nome, email)
  values (eu, nova, 'admin', nullif(trim(coalesce(nome_usuario, '')), ''), (select u.email from auth.users u where u.id = eu));
  return nova;
end;
$$;

revoke execute on function public.criar_empresa(text, text) from public, anon;
grant execute on function public.criar_empresa(text, text) to authenticated;

notify pgrst, 'reload schema';
