# Paredes, portas, visão automática e importação

> Parte do `AGENTS.md` (dividido em 09/10/2026; o texto é o mesmo de antes, só mudou de lugar). **Leia quando:** Antes de mexer em paredes, visão, importação de paredes — e antes de pensar em "detectar paredes sozinho" (foi removido de propósito).

- **Paredes, portas e visão automática** (migration `0021_paredes.sql`,
  `lib/paredes.ts`, `lib/visao.ts`, `hooks/useParedes.ts`, seção "Paredes e visão"
  do Mestre, ferramenta "🧱 paredes"). O Mestre desenha **paredes** e **portas**
  (segmentos, em px da imagem; modos parede / curva / porta / cômodo = 4 paredes de uma
  vez / apagar; as pontas encaixam na ponta de outra parede perto — sem fresta nos
  cantos — ou, senão, no cruzamento da grade; no máximo 400 por cena). Com a "visão
  automática" ligada na cena (`cenas.visao_ligada`, desligada por padrão: cena velha
  não muda), **cada aparelho** calcula o que o grupo enxerga e a névoa se abre
  sozinha: de cada peão de JOGADOR (`PecaNaTela.observa`) saem raios até a primeira
  parede/porta fechada ou até o alcance (`visao_alcance` em metros; vazio = até
  onde as paredes deixarem); o polígono resultante abre a névoa (`poligonoDeVisao`,
  `comporNevoaComVisao`). **Decisão do Daniel (01/10): visão do GRUPO** — telão e
  celulares veem o que qualquer jogador enxerga, não cada um o seu. Feita à mão
  (pincel etc.) a névoa continua valendo pra REVELAR; esconder à mão não segura
  contra a visão (pra isso, desenhe uma parede). Porta aberta deixa passar; o
  Mestre abre/fecha tocando nela com a ferramenta de mover (só ao soltar e se o
  dedo não andou, e não se virou ping de toque longo).
  - **O jogador (e o telão) NUNCA vê a marcação de parede ou porta**: só o Mestre as
    desenha (vermelho = parede, dourado = porta, tracejada = aberta); a mesa vê o
    desenho do mapa e a névoa se abrindo. Por isso **uma passagem secreta é só uma
    porta fechada onde o mapa mostra uma parede comum**; o Mestre abre quando eles
    descobrem. (Opção "mostrar a porta pra mesa" não existe; se pedirem, é por porta.)
  - **A memória do "já visto" é compartilhada**: máscara de quadradinhos (célula =
    quadradinho, piso de 32 px) compactada em texto em `cenas.explorado`
    (`codificarMascara`: `"colsxrowsxlado:base64"`; vazio = nada). Aparece
    escurecida (metade da névoa), não preta. **Só o aparelho do Mestre grava** (1,5 s
    depois da última mudança, só se mudou, e só com o mapa NA MESA — com ele ainda em
    preparo o Mestre mexe nos peões sem gastar a névoa); telão e celulares acumulam
    localmente e juntam com o que o Mestre guardou. Mudou a escala da grade: a
    memória antiga é descartada (`decodificarMascara` devolve null). "Cobrir de novo
    o explorado" zera (`reiniciarMemoria` + `explorado = ''`; quem vê a transição
    pra vazio também esquece). **Limite conhecido, e por que fica
    assim** (revisto em 02/10/2026, pela leitura do código, sem teste com dois aparelhos): o aparelho que
    abre depois do Mestre e antes de ele gravar fica sem o histórico por no máximo 1,5 s — quando o
    Mestre grava, a coluna `cenas.explorado` muda e todo aparelho junta o que chegou com o que já viu
    (efeito de `cena.explorado` em `CenaMapa`). O que sobra de verdade é que **só o aparelho do Mestre
    grava**: com o app dele fechado, o que os jogadores exploram fica só em cada celular. Não vale
    resolver: sem servidor, vários aparelhos gravando a mesma coluna se sobrescreveriam e perderiam
    células (a união não é atômica), e numa sessão o Mestre está sempre com o app aberto.
  - **Peão de inimigo sob a vista**: aparece só onde o grupo enxerga AGORA — não na
    parte "já vista" (a névoa escurecida conta como coberta: o limiar de
    `cobertaPorNevoa` caiu de 128 pra 40 de alfa).
  - **O Mestre vê o que os inimigos enxergam** (`verVisaoDosInimigos`, caixinha na
    seção "Paredes e visão"): véu vermelho com contorno por inimigo, pra saber se o
    goblin está vendo o grupo. É só da tela do Mestre e **não abre névoa pra mesa**.
  - **Onde os peões entram é o Mestre quem escolhe; nada nasce sozinho ao liberar o
    mapa.** "Pôr o grupo no mapa" põe no meio do que ele está vendo; novos
    "grupo/inimigos onde eu tocar" (`ferramenta "colocar"`, `regiaoEmTornoDe`) põem em
    volta do ponto tocado. **Com a visão automática ligada o jogador NÃO põe o
    próprio peão** ("pôr meu peão" some, com aviso): o lugar do peão abre a névoa.
    O ideal é preparar peões, paredes e portas ANTES de "levar a mesa pra este mapa".
  - **Desempenho:** a conta de visão roda por aparelho. Com o peão sendo arrastado,
    recalcula no máximo a cada 70 ms; só entram na conta as paredes que o alcance
    toca. Paredes são lidas por `useParedes` (canal próprio, como os peões) e a
    tabela ausente é tolerada ("falta rodar a migration 0021"; o chip da ferramenta
    some e a visão não liga).
  - **Backup:** `cena_paredes` entrou em `TABELAS_COM_SALA` e na ordem de restauração
    (depois de `cenas`); a memória vai junto na coluna `explorado`.
  - **Lições:** (1) **o relógio de gravar a memória não pode ser armado só "quando
    surge célula nova"**: o React em desenvolvimento liga, desliga e religa os
    efeitos, o cleanup cancelava o relógio e nada mais o rearmava — hoje cada
    recálculo pergunta "há o que guardar?" comparando com o último gravado, e o
    relógio reconfere `na_mesa`/Mestre ao disparar. (2) Achado numa página
    provisória com dados em memória (apagada): o desenho da visão (porta fechada
    bloqueia, aberta abre em leque, memória, arrasto, "preparando" não gasta
    explorado) foi conferido SEM banco antes de pedir a migration — a mesma técnica
    da névoa. (3) Os testes de visão (`visao.test.ts`) conferem canto de parede
    exato, alcance, cômodo fechado e a memória (guardar/ler/juntar/escala trocada).
  - **Corrida de carregamento (achada numa foto real, 01/10):** ao abrir o mapa os
    peões chegam antes das paredes; por instantes a conta rodava SEM parede, via
    "através de tudo" e marcava isso como "já visto" — e a memória só cresce, então
    ficava errado pra sempre (e o aparelho do Mestre gravaria no banco). Hoje
    `visaoPronta` (paredes E peões já lidos; `!muros.carregando && !banco.carregando`)
    segura a visão: até lá a névoa é só a feita à mão. O robô reproduz a corrida
    atrasando a resposta de `cena_paredes` em 3,5 s num reload do Mestre
    (`page.route`) e confere que a memória gravada não tem célula do outro lado da
    parede; **sem a correção o teste falha (285 células)**. Vale pra qualquer
    "estado derivado que só cresce": nunca calcular com a entrada ainda carregando.
  - **Parede e porta fechada seguram o peão do JOGADOR** (01/10/2026, sem migration;
    achado do Daniel jogando: "mesmo com as salas fechadas o player atravessa a porta
    e as paredes, podendo revelar qualquer área"). Antes elas só barravam a VISTA: o
    jogador arrastava o peão pra dentro da sala fechada e a visão automática abria a
    névoa de lá — nem precisava soltar, a visão acompanha o arrasto. Agora, a cada
    movimento do dedo, o passo do peão é conferido contra `segmentosQueBloqueiam`
    (`passoBloqueado`/`andarComParedes` em `lib/paredes.ts`): bateu, ele encosta e
    desliza pela parede; porta ABERTA deixa passar. Detalhes que não são óbvios:
    encostar conta e parar em cima da parede também (senão atravessava em dois
    passos), mas SAIR de cima não (peão 2×2 fica no cruzamento da grade); fresta
    menor que meio pixel não passa; o encaixe no quadradinho ao soltar também é
    conferido (`pousoLivre`: o vizinho mais perto a que dê pra chegar, senão volta);
    o jogador só pega o peão depois de as paredes chegarem do banco (`visaoPronta`).
    **O Mestre passa sempre** (é ele quem abre a porta). Vale com a visão automática
    ligada ou não. Como todo o resto do mapa, a trava é NA TELA: o banco é aberto.
    Robô: `e2e/andarComParedes.e2e.ts` (falha com a trava desligada: o peão vai pra
    525 em vez de parar em 435). `.cena-caixa[data-pronto]` existe pra o robô saber
    que paredes e peões já chegaram.
  - **Parede em curva** (01/10/2026, sem migration; pedido do Daniel: "curvas
    próximas ficam difíceis, ela só faz de forma reta"): modo **curva** da
    ferramenta 🧱 paredes. O Mestre passa o dedo acompanhando a curva e o traço vira
    trechos retos curtos emendados (`paredesDoTraco`: Douglas-Peucker com folga de
    `TOLERANCIA_DA_CURVA_PX` = 1,2 px de TELA — com 2,5 a onda virava zigue-zague e
    o círculo um octógono, visto na foto a 375px), SEM encaixar na grade; a ponta
    gruda na ponta de outra parede perto, e voltando ao começo a volta fecha. No
    máximo 60 trechos por traço (afrouxa até caber). **O limite de 400 paredes por
    cena fica**: a conta de visão é quadrática — medido aqui: 6 ms por peão com 400,
    40 ms com 800, 92 ms com 1200 (alcance sem limite), e celular é 4 a 5× mais
    lento. Cada trecho conta como uma parede (a tela mostra quantas cabem).
    **"↩ desfazer parede" tira o último DESENHO inteiro** (`ultimoDesenho`: o que
    entrou na mesma escrita tem a mesma hora — a curva toda, o cômodo todo) e o modo
    **apagar virou borracha** (passar o dedo tira os trechos por onde ele passa).
    Os contornos pretos são desenhados todos antes das cores (`desenharParedes`),
    senão cada emenda da curva ganhava uma marca escura.
  - **Importar paredes de um arquivo** (01/10/2026, sem migration; pedido do Daniel:
    "paredes e portas automáticas"). No fim de "Paredes e visão", fechado
    (`ImportarParedes.tsx`, regras em `lib/importarParedes.ts`). **O passo a passo
    fica escrito na própria tela** (pedido do Daniel: ele joga, não mestra, e não vai
    estar do lado pra explicar — quem tem a imagem do mapa é o Mestre). O Mestre copia o
    pedido (`pedidoDeParedes`, com o tamanho da cena), manda pra uma IA que enxergue
    imagens junto com o mapa, e cola a resposta (ou escolhe o arquivo): um JSON
    `{largura, altura, paredes: [[x1,y1,x2,y2]], portas: [...]}`. O app leva as
    coordenadas pro tamanho da cena (a imagem guardada é reduzida), prende no mapa,
    fecha as frestas e grava tudo **numa escrita só** pelo `muros.adicionar` de
    sempre — então "↩ desfazer parede" tira a importação inteira. **É rascunho**: o
    Mestre confere e corrige. O que foi testado antes de escolher este caminho, com
    dois mapas reais (um pergaminho com grade, um cenário pintado): **detectar por
    cor/contraste não serve** (limiar acha contorno furado e marca legenda, bússola e
    borda como parede; "tocar no cômodo" vaza pela porta ou não chega na parede,
    porque a luz pintada muda a cor do chão); já a IA olhando a imagem acertou as 53
    paredes e 10 portas do pergaminho dentro da faixa de pedra, e no pintado acertou
    o contorno mas errou o interior e não achou porta. Não refazer a detecção por
    pixel sem um motivo novo. **Fechar fresta nunca muda de lugar uma linha do
    arquivo** (`soldarPontas`): só estica a parede na direção dela ou acrescenta um
    trechinho. A primeira versão puxava a ponta até a ponta vizinha, e isso entortava
    a parede e **abria o "T" de outra parede no meio dela** — visto rodando o arquivo
    real, não nos testes. Os trechinhos contam no limite de 400. **Conferido na
    tela de verdade em 02/10/2026** (robô provisório contra o banco, na sala `ci-teste`,
    depois apagado): colar JSON em bloco ```json, escala 600×400 → 900×600, 2 frestas
    fechadas, 5 paredes + 1 porta gravadas numa escrita só, "↩ desfazer parede" tirou
    tudo, sem erro no console. **Altura medida a 375px no mesmo dia**: fechada 51 px,
    aberta e vazia 579 px, com a resposta colada 625 px; botões de 36 a 38 px, nada passa
    da largura da tela. **Arquivo de IA de verdade conferido em 06/10/2026**
    (`paredes-mapa-ruinas.json`, 1125×1125, 55 paredes, 0 portas; robô provisório contra a `ci-teste`, depois apagado): escolhido pelo
    botão "escolher arquivo…", "Prontas pra entrar: 55 paredes e 0 portas. Fechei 2 frestas", 55 gravadas numa escrita só, nenhuma fora do
    mapa, "↩ desfazer parede" tirou tudo, sem erro no console. **Com a imagem de verdade** (mesmo dia; `art-ruined-village-battle-map-30x30`, 1080×1080 webp, que a cena guardou sem reduzir): as 55 paredes caem sobre
    os muros das cinco construções e dos dois muretes de caminho, vãos de porta e brecha ficam abertos; o arquivo veio **sem nenhuma porta**, então
    os vãos são só vãos (a visão passa por eles). Escala 1125 → 1080 sem desvio visível. Rascunho bom, o Mestre ainda confere. Não há robô fixo para isso, só `ImportarParedes.test.ts` com banco de mentira. **Portas nos vãos** (06/10/2026, sem migration; `lib/vaos.ts`, 10 testes, botão `VaosViramPortas` em "Paredes e visão"): a IA não marca portas, então o botão
    "🚪 marcar N vãos como portas" acha onde duas paredes se apontam na mesma linha (até 20° de desvio) com abertura de meio a **dois** quadradinhos (sem
    grade: 1,5% a 4% do lado do mapa), sem outra parede no meio, cada ponta num vão só (o mais curto ganha), sem porta já ali. Entram como portas **abertas**
    (a vista não muda; o Mestre fecha as que importam tocando com ✋ mover) numa escrita só, então "↩ desfazer parede" tira todas. **Conferido no mapa das ruínas de verdade (06/10/2026):** o botão diz "marcar 15 vãos como portas", entram 15 portas abertas (as 55 paredes ficam), caem nas quebras dos muros das construções e dos muretes; alguns vãos pequenos em fila num mesmo muro (leste da construção de baixo à direita) são mais ruína quebrada que porta — é rascunho, o Mestre apaga as que não valem. No mesmo mapa, com
    até 3 quadradinhos deu 17 vãos e os dois maiores (~105 px) eram a rua entre construções: por isso o teto de 2. Robô: `portasNosVaos.e2e.ts`.
    Não há botão "detectar" dentro do app
    porque isso pediria rota de servidor e chave paga — decisão do Daniel.
  - **Mapa ↔ iniciativa (01/10/2026, sem migration; pedido do Daniel no mesmo dia).**
    Antes só a iniciativa mandava no mapa (anel da vez, "pôr os inimigos", nome/cor/
    condições da ficha). Agora vale nos dois sentidos:
    - **Inimigo que entra na ordem ganha peão OCULTO** no mapa que está NA MESA
      (`porPecasDosQueEntram` em `lib/pecasNoBanco.ts`, regra pura
      `pecasDosQueEntram` em `lib/pecas.ts`): pelo formulário, pela ficha que já
      existia e pelo "começar encontro". Só NPC, só quem ainda não tem peão naquela
      cena, no meio do pedaço que a mesa vê (`cena.camera`), sem cair em cima de
      ninguém. **Tamanho pelo tipo da ficha** (`tamanhoPeloTipo`: "Fera grande" = 2×2,
      enorme = 3, imenso = 4 — o catálogo escreve assim; vale também pro botão "pôr
      os inimigos da iniciativa"). Sem mapa na mesa, nada nasce. Isso **não contraria**
      "nada nasce sozinho ao liberar o mapa": o gatilho é o inimigo ENTRAR na ordem,
      nunca o mapa ir pra mesa.
    - **Inimigo que sai da ordem (✕) sai do mapa da mesa**; jogador fica (continua ali
      fora do combate). **Ficha apagada** (aba Fichas ou desfazer de NPC criado) tira o
      peão de TODOS os mapas da sala — era o "?" cinza órfão. **Reiniciar o combate não
      mexe em peão** (de propósito: o Mestre reinicia pra rolar de novo e o inimigo que
      volta acha o peão onde estava, sem nascer outro).
    - **Desfazer leva os peões junto** (`AcaoDesfazivel.pecas`, opcional — pilha
      guardada antes disso continua valendo): desfazer a entrada apaga o peão criado;
      desfazer a saída devolve o peão com o mesmo id e no mesmo lugar.
    - **Tocar num peão (soltar sem arrastar) abre o cartão dele** embaixo do mapa
      (`CartaoDoPeao.tsx`, callback `aoAbrirPeca` do `CenaMapa`; o arrasto não abre):
      o mesmo painel da linha da iniciativa (`AcoesNaLinha`, agora exportado: dano,
      metade, cura, ataques, condições, testes de morte), "Passar a vez →" quando é a
      vez dele, e — só pro Mestre — mostrar/esconder o peão e revelar o nome. Mesmas
      funções da iniciativa (`mudarPVComLog`, `avancarTurno`), então log, desfazer e
      anti-spoiler são os mesmos. O jogador só abre o do próprio peão (é o único que o
      toque dele pega). No mapa o campo de dano **não** ganha foco sozinho
      (`focarAoAbrir={false}`): o teclado subiria por cima do mapa a cada toque. O
      cartão rola a página só o necessário pra aparecer (`scrollIntoView nearest`) e
      continua aberto depois do dano, pronto pro próximo golpe. Tocar no nome do peão
      na lista do Mestre também abre.
    - **Tudo do mapa aqui é melhor esforço**: erro vai pro relato, sem aviso na tela e
      sem travar o combate; sem internet nem tenta. Sem a tabela de peões, não faz nada.
    - **Robô** (`e2e/mapaIniciativa.e2e.ts`): entrada (form e ficha existente, tamanho
      2×2), saída + desfazer (mesmo id e lugar), cartão do Mestre (dano no banco, campo
      sem foco, mostrar, revelar), cartão do jogador (só o dele, passa a vez) e ficha
      apagada. Conferido que ele FALHA com o toque no peão desligado.
    - De passagem: o campo "quanto?" da linha da iniciativa cortava o texto por 1 px
      a 375px (precisava 63, cabia 62); `.initajuste input.num` foi de 84 pra 90 px.
## Detecção automática de paredes: REMOVIDA (08/10/2026)

O botão "🔍 achar paredes e portas sozinho" (detector no aparelho, três modos: linha escura, parede clara, contorno dos
cômodos) e tudo que era só dele — `detectarParedes`/`detectarCurvas`/`detectarContorno`, a `PreviaDeParedes`, o CSS da prévia e a
pasta `scripts/mapas` (medição, gabaritos do Watabou, `gerar_paredes.sh`) — **saíram do app por decisão do Daniel**: o resultado
não servia em mapa de verdade e ele preferiu abandonar a automação por enquanto. **Não recriar sem ele pedir.** O código e as
medições estão no Git: o último commit com tudo é `d7702a4` (`git show d7702a4:src/lib/detectarContorno.ts`; `git log --stat` na
pasta `scripts/mapas` mostra os scripts).

O que ficou, e é o caminho de paredes hoje:
- **Desenhar à mão** (ferramenta "Paredes e portas": parede, curva, porta, cômodo, apagar; ver "Mapas com névoa de guerra").
- **Importar de arquivo** (seção "importar paredes de um arquivo", `ImportarParedes.tsx`): resposta de IA de visão (JSON, com o
  "pedido" que o app copia), **arquivo Universal VTT** do Dungeondraft/Dungeon Scrawl (`lib/uvtt.ts`, 5 testes; descarta a imagem
  embutida, corta a parede por baixo de cada porta, avisa se a proporção do mapa difere; **nunca testado com `.dd2vtt` real**) e
  **▭ fechar a borda do mapa**. Mais o botão de marcar vãos como portas (`lib/vaos.ts`). Entra tudo como rascunho, numa escrita só,
  e "↩ desfazer parede" tira a importação inteira.

Lições que valem se um dia voltar (o resto está nos commits):
- **Gabarito exato sem desenhar à mão**: o One Page Dungeon do Watabou (uso livre dos mapas gerados) exporta JSON de geometria
  (tecla J; PNG na tecla E). A porta dele é a célula 1×1 `(x, y)`; `dir` é só o eixo. No Chrome automatizado as duas primeiras teclas
  depois de abrir são engolidas, e a opção "girar pra caber" (R) fica salva por contexto.
- Medido só em masmorra DESENHADA (9 mapas): contorno 89% das paredes achadas / 86% certas, portas 55% achadas / 37% falsas. Mapa
  pintado, caverna e foto nunca foram medidos — e foi aí que o Daniel viu o resultado ruim.
- Detecção por contraste/cor de pixel, contorno de silhueta, gargalo por distância e lacuna entre pisos já foram tentados; não há
  ganho barato sem mapas reais de teste (o Daniel é jogador e não tem os mapas das campanhas).
