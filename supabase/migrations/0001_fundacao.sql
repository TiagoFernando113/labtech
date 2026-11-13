-- LABTECH · BUILD 001 · Fundação
-- Empresas, vínculo usuário-empresa-função, obras, carimbo de sincronização e auditoria.
-- Toda tabela de negócio segue o mesmo molde da tabela `obras`.

create type public.papel as enum ('admin', 'laboratorista', 'ajudante');

-- Sequência única do servidor: é ela (e não o relógio de nenhum aparelho) que ordena as alterações.
create sequence public.sync_seq as bigint;
grant usage on sequence public.sync_seq to authenticated;

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  criado_em timestamptz not null default now()
);

create table public.membros (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  papel public.papel not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  primary key (usuario_id, empresa_id)
);
create index membros_empresa on public.membros (empresa_id);

create table public.obras (
  id uuid primary key,
  empresa_id uuid not null references public.empresas (id),
  nome text not null check (length(trim(nome)) > 0),
  codigo text,
  endereco text,
  ativa boolean not null default true,
  criado_em timestamptz not null,
  atualizado_em timestamptz not null,
  criado_por uuid references auth.users (id),
  atualizado_por uuid references auth.users (id),
  excluido_em timestamptz,
  versao integer not null default 0,
  servidor_seq bigint not null default 0,
  servidor_em timestamptz not null default now()
);
create index obras_sync on public.obras (empresa_id, servidor_seq);
create unique index obras_nome_unico on public.obras (empresa_id, lower(nome)) where excluido_em is null;

-- Trilha de auditoria: só inserção, feita por gatilho; ninguém altera nem apaga pelo app.
create table public.auditoria (
  id bigint generated always as identity primary key,
  empresa_id uuid not null,
  tabela text not null,
  registro_id uuid not null,
  acao text not null check (acao in ('criar', 'alterar', 'excluir')),
  antes jsonb,
  depois jsonb,
  usuario_id uuid,
  servidor_em timestamptz not null default now()
);
create index auditoria_registro on public.auditoria (tabela, registro_id, id);

-- ── Funções de acesso ────────────────────────────────────────────────────────
-- security definer + search_path fixo: consultam `membros` sem recursão de RLS.

create function public.eh_membro(e uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membros m
    where m.usuario_id = (select auth.uid()) and m.empresa_id = e and m.ativo
  );
$$;

create function public.tem_papel(e uuid, variadic papeis public.papel[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membros m
    where m.usuario_id = (select auth.uid()) and m.empresa_id = e and m.ativo and m.papel = any (papeis)
  );
$$;

revoke execute on function public.eh_membro(uuid) from public, anon;
revoke execute on function public.tem_papel(uuid, public.papel[]) from public, anon;
grant execute on function public.eh_membro(uuid) to authenticated;
grant execute on function public.tem_papel(uuid, public.papel[]) to authenticated;

-- ── Carimbo de sincronização e detecção de conflito ──────────────────────────
-- O cliente envia em `versao` a versão sobre a qual trabalhou.
-- Se alguém gravou antes, a versão do servidor já é outra e a gravação é recusada
-- (erro LT409): o app guarda a alteração como conflito para uma pessoa decidir.

create function public.sync_carimbar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.versao is distinct from old.versao then
      raise exception 'conflito de versao em %.% (servidor %, cliente %)', tg_table_name, old.id, old.versao, new.versao
        using errcode = 'LT409';
    end if;
    if new.empresa_id is distinct from old.empresa_id then
      raise exception 'empresa_id nao pode ser alterado' using errcode = 'LT403';
    end if;
    new.versao := old.versao + 1;
    new.criado_em := old.criado_em;
    new.criado_por := old.criado_por;
  else
    new.versao := 1;
    new.criado_por := (select auth.uid());
  end if;
  new.atualizado_por := (select auth.uid());
  new.servidor_seq := nextval('public.sync_seq');
  new.servidor_em := now();
  return new;
end;
$$;

create function public.auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.auditoria (empresa_id, tabela, registro_id, acao, antes, depois, usuario_id)
  values (
    new.empresa_id,
    tg_table_name,
    new.id,
    case
      when tg_op = 'INSERT' then 'criar'
      when new.excluido_em is not null and old.excluido_em is null then 'excluir'
      else 'alterar'
    end,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new),
    (select auth.uid())
  );
  return null;
end;
$$;

create trigger obras_carimbar before insert or update on public.obras
  for each row execute function public.sync_carimbar();
create trigger obras_auditar after insert or update on public.obras
  for each row execute function public.auditar();

-- ── Políticas de acesso (RLS): cada empresa só enxerga o que é dela ──────────

alter table public.empresas enable row level security;
alter table public.membros enable row level security;
alter table public.obras enable row level security;
alter table public.auditoria enable row level security;

create policy empresas_ver on public.empresas for select to authenticated
  using (public.eh_membro(id));

create policy membros_ver on public.membros for select to authenticated
  using (usuario_id = (select auth.uid()) or public.tem_papel(empresa_id, 'admin'));
create policy membros_admin_inserir on public.membros for insert to authenticated
  with check (public.tem_papel(empresa_id, 'admin'));
create policy membros_admin_alterar on public.membros for update to authenticated
  using (public.tem_papel(empresa_id, 'admin')) with check (public.tem_papel(empresa_id, 'admin'));

create policy obras_ver on public.obras for select to authenticated
  using (public.eh_membro(empresa_id));
create policy obras_admin_inserir on public.obras for insert to authenticated
  with check (public.tem_papel(empresa_id, 'admin'));
create policy obras_admin_alterar on public.obras for update to authenticated
  using (public.tem_papel(empresa_id, 'admin')) with check (public.tem_papel(empresa_id, 'admin'));
-- Sem política de DELETE: exclusão é sempre lógica (excluido_em).

create policy auditoria_admin_ver on public.auditoria for select to authenticated
  using (public.tem_papel(empresa_id, 'admin'));
-- Sem políticas de escrita em `auditoria`: só o gatilho grava.

revoke all on public.empresas, public.membros, public.obras, public.auditoria from anon;
