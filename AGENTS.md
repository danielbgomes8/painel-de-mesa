<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Painel de Mesa — notas pro próximo agente

- **Português em tudo**: nomes de arquivo, variáveis, comentários, textos de tela.
  Quem conduz o projeto não é dev — explicar sem jargão.
- **Sem login.** Identidade é `localStorage` (`src/lib/identidade.ts`) + código de
  sala na URL (`?sala=...`). Sem `?sala=`, abre a última sala em que o
  aparelho entrou, e só então o padrão `setimo-raio` (`escolherSala` em
  `src/lib/sala.ts`) — é o que faz o app instalado na tela de início abrir a
  campanha de cada um. Campanha do grupo (nome com acento, quem mestra) mora
  em `CAMPANHAS`, no mesmo arquivo. A campanha da sala `setimo-raio` se chama
  **Salamina** (mestre: Maeta) — "Sétimo Raio" foi nome errado do começo,
  vindo da ficha do Tibério. O código não muda: renomear a sala obrigaria a
  mover os dados de todas as tabelas e cada aparelho perderia a escolha de
  personagem salva (`mesa-identidade:setimo-raio`).
- **Regras de negócio fechadas** ficam em `src/lib/regras.ts`, cada uma pura e
  testada em `src/lib/regras.test.ts` (`npm run teste`). Não reimplementar em
  componente — importar de lá. O mesmo vale pro catálogo de monstros:
  `buscarMonstros()` mora em `src/lib/monstrosSrd.ts`, testada em
  `monstrosSrd.test.ts`.
- **Verificação antes de publicar** (`npm run verificar` = testes +
  `next typegen` + `tsc` + lint, ~6s). **O `next typegen` não é enfeite**:
  tipos como `LayoutProps` são gerados pelo Next dentro de `.next/`, e o
  `next-env.d.ts` fica fora do Git — num checkout limpo (Vercel, GitHub)
  nada disso existe antes do build, e o `tsc` sozinho falhava com
  "Cannot find name 'LayoutProps'". Na máquina de quem desenvolve passava,
  porque o `.next/` já estava lá. Achado simulando um checkout limpo antes
  do primeiro push — sem isso, a trava abaixo teria barrado **todo** deploy,
  inclusive os bons. O `vercel.json` troca o comando de build do Vercel por
  `npm run verificar && npm run build`. **É isso que trava uma versão
  quebrada** — o deploy falha e o painel continua na última versão boa. O
  `next build` do Next 16 sozinho confere tipos, mas **não roda lint nem os
  testes** (ver `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`,
  "next lint Command"), então até 18/09/2026 um erro de regra ia pro ar sem
  ninguém tropeçar. O workflow do GitHub (`.github/workflows/verificar.yml`)
  roda a mesma coisa + o build a cada push e PR, mas só **avisa** (✗ no
  commit, e-mail): ele corre em paralelo ao Vercel e não segura o deploy.
  Não tirar a verificação do `vercel.json` achando que o GitHub já cobre.
  Testado reintroduzindo de propósito o defeito do descanso longo: 2 testes
  falharam e o build nem começou.
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
  **Piso medido a 375px: 32px de altura** (medido em 2026-09-17 — estava tudo
  entre 13px e 28px). Dois truques usados, pra não engordar a tela:
  `.minilink`/`.removechar` ganham a área de toque num `::after` absoluto
  (inset negativo), então o alvo tem ~37px **sem** mexer no layout; e o `.pip`
  (exaustão, testes de morte, trilhas de uso) virou um botão de 30px com o
  quadradinho de 20px desenhado no `::before` — mexer no tamanho do `.pip` sem
  olhar o `::before` desalinha o desenho. **`.rm` (o ✕ do `BotaoRemover`) só
  tinha estilo dentro de `.initrow`**; fora dela caía no botão padrão do
  navegador (fundo cinza, borda branca) — hoje tem regra base, não tirar.
- **Escrita que pode falhar não se confirma antes da hora.** As mutações do
  `useSala` engolem o erro no `console.error`; `criarModeloNpc` devolve
  `boolean` justamente pra tela só dizer "copiado" depois do banco
  confirmar. Ao criar mutação nova que tenha retorno na tela, siga isso —
  senão o painel mente quando o Supabase está pausado ou a internet cai.
- **Escrita de personagem manda só as colunas que mudaram.** Nunca gravar a
  linha inteira a partir da cópia que o aparelho tem na memória: são vários
  celulares na mesma sala, e a linha inteira leva junto o valor VELHO de tudo
  o que outra pessoa mexeu nesse meio-tempo. `atualizarVariosPersonagens` já
  foi um `upsert` em lote (uma requisição só, linha completa) e apagava, por
  exemplo, a nota gravada de outro celular 100ms antes quando o Mestre
  aplicava dano em massa — reproduzido contra o banco. Hoje são N `update`
  parciais em paralelo. `upsert` parcial não é saída: o Postgres cobra as
  colunas `not null` (`room_code`, `name`...) mesmo em quem já existe.
- **Dados**: Supabase (Postgres + Realtime). Esquema em `supabase/migrations/`.
  O app fala com o banco só pelo cliente do navegador (`src/lib/supabase.ts`);
  não há rota de servidor nem segredo de servidor.
- **RLS é policy aberta de propósito** — ver README, seção "Segurança". Não
  "consertar" achando que é falha.
- **Pra testar, use uma sala separada**: abra `?sala=teste-ui` (ou outro
  código) em vez de mexer na `setimo-raio`, que tem os dados reais da mesa.
  A sala nasce sozinha no primeiro acesso. Pra apagar depois, basta remover
  a linha dela em `rooms` — as nove tabelas filhas têm `on delete cascade`,
  então some tudo junto e nada encosta na campanha. **A sala renasce se o
  navegador de teste voltar a abrir o app**: o `preview_start` abre `/` sem
  `?sala=`, e o app abre a última sala em que aquele aparelho entrou
  (`mesa-ultima-sala` no localStorage) e a recria no acesso — aconteceu três
  vezes em 01/10/2026. Pra encerrar de vez: feche as abas de teste, abra uma
  página da mesma origem que não é o app (`/manifest.webmanifest`), rode
  `localStorage.clear()`, feche, **só então** apague as salas pela API, e
  confira duas vezes com uns segundos de intervalo.
- O visual saiu do protótipo (Artifact) validado com a mesa: paleta e classes
  CSS estão em `src/app/globals.css`, praticamente iguais às do protótipo.

## Onde está o resto (leia só o que a tarefa pede)

Este arquivo tem só o que vale SEMPRE. O detalhe de cada assunto — o que foi decidido, o que foi testado, as armadilhas já achadas — está em `docs/agentes/`. **Antes de mexer num assunto, leia o arquivo dele**: as decisões ali não estão óbvias no código e várias foram refeitas depois de erro.

| Arquivo | O que tem | Leia antes de… |
|---|---|---|
| [`docs/agentes/fichas.md`](docs/agentes/fichas.md) | Ficha clássica do jogador, ficha completa, ficha de classe calculada, ataques, inventário, magias, baú, subir de nível, XP, e as regras de escrita da ficha (corrida de escrita, trava de versão). | mexer em ficha de personagem, em `atualizarPersonagem`/`alterarListasDoPersonagem` ou em qualquer coluna que viaja inteira |
| [`docs/agentes/combate.md`](docs/agentes/combate.md) | Iniciativa, encontros preparados, telão, log público, dano direto, desfazer, condições, concentração, testes de morte, ataques rolados, salvaguarda em massa, ações lendárias, encerrar combate, emboscada, companheiros, eventos do combate, simulador de encontro. | mexer em iniciativa, PV, log, condições, desfazer, telão ou qualquer linha de log nova sobre personagem (passa por `nomeNoLog`) |
| [`docs/agentes/monstros.md`](docs/agentes/monstros.md) | Como o catálogo de 331 criaturas é montado, gerado, conferido e mostrado; ataque do NPC. | acrescentar, editar ou regerar monstros |
| [`docs/agentes/campanha.md`](docs/agentes/campanha.md) | Quadro da Campanha, recap da sessão, histórico do baú, tempo da campanha, várias campanhas no mesmo deploy e troca de campanha. | mexer na aba Campanha, em salas/campanhas ou em linhas de log que o recap lê |
| [`docs/agentes/mapa.md`](docs/agentes/mapa.md) | Mapas com névoa, ping, peões, régua, condições no peão, modelos de magia, desenhos e notas, aura, e o layout do palco do mapa. | mexer em qualquer coisa do mapa (CenaMapa, PainelMapa, desenharCena) |
| [`docs/agentes/paredes.md`](docs/agentes/paredes.md) | Paredes e portas, visão automática, memória do explorado, importar paredes de arquivo/UVTT, e a detecção automática que foi REMOVIDA. | mexer em paredes, visão, importação de paredes — e antes de pensar em "detectar paredes sozinho" (foi removido de propósito) |
| [`docs/agentes/infra.md`](docs/agentes/infra.md) | Estado do deploy, Supabase, sem internet, backup e restauração, revisões de tecnologia, relato de erro, contador de uso, teste de vazamento, próximos passos. | mexer em deploy, banco, migrations, backup, sem internet, relato de erro ou dependências |
| [`docs/agentes/robo.md`](docs/agentes/robo.md) | Como o robô de tela roda, por que falhava "sozinho", trava de apagar sala, restauração do backup bruto, imagens dos mapas no backup. | escrever ou rodar teste `e2e/*.e2e.ts` |

### Regras de ouro (resumo; o porquê está nos arquivos acima)

1. **Segredo se esconde NA TELA** (o banco é aberto de propósito). NPC oculto, segredo e cartão escondido, nota 🔒, peão oculto, PV de inimigo: toda tela nova passa pelas funções de visão que já existem, e linha de log nova sobre personagem passa por `nomeNoLog` — nunca `p.name` direto. O `e2e/vazamento.e2e.ts` confere; tela nova com dado secreto ganha uma isca nele. → `combate.md`, `campanha.md`, `infra.md`.
2. **Escrita de ficha**: só as colunas que mudaram; lista inteira (inventário, magias, moedas) só por `alterarListasDoPersonagem`; nunca recalcular em cima da cópia velha. → `fichas.md` ("Corrida de escrita").
3. **Escrita que pode falhar não se confirma antes da hora** (log, "copiado", desfazer só depois que o banco aceitar). Erro novo: `relatarErro`, não `console.error`.
4. **Regras e números de D&D vêm de `lib/regras.ts` e do SRD 5.2 (2024), conferidos na fonte — nunca de memória.** → `monstros.md`.
5. **Migration é manual**: escreva o `.sql`, peça pro Daniel rodar no SQL Editor e mande o link; o código tolera tabela ausente. Tabela nova com `room_code` entra em `TABELAS_COM_SALA` (ou em `TABELAS_FORA_DO_BACKUP`) e na lista de `e2e/esquema.e2e.ts`. → `infra.md`.
6. **Teste de tela com o robô: veja a seção "Rodar o robô de tela aqui" abaixo** (nunca junto com o robô do GitHub) e `robo.md`.
7. **Commit sempre com o e-mail do Daniel** (`git log -1 --format=%ae` depois de commitar); sem isso o Vercel bloqueia o deploy.

## Rodar o robô de tela aqui — LEIA antes de rodar (lição de 02/10/2026)

O robô local e o do GitHub **usam a mesma sala `ci-teste` no banco real**: se rodam ao mesmo tempo, um apaga os dados do outro e aparecem
falhas em testes que nada têm a ver com a mudança (aura, mapa, quadro...). Isso já derrubou o robô do GitHub de um commit bom.
**A checagem certa é `gh run list --workflow e2e.yml --limit 1 --json status`** (o `gh run list --limit 1` sozinho pode mostrar o workflow
"Verificar", que acaba em 1 minuto, e dar "completed" com o robô ainda andando). Depois de um push, **espere o "Robô de tela" terminar
(~9 min) antes de rodar qualquer `playwright` aqui**; e se ele falhar, refaça com `gh run rerun <id>` antes de achar defeito no código.

**Desde 12/10/2026 o robô do GitHub roda em DOIS jobs** (`--shard=1/2` e `2/2`), cada um na sua sala: **`ci-teste-1` e `ci-teste-2`**
(`E2E_SALA` no `e2e.yml`; a suíte tinha passado de 22 min num job só, perto do limite de 25). O robô local segue na **`ci-teste`**, então
**o choque local × GitHub descrito acima não acontece mais** — mas dois robôs locais juntos ainda se atrapalham, e as três salas são só do robô.
A sala nasce sozinha na primeira vez (`garantirSala` em `e2e/apoio.ts`). Teste novo continua usando `SALA`, nunca o nome escrito.
