# Robô de tela (Playwright) e trava de sala

> Parte do `AGENTS.md` (dividido em 09/10/2026; o texto é o mesmo de antes, só mudou de lugar). **Leia quando:** Antes de escrever ou rodar teste `e2e/*.e2e.ts`.

## Robô em dois jobs (12/10/2026)

- **Por quê:** a suíte (62 testes, ~943 s de teste + ~35% de limpeza e abertura entre eles) chegou a **22,1 min num job só**, e o limite é 25.
  Uma única repetição de teste instável já estourava e o GitHub cancelava (aconteceu em `e38a399`, a 2 testes do fim).
- **Como:** o `e2e.yml` tem uma matriz `metade: [1, 2]`; cada job roda `npm run e2e -- --shard=<metade>/2` com
  `E2E_SALA=ci-teste-<metade>`. O `--shard` do Playwright reparte por **arquivo** (a suíte é `fullyParallel: false`); com os arquivos de
  hoje deu 489 s × 454 s de teste. Cada job faz o próprio `npm ci` + build, então cada metade leva ~14 min, em paralelo.
- **Salas separadas são o que deixa isso funcionar:** na mesma sala, um job apagaria os dados do outro (a lição de 02/10 abaixo). O
  robô local fica na `ci-teste`, então **não colide mais com o GitHub**. O `concurrency: e2e` continua: duas EXECUÇÕES do workflow
  (dois pushes seguidos) usariam as mesmas salas.
- **Sala nova nasce sozinha:** `garantirSala` (em `limparSala`, `e2e/apoio.ts`) faz o mesmo `upsert` que o app faz ao abrir uma sala
  (`rooms`, `combat_state`, `dm_notes`, `bastiao`). Sem isso, o primeiro `criarFicha` numa sala nova falhava por falta da linha em `rooms`,
  e o `esquema.e2e.ts` por falta das outras. Testado: `esquema` sozinho numa sala que nunca existiu passa.
- **Se um dia o tempo voltar a apertar:** passar de 2 para 3 metades (`metade: [1, 2, 3]`, `/3`, e uma sala `ci-teste-3`). Teste novo usa
  `SALA`, nunca o nome escrito. `ci-teste-1` e `ci-teste-2` são só do robô (as de `ci-teste*` entram no backup diário como qualquer sala).

## Robô de tela, trava de sala e restauração do backup (01/10/2026)

- **Robô de tela** (`e2e/*.e2e.ts`, `playwright.config.ts`,
  `.github/workflows/e2e.yml`, `npm run e2e`): Playwright com o **Chrome já
  instalado** (`channel: "chrome"`, nada é baixado; no CI roda
  `npx playwright install chrome`). Abre o app de verdade numa sala **fixa**
  `ci-teste` que ele mesmo limpa antes e depois (`e2e/apoio.ts`; fixa porque
  depois da migration 0020 ninguém apaga sala pelo app). Cobre: Mestre entra e
  vê as abas sem erro na tela; combate (monstro na iniciativa, passa a vez);
  mapa (sobe a imagem, ela CARREGA — a política de segurança já bloqueou isso
  uma vez —, vai pra mesa, o jogador vê o aviso e abre o mapa, o telão mostra, o
  Mestre tira e a aba some ao vivo); peões; régua (espia o `fillText` do canvas
  pra ler a medida que foi DESENHADA). Erro no console conta como falha (o robô
  imprime o endereço que falhou). Local: `E2E_URL=http://localhost:3000 npm run
  e2e` (usa um servidor já rodando) ou `npm run e2e` (sobe o `next dev` na 3100;
  o Next 16 não deixa dois `next dev` na mesma pasta). **Não entra no `npm run
  verificar`** (precisa do banco) e **só avisa** (✗ no commit), como o
  `verificar.yml`. Segredos do repositório: os mesmos do backup diário.
  Os arquivos são `.e2e.ts`, não `.test.ts`, pra o Vitest não tentar rodá-los.
  **Não rode o robô aqui enquanto o do GitHub está rodando** (`gh run list`): os
  dois usam a MESMA sala `ci-teste` no MESMO banco, e um limpa a sala no meio do
  teste do outro — em 01/10 isso derrubou os dois com erros que pareciam defeito.
  E o robô não pode tocar no mapa logo que a imagem carrega: os peões chegam do
  banco um instante depois (no CI o toque caiu 50 ms antes deles); repita o toque
  até o efeito aparecer (`abrirCartao` em `mapaIniciativa.e2e.ts`).
  **Já achou um erro de verdade:** com a tabela dos peões ainda não criada o
  console mostra um 404 (o app trata, mas o robô falha de propósito). Com a 0019
  rodada, os 4 cenários passam (~20 s).
- **Por que o robô falhava "sozinho" (02/10/2026): duas causas, nenhuma era o Supabase.**
  (1) **Duas execuções do robô ao mesmo tempo.** Todas usam a MESMA sala `ci-teste` do MESMO
  banco e cada uma começa e termina apagando tudo dela: ficha "duplicada" que não devia
  existir, cena que sumiu na hora de criar o peão, peão que some no meio. **O GitHub roda o
  robô a cada push (`e2e.yml`, ~5 min)**, então rodar o robô AQUI logo depois de um push (ou
  dois `npm run e2e` juntos) derruba os dois lados. Prova: as janelas de execução do GitHub de
  02/10 (`gh run list --workflow e2e.yml`) cobrem as rodadas locais que falharam, e 4 rodadas
  seguidas passaram começando 2 s depois de uma janela acabar; as 3 falhas do GitHub nesse
  dia foram as janelas em que eu rodava o robô aqui. **Antes de rodar o robô: `gh run list
  --workflow e2e.yml --limit 1` — se estiver "in_progress", espere. Depois de um push, não
  rode o robô até a execução do GitHub acabar.**
  (2) **Armadilha de quem ESPIA o canvas** (`aura.e2e.ts`, `ultimoQuadro`): eu lia o
  PENÚLTIMO quadro achando que o último podia estar pela metade. Mas o desenho de um quadro
  é síncrono, então o último está sempre completo — e com a tela parada depois de uma
  mudança ele é justamente o que mostra a mudança; o penúltimo é o quadro velho. O teste
  falhava 3 de 3 e passava "de vez em quando" (quando algo redesenhava). Medi o tempo real
  direto com o supabase-js (insert/update de peão e nota, escutando
  `postgres_changes`): eventos chegam em ~0,2 s, aura inclusive. **Se um cenário falhar,
  rode-o sozinho com o GitHub parado antes de investigar**, e não atribua ao "tempo real"
  sem medir como acima (gastei um diagnóstico e um remendo de teste nisso).
  **Terceira causa (02/10/2026): o service worker do build de produção.** O `versao.e2e.ts` passava
  aqui (`next dev`, sem service worker) e falhava só no GitHub (`next build`, com ele): o service worker
  atende `/versao` sozinho e o `page.route` do Playwright não enxerga esse pedido, então o aviso nunca
  aparecia. Hoje o teste abre o contexto com `serviceWorkers: "block"`. **Teste que troca resposta de rede
  com `page.route` precisa bloquear o service worker, senão só prova alguma coisa em desenvolvimento.**
  Outras duas coisas do mesmo dia: (a) o `e2e.yml` tem `concurrency` (uma execução por vez no GitHub), então
  o choque é sempre com ALGUÉM mexendo na `ci-teste` à mão — o Daniel criou um NPC lá e o robô apagou
  ("meu NPC sumiu"); **a `ci-teste` é só do robô, teste sempre noutra sala (`teste-<nome>`)**; (b)
  "paredes e visão" e "o jogador não atravessa parede" falharam uma vez e passaram na execução seguinte,
  sem mudança de código: instabilidade quando a sala é usada por fora. Se repetirem sozinhos, investigar.
- **Trava no apagar sala** (`0020_sem_apagar_sala.sql`, **rodada pelo Daniel em
  01/10/2026 e conferida**: `DELETE rooms` com a chave pública devolve 401
  "permission denied", enquanto criar/garantir sala e apagar ficha seguem
  funcionando e o robô passa): `revoke delete on rooms from anon`. O app só faz `upsert` da sala (nunca apaga), então nada muda pra
  quem usa; o `on delete cascade` deixava qualquer aparelho com a chave pública
  apagar uma campanha inteira. **Consequência pra quem testa:** apagar sala de
  teste deixa de ser possível pela API — passa a ser no SQL Editor
  (`delete from public.rooms where code = 'teste-ui';`). As tabelas filhas
  continuam apagáveis pela API (por isso o robô limpa filha por filha). Salas que
  existem hoje: as reais (`setimo-raio`, `forgotten-realms`) e a `ci-teste` do
  robô, que fica de propósito.
- **Restaurar o backup diário bruto** (`scripts/restaurar-backup-bruto.mjs`):
  devolve ao banco uma sala a partir de `backup/<sala>.json`. Sem `--executar` só
  simula. Insere com "ignorar duplicata" pelo `id`: seguro por cima de uma sala
  que já tem dados (o que existe fica, o que falta volta, rodar duas vezes não
  duplica). Tira a coluna `seq` da névoa (o banco recusa) e insere a névoa na
  ordem do `seq`. Ordem: sala, o resto, cenas, névoa, peões (chave estrangeira).
  `restaurarBackupBruto.test.ts` confere que **toda** tabela do backup é
  restaurada. (Desde 02/10/2026 as imagens dos mapas TAMBÉM estão no backup: ver
  "Imagens dos mapas no backup" logo abaixo.) **Ensaiado em 01/10/2026
  contra o banco de verdade**, numa sala fictícia `ensaio-backup` com dados em
  todas as 14 tabelas: backup pelo script, sala APAGADA inteira (como se o banco
  tivesse se perdido), simulação (não gravou nada), restauração, comparação
  linha a linha — **zero diferenças**, ordem da névoa preservada, rodar de novo
  não duplica. Achou uma lacuna: o backup guardava da sala só o `code`, e a sala
  restaurada ganhava `created_at` novo; hoje lê `rooms?select=*`. Uso:
  `SUPABASE_URL=… SUPABASE_ANON_KEY=… node scripts/restaurar-backup-bruto.mjs
  backup/sala.json --executar`.
- **`rm -rf .next/dev` com o servidor de teste rodando o corrompe** ("Internal
  Server Error", `routes-manifest.json` sumiu): pare o servidor antes de limpar.

### Imagens dos mapas no backup (02/10/2026, sem migration)

- **O backup diário baixa a imagem de cada mapa** (`copiarImagens` em
  `scripts/backup-salas.mjs`): o bucket `mapas` é público, então vai por
  `/storage/v1/object/public/mapas/<caminho>` e grava em `backup/mapas/<caminho>`, dentro
  do mesmo artifact de 90 dias do workflow. Erro de rede ou 5xx **derruba** o backup
  (como o resto); 404/400 de uma imagem que a cena cita e o Storage não tem vira só aviso
  — senão o backup ficaria vermelho todo dia por um arquivo que já não existe. O
  `cenas.imagem` vem de um banco aberto: `caminhoSeguroDaImagem` recusa `..`, caminho
  absoluto, `//` e barra invertida (nada de gravar fora da pasta). A mesma imagem em duas
  cenas é baixada uma vez.
- **O restaurador as devolve** (`restaurarImagens` em `scripts/restaurar-backup-bruto.mjs`):
  procura `mapas/` ao lado do `.json` e sobe com `x-upsert: false`; "Duplicate" (400/409)
  conta como "já estava lá". Sem `--executar` só conta o que existe na pasta. Imagem sem
  arquivo é dita no fim ("suba de novo o original").
- **Ensaiado contra o banco de verdade:** imagem de teste subida, backup (bytes iguais),
  apagada do Storage, restaurada (enviada como nova), restaurada de novo (já estava lá),
  tudo limpo no fim. **Armadilha do ensaio:** o endereço PÚBLICO segue devolvendo 200
  por um tempo depois de apagar o objeto (cache do Storage), então não prova nada sobre
  "apagou/voltou" — olhe o resultado do upload (aceito como novo = tinha sumido) ou a
  listagem `POST /storage/v1/object/list/mapas`.
