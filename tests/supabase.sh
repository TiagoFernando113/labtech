#!/usr/bin/env bash
# Sobe um Postgres temporário, aplica as migrações do Supabase e verifica
# isolamento entre empresas, funções, conflito de versão e auditoria.
# Uso: bash tests/supabase.sh   (precisa de PostgreSQL instalado; roda como usuário postgres se for root)
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
DIR="$(mktemp -d)"
PORTA=54399
COMO=()
if [ "$(id -u)" = 0 ]; then chown postgres "$DIR"; COMO=(runuser -u postgres --); fi
"${COMO[@]}" "$BIN/initdb" -D "$DIR/pg" -U postgres >/dev/null
"${COMO[@]}" "$BIN/pg_ctl" -D "$DIR/pg" -o "-p $PORTA -c listen_addresses='' -k $DIR" -l "$DIR/log" -w start >/dev/null
trap '"${COMO[@]}" "$BIN/pg_ctl" -D "$DIR/pg" -m immediate stop >/dev/null; rm -rf "$DIR"' EXIT
SQL=("${COMO[@]}" "$BIN/psql" -h "$DIR" -p "$PORTA" -U postgres -v ON_ERROR_STOP=1 -q)

# O mínimo do ambiente Supabase de que as migrações dependem.
"${SQL[@]}" <<'EOF'
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;
EOF
for f in "$RAIZ"/supabase/migrations/*.sql; do "${SQL[@]}" < "$f"; done

"${SQL[@]}" <<'EOF'
\set VERBOSITY terse
insert into auth.users values ('a0000000-0000-0000-0000-000000000001'), ('a0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000003'), ('b0000000-0000-0000-0000-000000000001');
insert into empresas (id, nome) values ('e0000000-0000-0000-0000-00000000000a', 'Lab A'), ('e0000000-0000-0000-0000-00000000000b', 'Lab B');
insert into membros (usuario_id, empresa_id, papel) values
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000a', 'admin'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-00000000000a', 'laboratorista'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-00000000000a', 'ajudante'),
  ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000b', 'admin');

create schema t; grant usage on schema t to authenticated, anon;
create function t.espera_erro(comando text, codigo text, nome text) returns void language plpgsql as $$
begin
  execute comando;
  raise exception 'FALHOU: % (era para ser recusado)', nome;
exception when others then
  if sqlstate <> codigo then raise exception 'FALHOU: % (esperado %, veio % — %)', nome, codigo, sqlstate, sqlerrm; end if;
  raise notice 'ok: %', nome;
end $$;
create function t.confere(condicao boolean, nome text) returns void language plpgsql as $$
begin
  if condicao is not true then raise exception 'FALHOU: %', nome; end if;
  raise notice 'ok: %', nome;
end $$;

-- Admin da empresa A cria uma obra.
set role authenticated; set request.jwt.sub = 'a0000000-0000-0000-0000-000000000001';
insert into obras (id, empresa_id, nome, criado_em, atualizado_em, versao)
  values ('00000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-00000000000a', 'Oceana', now(), now(), 0);
select t.confere((select versao = 1 and servidor_seq > 0 and criado_por = 'a0000000-0000-0000-0000-000000000001' from obras), 'servidor carimba versao, sequencia e autor');
select t.espera_erro($$insert into obras (id, empresa_id, nome, criado_em, atualizado_em) values (gen_random_uuid(), 'e0000000-0000-0000-0000-00000000000b', 'Invasao', now(), now())$$, '42501', 'admin de A nao cria obra na empresa B');
select t.espera_erro($$insert into obras (id, empresa_id, nome, criado_em, atualizado_em) values (gen_random_uuid(), 'e0000000-0000-0000-0000-00000000000a', 'OCEANA', now(), now())$$, '23505', 'nome de obra duplicado na mesma empresa');

-- Alteração com a versão certa passa; com versão velha é conflito.
update obras set nome = 'Oceana Torre B', versao = 1 where id = '00000000-0000-0000-0000-0000000000a1';
select t.confere((select versao = 2 from obras), 'alteracao com versao base correta sobe para versao 2');
select t.espera_erro($$update obras set nome = 'Atrasado', versao = 1 where id = '00000000-0000-0000-0000-0000000000a1'$$, 'LT409', 'alteracao sobre versao antiga e recusada como conflito');
select t.espera_erro($$update obras set empresa_id = 'e0000000-0000-0000-0000-00000000000b' where id = '00000000-0000-0000-0000-0000000000a1'$$, 'LT403', 'obra nao muda de empresa');
select t.espera_erro($$delete from obras$$, '42501', 'exclusao fisica e proibida');
select t.confere((select count(*) = 2 and bool_and(usuario_id is not null) from auditoria), 'auditoria registrou criar e alterar com autor');
select t.espera_erro($$insert into auditoria (empresa_id, tabela, registro_id, acao) values ('e0000000-0000-0000-0000-00000000000a', 'obras', gen_random_uuid(), 'criar')$$, '42501', 'ninguem escreve direto na auditoria');

-- Laboratorista e ajudante da A enxergam, mas não gerenciam obras.
set request.jwt.sub = 'a0000000-0000-0000-0000-000000000002';
select t.confere((select count(*) = 1 from obras), 'laboratorista ve as obras da empresa');
select t.espera_erro($$insert into obras (id, empresa_id, nome, criado_em, atualizado_em) values (gen_random_uuid(), 'e0000000-0000-0000-0000-00000000000a', 'Nova', now(), now())$$, '42501', 'laboratorista nao cria obra');
update obras set nome = 'X', versao = 2;
select t.confere((select nome = 'Oceana Torre B' from obras), 'laboratorista nao altera obra');
select t.confere((select count(*) = 0 from auditoria), 'laboratorista nao le a auditoria');
select t.confere((select count(*) = 1 from membros), 'laboratorista so ve o proprio vinculo');
set request.jwt.sub = 'a0000000-0000-0000-0000-000000000003';
select t.espera_erro($$insert into membros (usuario_id, empresa_id, papel) values ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-00000000000b', 'admin')$$, '42501', 'ajudante nao se promove nem entra em outra empresa');

-- Admin da empresa B não enxerga nada da A.
set request.jwt.sub = 'b0000000-0000-0000-0000-000000000001';
select t.confere((select count(*) = 0 from obras), 'empresa B nao ve obras da A');
select t.confere((select count(*) = 1 from empresas), 'empresa B so ve a propria empresa');
select t.confere((select count(*) = 1 from membros), 'admin de B nao ve membros da A');
update obras set nome = 'Invadida', versao = 2;
select t.confere((select count(*) = 0 from auditoria), 'empresa B nao le auditoria da A');

-- Sem login não há acesso.
set role anon; set request.jwt.sub = '';
select t.espera_erro($$select * from obras$$, '42501', 'anonimo nao le obras');
reset role;
select t.confere((select nome = 'Oceana Torre B' and versao = 2 from obras), 'dados intactos apos todas as tentativas');
EOF
echo "SUPABASE: todas as verificações passaram"
