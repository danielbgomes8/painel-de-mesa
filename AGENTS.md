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
- **A mesa joga D&D 2024 (SRD 5.2). Não confie na sua memória de monstro.**
  O catálogo já esteve inteiro com números de 2014 — e 27 dos 41 estavam
  errados. O que mais engana: em 2024 a **iniciativa do monstro é um bônus
  próprio**, não o modificador de Destreza (o Gigante do fogo tem Destreza 9 e
  iniciativa +3; o Lich tem +17). PV mudaram muito (Wight 45 → 82, Lich 135 →
  315), goblinoides viraram fadas, o kobold virou dragão, e Orc, Observador e
  Fera Deslocadora **não existem** no SRD 2024. Fonte estruturada e conferível:
  `https://api.open5e.com/v2/creatures/?document__key=srd-2024` (331 criaturas,
  com bônus de acerto e dados de dano por ataque). Conferir contra ela antes de
  acrescentar ou editar qualquer monstro — `monstrosSrd.test.ts` tem uma guarda
  de edição com três valores que mudaram entre 2014 e 2024.
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

## Estado (15/09/2026) — já está tudo publicado e funcionando

- **No ar**: https://painel-de-mesa.vercel.app — testado de ponta a ponta
  (leitura e escrita reais), sala `setimo-raio` com o Tibério Vaz.
- **Ficha completa** (`ficha_secoes`/`ficha_epiteto`, migration `0012`,
  componente `FichaCompleta.tsx`): seções genéricas (texto ou lista de
  título+tag+descrição) dentro da mesma linha do personagem — história,
  características, magias, itens mágicos, trejeitos... Sem regra de D&D
  embutida, igual `Recurso`/`ItemEquip`. Fica atrás de "+ ver ficha completa"
  na aba Fichas, só pra jogador.
- **Ficha de classe calculada** (`nivel`/`atributos`/`proficiencias`/
  `conjurador`/`atributo_conjuracao`/`classe_base`/`modificadores`, migration
  `0013`, componente `FichaClasse.tsx`, no mesmo toggle "+ ver ficha
  completa"): calcula resistência/perícia/CD de magia/percepção passiva a
  partir de atributo + nível + proficiência (fórmulas em `regras.ts`,
  conferidas contra `api.open5e.com/v2/classes` — mesma disciplina do
  catálogo de monstros). **Não sobrescreve os campos manuais sozinha** — só
  mostra "calculado: X" com um botão "usar"; quem decide se aceita é o
  jogador, porque item mágico e feito somam por cima da fórmula. "Gerar
  espaços de magia" preenche `resources` com pips clicáveis (reaproveita
  `TrilhaDeUsos`), igual Fúria/Ki. `Modificadores` é a peça pra bônus que
  liga/desliga (ex.: Feitiçaria Inata do Feiticeiro, CD +1 por 1 minuto) —
  cadastro livre, sem regra de classe embutida. O catálogo de habilidades por
  nível (`classesSrd.ts`, `habilidadesAte()`) só cobre a classe **base**, sem
  subclasse, e tem Feiticeiro, Bárbaro, Guerreiro e Monge populados até agora
  — as outras 8 entram conforme alguém da mesa jogar (mesmo padrão de
  crescimento do catálogo de monstros). **Pegadinha já achada aqui**: a
  `open5e` erra o nível de algumas habilidades (viu isso no Monge — "Deflect
  Attacks" veio sem nível, "Stunning Strike" veio em dois níveis diferentes);
  quando o nível não fechar sozinho, cruzar com uma segunda fonte
  (aidedd.org, Roll20 Compendium) antes de confiar.
- **Passar a vez** (`avancarTurno` exportada de `RastreadorCombate.tsx`,
  reaproveitada no `BannerSuaVez`): o jogador vê um botão no banner "É a sua
  vez!" pra avançar o turno sozinho, sem depender do Mestre. Só aparece
  quando é a vez do próprio personagem — o Mestre continua sendo o único que
  passa a vez de qualquer um.
- **Vantagens & resistências** (`vantagens_resistencias`, migration `0011`):
  campo próprio na ficha, separado das Notas rápidas, só pra personagem de
  jogador. Antes isso ficava misturado em texto livre.
- **Catálogo de monstros**: 56 criaturas, todas conferidas contra o SRD 2024
  (ver a regra de edição acima), com CA, PV, iniciativa e linha de ataque
  (acerto + dano). A busca ignora acento de propósito — no teclado do celular
  se digita "manticora", não "Mantícora" — e casa também contra o tipo, então
  "morto-vivo" devolve todos os mortos-vivos. Por isso o campo `cls` tem que
  seguir o padrão "Monstruosidade média", "Morto-vivo médio": inventar outro
  formato tira o bicho da busca por tipo.
- **Ataque do NPC** (`ataque`, migration `0008`): texto livre com acerto e
  dano, vindo do catálogo, editável na biblioteca e na ficha, e carregado
  junto quando o modelo entra no combate. Fica num campo que quebra linha, não
  num input de uma linha — a linha do dragão tem 90 caracteres e sumia pela
  direita no celular.
- **GitHub**: [danielbgomes8/painel-de-mesa](https://github.com/danielbgomes8/painel-de-mesa)
  (privado), conectado ao Vercel — push na `main` já republica sozinho.
- **Supabase**: projeto próprio na org "Daniel Lima projetos" (região São
  Paulo), separado do gb-reserva. Migrations `0001` a `0013` e o `seed.sql`
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
