<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Painel de Mesa — notas pro próximo agente

- **Português em tudo**: nomes de arquivo, variáveis, comentários, textos de tela.
  Quem conduz o projeto não é dev — explicar sem jargão.
- **Sem login.** Identidade é `localStorage` (`src/lib/identidade.ts`) + código de
  sala na URL (`?sala=...`, padrão `setimo-raio` em `src/lib/sala.ts`).
- **Regras de negócio fechadas** ficam em `src/lib/regras.ts`, cada uma pura e
  testada em `src/lib/regras.test.ts` (`npm run teste`). Não reimplementar em
  componente — importar de lá.
- **Dados**: Supabase (Postgres + Realtime). Esquema em `supabase/migrations/`.
  O app fala com o banco só pelo cliente do navegador (`src/lib/supabase.ts`);
  não há rota de servidor nem segredo de servidor.
- **RLS é policy aberta de propósito** — ver README, seção "Segurança". Não
  "consertar" achando que é falha.
- O visual saiu do protótipo (Artifact) validado com a mesa: paleta e classes
  CSS estão em `src/app/globals.css`, praticamente iguais às do protótipo.

## Estado (11/09/2026) — já está tudo publicado e funcionando

- **No ar**: https://painel-de-mesa.vercel.app — testado de ponta a ponta
  (leitura e escrita reais), sala `setimo-raio` com o Tibério Vaz.
- **GitHub**: [danielbgomes8/painel-de-mesa](https://github.com/danielbgomes8/painel-de-mesa)
  (privado), conectado ao Vercel — push na `main` já republica sozinho.
- **Supabase**: projeto próprio na org "Daniel Lima projetos" (região São
  Paulo), separado do gb-reserva. Migrations `0001_inicial.sql` e `seed.sql`
  já rodadas. **Pegadinha real já resolvida uma vez**: se criar tabela nova
  sem "Automatically expose new tables", ela não pega GRANT pro `anon`
  automaticamente — RLS sozinho não basta, tem que dar `grant select,
  insert, update, delete ... to anon, authenticated` explícito (ver fim de
  `0001_inicial.sql`). Sem isso dá "permission denied" mesmo com policy certa.
- **Chaves**: `.env.local` (na máquina do Daniel, fora do Git) e as env vars
  do Vercel (Production/Preview/Development) já configuradas com a URL e a
  chave `sb_publishable_...` do projeto Supabase acima. `.vercel/` também já
  linkado localmente.
- **Não commitado / local só desta máquina**: `.env.local`, `.vercel/` —
  ambos re-obteníveis (`vercel env pull`, ou o painel do Supabase) se
  precisar reconfigurar em outra máquina.
