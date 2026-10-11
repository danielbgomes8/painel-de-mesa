# Mapas: cena, névoa, peões, régua, áreas, desenhos e palco

> Parte do `AGENTS.md` (dividido em 09/10/2026; o texto é o mesmo de antes, só mudou de lugar). **Leia quando:** Antes de mexer em qualquer coisa do mapa (CenaMapa, PainelMapa, desenharCena).

## Mapas com névoa de guerra (01/10/2026, migration `0018_cenas.sql`, já rodada)

O Daniel pediu "algo como o Roll20 faz pra mapa". Quatro etapas combinadas; a
**1 está construída** (cena + grade + névoa ao vivo + telão + celular), a **2
está completa** (ping, peões, régua e condições como ícone no peão), a **3 está
construída** (paredes, portas e visão automática; migration `0021`) e a **4 está
completa** (modelos de magia, desenhos e notas no mapa; migration `0022`). Prioridade dita pelo Daniel em 01/10: **o ping é
essencial; peão é "bom ter"** (a mesa não vai usar muito):

1. **Cena** — subir o mapa, grade, zoom/arrastar, névoa ao vivo, vários mapas,
   telão e celular. *(feito, ver abaixo)*
2. **Peões** — nascem das fichas e da iniciativa, anel na vez de quem joga,
   jogador move o próprio peão, peão oculto, condições como ícones, régua em
   metros, ping.
3. **Paredes e visão** — o Mestre desenha paredes/portas e a névoa abre sozinha
   pelo que cada peão enxerga. A parte mais pesada.
4. **Extras** — desenhos, modelos de magia (cone/esfera/linha), notas no mapa.

Decisões que não estão no código à primeira vista:

- **A névoa esconde NA TELA, não no banco.** O mapa inteiro está no Storage e as
  pinceladas no Postgres, legíveis por qualquer aparelho — igual NPC oculto e PV
  de inimigo já eram. O Daniel escolheu isso (01/10) sobre "segredo de verdade"
  (o Mestre mandar só uma imagem já com o preto aplicado): peões que o jogador
  move e visão automática exigem que cada aparelho calcule o que aparece, e sem
  servidor não há como esconder o dado. **Não "consertar" achando que é falha.**
- **Tabelas:** `cenas` (imagem, grade, `na_mesa`, `camera`, `nevoa_ligada`) e
  `cena_nevoa` (uma linha por pincelada: `revelar`/`esconder` × `retangulos`/
  `pincel`, em ordem por `seq`). Só UMA cena por sala fica `na_mesa` (índice
  único parcial): trocar = tirar a antiga e pôr a nova, nessa ordem
  (`mandarParaMesa`). Desfazer = apagar a pincelada mais nova.
- **Coordenadas são sempre px da IMAGEM da cena**, nunca da tela. Os retângulos
  da névoa não dependem da grade: recalibrar a grade depois não desloca o que já
  foi revelado (o teste confere).
- **`replica identity full` nas duas tabelas** (migration): sem isso o
  apagamento (desfazer, cobrir tudo, tirar da mesa) não chega nos outros
  aparelhos com o canal filtrado por sala — a limitação das outras tabelas
  ("o tempo real não entrega apagamento feito em outro aparelho").
- **`useCenas`/`useNevoa` têm canal próprio, fora do `useSala`**, pra um problema
  de mapa nunca derrubar o combate. O código vai ao ar **antes** do SQL: se as
  tabelas não existem (`ehTabelaAusente`), o app abre normal, o Mestre vê na aba
  Mapa "falta rodar a migration 0018" e o jogador nem vê a aba. Testado
  consultando o app sem as tabelas. A aba Mapa do jogador só aparece quando há
  cena na mesa (`naMesa`).
- **A imagem é reduzida no aparelho** (`lib/imagem.ts`): no máximo 3000 px, JPEG,
  alvo de 3,5 MB (o bucket recusa mais de 8 MB). O cliente do Supabase dava só
  10 s por pedido (`fetchComPrazo`); pro Storage agora são 90 s, senão o envio
  de um mapa no 4G era cortado no meio.
- **Telão com mapa:** o mapa ocupa a tela e a vez vira uma faixa embaixo (mesma
  regra de privacidade de antes: NPC não revelado continua "Inimigo N", e PV de
  NPC nunca aparece). O telão e os celulares enquadram a `camera` que o Mestre
  definiu ("levar a mesa pra esta visão"); jogador pode dar zoom e voltar com
  "voltar à visão da mesa".
- **Backup:** `cenas` e `cena_nevoa` entram no backup DIÁRIO bruto (a imagem também,
  desde 02/10/2026) e **não** no botão "backup" do Mestre. O Mestre ainda deve guardar
  o arquivo original do mapa (o app reduz a imagem ao subir).
- **Lint:** o projeto proíbe `setState` dentro de efeito (`react-hooks/set-state-in-effect`).
  Os hooks derivam o valor (estado guarda a cena a que pertence) em vez de
  zerar no efeito; ver `useNevoa`.
- **Como testei o canvas sem o banco** (e como refazer): uma página provisória
  (`src/app/mapa-teste/`, apagada depois) com imagem desenhada no próprio
  canvas e névoa em memória. Toque de verdade não existe no navegador de teste:
  dá pra disparar `PointerEvent` no `<canvas>` com `pointerType: 'touch'` e dois
  `pointerId` (stub de `Element.prototype.setPointerCapture`, que recusa id
  inventado). Conferido assim: pinça dá zoom, e **o segundo dedo cancela a
  pincelada em andamento** (não deixa tinta); um dedo pinta. Pra testar o envio
  de arquivo: montar um `File` do canvas e pôr num `DataTransfer` no `input.files`.
- Limites: o banco recusa pincelada com mais de ~32 KB (o app simplifica o traço
  pra no máximo 400 pontos e 600 retângulos); a névoa é lida em páginas de 1000.
- **A política de segurança do site bloqueava as imagens** (`next.config.ts`,
  `img-src 'self' data: blob:`): o mapa subia, a cena era criada e o canvas dizia
  "não deu pra carregar" — só no navegador, nunca nos testes automáticos. Hoje o
  `img-src` libera o host do Supabase (o mesmo do `connect-src`). **Recurso novo
  que busque coisa de outro endereço tem de entrar na CSP**; conferir sempre no
  navegador, com o servidor reiniciado (cabeçalho só muda no `next dev` novo).
- **Conferido de ponta a ponta em 01/10/2026** (sala `teste-ui`, depois apagada,
  Storage vazio): imagem de 5000×3333 reduzida pra 3000×2000; pincelada gravada;
  mapa na mesa; **telão** com o mapa e a faixa da vez; **jogador** a 375px vê a
  aba Mapa só enquanto há mapa na mesa (some ao vivo quando o Mestre tira);
  **tempo real**: INSERT e DELETE de pincelada (inserido e apagado direto pela API
  REST com o telão em primeiro plano — isso isola do releitura por
  `visibilitychange`, que também atualiza a aba ao voltar pra frente); grade,
  câmera da mesa, cobrir/revelar tudo; apagar cena remove o arquivo do Storage.
- **Armadilhas do navegador de teste:** (1) `focus()`/`blur()` por script **não**
  disparam `onFocus`/`onBlur` do React (a janela de teste não tem foco): o campo
  parecia gravar e não gravava — usar clique e digitação reais (`triple_click`,
  `type`, `Tab`). (2) A identidade fica no `localStorage`, então **trocar de
  Mestre pra jogador numa aba troca nas outras abas do mesmo navegador** (evento
  `storage`); a aba que mudou não se atualiza sozinha, é preciso recarregar.
  (3) `window.confirm` trava a ferramenta: sobrescrever por `() => true` antes de
  tocar em "cobrir tudo", "revelar tudo" e "apagar cena".
- **Ping** (`lib/ping.ts`, `hooks/usePing.ts`, sem migration): segure o dedo
  parado ~450 ms no mapa (ou Shift+clique no notebook, ou a ferramenta "📍 ping"
  do Mestre) e a mesa vê um pulso com o nome de quem apontou, no telão e nos
  celulares. **Não grava nada**: viaja pelo canal de transmissão do Supabase
  Realtime (`broadcast`, um canal `ping:<cena>`) e some em 3,6 s. Tudo que chega
  passa por `validarPing` (ponto dentro do mapa, nome cortado em 30, cor só da
  paleta — o canal é aberto), com freio de 1 ping por 700 ms por aparelho. O
  telão só recebe. **Cor de cada jogador** = posição da ficha entre as dos
  jogadores da sala (`corDoJogador`, a mesma do peão): nunca repete até 9
  jogadores, ao contrário de sortear pelo nome; Mestre é dourado. Ping fora da
  parte visível vira uma seta na borda. O gesto: mexer o dedo mais de 10 px antes
  de completar o toque longo cancela (é arrasto); o segundo dedo cancela e vira
  pinça. **Testado** com PointerEvent sintético: arrasto cancela, dois dedos não
  pingam, tremidinha de 4 px ainda pinga, toque rápido não pinga, Shift pinga na
  hora. **Armadilha de teste:** a captura de tela sai logo depois do comando; um
  `setInterval` que só dispara 1 s depois faz o pulso "não aparecer" (perdi uns
  vinte minutos nisso) — espere antes de capturar, ou conte `arc()` no canvas.
  Também: o canvas fica "contaminado" (imagem de outro endereço), então
  `getImageData` nele falha — normal, não é bug.
- **Aviso "Tem um mapa na mesa"** (`BannerMapaNaMesa.tsx`): faixa pro jogador
  quando há mapa na mesa e ele não está na aba Mapa. `mapaVisto` guarda o id do
  último mapa que a pessoa viu (abrir ou SAIR da aba conta); trocar de mapa faz
  o aviso voltar; ✕ dispensa. Uma vibração curta, sem som.
- **Peões** (migration `0019_pecas.sql`, `lib/pecas.ts`, `hooks/usePecas.ts`):
  tabela `cena_pecas` (x, y = CENTRO em px da imagem; `slug` liga à ficha, nulo =
  marcador avulso com nome/cor próprios; índice único (cena, slug): uma ficha, um
  peão por cena). **Nome, cor e "inimigo revelado" vêm da ficha, não são
  copiados** — revelar o NPC na ficha revela o peão. Regras: o Mestre move todos,
  o jogador só o da própria ficha; peão **oculto** ou **sob a névoa** não aparece
  pra mesa (checa o canvas da névoa no centro do peão, com cache), exceto o do
  próprio jogador; NPC não revelado é "?" vermelho pra jogador (e PV nunca
  aparece); o anel dourado é a vez da iniciativa; encaixa no centro do
  quadradinho (peão de tamanho par, no cruzamento das linhas). "Pôr o grupo" e
  "pôr os inimigos da iniciativa" (esses entram ocultos) ficam na seção Peões do
  Mestre; o jogador tem "pôr meu peão no mapa". Arrastar peão só vale com a
  ferramenta mover; arrastar fora de peão arrasta o mapa. Sem a tabela, a seção
  diz "falta rodar a migration 0019" e o resto do mapa funciona. Conferido em
  01/10/2026 com a migration rodada: o robô de tela cobre pôr o grupo/inimigos,
  inimigo entra oculto, tocar de novo não duplica, revelar, tamanho e "pôr meu
  peão"; e um script de verificação (apagado) tirou fotos a 375px e **arrastou um
  peão com o mouse na aplicação de verdade** (saiu de 435,285 pra 615,405,
  encaixado no centro do quadradinho). **Defeito achado nas fotos:** "pôr o
  grupo" e depois "pôr os inimigos" caíam todos no mesmo lugar, um peão em cima
  do outro (o arrasto pegava o de cima). Hoje `posicoesIniciais` recebe os lugares
  ocupados e desce/sobe a fileira até achar trecho livre (testado). **Um bug
  desses não aparece em teste de regra: olhe a foto.**
- **Régua em metros** (`lib/regua.ts`, sem migration): ferramenta "📏 régua" do
  Mestre e botão "📏 medir" do jogador; arrastar de um ponto a outro mede e a
  MESA INTEIRA vê a linha com a medida por ~7 s (mesmo canal de transmissão do
  ping, evento `regua`). A conta usa os dois números da cena (`grade_px` e
  `metros`, em "Grade e névoa"), sempre em px da imagem, então o zoom não entra.
  **Regra conferida no texto bruto das Regras Gratuitas 2024 ("Playing on a
  Grid", seção Movimento e Posição)** — o resumo automático da página disse que
  não havia regra de diagonal, e o texto bruto tem: *"It costs 1 square of
  movement to enter an unoccupied square that's adjacent to your space
  (orthogonally or diagonally adjacent)"* e o alcance se conta "pelo caminho mais
  curto" a partir de um quadrado vizinho. Logo, **na grade a diagonal vale 1
  quadrado** (distância = maior diferença entre colunas e linhas; pontos encaixam
  no centro do quadradinho) e não existe a variante 5-10-5 nessa edição. O
  segundo modo, "em linha reta", é a distância euclidiana (um quadrado na
  diagonal = 1,4); com a grade desligada o modo grade vira reta sozinho. Cada
  quadrado vale 5 pés = 1,5 m por padrão e a velocidade se converte dividindo
  por 5 (9 m = 6 quadrados). **Começar a medida em cima de um peão leva o
  deslocamento da ficha**: a etiqueta diz "cabe nos 9 m" ou "passa 3 m dos 9 m"
  (só pra quem pode mexer naquele peão — o deslocamento de inimigo é do
  Mestre). O pacote que viaja NÃO leva a distância: quem recebe refaz a conta com
  a grade da própria cena (`validarRegua`), então ninguém mostra número falso na
  mesa. Etiqueta em duas linhas e letra que encolhe: com nome + "passa 3 m dos 9
  m" ela passava da largura de um celular (achado na foto). Conferido pelo robô
  (o canvas não tem texto no DOM: o robô espia `fillText`): 5 quadrados = 7,5 m,
  diagonal de 3 = 4,5 m, em reta 4,2 quadrados = 6,4 m, e o jogador vê o mesmo.
- **Condições no peão** (`ICONE_CONDICAO` em `lib/condicoes.ts`, `iconesDaPeca` /
  `iconesVisiveis` / `posicoesDosIcones` em `lib/pecas.ts`, `desenharIcones` em
  `lib/desenharCena.ts`, `LegendaIconesPeao.tsx`; sem migration): cada condição
  ligada na ficha vira uma bolinha colorida com emoji sobre a borda do peão
  (começa no alto à direita e vai pra esquerda por cima, sem encostar uma na
  outra); exaustão é 😫 com o nível pequeno no canto; no máximo 4 bolinhas — com
  mais, 3 e um "+N". Vale pro telão, celulares e Mestre, porque vem da ficha (a
  mesma fonte da iniciativa): mudar a condição em qualquer lugar muda o peão ao
  vivo. **Privacidade igual à da ordem de iniciativa e do telão:** condição de
  inimigo aparece pra todos ("Um inimigo ficou Atordoado" já está no log), mas
  **jogador a 0 PV ganha 💤 Inconsciente e inimigo a 0 PV não** (o PV dele é do
  Mestre); peão oculto ou sob a névoa continua sem aparecer, ícones inclusive
  (o robô confere que o ícone do dragão oculto é desenhado pro Mestre e NÃO pro
  jogador). Nome estranho gravado em `cond` não vira ícone. O tamanho da
  bolinha acompanha o peão (38% do raio), com piso de ~7 px na tela e teto de
  55% do raio. **A legenda ("O que significam os ícones nos peões") fica
  recolhida embaixo do mapa** e só explica o desenho — não lista peão nenhum,
  senão entregaria quem está oculto. Não dá pra tocar num peão alheio pra ver a
  condição (o toque só pega peão que a pessoa pode mover): por isso a legenda.
  O emoji depende da fonte do aparelho (Emoji 12 ou mais; nada baixa). Se um dia
  algum ficar igual a outro, o teste de `condicoes.test.ts` confere que os 15
  emojis são distintos.
- **Modelos de magia** (`lib/area.ts`, `ControlesDeArea.tsx`, `desenharAreas` em
  `lib/desenharCena.ts`, evento `area` do canal `ping:<cena>`; sem migration):
  botão "✨ área" do Mestre (ao lado do ping e da régua) e do jogador (ao lado de
  "📏 medir"). Escolhe cone, esfera, cubo ou linha, o tamanho em metros (botões
  prontos + um campo "outro") e, na linha, a largura; arrasta no mapa e a MESA
  INTEIRA vê a figura por 9 s, com o nome de quem marcou ("Mestre: Esfera · raio
  6 m"). **Formas conferidas no texto bruto do Rules Glossary das Regras
  Gratuitas 2024** (Area of Effect, Cone, Cube, Line, Sphere): o cone tem largura
  igual à distância da ponta (é um triângulo de base = comprimento); o cubo parte
  do MEIO de uma face e o tamanho é o lado; a esfera tem a origem no CENTRO e o
  tamanho é o raio (o cilindro, visto de cima, é o mesmo círculo); a linha leva
  comprimento e largura (1,5 m = 5 pés é o comum). A origem encaixa no
  CRUZAMENTO da grade (a regra põe a origem num ponto, e o canto de quadradinho é
  onde as mesas põem); a direção é livre. Esfera vale com um toque (o centro segue
  o dedo); cone, cubo e linha precisam de arrasto — um toque simples não conta,
  como na régua. Como na régua, **o pacote leva metros, não pixels**: quem recebe
  converte pela grade da PRÓPRIA cena (`formaNoMapa`), então zoom e tamanho de tela
  não entram na conta e ninguém manda figura de tamanho falso; forma, tamanho,
  pontos e cor passam por `validarArea`. **Cada pessoa tem uma figura por vez**
  (`adicionarArea` troca a anterior dela): empilhadas, as etiquetas ficavam umas
  por cima das outras (achado na foto). A figura é desenhada em coordenadas do
  mapa (cobre o que cobre de verdade em qualquer zoom), abaixo de pings e réguas
  e acima dos peões; não esconde nem revela nada, então vale também sobre névoa.
  A emanação de 2024 (a área que acompanha uma criatura) veio depois, como aura no peão
  (ver "Aura no peão" abaixo), e a **contagem de criaturas na área** também: abaixo.
  **Contagem na área** (02/10/2026, sem migration; `areaToca`/`contagemNaArea`/
  `rotuloDaContagem` em `lib/area.ts`, linha a mais na etiqueta em `desenharAreas`): a
  etiqueta diz "2 criaturas" (ou "1 criatura", "ninguém"). **Regra combinada com o Daniel:
  só conta quem a MESA enxerga** — peão oculto e peão sob a névoa NÃO entram no número, e o
  número é o mesmo em todo aparelho (cada um conta com os dados da própria tela, então um
  número diferente entre aparelhos entregaria alguém). **O Mestre, e só ele, vê à parte
  "(+1 oculto)"** (`rotuloDaContagem(…, mestre)`; a mesa nunca vê o "+" nem a palavra
  "oculto" — o robô confere). Entra quem tem QUALQUER PARTE do espaço dentro da área (regra do
  D&D): o círculo do espaço da criatura (`PecaNaTela.espacoPx` = metade do lado × tamanho, não
  o diâmetro desenhado, que é 12% menor) é testado contra o círculo da esfera ou o polígono de
  cone/cubo/linha (dentro, ou a distância ao lado ≤ raio). Vale também na prévia enquanto se
  arrasta, pra quem conjura ver quantos pega antes de soltar. Sem nenhum peão no mapa a linha
  não aparece (nada de "ninguém" em mapa sem peões).
  A etiqueta da régua foi extraída pra `desenharEtiqueta` e as duas usam a mesma.
  O robô marca as quatro formas e confere pelo `fillText` que Mestre e jogador
  veem "Mestre: Cone · 9 m" etc.; **a barra de tamanhos muda de altura conforme a
  forma e empurra o mapa — o robô mede a posição do canvas a cada arrasto**.
- **Desenhos e notas** (02/10/2026, migration `0022_marcas.sql`, rodada e conferida;
  `lib/marcas.ts`, `hooks/useMarcas.ts`, `MarcasDoMapa.tsx`, `desenharMarcas` em
  `lib/desenharCena.ts`, ferramenta "✏️ desenhar"). Combinado com o Daniel: **só o
  Mestre desenha e anota, e fica gravado na cena** (como as paredes; ao contrário
  do ping e da régua, que somem). Uma tabela só, `cena_marcas`: `tipo` `traco`
  (`pontos`, lista de [x, y] em px da imagem; a linha reta tem dois) ou `nota`
  (`x`, `y`, `texto` de até 140). Seis modos: livre, linha, círculo, retângulo, nota,
  apagar; seis cores. **Círculo e retângulo (02/10/2026, sem migration) são `traco`
  fechado**: o retângulo guarda cinco pontos (o quinto repete o primeiro) e o círculo
  um polígono de 64 lados (`circuloDe`/`retanguloDe` em `lib/marcas.ts`) — assim
  lista, borracha (pega pela BORDA, não pelo meio), backup e desenho já funcionavam.
  O círculo se arrasta do centro até a borda; o retângulo, de canto a canto; a prévia
  acompanha o dedo (`CenaMapa` refaz os pontos a partir da `origem` a cada movimento —
  no círculo `pontos[0]` NÃO é o centro). Toque sem arrasto não vira forma. Não dá pra
  saber depois que um traço era "um círculo": se um dia precisar editar a forma, aí
  sim vira tipo novo (e migration);
  e **cada marca tem `visivel`** — "🔒 só eu vejo" é preparo de sessão: o Mestre vê
  tracejado e apagado, a mesa e o telão não veem (esconde NA TELA, como a névoa e as
  paredes). O traço livre é simplificado antes de gravar (`simplificarDesenho`, o
  mesmo Douglas-Peucker das paredes, tolerância de 1 px da TELA, então desenhar com
  zoom guarda mais detalhe; teto de 400 pontos que o banco também cobra). Ficam
  **por baixo da névoa**: o que está num canto ainda coberto continua coberto pra
  mesa. A nota é uma bolinha numerada no mapa e o TEXTO vai numa lista (DOM) embaixo
  do mapa: texto longo não cabe no canvas do celular. A numeração é pelo que **cada
  um enxerga** (`notasNumeradas` recebe marcas já filtradas): a mesa vê 1, 2, 3 sem
  buraco onde há nota escondida, então liberar uma nota renumera as da mesa. No telão
  a lista é um cartão sobre o canto do mapa (cor fixa: a do tema herdada sumia sobre
  o mapa escuro — achado na foto). Um toque simples não é desenho (mínimo de 6 px
  de arrasto); a nota só nasce ao SOLTAR sem arrastar. Limite de 300 marcas por cena.
  Tabela ausente é tolerada (a ferramenta some e a seção diz "falta rodar a 0022").
  Entrou em `TABELAS_COM_SALA` do backup, na ordem de restauração e no robô de
  esquema. O robô (`desenhos e notas`) confere traço, linha, toque que não desenha,
  nota escondida × liberada, o que o jogador e o telão veem, a liberação ao vivo e a
  borracha, a edição do texto e o mover do alfinete. **Notas se editam (02/10/2026):**
  na lista da seção "Desenhos e notas" cada nota tem "editar" (o texto), "mover" (espera
  um toque no mapa, que reaproveita a ferramenta "colocar" dos peões, e prende o
  alfinete dentro da imagem), "👁/🔒" e "apagar". Só a nota muda de lugar ou de texto;
  **Desenho se edita desde 02/10/2026 (sem migration), no modo "✋ editar"**: tocar num traço, círculo
  ou retângulo o seleciona e já o arrasta (mover); a caixa branca tem duas alças, o quadradinho do
  canto de baixo à direita (redimensiona, em torno do centro) e a bolinha acima do topo (gira). Cor,
  "👁 a mesa vê / 🔒 só eu vejo" e "apagar desenho" são botões. **Tudo é conta sobre os mesmos pontos**
  (`moverPontos`/`escalarPontos`/`girarPontos`/`manterNoMapa` em `lib/marcas.ts`, testadas): o círculo é
  um polígono de 64 lados e o retângulo, cinco pontos, então escalam e giram sem tipo novo nem migration.
  O gesto só aparece na tela enquanto o dedo está na tela (`editandoMarca` em `CenaMapa`); os pontos vão
  ao banco UMA vez, ao soltar (`marcas.atualizar(id, { pontos })`, só a coluna), e um toque sem arrastar
  (menos de 3 px) só seleciona. `manterNoMapa` empurra o desenho de volta pra dentro da imagem (e encolhe
  se for maior que ela); o lado mínimo é 12 px. Nota não entra aqui: ela se edita na lista embaixo do mapa.
  **O painel de edição fica ABAIXO do mapa e só existe com um desenho selecionado.** A primeira versão o
  punha acima: ao selecionar, o mapa descia ~44 px no meio do toque e o "toque" virava um arrasto que
  empurrava o desenho — o robô pegou (`e2e/editarDesenho.e2e.ts` confere que o mapa não muda de lugar).
- **Aura no peão** (02/10/2026, migration `0023_aura_peao.sql`, rodada e conferida;
  `raioDaAuraPx`/`auraValida` em `lib/pecas.ts`, `ControleDeAura` em `CartaoDoPeao.tsx`,
  halo em `desenharPecas`). É a **emanação** do D&D 2024: área que parte de uma criatura,
  se estende em volta dela e anda junto. Decisões do Daniel: **liga o Mestre (em qualquer
  peão) e o jogador (no próprio peão — o app não sabe quem tem magia de aura, então todo
  jogador pode), e fica ligada até desligar** (não some sozinha, ao contrário do ping, da
  régua e da área de magia). Uma coluna só, `cena_pecas.aura` (metros, 0,1 a 120, nulo =
  sem; o banco também cobra): ligar, mudar e desligar é um `update` só dessa coluna e chega
  nos outros aparelhos pelo canal que já existia. **O raio é contado a partir da BORDA do
  espaço da criatura** (`tamanho × lado / 2` + a distância, como o D&D mede), não do centro:
  3 m num peão médio de 30 px/quadrado dão 15 + 60 = 75 px. Desenhada por **baixo de todos
  os peões**, translúcida, na cor do peão, com contorno tracejado de largura fixa na tela, e
  acompanha o peão até durante o arrasto. **Segue a visibilidade do peão**: peão oculto ou
  sob a névoa não mostra a aura pra mesa (entregaria a posição); o Mestre vê a de peão
  oculto mais apagada. Raios prontos de 1,5 / 3 / 4,5 / 6 / 9 m (4,5 m = os 15 pés de
  Guardiões Espirituais), campo "outro (m)" que aceita vírgula e tocar de novo no raio
  ligado desliga. Círculo (a forma 2024 numa grade desenha-se redonda), não o quadrado da
  régua em grade. O robô (`aura.e2e.ts`) espia `arc()` no canvas — cada quadro começa no
  `fillRect(0,0)` do fundo — pra ler os raios DESENHADOS no Mestre e no jogador, e confere a
  de peão oculto, o mover, "outro" com vírgula, o limite e desligar. Lição de teste: **raios de teste iguais mascaram o que se quer provar** — a aura de 6 m do
  jogador tinha o mesmo raio da armadilha oculta (135) e a checagem seria vazia; use valores
  distintos.
- Medido: a primeira abertura do app cresceu ~31 KB sem compactar com o código
  do mapa (estático em `Painel`). Se pesar, dá pra carregar `PainelMapa` sob
  demanda como o catálogo de monstros (`import()` dinâmico).

## Palco do mapa: layout novo (08/10/2026, sem migration)

O Daniel achou o painel do mapa complexo (9 ferramentas numa fileira, 5 seções recolhíveis, tudo com o mesmo peso). O layout foi
validado num protótipo (Artifact) antes de portar — **mostrar o arranjo antes de portar** continua valendo. Nenhuma regra mudou:
só a apresentação dos controles. Os estados, o `CenaMapa` e os hooks são os de antes.
- **Peças**: `PalcoDoMapa.tsx` (casca visual: mapa em tela cheia, barra de ícones à esquerda, painel flutuante com as opções da
  ferramenta ativa, zoom embaixo, ping como botão grande, dica curta que some em ~6 s), `IconesMapa.tsx` (ícones de traço),
  `PainelMapaPaineis.tsx` (o conteúdo de cada painel: as antigas seções e barras de opções, movidas quase sem mudar) e `PainelMapa.tsx`
  (estado e lógica; `EditorDoMestre` e `VisorDaMesa`). O telão não usa o palco: `VisorDaMesa telao` devolve só o `CenaMapa`.
- **Mestre**: **Preparar × Jogar** (`fase`; sem escolha segue o mapa: na mesa = Jogar). Jogar: Mover, Névoa, Medir, Desenhar, Peões.
  Preparar: Mover, Névoa, Paredes e portas, Peões, Desenhar, Cena e grade. (A névoa ficou nas duas fases: preparar a sessão inclui
  pré-revelar a entrada — decisão minha em cima do protótipo, que só tinha 5 ícones em Preparar.) O botão de baixo à esquerda com
  o alvo ("A mesa") abre o painel da visão da mesa (levar a câmera, tirar o mapa da mesa). "levar a mesa pra este mapa" fica no
  canto de cima enquanto o mapa não está na mesa. **Jogador**: só Mover e Medir (régua ou área de magia), mais o ping.
- **Ícone → ferramenta do `CenaMapa`** (`ferramentaMapa` em `EditorDoMestre`): Névoa = pincel/retângulo/quadradinhos (escolha dentro do
  painel), Medir = régua/área, Desenhar = marca, Paredes = parede, Peões/Mover/Cena/A mesa = mover; esperando "onde eu toco" = colocar.
  Tocar no ícone já ativo abre/fecha o painel; no celular (< 700 px) tocar no mapa fecha o painel (ele cobre boa parte do mapa).
- **Painel não repete texto da dica**: o aviso "Toque no mapa no lugar onde…" vive só na dica flutuante (dois `role=status` iguais
  confundem leitor de tela e o robô, que acusa texto duplicado).
- **Robô**: botões antigos ("🧱 paredes", "✏️ desenhar", "✨ área", seções "Peões"/"Paredes e visão") não existem mais. `e2e/apoio.ts` tem
  `abrirFerramenta(page, "Paredes e portas", "preparar")`, `escolherNoPainel`, `fecharPainelDoMapa` (o painel cobre o canto de cima
  do mapa: quem vai tocar no mapa fecha antes) e `abrirMesa`.

## Luzes que acabam e armadilhas (11/10/2026, migration `0036_luzes_e_armadilhas.sql`, rodada e conferida)

O Daniel escolheu dois itens de uma lista de ideias novas: "cronômetro e luz da tocha" e "armadilhas no mapa". Decisões dele: **o Mestre
passa o tempo** (botões, não relógio real); **a luz que acaba encolhe a visão do portador**; **a armadilha avisa só o Mestre**.
(A migration nasceu como 0033 e foi renumerada pra 0036 no rebase: outra sessão já tinha usado 0033 a 0035. Rodada no banco com o
nome de antes; o conteúdo é o mesmo.)

- **Luzes** (`lib/luzes.ts`, `components/LuzesDoMapa.tsx`, ferramenta 🔥 "Escuridão e luzes"). Moram no peão, em três colunas de
  `cena_pecas`: `luz_nome`, `luz_alcance` (m, claro + penumbra) e `luz_minutos` (restante; **nulo = não acaba**, 0 = apagada). No tipo
  `Peca` é um objeto só (`luz`), e `colunasDaLuz`/`lerLuz` traduzem; **o robô de esquema lista as três colunas à mão** (`Omit<Peca, "luz">`).
  `cenas.escura` liga o **mapa escuro**: com a visão automática, `montarPecasNaTela` põe `visaoPx` em cada peão de jogador (luz acesa =
  o alcance dela; apagada ou sem luz = `RAIO_NO_ESCURO_M`, 1,5 m) e o `CenaMapa` usa `x.visaoPx ?? alcance da cena` em `recomporNevoa`.
  **Inimigo não entra** (monstro costuma ter visão no escuro): `visaoPx` dele é sempre nulo. Mapa claro: `visaoPx` nulo, a luz só conta o tempo.
  Valores prontos conferidos no SRD 5.2 (open5e `srd-2024`): tocha 20+20 pés = 12 m por 1 h; vela 3 m por 1 h; lamparina 13,5 m e lanterna
  coberta 18 m por 6 h; luz do dia 36 m por 1 h. **Passar o tempo** escreve só as colunas da luz de cada peão (`definirLuzes`, em paralelo,
  volta tudo se uma falhar), loga "⏳ Passaram X" e "🔥 Tocha de Ana apagou". **Desfazer devolve a luz de ANTES** (guardada no clique), não soma
  minutos de volta: a luz que parou em 0 teria gasto menos que o clique. Só devolve se a luz ainda está como o clique deixou.
  A mesa e o telão veem "Tocha de Ana — faltam 40 min" (`LuzesNaMesa`): só luz de jogador ou de marcador visível, nunca de inimigo.
- **Armadilhas** (`lib/armadilhas.ts`, `hooks/useArmadilhas.ts`, `hooks/usePisadas.ts`, `components/ArmadilhasDoMapa.tsx`, ferramenta ⚠️).
  Tabela `cena_armadilhas`; estados `armada` (escondida, vigia) → `revelada` (a mesa vê, ainda vigia) → `disparada` / `desarmada` (a mesa
  vê, não vigia mais); o Mestre pode rearmar. **Esconde NA TELA**, como a névoa e as paredes (`armadilhasVisiveis`). A zona é um círculo
  (`raio` em metros, padrão 0,75 m = o quadradinho: o vizinho a 1 quadradinho NÃO pisa; criatura grande pisa pelo espaço que ocupa).
  **Pisar = ENTRAR** na zona (`avaliarPisadas`): a primeira conferência só aprende o terreno, armadilha nova e peão novo não avisam de quem
  já estava em cima, e quem continua lá não avisa de novo. O aviso é só do Mestre (`AvisosDePisada`, acima do palco): rolar o dano
  (`rolarDanoDoTexto`, soma cada `NdM+K` do texto), **disparar** (a mesa passa a ver, log "⚠️ Ana caiu em…"), **desarmar** ou **deixar passar**
  (continua escondida). `usePisadas` ajusta o estado durante a renderização, não em efeito: o lint proíbe `setState` em `useEffect`.
  **Limite conhecido: o aviso só aparece com a aba Mapa do Mestre aberta** (é ela que lê os peões e as armadilhas).
- **Robô** `e2e/luzesEArmadilhas.e2e.ts`: tocha de ponta a ponta (dar, passar, avisar a mesa, apagar, desfazer, tirar); mapa escuro lendo a
  máscara `cenas.explorado` (com a tocha explora >60 células; apagada, o peão longe descobre <25; **conferido que falha** com a visão por luz
  desligada); armadilha escondida (arco de raio 90 só no canvas do Mestre — valor que nenhum outro desenho usa), aviso, rolar, deixar passar,
  disparar, rearmar, revelar, desarmar, editar, apagar. Entra em `limparSala` e no backup bruto (`cena_armadilhas`).
- **Não cobre**: a luz de um peão iluminando os vizinhos (cada um vê só a própria luz), luz que muda de cor/forma (cone), armadilha que
  dispara sozinha, aviso com a aba Mapa fechada, devolver a luz ao desfazer a saída de um inimigo da iniciativa.
