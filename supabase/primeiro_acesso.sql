-- Rode UMA vez, depois de aplicar as migrações e de criar seu usuário em
-- Authentication > Users. Troque o nome da empresa e o e-mail abaixo.
with empresa as (
  insert into public.empresas (nome) values ('NOME DA EMPRESA') returning id
)
insert into public.membros (usuario_id, empresa_id, papel)
select u.id, empresa.id, 'admin'
from auth.users u, empresa
where u.email = 'SEU_EMAIL@exemplo.com';
