# LABTECH — Arquitetura

Prioridades, nesta ordem: **simples na obra**, **funciona sem internet**, **rastreabilidade do corpo de prova da moldagem ao rompimento**.

## 1. Visão geral

Distribuição: **web app instalável (PWA)** publicado no GitHub Pages. O mesmo código Expo gera Android/iOS nativos se um dia for preciso. Um service worker guarda o app para uso offline e fornece o isolamento de origem que o SQLite no navegador exige.

Contas: o responsável cria a conta e a empresa pelo próprio sistema (`criar_empresa`); funcionários são cadastrados pelo administrador em Ajustes. Ninguém precisa abrir o painel do Supabase no dia a dia.

```
Tela (expo-router) ──> Repositório ──> SQLite local  (fonte da verdade para a interface)
                            │
                            └──> sync_fila + historico   (mesma transação do dado)
                                      │  quando há conexão (BUILD 005)
                                      ▼
                                  Supabase (Postgres + RLS + Storage + Auth)
```

- A interface **só lê e grava no SQLite**. Nenhuma tela espera a rede.
- Toda gravação entra, na mesma transação, na fila de envio e no histórico local.
- O servidor é a autoridade de versão, ordem e permissão. O aparelho é a autoridade do que o funcionário digitou.

## 2. Estrutura de pastas

```
src/
  app/                 rotas (expo-router): cada arquivo é uma tela
    (tabs)/            Painel, Obras, Ajustes
    obra/[id].tsx      formulário de obra ("nova" ou id)
    entrar.tsx         login (só quando há Supabase configurado)
  core/                regras sem interface, testáveis no Node
    db/                contrato Db, migrações, adaptador expo-sqlite
    sync/              fila de envio e histórico
    datas.ts           datas civis e datas de rompimento
    permissoes.ts      matriz função × ação
  features/<módulo>/   repositório de cada módulo (obras, config, …)
  i18n/                pt, es e glossário técnico (offline)
  services/            Supabase, contexto do app, leitura por foco
  ui/                  tema e componentes
supabase/migrations/   esquema, gatilhos e políticas do servidor
tests/                 testes do núcleo (SQLite real), do Supabase (Postgres real) e de tela (navegador)
```

Regra: `core/` e `features/` não importam React nem Expo. É isso que permite testar o SQL de verdade fora do celular.

## 3. Banco de dados

### Molde de toda tabela sincronizável

| Coluna | Para quê |
|---|---|
| `id` (UUID gerado no aparelho) | criar offline sem colisão |
| `empresa_id` | isolamento por empresa (RLS) |
| `criado_em/por`, `atualizado_em/por` | autoria |
| `excluido_em` | exclusão lógica: nada é apagado |
| `versao` | versão confirmada pelo servidor; base da detecção de conflito |
| `servidor_seq`, `servidor_em` (só no servidor) | ordem global das alterações |

### Tabelas por etapa

| Etapa | Tabelas |
|---|---|
| 001 (feito) | `config_local`, `obras`, `sync_fila`, `sync_cursor`, `historico` · servidor: `empresas`, `membros`, `obras`, `auditoria` |
| 002 | `clientes`, `funcionarios`, `usinas`, `concretagens`, `caminhoes`, `corpos_de_prova`, `fotos` |
| 003 | `tanques`, `tanque_regras`, `tanque_movimentos` (entrada/saída), `tanque_manutencoes`, `tanque_parametros`, `tanque_leituras` |
| 004 | `idades_padrao`, `rompimentos_previstos`, `ensaios`, `ensaio_resultados` |
| 006 | `ia_conversas`, `ia_mensagens` |

Decisões que já valem para as próximas etapas:

- **Corpo de prova**: código único legível (obra + sequência) além do UUID; `caminhao_id` liga vários CPs ao mesmo caminhão; localização atual é derivada do último `tanque_movimento`.
- **Eventos só recebem inserção** (movimentos de tanque, resultados de ensaio, histórico). Correção é um novo registro que referencia o anterior. Isso elimina conflito nesses dados e preserva a rastreabilidade.
- **Datas de ensaio são datas civis** (`AAAA-MM-DD`, texto), calculadas uma vez na moldagem e gravadas em `rompimentos_previstos`. Não são recalculadas se o aparelho mudar de fuso. O horário da moldagem é guardado à parte, com o deslocamento de fuso do momento.
- **Resultado individual ≠ resistência característica**: `ensaio_resultados` guarda carga, área e MPa de cada CP; estatística do lote é calculada à parte e nunca gravada como "fck".
- **Regra dos tanques** (dias 01–10, 11–20, 21–31) fica em `tanque_regras`, editável pelo administrador.

## 4. Sincronização offline — riscos e respostas

| Risco | Resposta |
|---|---|
| Dado gravado e não enfileirado (ou o contrário) | dado + fila + histórico na mesma transação exclusiva (testado: falha no meio desfaz tudo) |
| Dois aparelhos alteram o mesmo registro | o cliente envia a `versao` base; o servidor recusa se já mudou (`LT409`); o item vira `conflito` na fila e uma pessoa decide. Nunca "último a gravar vence" em silêncio |
| Relógio do aparelho errado | ordem e recebimento usam `servidor_seq`; o relógio local só serve para exibição |
| Envio repetido após queda de rede | UUID do cliente + upsert: reenviar é inofensivo |
| Perda de registro local | item só sai da fila após confirmação do servidor; nada é apagado localmente antes disso |
| Fotos grandes em rede ruim | arquivo fica no aparelho; fila própria de upload, com retomada; o registro referencia a foto pelo UUID |
| Ordem entre tabelas (CP antes do caminhão) | fila única ordenada por `seq`; envio respeita a ordem de criação |
| Troca de usuário no mesmo aparelho | fila carrega o autor de cada item; RLS valida no servidor |
| Dados criados em modo local antes de haver conta | ficam com `empresa_id` nulo e recebem a empresa no primeiro envio (definir na etapa 005) |
| Mudança de esquema com fila pendente | migrações locais numeradas e só aditivas; banco mais novo que o app é recusado com aviso |

## 5. Segurança

- **RLS em todas as tabelas**: acesso só por vínculo ativo em `membros`. Sem vínculo, nada é visível.
- **Função no servidor**: políticas usam `tem_papel(empresa, …)`. A matriz do app (`permissoes.ts`) só decide o que mostrar.
- **Sem exclusão física** pelo app: não há política de `DELETE`.
- **Auditoria** gravada por gatilho, legível só por administradores, sem política de escrita.
- **Sessão** no cofre do sistema (Keychain/Keystore). A chave `anon` é pública por natureza; a `service_role` nunca entra no app.
- **Fotos**: bucket privado, caminho `empresa_id/…`, política por empresa (etapa 002).
- **IA** (etapa 006): acessa apenas consultas já filtradas pelo RLS do usuário; só leitura. Qualquer gravação sugerida passa por confirmação na tela.

## 6. Etapas

| Build | Entrega | Critério para avançar |
|---|---|---|
| 001 Fundação ✅ | Expo + TypeScript, navegação, identidade, SQLite com migrações, fila/histórico, pt/es, permissões, esquema Supabase, cadastro de obras | testes do núcleo, do Supabase e de tela passando |
| 002 Cadastros | clientes, funcionários, caminhões, CPs, fotos, QR Code | CP rastreável do caminhão à foto, offline |
| 003 Tanques | entrada/saída em lote, manutenção, parâmetros | localização atual correta após qualquer sequência de movimentos |
| 004 Ensaios | calendário, rompimentos, calculadora | cálculo conferido contra exemplos das normas vigentes |
| 005 Sincronização | envio/recebimento, conflitos, fotos | dois aparelhos, rede cortada no meio, sem perda |
| 006 LAB IA | tradução, voz, consultas | IA sem nenhum caminho de escrita |
| 007 Relatórios | PDF, Excel, indicadores | relatório confere com o banco |

## 7. Como verificar

```
npm run typecheck       # tipos
npx expo lint           # lint
npm test                # núcleo, com SQLite de verdade
npm run test:supabase   # migrações + RLS num Postgres temporário
npm run test:web        # app no navegador: criar obra, persistir, trocar idioma
```
