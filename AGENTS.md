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
  componente — importar de lá. O mesmo vale pro catálogo de monstros:
  `buscarMonstros()` mora em `src/lib/monstrosSrd.ts`, testada em
  `monstrosSrd.test.ts`.
- **Isto é usado no celular, no meio do combate.** Antes de acrescentar
  qualquer lista na tela, meça a altura dela a 375px de largura. O catálogo
  de monstros já ensinou a lição: 41 pílulas lado a lado davam 959px de
  rolagem (mais de uma tela inteira), com alvos de toque de 27px. Virou
  busca-primeiro — some por padrão, aparece ao digitar, cada resultado é uma
  linha de ~100px de altura. **Não "melhore" isso voltando a despejar a
  lista completa**; quem quer folhear usa o botão "ver todos".
- **Alvo de toque e retorno visual**: elemento em que se toca precisa de
  `touch-action: manipulation` (sem isso o navegador segura ~300ms esperando
  duplo-toque, e o Mestre toca de novo achando que falhou, duplicando o
  registro), foco visível (`:focus-visible`) e, quando a ação é assíncrona,
  uma confirmação com `aria-live="polite"`.
- **Escrita que pode falhar não se confirma antes da hora.** As mutações do
  `useSala` engolem o erro no `console.error`; `criarModeloNpc` devolve
  `boolean` justamente pra tela só dizer "copiado" depois do banco
  confirmar. Ao criar mutação nova que tenha retorno na tela, siga isso —
  senão o painel mente quando o Supabase está pausado ou a internet cai.
- **Dados**: Supabase (Postgres + Realtime). Esquema em `supabase/migrations/`.
  O app fala com o banco só pelo cliente do navegador (`src/lib/supabase.ts`);
  não há rota de servidor nem segredo de servidor.
- **RLS é policy aberta de propósito** — ver README, seção "Segurança". Não
  "consertar" achando que é falha.
- **Pra testar, use uma sala separada**: abra `?sala=teste-ui` (ou outro
  código) em vez de mexer na `setimo-raio`, que tem os dados reais da mesa.
  A sala nasce sozinha no primeiro acesso. Pra apagar depois, basta remover
  a linha dela em `rooms` — as nove tabelas filhas têm `on delete cascade`,
  então some tudo junto e nada encosta na campanha.
- O visual saiu do protótipo (Artifact) validado com a mesa: paleta e classes
  CSS estão em `src/app/globals.css`, praticamente iguais às do protótipo.

## Estado (11/09/2026) — já está tudo publicado e funcionando

- **No ar**: https://painel-de-mesa.vercel.app — testado de ponta a ponta
  (leitura e escrita reais), sala `setimo-raio` com o Tibério Vaz.
- **Última mudança publicada**: catálogo do SRD passou de 16 pra 41 monstros
  e ganhou busca (commit `db5b588`). A busca ignora acento de propósito —
  no teclado do celular se digita "manticora", não "Mantícora" — e casa
  também contra o tipo, então "morto-vivo" devolve todos os mortos-vivos.
  Por isso o campo `cls` de cada monstro tem que seguir o padrão
  "Monstruosidade média", "Morto-vivo médio": inventar outro formato tira o
  bicho da busca por tipo.
- **GitHub**: [danielbgomes8/painel-de-mesa](https://github.com/danielbgomes8/painel-de-mesa)
  (privado), conectado ao Vercel — push na `main` já republica sozinho.
- **Supabase**: projeto próprio na org "Daniel Lima projetos" (região São
  Paulo), separado do gb-reserva. Migrations `0001` a `0007` e o `seed.sql`
  já rodadas — o banco tem as dez tabelas (`rooms` mais nove filhas, todas
  com `on delete cascade` ligado em `rooms`). **Pegadinha real já resolvida
  uma vez**: se criar tabela nova
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
