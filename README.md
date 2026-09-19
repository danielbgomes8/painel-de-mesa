# Painel de Mesa

Painel de combate e fichas pra mesa de **D&D 5.5** (regras 2024, SRD 5.2) do
Daniel — campanha **"Sétimo Raio"** (mestrada pelo Maeta), jogada
presencialmente com cada pessoa no seu aparelho. O mesmo app serve outras campanhas do grupo, cada uma com os
dados separados (hoje também a **"Forgotten Realms"**, mestrada pelo Diogo).

Não é ficha completa de personagem: é o punhado de coisas que muda o tempo todo
durante a sessão — PV, exaustão, condições, testes de morte, iniciativa — com
tudo sincronizando na hora entre celular, tablet e notebook.

**Sem login.** Cada pessoa abre o link, escolhe a campanha e diz quem é
(Mestre, um personagem da lista, ou digita um nome novo). Essa escolha fica
salva só no navegador dela, uma por campanha.

---

## O que cada um vê

O topo tem um menu de abas — **Diário · Bastião · Combate · Fichas** pra todo
mundo, e uma aba **Mestre** que só aparece pra quem entrou como Mestre. O
banner **"É a sua vez!"** (com vibração/bipe) fica sempre visível acima das
abas, não importa qual está aberta.

**Diário** — histórico da campanha (título + texto) em ordem cronológica,
escrito pelo Mestre, visível pra todo mundo.

**Bastião** (regras de Bastiões do 2024, DMG cap. 8) — gestão de turno de
verdade, não só uma lista: cada instalação especial pode ser marcada
"trabalhando este turno" (volta sozinha a "não trabalhou" quando o turno
avança), catálogo de instalações especiais e básicas agrupado por nível com
a descrição de cada mecânica, evento aleatório com **rolagem de d100** real
contra a tabela oficial, tesouro/defensores editáveis, log próprio. Jogador
e Mestre editam igual — não é ferramenta só do Mestre.

**Combate** — rastreador de iniciativa (adicionar personagem cadastrado ou
NPC/monstro avulso do catálogo, **rolar iniciativa** d20+mod, ordenar,
reordenar na mão, marcar o turno, avançar rodada, reiniciar), **ações em
massa** (só Mestre: selecionar vários e aplicar dano/cura ou uma condição de
uma vez), log de combate visível pra todos. NPC não revelado aparece como
"Inimigo N"; **o PV de NPC nunca aparece pro jogador, nem depois do nome
revelado** — só o Mestre vê isso, inclusive no modo telão. Jogador também
pode rolar ou digitar a própria iniciativa sem depender do Mestre.

**Fichas** — jogador vê só o próprio card; Mestre vê todos os cards,
editáveis. PV atual/máx/temporário com +/− (dano desconta do temporário
primeiro) · CA, Iniciativa e Deslocamento editáveis · Exaustão 0–6 em pips,
com o efeito calculado em texto · dados de vida + **descanso curto/longo**
(o longo cura tudo, tira 1 exaustão, recupera metade dos dados de vida e
zera os recursos) · testes de resistência contra a morte · aviso de "Caído"
quando o PV zera · as 14 condições do 2024 como chips, com prazo em rodadas
opcional · **Inspiração Heroica** e **concentração** (com nota de "em quê") ·
vantagens/resistências em campo próprio · **recursos de classe genéricos** —
cada jogador cadastra o que a própria classe usa (Fúria, Pontos de Foco,
Surto de Ação, Canalizar Divindade, espaços de magia por nível…), com opção
de recuperar no descanso curto · munição/equipamento com contador de uso ·
ataque em texto livre (acerto + dano), carregado do catálogo quando o NPC
entra em combate · notas rápidas. Atrás de "+ ver ficha completa" (só
jogador): **ficha de classe calculada** — resistência, perícia, CD de magia e
percepção passiva a partir de atributo + nível + proficiência, com
multiclasse e um catálogo de habilidades por nível; nunca sobrescreve o
campo manual sozinha, só sugere "usar" — e **ficha livre** (história,
características, magias, itens mágicos, trejeitos… em seções de texto ou
lista, sem regra de D&D embutida).

**Mestre** (aba própria) — biblioteca de NPCs pra preparar a mesa com
antecedência (ficha completa + notas de tática, reaproveitável entre
combates e sessões), busca no catálogo de monstros do SRD 2024 (CA, PV,
iniciativa, linha de ataque), notas privadas que só o Mestre enxerga,
revelar/ocultar NPC, remover personagens e NPCs, **modo telão** (tela cheia
pra projetar ou compartilhar, sem os controles de edição, com o mesmo
segredo de PV de NPC) e **backup** (baixa tudo da sala num `.json`).

---

## Regras de negócio (fechadas — não reinventar)

Estão em [`src/lib/regras.ts`](src/lib/regras.ts), cada uma pura e coberta por
[`src/lib/regras.test.ts`](src/lib/regras.test.ts).

- **Exaustão 2024**: trilha única 0–6. Penalidade de **−2 em todo teste de D20**
  por nível (perícia, ataque, resistência) e **−1,5 m de deslocamento** por
  nível. Nível 6 = morte. Descanso longo tira **1 nível** (não zera).
- **Testes de morte** zeram sozinhos assim que a criatura recupera **qualquer PV
  acima de 0**.
- **PV** nunca passa do máximo nem fica negativo (trava em 0). **Dano desconta
  do PV temporário antes do PV normal**; cura não mexe no temporário.
- **Descanso longo**: PV cheio, −1 exaustão, recupera metade dos dados de vida
  (mínimo 1) e zera todos os recursos de classe. **Descanso curto**: só os
  recursos marcados como "recupera no descanso curto".
- **NPC não revelado** aparece pro jogador como "Inimigo N" na ordem de
  iniciativa — Mestre revela quando quiser (evita entregar o monstro antes da
  hora). O **PV de NPC nunca vai pro jogador**, mesmo revelado.
- **Ficha de classe**: fórmulas de resistência/perícia/CD de magia/percepção
  passiva a partir de atributo + nível + bônus de proficiência (a soma dos
  níveis de todas as classes, em caso de multiclasse) — conferidas contra
  `api.open5e.com/v2/classes`, mesma disciplina do catálogo de monstros.
- **Evento do Bastião**: `eventoBastiaoPara` acha o nome do evento da tabela
  oficial pela faixa em que a rolagem de d100 cai. Os números de cada ordem
  (quanto rende, quantos dias leva) ficam de propósito fora do app — vai no
  livro físico, o painel só guarda o estado de quem está trabalhando.

---

## Stack

Next.js 16 (App Router) · Supabase (Postgres + Realtime) · Vercel · TypeScript.
Tudo roda no navegador: não há backend próprio nem segredo de servidor.

```
src/
  app/            layout, página única, ícone/manifest gerados em código
                  (icon.tsx, apple-icon.tsx, manifest.ts), globals.css
                  (tema "taverna")
  components/     Painel (orquestra as abas) · BarraAbas · Portao ·
                  DiarioCampanha · PainelBastiao · RastreadorCombate ·
                  AcoesEmMassa · LogCombate · BibliotecaNpcs · NotasDoMestre ·
                  FichaPersonagem · FichaCompleta · FichaClasse ·
                  SecaoRecolhivel · BannerSuaVez · Telao ·
                  CampoNumero · CampoTexto · CampoTextoAdiado · BotaoRemover ·
                  ListaLog (campos e blocos reutilizáveis)
  hooks/          useSala (carrega a sala + assina o Realtime + mutações) ·
                  useCodigoSala · useIdentidade · useModoTelao
  lib/            regras · condicoes · identidade · sala · supabase · tipos ·
                  dados (rolagem d20/d100) · alerta (vibração/bipe de turno) ·
                  bastiaoDmg (catálogo do Bastião) · classesSrd (habilidades
                  por classe/nível) · monstrosSrd (catálogo de monstros) ·
                  backup (exporta a sala num .json)
supabase/
  migrations/     0001 a 0016 — do esquema inicial até os encontros
                  preparados; o
                  cabeçalho de cada arquivo diz depois de qual rodar
  seed.sql        dados da sala "setimo-raio" (Tibério Vaz)
```

---

## Rodar no computador

```bash
npm install
cp .env.example .env.local   # e preencha as duas variáveis do Supabase
npm run dev                   # http://localhost:3000
```

Sem o `.env.local` o app abre, mas mostra um aviso em vez do painel.

Outros comandos: `npm run build`, `npm run lint`, `npm run teste`
(regras de negócio), `npm run teste:assistir`.

**`npm run verificar`** roda tudo de uma vez — testes, tipos e lint (uns 6
segundos). É o mesmo comando que o Vercel roda antes de publicar
(`vercel.json`): se alguma coisa falhar, o deploy falha e o painel continua
na última versão que funcionava, em vez de ir pro ar quebrado. O GitHub
também roda a mesma verificação a cada push (`.github/workflows/verificar.yml`)
e marca o commit com ✓ ou ✗.

Cada campanha é uma sala, com os dados separados, e todas moram no mesmo
deploy. As campanhas do grupo ficam na lista `CAMPANHAS` de
[`src/lib/sala.ts`](src/lib/sala.ts) (nome, código e quem mestra) e aparecem
pra todo mundo: na tela de entrada e no botão **"⇄ trocar campanha"** do topo,
que troca na hora, sem recarregar e sem mexer em link. Campanha nova do grupo
é uma linha nessa lista. Uma que não deve aparecer pra quem abre o app fica de
fora e entra pelo campo **"outra campanha (com código)"** ou pelo link
`?sala=<codigo>` (ex.: `/?sala=cripta-de-ferro-7k2`). Nesse caso use um código
difícil de chutar, porque ele é a única "senha" da mesa. A sala é criada
sozinha no primeiro acesso. O app instalado na tela de início abre a última
campanha em que o aparelho entrou.

---

## Segurança — por que o RLS é uma policy aberta

O app **não tem autenticação**. A saída mais simples, e suficiente pra uma mesa
de amigos, é: RLS ligado em todas as tabelas (`rooms` mais as nove filhas),
com uma policy **`for all` que libera leitura e escrita pro papel `anon`**
(ver o fim de [`0001_inicial.sql`](supabase/migrations/0001_inicial.sql) —
tabela nova segue o mesmo padrão, incluindo o `grant` explícito pro `anon`
quando não nasce com "Automatically expose new tables" marcado).

Na prática: **quem tem o link e o código da sala lê e escreve as linhas daquela
sala.** É a mesma confiança que o grupo já tem entre si na mesa física. Não se
guarda nada sensível aqui — PV, condições e anotações de RPG. As notas do Mestre
ficam "privadas" só no cliente (o painel não as mostra a quem entrou como
jogador); não é segredo criptográfico, é combinado entre amigos.

A chave `anon` do Supabase é **pública por natureza** — vai no bundle do
navegador. Ela não é o segredo; o "segredo" é o código da sala não ser divulgado.
As campanhas da lista `CAMPANHAS` (ver acima) aparecem pra qualquer um que abra
o app — do mesmo jeito que a `setimo-raio` sempre esteve aberta pra quem tem o
link do deploy.

Se um dia a mesa quiser isolamento de verdade, o caminho é adicionar auth do
Supabase (magic link, sem senha) e trocar as policies por filtros que amarrem
`room_code` a quem está logado.

---

## Publicar (passos do Daniel, fora do Claude)

Pré-requisito: `gh auth login` e `vercel login` já feitos.

1. **GitHub** — criar o repositório e subir:
   ```bash
   gh repo create painel-de-mesa --private --source=. --remote=origin --push
   ```
2. **Supabase** — criar um projeto novo (conta separada do gb-reserva, plano
   gratuito). Em *Project Settings → Data API*, copiar **Project URL** e a chave
   **anon / public**.

   O plano gratuito é mais que suficiente pra uma mesa (500 MB de banco, muito
   acima do que fichas de RPG ocupam). A única pegadinha: **projeto sem uso por
   ~1 semana pausa sozinho.** Como a mesa não joga todo dia, antes de uma sessão
   depois de um tempo parado, abra o painel do Supabase e clique em
   *Restore/Unpause* — leva menos de um minuto e evita surpresa em cima da hora.
3. **Migrations** — no *SQL Editor* do Supabase, rodar cada arquivo de
   [`supabase/migrations/`](supabase/migrations/) em ordem, de `0001` até o
   mais recente (o cabeçalho de cada um diz depois de qual rodar), e por
   último [`supabase/seed.sql`](supabase/seed.sql).
4. **Realtime** — cada migration que precisa já faz o próprio
   `alter publication`. Confirmar em *Database → Replication* que todas as
   tabelas da sala (`characters`, `combat_state`, `dm_notes`, `diario`,
   `bastiao`, `bastiao_instalacoes`, `bastiao_log`, `npc_templates`,
   `combat_log`) estão na publicação `supabase_realtime`.
5. **Vercel**:
   ```bash
   vercel link
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   vercel --prod
   ```
   (adicionar as duas variáveis nos três ambientes: Production, Preview e Development.)

Depois é só mandar o link pra mesa. Pro grupo, a URL pode ser a raiz mesmo — a
sala `setimo-raio` abre pra quem ainda não entrou em nenhuma campanha, e cada
um escolhe a sua na tela de entrada.
