# LABTECH

Controle tecnológico de concreto: corpos de prova, tanques de cura, rompimentos e relatórios. Android e iOS, offline-first.

Estado atual: **BUILD 001 — Fundação**. Veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Rodar

```
npm install
npx expo start          # abra no Expo Go ou em um development build
```

Sem configuração o app roda em **modo local** (dados só no aparelho). Para conectar a conta da empresa, copie `.env.example` para `.env`, preencha a URL e a chave `anon` do projeto Supabase e aplique `supabase/migrations/`.

## Verificar

```
npm run typecheck && npx expo lint && npm test && npm run test:supabase && npm run test:web
```
