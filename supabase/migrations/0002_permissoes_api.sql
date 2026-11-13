-- Projetos novos do Supabase não liberam tabelas para a API automaticamente.
-- Libera só o necessário para usuários logados; quem vê o quê continua decidido pelo RLS.
grant usage on schema public to authenticated;
grant select on public.empresas to authenticated;
grant select, insert, update on public.membros to authenticated;
grant select, insert, update on public.obras to authenticated;
grant select on public.auditoria to authenticated;
notify pgrst, 'reload schema';
