# Infra, deploy, backup, erros, uso e histórico do projeto

> Parte do `AGENTS.md` (dividido em 09/10/2026; o texto é o mesmo de antes, só mudou de lugar). **Leia quando:** Antes de mexer em deploy, banco, migrations, backup, sem internet, relato de erro ou dependências.

## Estado (15/09/2026) — já está tudo publicado e funcionando

- **No ar**: https://painel-de-mesa.vercel.app — testado de ponta a ponta
  (leitura e escrita reais), sala `setimo-raio` com o Tibério Vaz.
- **Tela que volta do descanso relê a sala** (`carregar()` em `useSala.ts`):
  o tempo real do Supabase só entrega o que muda enquanto está conectado,
  não repassa o que passou durante a queda. Celular com a tela apagada
  voltava mostrando "sincronizado" com turno e PV velhos. Por isso a sala
  inteira é relida a cada reconexão do canal e sempre que a aba volta a
  ficar visível — **não tirar achando que é leitura repetida à toa**. Se um
  evento chega no meio da releitura, ela descarta e lê de novo (a foto do
  banco podia ser anterior ao evento). Testado derrubando o WebSocket de
  propósito e mudando o PV enquanto estava caído.
- **Sem internet** (19/09/2026, sem migration, roadmap item 8). Duas partes:
  - **App abre sem internet**: service worker em `public/sw.js`, registrado
    pelo `Painel` só no build de produção. Guarda só o próprio app (página
    por rede primeiro com 4 s de prazo; `/_next/static/` guardado primeiro,
    porque o nome muda a cada versão; na instalação já guarda a página e os
    arquivos que ela cita). Chamada pro Supabase nunca passa por ele. **O
    navegador embutido do Claude Code não registra service worker em
    `http://localhost`** ("unknown error when fetching the script" — em
    HTTPS funciona), então ele só foi testado no site publicado.
  - **Combate continua sem internet** (regras em `lib/offline.ts`, fila no
    `useSala`): escrita que falha por queda de rede (erro sem `code` — ver
    `ehFalhaDeRede`; recusa do banco continua sendo erro) fica na tela e vai
    pra uma **fila no localStorage** (`mesa-fila:<sala>`), junto com o
    antes/depois de cada campo. Vale pra `atualizarPersonagem`,
    `atualizarVariosPersonagens`, `definirCombate` e os dois `registrarLog`
    — o resto (criar ficha, diário, Bastião…) continua precisando de
    conexão. Todo pedido ao Supabase tem **prazo de 10 s**
    (`fetchComPrazo` em `lib/supabase.ts`): wi-fi "conectado" mas sem
    internet deixava o pedido pendurado por dezenas de segundos. E cada
    operação leva `seq` = a hora do toque, não a da falha — escritas
    penduradas falham fora de ordem, e a fila precisa da ordem em que a
    pessoa jogou (achado testando: dois danos seguidos no mesmo goblin). Na volta (evento `online`, reconexão do tempo real, volta pro
    app, ou a cada 10 s), `sincronizar` manda a fila na ordem, uma operação
    por vez, e **só grava o que o banco ainda tem como a mudança
    encontrou**: se outro celular mexeu no meio tempo, pula (e as linhas de
    log amarradas a ela, `dependeDe`) e o aviso diz quem. Só depois relê a
    sala — reler antes apagaria da tela o que ainda não foi. Enquanto houver
    fila, o desfazer espera a conexão. A **foto da sala** (`mesa-foto:<sala>`,
    gravada 1 s depois de cada mudança) é o que a tela mostra se o app abrir
    sem internet; sem foto, a mensagem diz que o aparelho nunca abriu a
    sala. **Pra testar a queda no meio da sessão**: o cliente do Supabase
    resolve `fetch` a cada chamada (`lib/supabase.ts`), então no console dá
    pra trocar `window.fetch` por um que rejeita URLs de
    `supabase.co/rest` com `TypeError` e depois voltar o original e
    disparar `window.dispatchEvent(new Event("online"))`. Pra testar abrir
    sem internet: subir o `next dev` com `NEXT_PUBLIC_SUPABASE_URL` apontando
    pra um endereço que não responde.
- **Backup e restauração** (`backup.ts` + `BackupSala.tsx`, aba do Mestre, sem
  migration): o arquivo leva a sala inteira — as dez tabelas (os encontros
  entraram na versão 3 do arquivo; arquivo antigo sem eles deixa os da sala
  em paz, mesma regra do Bastião abaixo), com o log
  **completo** (lido do banco na hora por `exportarSala`, em páginas de 1000;
  o que está na tela são só as últimas 40 linhas) e o Bastião. Antes o backup
  não levava nada de Bastião e cortava o log — parecia seguro e não era.
  Restaurar é a única ação do app que apaga em massa, então tem três travas:
  a tela compara "o arquivo tem" com "a sala de agora tem" (relendo o banco
  primeiro, porque o tempo real **não entrega apagamento feito em outro
  aparelho** e o número na memória mente justo na hora de decidir), exige o
  código da sala digitado à mão, e baixa sozinha um backup do estado atual
  antes de encostar no banco — se falhar em baixar essa rede, não restaura.
  As linhas voltam **sem o `id` antigo** (`linhasParaInserir`, que também
  iguala as chaves de todas as linhas; o insert em lote do PostgREST recusa
  formatos diferentes) e com as colunas tiradas do próprio arquivo, pra
  coluna nova de migration futura voltar sozinha. **Arquivo antigo (versão 1)
  não tem Bastião — e "não tem" é diferente de "tem vazio": nesse caso o
  Bastião da sala não é apagado**, que é o que o aviso da tela promete;
  achado testando, porque a primeira versão apagava as instalações.
- **Bastião desligado por enquanto** (01/10/2026, a mesa não está usando):
  `BASTIAO_ATIVO = false` em `BarraAbas.tsx` esconde a aba. **Nada foi apagado**:
  o `PainelBastiao`, a tabela, os dados da campanha, o carregamento no `useSala`
  e o backup (que leva o Bastião) seguem como estavam. Religar = trocar por
  `true`. Quem está no `Painel` com a aba "bastiao" aberta cai no Diário
  (`abaEfetiva`).
- **GitHub**: [danielbgomes8/painel-de-mesa](https://github.com/danielbgomes8/painel-de-mesa)
  (privado), conectado ao Vercel — push na `main` já republica sozinho.
- **Supabase**: projeto próprio na org "Daniel Lima projetos" (região São
  Paulo), separado do gb-reserva. Migrations `0001` a `0033` (a 0029 não existe; a 0020 é a trava de apagar sala) e o `seed.sql`
  já rodadas — o banco tem `rooms` mais treze filhas (as dez de antes, `cenas`,
  `cena_nevoa` e `cena_pecas`), todas com `on delete cascade` ligado em `rooms`,
  fora a `erros`, e o bucket de imagens `mapas`. (A 0020, que tira do `anon` o
  direito de apagar sala, é escrita à parte: ver "Robô de tela, trava de sala e
  restauração do backup".) **Pegadinha real já resolvida
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

## Revisão de 25/09/2026 (antes da sessão de domingo)

Revisão completa feita contra o site publicado, numa sala descartável, em 375px
(mestre e jogador: ordem, monstros, encontro, dano/condição/desfazer, virada de
rodada, concentração, testes de morte, telão, queda de rede com sincronização,
tempo real). Nada quebrou; saíram estes ajustes:

- **Campo que não cabe a 375px é defeito.** Placeholder cortado ("iniciati",
  "desl. (m") não some sozinho: `.addcombatant input.num` tem 108px (cabe
  "iniciativa") e, em telas ≤520px, campo de texto do formulário ocupa a linha
  toda. Teste que achou 16 cortes e hoje dá 0 — no console, pra cada `input`
  vazio com `placeholder`, comparar `canvas.measureText(placeholder).width`
  (com a fonte computada do input) com `clientWidth - padding`. **Placeholder
  novo: encurte, e ponha o texto longo no `aria-label`.**
- **Backup diário** (`scripts/backup-salas.mjs` + `.github/workflows/backup-diario.yml`,
  sem migration): lê todas as salas todo dia (só leitura, sem dependência), guarda
  90 dias como artifact e mantém o projeto do Supabase com movimento (o plano
  gratuito não faz backup e pausa após ~7 dias parado). Falha alto (exit 1) —
  banco sem sala ou erro HTTP não vira "backup vazio". **Tabela nova com
  `room_code` precisa entrar em `TABELAS_COM_SALA`**: `backupBruto.test.ts`
  compara a lista com as migrations e quebra o `npm run verificar` se faltar.
  Segredos no repositório: `SUPABASE_URL` e `SUPABASE_ANON_KEY` (públicos por
  natureza). Cópia bruta, reinserível por REST; o restaurável pelo app é o
  botão "backup" do Mestre.
## Revisão de tecnologia (25/09/2026, noite)

O Daniel pediu "o que falta de tecnologia no app" e aprovou os dois
primeiros itens; os outros estão na lista do fim desta seção.

- **Next.js 16.3.1 → 16.3.6** (e `eslint-config-next` junto, versão exata como
  antes). O `npm audit` apontava dois alertas **críticos** — execução de código
  em servidor **Windows** e na otimização de imagem **AVIF** (`sharp`/`libheif`).
  Nenhum atingia o site (o Vercel roda Linux e o app não usa `next/image`),
  mas era atualização de conserto, sem mudança de uso. `npm audit --omit=dev`
  = 0. Sobra um alerta moderado no **Vitest** (ferramenta de teste, não vai
  pro site); a correção é o Vitest 5, versão grande — decisão pra depois.
  Em 01/10/2026 o `npm audit` (completo) deu 3: o do Vitest (conta duas vezes,
  `vitest` + `@vitest/mocker`, mesmo aviso) e um **alto** no `brace-expansion`
  (usado pelo lint, só desenvolvimento); o `npm audit fix` resolveu esse
  (1.1.18 → 1.1.21 e 5.0.9 → 5.0.12, só no lockfile). Ficou só o do Vitest —
  **resolvido em 01/10/2026 com o Vitest 3.2.7 → 4.1.11** (`npm audit` completo
  = 0). Não foi pro 5: o 5.0.3 tinha um dia e meio (dentro dos 3 dias de espera)
  e o 5 exige Node 22.12+, e não se sabe o Node do projeto no Vercel; o 4.1.11 roda
  do Node 20 em diante e já tinha 6 semanas. Nada mudou no uso: os 457 testes
  passaram sem mexer em teste nenhum, e um defeito plantado continua acusando.
- **Robô de atualizações** (`.github/dependabot.yml`): toda segunda, 06:00 de
  Brasília, UM pull request com todas as atualizações pequenas (`minor` +
  `patch`) do npm; ações dos workflows uma vez por mês. Versão **grande** fica
  de fora (`ignore` semver-major — TypeScript 7, Vitest 5, ESLint 10 quebram
  coisa e são decisão conjunta); o `ignore` só vale pra atualização de rotina,
  não pra de segurança. `cooldown` de 3 dias: versão recém-publicada espera
  (é quando aparece — e é retirada — a maioria das quebradas ou adulteradas).
  **Aplicar um pedido do robô**: o commit que vai pro ar precisa ter o Daniel
  como autor (`danielbgomes8@gmail.com`), senão o Vercel bloqueia o deploy —
  então não é "Squash and merge" pelo site: rodar as mesmas versões aqui
  (`npm install --save-exact …`), `npm run verificar`, commitar com o autor
  inline; o robô fecha o PR dele sozinho quando vê a versão já aplicada. O
  jeito mais fiel é pegar os dois arquivos do próprio PR
  (`git checkout origin/<branch do robô> -- package.json package-lock.json`
  + `npm ci`). O preview do Vercel no PR do robô passou normalmente no #1;
  o que nunca se testou é produção com commit de autor `dependabot` — por
  isso o caminho acima. Atualização com novidade de verdade (não só
  conserto) merece o teste de uso numa sala descartável antes: o #1 (React
  19.2.8 → 19.3.0, supabase-js 2.116 → 2.117, `@types/node`) foi aplicado em
  25/09 depois de montar ordem, dano, condição, turno, desfazer, telão em
  tempo real e a fila sem internet (o formato do erro de rede do supabase-js
  é o que `ehFalhaDeRede` lê — conferir sempre que ele mudar de versão).
  Em 01/10/2026 entrou o supabase-js 2.117.0 → 2.117.2 (PR do robô, aplicado
  pelo caminho acima). Conferido: o erro de queda de rede continua
  `{message: "TypeError: Failed to fetch", code: ""}` (um teste provisório
  rodou `ehFalhaDeRede` sobre o erro REAL do cliente instalado), e o robô de
  tela passa nos 5 cenários — ele cobre o canal de transmissão do ping e da
  régua, que é o que mais depende da biblioteca. **Atualização do cliente do
  Supabase agora tem teste de verdade: rode `npm run e2e` antes de aceitar.**
  **Os alertas de segurança do GitHub estão ligados** (o Daniel ligou em 02/10/2026,
  conferido pela API: `vulnerability-alerts` = 204, `automated-security-fixes` =
  `enabled: true`). É configuração de segurança da conta: quem liga/desliga é ele,
  não mexer por API. Se chegar um pull request do Dependabot de segurança, vale o
  mesmo caminho do robô de atualizações (acima): não fazer "Squash and merge" pelo
  site, que o commit precisa ter o Daniel como autor.
- **Telão segura a tela acesa** (`lib/telaAcesa.ts`, testado com navegador e
  documento falsos em `telaAcesa.test.ts`; `hooks/useTelaAcesa.ts`, usado só
  no `Telao`): pede a trava de tela (Screen Wake Lock) ao abrir e **de novo
  a cada volta** — o navegador solta sozinho quando a aba some (troca de aba,
  minimizar). Se o navegador negar (economia de bateria) ou não tiver o
  recurso (antigo, ou página sem HTTPS), o telão mostra um aviso pequeno pra
  desligar o descanso de tela. A situação fica em `data-tela` no `.telao`
  (`acesa` / `recusada` / `sem-suporte`) pra conferir de fora.
  **O navegador embutido do Claude nega a trava** (`permissions.query` =
  `denied`, "Wake Lock permission request denied") — nele só dá pra ver o
  aviso. Pra ver funcionando: Chrome sem janela com perfil temporário
  (`chrome --headless=new --remote-debugging-port=9333
  --user-data-dir=<pasta temporária>`) e um script Node falando o protocolo de
  depuração (CDP) por WebSocket — abrir o telão, ler `data-tela`, trocar de aba
  com `Target.activateTarget` e contar os pedidos embrulhando
  `navigator.wakeLock.request`. Resultado em 25/09: `acesa`, permissão
  `granted`, um pedido novo a cada volta, trava nova ativa. Com
  `Browser.setPermission` negando `screen-wake-lock`, o aviso aparece
  (conferido em foto a 1280×720, sem rolagem).
- **`.gitattributes` (`scripts/** eol=lf`)**: num checkout Windows
  (`core.autocrlf=true`) o `scripts/backup-salas.mjs` vinha com CRLF, e o
  Vitest não importava arquivo com `#!/usr/bin/env node` + CRLF
  (`SyntaxError` no `backupBruto.test.ts`) — o `verificar` quebrava só no
  Windows. GitHub e Vercel (Linux) passavam.

**Ainda da revisão (não feito, esperando o Daniel):**
3. ~~Erros dos celulares somem no `console.error` do aparelho~~ — feito,
   ver "Relato de erro dos aparelhos" logo abaixo.
4. ~~Nenhum teste cobre tela~~ — feito em 01/10/2026: robô de tela (ver "Robô
   de tela, trava de sala e restauração do backup"). **O `useSala` ganhou teste
   próprio em 01/10/2026** (`hooks/useSala.test.ts`, no `npm run verificar`): o
   hook INTEIRO contra um Supabase falso em memória (`hooks/bancoFalsoParaTeste.ts`
   — consultas em cadeia, chaves únicas/23505, tempo real filtrado por sala, e o
   mesmo erro de queda de rede do supabase-js), com `happy-dom` +
   `@testing-library/react` (só nesse arquivo: `// @vitest-environment happy-dom`;
   o resto continua em `node`; o `vitest.config.mts` ganhou o `@/` do tsconfig).
   Cobre o que o robô não alcança: abrir a sala, tempo real, dano que manda só a
   coluna que mudou (a nota de outro celular fica), corrida na ordem (o aviso que
   ainda não chegou — `comoOutroAparelho(..., { avisar: false })`), desfazer que
   volta / que recusa quando outro aparelho mexeu / que devolve o peão, a fila sem
   internet (vai quando volta; não atropela número NEM texto mudado no meio) e
   ficha apagada levando o peão. **Conferido plantando defeitos**: refazer a conta
   no conflito, gravar a linha inteira, esquecer o peão e pular a conferência da
   fila — os quatro quebram teste. (O último só quebrou depois do caso de TEXTO:
   número tem a segunda trava do próprio UPDATE, `camposConferiveis`; texto não.)
   **O Vercel roda o `verificar` com NODE_ENV=production**: em produção o React
   não tem `act` e o teste do hook quebrava SÓ lá (o 1º deploy dele falhou e a
   trava segurou o site na versão anterior). O `vitest.config.mts` força
   `env: { NODE_ENV: "test" }`. Pra simular o Vercel aqui:
   `NODE_ENV=production CI=1 VERCEL=1 bash -c "npm run verificar && npm run build"`.
5. ~~Trava no apagar sala~~ — feito em 01/10/2026 (`0020`, rodada e conferida).
   **A lista de salas é pública**: `GET /rest/v1/rooms?select=code` com a
   chave `anon` devolve todos os códigos (conferido). Então "código difícil de
   chutar" (seção de trocar campanha, acima) **não esconde campanha nenhuma**.
   Trava barata sem login: o app nunca apaga sala inteira, dá pra tirar o
   `delete` de `rooms` do `anon` (as tabelas filhas continuam abertas).
6. ~~O backup diário nunca foi restaurado~~ — feito em 01/10/2026: script
   `restaurar-backup-bruto.mjs` + ensaio contra o banco de verdade, sem
   diferenças.
7. ~~Peso da primeira abertura~~ — feito em 01/10/2026: de **272 KB pra 250 KB**
   compactados (medido no `next start`, pedidos de script até o evento `load`).
   Saíram dela: o **mapa** inteiro (`components/MapaSobDemanda.tsx`, `next/dynamic`
   do `PainelMapa` e do `VisorDaMesa` do telão; só baixa ao abrir a aba/telão com
   mapa) e as **habilidades de classe** (`hooks/useCatalogoClasses.ts`, igual ao de
   monstros; o rótulo `NOME_CLASSE` foi pra `lib/classesNomes.ts`, que é leve).
   **Pré-carga no tempo livre** (`quandoSobrarTempo` no `Painel`): as classes
   sempre e o mapa pra quem tem mapa (Mestre, ou todos com mapa na mesa) — a ficha
   tem de abrir sem internet e o service worker só guarda o que já baixou. Sem
   internet e sem a parte baixada, o mapa mostra "Não deu pra carregar o mapa…
   tentar de novo" em vez de derrubar o app (conferido bloqueando os pedidos com
   `serviceWorkers: "block"` — **o `page.route` do Playwright não pega o que o
   service worker busca**, e sem bloquear ele o teste passa por engano). O resto
   da abertura é React (~70 KB), supabase-js (~64 KB) e o Next (~46 KB): o próximo
   corte seria trocar o `supabase-js` pelos pacotes separados (postgrest/realtime/
   storage, sem o de login que o app não usa) — mexe no `ehFalhaDeRede`, então só
   com o robô e o teste de queda de rede. **Medido em 02/10/2026 e decidido NÃO fazer:** no site
   publicado, celular de 375 px, cache desligado e CPU 4× mais lenta, a tela de entrada aparece em
   **2,5 s no 4G rápido (9 Mbps, 170 ms) e 6,3 s no 4G lento (1,6 Mbps, 560 ms)**, com 493 KB e 11
   scripts no total. Tirar uns 25 KB seria ~5%: de 0,1 a 0,15 s, só na primeira visita (nas seguintes o
   service worker já resolve). Não compensa o risco no tratamento de queda de rede; reabrir só se a mesa
   reclamar de lentidão. Banco na mesma data: 507 linhas no total (157 de log) e 0,6 MB de imagens no
   Storage, contra 500 MB e 1 GB do plano gratuito — **podar o `combat_log` não tem motivo**.
   **De passagem:** campo `type="number"` não tem mais as setinhas de subir/descer
   (`globals.css`): no notebook o Chrome guarda ~15 px pra elas em cada campo e
   cortava "iniciativa" e "quanto?" — a medida por `measureText` NÃO pega isso
   (dava "cabe"); só a foto mostrou. Pra medir de verdade, compare o
   `scrollWidth` com um texto longo no notebook e no celular.
   **Banco × `tipos.ts`** (01/10/2026, `e2e/esquema.e2e.ts`): cada tabela tem a
   lista das colunas que o código usa, escrita como objeto com todas as chaves do
   tipo — o `tsc` não compila se faltar ou sobrar campo (conferido acrescentando um
   campo de mentira em `Personagem`) — e o robô pede essas colunas ao banco
   (`select=a,b&limit=0`, só leitura: coluna que falta volta 400 com o nome). A
   chave pública NÃO lê o esquema (`/rest/v1/` pede chave secreta), então o
   caminho inverso (coluna no banco que o tipo não tem) é conferido com `select=*`
   nas tabelas em que a sala de teste sempre tem linha. **Já achou uma:**
   `combat_state.updated_at` existia no banco e não no tipo `LinhaCombate` (agora
   tem). Tabela ou coluna nova: acrescente na lista do `esquema.e2e.ts`. O log **não**
   precisa de limpeza: 135 linhas na Salamina em duas semanas e o app só lê
   as 40 últimas.

### Relato de erro dos aparelhos (25/09/2026, migration `0017`)

- **Tabela `erros`** (`0017_erros.sql`): sem ligação com `rooms` de propósito
  (o relato não pode falhar porque a sala não existe, e apagar a sala não
  apaga o histórico); `check` de tamanho em cada coluna, e o teste confere
  que batem com `LIMITES_ERRO`. Policies de ler/inserir/apagar pro `anon`,
  sem update. **Fora do backup** (`TABELAS_FORA_DO_BACKUP` em
  `scripts/backup-salas.mjs`; `backupBruto.test.ts` respeita a lista).
- **Regras puras** em `lib/erros.ts` (testadas): `resumirErro` (erro do
  Supabase leva o `code` no detalhe — 42501 = RLS, PGRST204 = coluna que o
  banco não tem, ou seja, migration que não rodou; erro de programa leva a
  pilha), `deveRelatar` (queda de internet NÃO: ela tem a fila; nem o aviso
  de `ResizeObserver` nem "Script error." de outro site), `criarFreio` (20 por
  abertura, mesmo erro a cada 5 min).
- **Quem manda**: `lib/relatarErro.ts` — `relatarErro(onde, erro)` faz o
  `console.error` de sempre e insere na tabela; relato que falha vira só um
  `console.warn` (nunca outro relato). **Só no build de produção**
  (`NODE_ENV`), então `npm run dev` não suja a tabela; pra testar, `next
  build && next start` com o `.env.local` (a versão sai "local"). A versão
  publicada vem de `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` (o Vercel preenche no
  build). Sala e quem usa o aparelho vêm de `definirContextoDoErro`, chamado
  pelo `PainelSala`.
- **Os três caminhos de erro**: todo `console.error` do `useSala` e do
  `Painel` virou `relatarErro` (inclusive a primeira carga da sala que não é
  queda de rede); `instrumentation-client.ts` (convenção do Next, roda antes
  do app) ouve `error` e `unhandledrejection` da janela; e `app/error.tsx` é a
  tela "Algo deu errado" (Tentar de novo / Recarregar), que relata "tela
  quebrou". **Erro novo no app: use `relatarErro`, não `console.error`.**
  O `gravarSeVersaoBater` devolve `causa` (o erro inteiro, com o código) pra
  isso.
- **Testado** (25/09, build de produção local contra o banco real, salas
  descartáveis e relatos de teste apagados depois): erro solto e promessa sem
  tratamento chegaram na tabela com sala, "Mestre", pilha e versão "local";
  o `TypeError: Failed to fetch` não entrou, e o mesmo erro repetido foi
  segurado pelo freio. Gravação recusada (resposta 403 com código 42501
  simulada trocando `window.fetch` só pro PATCH de `characters`) entrou como
  `atualizarVariosPersonagens` / "código 42501", e a tela desfez o dano e
  avisou "Não salvou". Uma ficha com `resources` estragado
  (`{}` em vez de lista) quebrou a aba Fichas e caiu na tela "Algo deu
  errado" em vez de página em branco. O `error.tsx` pega a página inteira
  (é um segmento só): uma ficha estragada derruba o app todo **naquele
  aparelho**, até o dado ser consertado — antes era a mesma coisa, só que em
  branco. No `localhost` o service worker não registra e isso também vira
  relato (no site publicado ele registra).

## O que a mesa usa e teste de vazamento (09/10/2026)

- **Contador de uso** (migration `0033_uso.sql`; `lib/uso.ts` regras puras, 11 testes; `lib/registrarUso.ts` quem manda;
  `UsoDaMesa.tsx` a leitura, em Mestre → Sala → "📊 O que a mesa usa"). Cada aparelho marca UMA vez por abertura do app cada tela
  ou ação que usou (`registrarUso("aba:combate")`): abas, partes da Campanha, seções do Mestre, ferramentas do mapa, telão e cinco
  ações (desfazer, rolar ataque, recap, subir de nível, encerrar combate). Guarda só sala, papel (mestre/jogador/telão), nome da
  tela e um sorteio por abertura — **nada de nome de pessoa nem conteúdo**. Mesmo molde do relato de erro: só no build de produção,
  nunca atrapalha, sem internet nem tenta, tabela ausente (`PGRST205`/`42P01`) para de tentar, sem ligação com `rooms`, fora do
  backup (`TABELAS_FORA_DO_BACKUP`). O resumo olha 30 dias, conta aberturas distintas por tela e lista as telas do catálogo que
  ninguém abriu. **Tela ou ação nova: acrescente em `TELAS_DE_USO` (rótulo) e chame `registrarUso`**; sem o rótulo ela aparece
  com o nome cru, e sem estar no catálogo nunca aparece como "ninguém abriu". Para limpar dado de teste: `delete from uso where room_code = '...'`.
- **Teste de vazamento** (`e2e/vazamento.e2e.ts`): semeia uma ISCA (`ISCA_<CAMPO>`) em cada lugar secreto — NPC oculto (nome, tipo,
  notas, ataque, PV), cartão escondido/silhueta/pessoal do Quadro, segredo de cartão revelado, ligação e nota ligadas a cartão
  escondido, sessão do diário que cita cartão escondido, notas do Mestre, biblioteca, encontro preparado, nota 🔒 do mapa, peão
  oculto — e passeia como jogador e como telão por todas as telas (abrindo cada cartão, cada gaveta, cada linha da iniciativa),
  conferindo HTML inteiro (atributos incluídos), valor de campos, texto desenhado nos canvas e o PV do inimigo. Controles provam que
  o robô enxerga: o Mestre tem de ver as iscas e o jogador o que é público. **Conferido plantando 5 defeitos** (cartão escondido
  visível, nome real no log, peão oculto desenhado, nota 🔒 visível, e o nome do inimigo) — os 5 quebram o teste. Armadilhas
  achadas: (1) com a névoa ligada ela esconde os peões sozinha e mascara o `oculto` (o teste desliga a névoa da cena);
  (2) `pecaVisivel` em `lib/pecas.ts` só é usada nos testes — o filtro de verdade do mapa está em `desenharCena.ts`.
  **Tela nova com dado secreto: semeie uma isca nova aqui** em vez de escrever outro teste.

## Próximos passos (combinados em 17/09/2026)

Lista de melhorias que o Daniel aprovou, na ordem. Os riscados já foram
feitos — ficam aqui pra deixar claro de onde a ordem veio. Os 8 foram feitos;
a lista seguinte está logo abaixo.

1. ~~Corrigir os três defeitos achados na revisão completa~~ — commit
   `0347e01` (escrita que apagava a de outro celular, descanso longo
   incompleto, modificador de CD entrando no ataque de magia).
2. ~~Backup completo com restauração~~ — commit `60f4e1c`.
3. ~~CI no GitHub~~ — feito em 18/09/2026: `npm run verificar`, trava no
   `vercel.json` e workflow no GitHub (ver "Verificação antes de publicar"
   lá em cima).
4. ~~Preparar encontro~~ — feito em 19/09/2026 (migration `0016`; ver
   "Encontros preparados" em Estado).
5. ~~Aplicar dano na própria linha da iniciativa~~ — feito em 19/09/2026
   (sem migration; ver "Dano direto na iniciativa" em Estado).
6. ~~Desfazer a última ação~~ — feito em 19/09/2026 (sem migration; ver
   "Desfazer" em Estado).
7. ~~Explicar a condição na hora~~ — feito em 19/09/2026 (sem migration; ver
   "Condições explicadas" em Estado).
8. ~~Funcionar sem internet~~ — feito em 19/09/2026 (sem migration; ver
   "Sem internet" em Estado).

### Segunda lista (sugerida em 19/09/2026 — o Daniel respondeu "vamos seguir")

Tudo gira em torno da linha da iniciativa, que virou o centro do combate.
Os quatro foram feitos; a próxima lista sai de conversa nova com o Daniel.

1. ~~Condição direto na linha da iniciativa~~ — feito em 19/09/2026 (sem
   migration): o painel que abre ao tocar no nome ganhou os 14 chips e os
   prazos, os mesmos da ficha (`CondicoesEditaveis.tsx`).
2. ~~Ataque rolado na iniciativa~~ — feito em 19/09/2026 (sem migration;
   ver "Ataques rolados" em Estado).
3. ~~Jogador caído na iniciativa~~ — feito em 19/09/2026 (sem migration;
   ver "Testes de morte" em Estado).
4. ~~Telão com as condições~~ — feito em 19/09/2026 (sem migration; ver
   "Telão" em Estado).

Lacunas mapeadas na mesma revisão e ainda abertas, fora da lista acima: os
componentes não têm teste de unidade (os de `lib/` são de funções puras; o
`useSala` tem o dele desde 01/10; as telas são cobertas pelo robô);
e `combat_log` nunca é podado. (A terceira — `definirBastiao` sem controle de
concorrência — foi fechada em 18/09/2026 com a migration `0015`: mesma trava
de versão do combate, os dois agora passam por `gravarSeVersaoBater` em
`useSala.ts`.)

**Fichas de Sigha, Mordecai, Massaranduba e Mistery Grey ficam como estão**
(decisão do Daniel em 06/10/2026: não vai preencher). Atributos 10, então o botão
"pôr todos na ordem" rola d20+0 pra eles. Não cobrar de novo.
