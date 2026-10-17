# Combate: iniciativa, dano, condições e chefes

> Parte do `AGENTS.md` (dividido em 09/10/2026; o texto é o mesmo de antes, só mudou de lugar). **Leia quando:** Antes de mexer em iniciativa, PV, log, condições, desfazer, telão ou qualquer linha de log nova sobre personagem (passa por `nomeNoLog`).

- **Concentração** (`danoComLog`/`condicaoComLog`/`cdConcentracao` em
  `regras.ts`, sem migration): dano em quem está com 🔮 ligado já sai no log
  com o teste de CON e a dificuldade (10 ou metade do dano, teto 30 — PV
  temporário absorvendo tudo ainda conta como dano). Cair a 0 PV (em
  `ajustarPV`, então vale até pro PV digitado na mão) ou ganhar uma condição
  que inclui Incapacitado desliga a concentração sozinho. Regra conferida no
  Rules Glossary das Regras Gratuitas 2024 **lendo o texto bruto da página**:
  o resumo automático dela errou e disse que Petrificado não inclui
  Incapacitado. O − da ficha e as Ações em Massa usam a mesma função — não
  voltar a montar a mensagem de dano em cada componente.
- **Aviso fixo de teste de concentração pro Mestre** (17/10/2026, migration `0039_aviso_de_concentracao.sql`; `useAvisoDeConcentracao`,
  `testeDeConcentracao` em `lib/eventosCombate.ts`). O app **não rola nada** (a mesa joga dados de verdade): quando quem está com 🔮 ligado perde
  PV ou PV temporário e continua concentrado, o aparelho do Mestre cria um aviso `tipo = 'concentracao'` em `combate_eventos` ("Teste de
  Constituição, CD 12 · concentrado em Bênção · 24 de dano"), que aparece no topo do Combate (`AvisosDoCombate`, junto dos eventos, com a vibração)
  até ele tocar "Feito" (que APAGA a linha, não marca). Quem dispara é a **mudança de PV que chega na tela**, não cada caminho de escrita: vale
  pro Mestre no painel, pro jogador no −/+ da própria ficha e pras Ações em Massa, e um caminho novo de dano não precisa lembrar de avisar. O aviso
  some sozinho se a pessoa larga a concentração (0 PV, condição, desligou). **Limite:** só avisa se o aparelho do Mestre estava aberto na hora; o log
  público continua trazendo a CD de qualquer jeito. Antes da migration o botão de aviso fica quieto (`indisponivel`); migration só troca a trava de
  `tipo`. Robô: `e2e/avisoDeConcentracao.e2e.ts`.
- **Descanso longo limpa o que sobra de quem caiu** (`aplicarDescansoLongo`):
  além de PV cheio, −1 de exaustão, dados de vida e recursos, zera
  `hp_temp` (PV temporário dura até o próximo descanso longo, regra explícita
  de 2024) e `dss`/`dsf`. Sem isso o personagem levantava do descanso com uma
  falha de teste de morte já marcada e morria mais cedo no combate seguinte —
  e contradizia o `ajustarPV`, que zera os testes ao recuperar PV.
- **CD de magia e ataque de magia são modificadores separados**
  (`CampoModificavel`): o bônus de `cd_magia` **não** entra no ataque. A
  Feitiçaria Inata do Feiticeiro, por exemplo, sobe a CD em 1 e dá **vantagem**
  no ataque, não +1 de acerto — somar os dois mostrava "ataque +8" onde o certo
  é +7. Item que sobe os dois (varinha do mago de guerra) é cadastrado como
  duas linhas de modificador.
- **Montar a iniciativa** (`entrarNaOrdem` em `regras.ts`): o Mestre tem um
  botão "🎲 Pôr os N jogadores na ordem" que rola d20 + modificador da ficha
  de cada jogador que ainda não está na ordem, numa escrita só — era o
  gargalo do começo do combate, feito um por um no celular. Os monstros
  entram pelos encontros preparados (abaixo) ou um por um no formulário. Os
  caminhos de entrada (botão, encontro, formulário do Mestre, "sua
  iniciativa" do jogador) passam pela mesma função, que **ignora quem já está na ordem** e
  devolve `entraram` — sem isso, toque duplo no celular punha a pessoa duas
  vezes na ordem (dois turnos) e, depois de corrigido, ainda logava duas
  vezes que ela entrou. Achado testando com dois toques de propósito.
- **Encontros preparados** (tabela `encontros`, migration `0016`,
  `EncontrosPreparados.tsx`): o Mestre monta o grupo inimigo antes da sessão
  na aba Mestre ("Emboscada na ponte: 3× Goblin + 1× Chefe goblin"),
  puxando da biblioteca da sala ou do catálogo do SRD; na aba Combate, um
  toque cria todas as fichas e põe cada monstro na ordem. Decisões que não
  estão no código à primeira vista:
  - cada grupo guarda uma **cópia** da ficha, não um link pro modelo —
    mexer/apagar a biblioteca depois não muda nem quebra o encontro;
  - **uma rolagem por monstro** (d20 + modificador), não uma por tipo —
    escolha do Daniel em 19/09/2026, mesmo o DMG sugerindo uma por grupo;
  - as fichas nascem num insert só (`criarVariosPersonagens`: todas ou
    nenhuma) e **só então** entram na ordem;
  - nomes não repetem nome da sala e continuam a série (`nomesDoGrupo`):
    rodar o mesmo encontro de novo dá Goblin 4, 5, 6 e "Chefe goblin 2", e
    um goblin avulso entra como "Goblin 3" se já houver 1 e 2 — nunca um
    "Goblin" solto do lado deles;
  - o log diz só "N inimigos entraram no combate", **sem nome do encontro
    nem dos monstros**: o log é público e "Emboscada do Dragão Vermelho"
    entregaria o chefão. Os monstros nascem ocultos, como qualquer NPC.
  A tabela nasceu numa sessão da outra máquina que não subiu o código; a
  `0016` foi escrita pra rodar por cima dela (tudo "se ainda não existir") e
  ligou o tempo real, que faltava — encontro montado no notebook não aparecia
  no celular sem recarregar.
- **Modo telão no painel do Mestre** (02/10/2026, sem migration, `Painel.tsx`): o botão "📺 modo telão"
  abre um painel que explica o uso — o telão é uma página à parte (`?telao=1`), feita pra OUTRO aparelho
  (TV, tablet) ou uma aba arrastada pra TV; **não ocupa o painel do Mestre** (era a dúvida dele) e não tem
  controle. Tem "🔗 copiar link do telão" e "↗ abrir em aba nova". O link leva `?sala=` (`linkDoTelao`):
  antes abria a sala que estivesse na barra de endereço. Copiar usa `navigator.clipboard`; se o navegador
  negar, avisa e deixa o link na tela (o navegador de teste nega, então só o caminho de falha foi visto).
- **Telão** (`?telao=1`, `Telao.tsx`): mostra de quem é a vez e, abaixo, os 3
  próximos da ordem (`proximosDaOrdem` em `regras.ts`, que dá a volta na
  virada de rodada). Só **nomes** na lista do "a seguir" — PV de NPC é
  informação do Mestre e o telão é visto pela mesa inteira, então continua
  passando por `nomeExibidoIniciativa`/`pvExibidoIniciativa` com
  `souMestre=false` (NPC não revelado aparece como "Inimigo 2"). Desde
  19/09/2026 mostra também **as condições de quem está na vez** (com o prazo,
  a exaustão e o "Inconsciente" de jogador a 0 PV) — elas valem pra mesa
  inteira ver, como já valiam na ordem e no log; NPC a 0 PV não entra nisso,
  que é PV dele disfarçado. A folga do corpo da página some no telão
  (`body:has(.telao)`): ela empurrava o conteúdo pra fora da tela da TV e
  deixava a página rolando 84px à toa (achado medindo). Desde 25/09/2026
  **segura a tela acesa** — ver "Revisão de tecnologia" mais abaixo.
- **Log de combate é público** (`nomeNoLog`/`pvNoLog`/`curaComLog` em
  `regras.ts`): cada jogador lê o log no próprio celular, então ele segue a
  mesma regra da ordem e do telão — NPC não revelado aparece como "Um
  inimigo", e **PV de NPC nunca vai pro log, nem revelado**. Jogador aparece
  inteiro, com PV. Antes o log entregava tudo: "Kobold entrou no combate" saiu
  duas vezes na setimo-raio com os dois Kobolds ocultos, e dano em NPC vinha
  com "(PV/máximo)". Frase fixa ("Um inimigo"), sem o número do "Inimigo N":
  o log fica congelado e o número da ordem muda quando alguém entra ou sai.
  **Linha de log nova sobre personagem passa por `nomeNoLog`** — nunca
  `p.name` direto.
- **Dano direto na iniciativa** (19/09/2026, sem migration, roadmap item 5):
  tocar no nome/PV de uma linha abre embaixo dela um campo com **Dano N**,
  **Metade** (resistência ou passou no teste: `metadeDoDano`, arredonda pra
  baixo) e **Cura N**; Enter = dano, Esc fecha. Mesma permissão da ficha
  (`podeEditarPersonagem`: Mestre em qualquer linha, jogador só na dele). O
  campo lembra o que muda a conta antes de aplicar (PV temporário,
  "Vantagens & resistências" da ficha, concentração). Tudo passa por
  `mudarPVComLog` (exportada de `FichaPersonagem.tsx`, a mesma do −/+ da
  ficha) → `ajustePVComLog` em `regras.ts`, que devolve o patch, a linha do
  log **público** (NPC oculto = "Um inimigo", sem PV) e o **retorno** que
  aparece embaixo da linha pra quem aplicou — esse com nome e PV de verdade,
  senão o Mestre não sabe em qual dos três goblins acertou, e com o aviso de
  concentração (teste de CON com a CD) ali mesmo, sem descer até o log.
  Jogador a 0 PV que leva dano não gera log; o retorno lembra que é falha no
  teste de morte (não marca sozinho: não dá pra saber se foi crítico). No
  celular o PV desce pra baixo do nome (`.pvlinha`, @media 520px) — com o
  "±" a mais o nome virava "Go…" (achado testando). O mesmo painel tem, embaixo,
  os chips de condição e os prazos — **os mesmos componentes da ficha**
  (`ChipsCondicao`/`PrazosCondicao` e `alternarCondicaoComLog` em
  `CondicoesEditaveis.tsx`), então log anti-spoiler, quebra de concentração,
  desfazer e fila sem internet valem igual. Dano fecha o painel; condição
  não (dá pra ligar mais de uma).
- **Desfazer** (19/09/2026, sem migration, roadmap item 6; regras puras em
  `lib/desfazer.ts`, pilha e escrita no `useSala`, botão em
  `BarraDesfazer.tsx`): cada aparelho desfaz o que **ele** fez — a pilha (até
  10, mais nova primeiro) fica no `sessionStorage` da aba, por sala, porque o
  celular recarrega a página quando a pessoa troca de app. Cada ação guarda o
  antes e o depois de cada campo que escreveu (`mudancaDe`), a mudança da
  ordem (`definirCombate` agora devolve `{ antes, depois }` da escrita que
  pegou) e as fichas que criou. Só volta se o "depois" ainda for o que está
  valendo (`podeDesfazer`); a ordem volta pela mesma trava de versão da
  migration 0010, e as fichas com `.eq` nos campos de número/booleano no
  próprio UPDATE. Se não der, avisa quem mudou e **esvazia a pilha** —
  desfazer as de antes pulando a mais nova deixaria tudo fora de ordem.
  **Toda ação nova que muda o combate chama `sala.lembrarDesfazer` depois
  que a escrita confirmar** — hoje: dano/cura (`mudarPVComLog`, ações em
  massa), condição (ficha e massa), `avancarTurno` (a virada de rodada volta
  com os prazos de condição), entrar na ordem (com o NPC criado junto),
  pôr todos os jogadores, começar encontro (apaga as fichas criadas; o
  encontro preparado fica), tirar da ordem e reiniciar combate. ▲▼ e
  revelar ficam de fora (o próprio botão já desfaz). O log ganha "↩ Desfeito:
  <linha original>" (já passou pelo anti-spoiler) ou um resumo com contagem;
  ação que não foi pro log não grava nada ao desfazer. O rótulo do botão só
  aparece no aparelho de quem fez — no do Mestre vai com nome de verdade, no
  do jogador nunca cita inimigo ("Próximo turno"). "trocar" esvazia a pilha:
  quem pega o celular depois não desfaz o que o Mestre fez. Na virada de
  rodada, "Rodada N começou" é gravada antes e sozinha: linhas da mesma
  escrita saem com o mesmo horário e o log trocava a ordem delas.
- **Condições explicadas** (19/09/2026, sem migration, roadmap item 7): o
  texto de cada uma mora em `EFEITOS_CONDICAO` (`lib/condicoes.ts`) — resumo
  em português do Rules Glossary 2024 / SRD 5.2, **conferido no texto da
  página** (não de memória) e com distância em metros. Na ordem de
  iniciativa, as condições ativas viram etiquetas embaixo do nome ("Atordoado
  · 2 rodadas", "Exaustão 2"); tocar abre a explicação ali mesmo
  (`ExplicacaoCondicao.tsx`). Aparecem pra todo mundo, NPC oculto inclusive
  (como "Inimigo 1"): o log já anuncia "Um inimigo ficou Atordoado", e o
  jogador precisa saber que o ataque dele tem vantagem. Na ficha, o chip
  continua ligando/desligando; embaixo, cada condição ativa mostra o que faz,
  e um guia recolhido traz as 14. Condição que inclui Incapacitado escreve o
  que ele faz junto; o teste de `condicoes.test.ts` confere que essa lista
  bate com `CONDICOES_QUE_QUEBRAM_CONCENTRACAO`.
- **Faixa de 0 PV diz "Inconsciente"**, não "Caído" (19/09/2026): Caído é a
  condição de estar no chão (Prone), que agora tem explicação própria.
- **Testes de morte** (19/09/2026, sem migration, segunda lista item 3):
  jogador a 0 PV ganha na ordem a etiqueta "Inconsciente · 0 PV · ✓1 ✗2"
  (tocar explica a condição Inconsciente, que ele tem pelas regras mesmo sem
  ninguém ligar na mão) e, no painel da linha, a seção de testes de morte —
  antes do resto, que é o que ele NÃO pode fazer. `resolverTesteMorte`
  (regras.ts, testado): 10+ passa, 20 natural acorda com 1 PV pelo
  `ajustarPV` (que zera a contagem), 1 natural conta duas falhas, 3 sucessos
  estabiliza e 3 falhas mata. Vai pro log com nome (jogador nunca é
  escondido) e dá pra desfazer. As marcas e o botão são o mesmo componente
  da ficha (`TestesDeMorte.tsx`); o botão de rolar só aparece a 0 PV, e o
  resultado na tela some se a contagem mudar (desfeito, ou outro aparelho).
- **Ataques rolados** (19/09/2026, sem migration, segunda lista item 2): no
  painel da linha da iniciativa, os ataques do campo `ataque` viram botões
  "🎲 Cimitarra +4" (`RolarAtaques.tsx`). `lerAtaquesRolaveis` (regras.ts)
  entende o texto livre nos dois formatos que existem — o do catálogo
  ("Cimitarra +4, 1d6+2 cortante · Arco…", "2x Dilacerar…", "2 ataques:
  A · B", dano extra "+ 1d6 elétrico", observação entre parênteses ignorada)
  e o da ficha do jogador ("Malho +1: +7, 2d6+9", uma linha por ataque); o
  teste passa todos os monstros do catálogo por ele. `resolverAtaque` rola
  com o dado injetado (testado com dado viciado): vantagem/desvantagem com
  dois d20, 20 natural rola os DADOS de dano em dobro (modificador uma vez),
  1 natural erra, dano não fica negativo. **Não vai pro log**: fica só na
  tela de quem rolou, como o Mestre rolando atrás do escudo. Na vez de quem
  tem ataque, o painel abre sem o cursor no campo de PV (o teclado do
  celular cobriria os botões de ataque).
- **Passar a vez** (`avancarTurno` exportada de `RastreadorCombate.tsx`,
  reaproveitada no `BannerSuaVez`): o jogador vê um botão no banner "É a sua
  vez!" pra avançar o turno sozinho, sem depender do Mestre. Só aparece
  quando é a vez do próprio personagem — o Mestre continua sendo o único que
  passa a vez de qualquer um.
## Salvaguarda em massa (09/10/2026, sem migration)

Em Combate → Ações em massa (só o Mestre): escolhe os alvos, o atributo, a CD, o dano ("8d6 fogo", "2d8+4", "12" ou vazio = sem dano)
e se quem passa leva metade, nada ou tudo. **Rolar** tira um d20 por alvo (bônus = o `save_*` do cartão, que manda; NPC sem ficha de
atributos fica com 0 e o Mestre corrige) e rola o dano **uma vez só**, igual pra todos (`lib/salvaguarda.ts`, 12 testes; tela em
`SalvaguardaEmMassa.tsx`). Regras 2024: passa quem chega na CD; **20 e 1 naturais não passam nem falham sozinhos** (isso é só do teste
de morte); metade arredonda pra baixo (`metadeDoDano`). O Mestre vê uma linha por alvo — "🎲 11 +5 = 16", passou/falhou (toque troca e
recalcula o dano) e o dano editável (resistência, imunidade e dado rolado na mesa são texto livre na ficha, que o app não lê) — e só
então "Aplicar o dano": passa por `danoComLog` (concentração, PV temporário, log anti-spoiler) numa escrita só e entra no ↩ Desfazer.
**A linha pública do log só tem a contagem** ("🎲 Salvaguarda de Destreza (CD 15): 1 passou, 1 falhou"), sem nome: NPC oculto continua
"Um inimigo" nas linhas de dano. "Selecionar quem falhou" deixa só eles marcados, pra usar "Adicionar condição" (Contido, Atordoado...).
Efeito sem dano tem "Registrar no log". Robô: `e2e/salvaguardaEmMassa.e2e.ts` (fixa `Math.random` **depois** de abrir o app: fixar antes
quebra a abertura; conferido que falha se a metade vira dano cheio). **Não cobre:** vantagem/desvantagem por alvo, condição aplicada
direto a quem falhou, cobertura/Evasão.

## Ações lendárias, resistência lendária e covil (04/10/2026, sem migration)

No painel que abre embaixo da linha da iniciativa de um **NPC** (e no cartão do peão), o bloco **Chefe** (`LendariasNaLinha.tsx`, regras
em `lib/lendarias.ts`, 13 testes) liga três coisas, **todas nos `resources` do monstro** (sem coluna nova), reconhecidas pelo nome:
- **"Ações lendárias"** (padrão 3): botões "gastar 1/2/3" (desabilitam se não sobra) e "devolver 1" (corrigir erro). **Voltam ao máximo
  sozinhas quando o turno chega no monstro** — está em `avancarTurno` (regra do livro: recupera no início do próprio turno), entra no
  "desfazer" do próximo turno junto com a virada de rodada. Cada gasto escreve no log (`👑 Dragão usou 2 ações lendárias (restam 1/3)`;
  `nomeNoLog`, então monstro oculto vira "Um inimigo").
- **"Resistência lendária"** (padrão 3 por dia): botão "usar"; **não volta sozinha** (o descanso longo do Mestre zera todos os recursos).
- **"Ações de covil"**: só uma marca (máx. 1). O Mestre vê o aviso **"🏰 Contagem 20: hora das ações de covil de X"** no turno que vem
  logo depois da contagem 20 (o primeiro com iniciativa < 20; quem empata em 20 age antes do covil; se todos têm 20 ou mais, o aviso
  vem no primeiro da rodada). Não grava estado: é calculado da ordem e do turno.
- Os recursos aparecem também na ficha do monstro como qualquer outro (dá pra mudar o máximo lá). "tirar tudo" remove só os três.
- **Não cobre**: texto das ações lendárias do monstro (o catálogo não tem), custo de cada ação pré-definido, e ações de covil como linha
  própria na iniciativa (é só aviso).
**Armadilha deste dia**: semeei a sala `ci-teste` com o robô do GitHub rodando e ele falhou 1 de 26 testes (`andarComParedes`); rodou de
novo sem mim e passou. `gh run list --workflow e2e.yml` ANTES de semear, sempre — e esperar o run terminar, não só começar.

## Encerrar combate (04/10/2026, sem migration)

Na aba Combate, o Mestre ganhou **🏁 Encerrar combate** ao lado de "Reiniciar combate" (que continua só apagando a ordem). Abre o painel
`EncerrarCombate.tsx` (regras em `lib/fimDoCombate.ts`, 11 testes): resumo ("Rodada 4 · 4 inimigos a 0 PV · 1 jogador caído"), o XP dos
derrotados, quem recebe, e uma opção de tirar dos jogadores as condições com prazo (desligada por padrão).
- **"Derrotado" é sugestão, o Mestre confirma**: inimigo (NPC) na ordem com 0 PV ou menos. O app não sabe quem fugiu, se rendeu ou foi
  poupado, então cada um tem checkbox. O XP vem do catálogo pelo **nome** (`xpDoInimigo`: sem acento, sem caixa, e tira o número de cópia
  no fim — "Goblin 2", "goblin #3", "Goblin nº 4" valem "Goblin"; casa o nome em português ou o em inglês); nome que não bate **não chuta**,
  fica em branco pro Mestre digitar ("Goblin Chefe" não vira Goblin). Quem recebe são os jogadores que estão na ordem (chips, todos
  marcados); o total é dividido por igual (`dividirXp`) e a sobra não vai pra ninguém (o texto diz).
- **Ordem das gravações**: primeiro as fichas (XP, e as condições se marcado), numa escrita só; se falha, o combate continua aberto. Depois
  limpa a ordem (como o Reiniciar), grava o log (`🏁 Combate encerrado: 4 rodadas, 4 inimigos derrotados, 250 XP (250 pra o jogador)` +
  uma linha 🏅 por jogador) e guarda **tudo junto no "Desfazer"** (testado: devolve o XP, as condições com prazo e a ordem na rodada em que
  estava).
- O catálogo de monstros só baixa ao abrir o painel (`useCatalogoMonstros`, igual à biblioteca).
- **Não cobre**: voltar as ações lendárias (elas voltam no turno do monstro e "tirar tudo" no bloco Chefe limpa), apagar as fichas/peões dos
  derrotados (continuam, a 0 PV), e XP de monstro que o catálogo não conhece além do que o Mestre digita.

**Dia e data no topo e no telão** (04/10/2026, sem migration): com a campanha contando os dias, o cabeçalho de todo mundo ganha a etiqueta
"🗓 Dia 14 · 29 Flamerule" (`rotuloCurtoDoDia`: sem o ano; festival aparece pelo nome; calendário simples vira só "Dia 14"; some se a
campanha não começou a contar). No celular a etiqueta cai numa segunda linha e custa ~22 px de altura (medido: topo de 141 para 163 px a
375 px). O **telão** (`Telao.tsx`) escreve o dia na linha de cima ("Ci Teste · Rodada 2 · Dia 14 · 29 Flamerule") e lista só os efeitos no
último dia ou que vencem hoje (`efeitosPertoDeVencer`: "⏳ Maldição da múmia: falta 1 dia"); com o mapa na mesa, o dia vai numa linha da
faixa de baixo — **esse caminho não foi visto na tela**, só o do telão sem mapa. Descanso curto do grupo: o Daniel disse que não precisa.


**Robô de tela** (06/10/2026, `e2e/combateAvancado.e2e.ts`, contra o banco real): encerrar combate (Goblin a 0 PV vale 50 XP pelo catálogo, 25 pra cada
um de dois jogadores, ordem limpa, log 🏁, e "↩ Desfazer" devolve XP e ordem), ações lendárias (gastar 2 vai pro log, resistência gasta, as ações voltam a
3 no turno do monstro e a resistência continua gasta) e emboscada (jogador surpreso entra na ordem e o log diz ", surpreso").

## Emboscada: surpresa na iniciativa (04/10/2026, sem migration)

**Regra de 2024, não a de 2014**: o surpreso NÃO perde o turno; ele rola a iniciativa com **desvantagem** (dois d20, vale o menor).
`rolarIniciativa(mod, desvantagem, dado)` em `lib/dados.ts` (3 testes, dado injetado) devolve o total e os dados rolados. Na aba Combate, o
Mestre tem **💥 Emboscada** (`EmboscadaDaIniciativa.tsx`, fechada por padrão): chips dos jogadores que ainda vão rolar e "Inimigos que vão
entrar". A marca vale pras rolagens que o Mestre faz na tela (🎲 do formulário, "Pôr os jogadores na ordem", encontro preparado) e **não fica
guardada** (some ao recarregar). O jogador que rola a própria iniciativa tem a caixinha "estou surpreso (desvantagem)". A tela diz "Surpreso:
rolou 19 e 3, vale o menor." e o log ganha ", surpreso" (`Ana Robô entrou no combate (iniciativa 3, surpreso)`; o encontro preparado
escreve "(surpresos)", sem nome de monstro). Se o Mestre digitar o número na mão depois de rolar, o ", surpreso" some do log (só marca quando
a rolagem com desvantagem foi a que entrou). Não cobre: vantagem na iniciativa (Alerta, etc.) nem surpresa por ficha (a marca é da tela).

## Companheiros e invocações (04/10/2026, migration `0031`)

Coluna `dono text` (nullable) em `characters`. Um companheiro (familiar, montaria, animal companheiro, criatura invocada) é uma **ficha de NPC
já revelada** (`is_npc`, `revealed`) com `dono` = o slug do personagem. O dono e o Mestre criam e apagam pela ficha de quem joga, em
**Companheiros** (`CompanheirosDaFicha.tsx`: nome, PV e CA; sem `dono`, tudo funciona como antes). Regras em `lib/companheiros.ts` (6 testes).
- **Na iniciativa (regra de 2024: age na iniciativa do dono)**: quando o dono entra na ordem — pelo formulário do Mestre, "Pôr os jogadores
  na ordem" ou "Entrar no combate" do próprio jogador — os companheiros dele que ainda não estão na ordem entram **logo depois, com a mesma
  contagem** (`comCompanheiros`; empates ficam na ordem de entrada, então ficam colados). Criar um companheiro com o dono já na ordem põe ele
  na ordem na hora; "pôr na ordem" cobre o caso de tirar e voltar. **Tirar o dono da ordem leva os companheiros** (um de cada vez, pra
  `turnoAposRemover` acertar o turno). Desfazer volta a ordem inteira (o estado anterior é guardado).
- **Quem mexe**: o jogador controla o PV dos companheiros dele na linha da iniciativa (`ehDoJogador`, usado no lugar da comparação de slug);
  o Mestre, todos. A linha mostra "🐾 de Ana". Log: "Pip acompanha Ana na iniciativa" — **de propósito sem "entrou no combate"**, senão o
  recap contaria o companheiro como inimigo (`resumirSessao` conta `entrou no combate` de quem não é jogador).
- **O PV do companheiro aparece pra mesa**, como o de qualquer aliado: `pvExibidoIniciativa` e `pvNoLog` tratam NPC com `dono` como jogador (a regra
  "PV de NPC é só do Mestre" é pra inimigo). Descoberto ao testar: sem isso o dono nem via o PV do familiar. O recap também conta o companheiro
  como do grupo (`DiarioCampanha` manda `!is_npc || dono` em `jogadores`), senão o dano nele entrava como "dano nos inimigos".
- A criação só manda `dono`/`revealed` pro banco quando vêm (`linhaDePersonagem`), então a coluna nova não quebra criar ninguém antes da migration.
- **Peão no mapa** (04/10/2026, sem migration): com um mapa na mesa, o companheiro que entra na iniciativa junto do dono ganha peão **visível** (não
  oculto como o dos inimigos) **encostado no peão do dono**, no primeiro quadradinho livre em volta (`pecasDosCompanheiros` em `lib/pecas.ts`, 6 testes:
  lado, depois embaixo/em cima/diagonais, em anéis; o tamanho vem do tipo da ficha, "Fera grande" ocupa 2×2 sem sobrepor). Dono sem peão neste mapa: cai
  no meio do que a mesa vê. `porPecasDosCompanheiros` (`lib/pecasNoBanco.ts`) acha o mapa da mesa sozinho, então vale pros três caminhos de entrada e
  pro "pôr na ordem" da ficha. **Tirar o dono da ordem tira os peões dos companheiros** (e desfazer devolve todos, no mesmo lugar). **Não anda junto**:
  cada peão é movido pelo seu dono.
- **Anda junto** (06/10/2026, sem migration): mover o peão do dono move os dos companheiros dele o mesmo deslocamento (`pecasQueAcompanham` em
  `lib/pecas.ts`, 5 testes; encaixa na grade e fica dentro do mapa; **não olha parede**, o companheiro atravessa o que o dono atravessou).
  Vale pro Mestre (`PainelMapa`) e pro jogador (`VisorDaMesa`), via `moverPeao`. Botão "🐾 companheiros junto" (ligado por padrão, só aparece
  se a sala tem companheiro; estado local de cada tela) pro familiar que vai explorar sozinho. Mexer no companheiro nunca arrasta o dono.
- **Telão**: na vez de um companheiro mostra "🐾 de Ana" (`nomeDoDono`), nos dois formatos (com e sem mapa).
- **Adotar NPC** (Mestre, na ficha do dono, em Companheiros): escolhe uma ficha de NPC sem dono (`npcsAdotaveis`) e ela vira companheiro
  (`dono` + `revealed`), entrando na ordem se o dono já está. "soltar" tira o `dono` (a ficha volta a ser NPC comum, continua revelada). Usa a
  coluna que já existe, **sem migration nova**. Robôs: `companheirosNoMapa.e2e.ts` e `adotarCompanheiro.e2e.ts`.
- **Parede segura o companheiro** (06/10/2026): ao seguir o dono, `pecasQueAcompanham` recebe `bloqueios` (`segmentosQueBloqueiam`: parede e porta fechada)
  e usa `andarComParedes` — ele encosta, desliza, e se nem assim dá fica onde está, **mesmo que o Mestre tenha passado o dono por cima da parede**
  (o Mestre passa; o companheiro não, como o jogador). Robô: 2º cenário de `companheirosNoMapa.e2e.ts` (conferido que falha sem a trava: o Pip vai a 495).
- **Não cobre**: peões de companheiros não se desviam um do outro ao seguir o dono.

- **Efeitos com duração** (09/10/2026, migration `0035_efeitos_do_combate.sql`; regras puras em `lib/efeitosCombate.ts`, 14 testes; hook
  `hooks/useEfeitos.ts` por **contexto** (`EfeitosContext`, no `Painel`); telas em `EfeitosDoCombate.tsx`). "Bênção, 10 rodadas": relógio preso a
  um personagem da ordem, **pra o que NÃO é condição** (condição já tem prazo próprio em `cond_prazo`, que sai na virada da rodada). Mestre **e
  jogador** criam, pelo botão "+ Efeito" no painel que abre ao tocar na linha (`AcoesNaLinha`, então também no cartão do peão). Guarda a rodada
  em que ACABA (`termina_rodada`), nunca uma contagem; acaba no início do turno de quem lançou (`acabou`: depois da rodada final, ou nela quando
  `turn >= índice do lançador`; sem lançador na ordem, no início da rodada). Chip `⏳ Bênção · 7 rod.` na linha; quando acaba, o aviso
  (`AvisosDeEfeitos`) aparece pro Mestre e pra quem lançou ou está sob o efeito, e "Acabou · contar à mesa" apaga a linha e SÓ DEPOIS põe
  `⏳ … acabou` no log (o `delete ... select` devolve true só pra quem apagou: dois toques não duplicam). Segredo: `efeitoVisivel` — jogador não vê
  efeito de inimigo não revelado (o nome "Forma de Dragão" entregaria quem é); o log usa `nomeNoLog`. Encerrar e reiniciar o combate apagam tudo
  (`limparTodos`); a tabela fica FORA do backup. Sem a migration o app abre normal e o painel diz "falta rodar a 0035".
  - **Ainda não faz**: concentração não derruba o efeito sozinha; efeito em vários alvos de uma vez (é um por alvo); fora de combate (a
    contagem em dias é `campanha_efeitos`, do tempo da campanha); não entra no desfazer.
  - Robô: `e2e/efeitosDoCombate.e2e.ts` (criar na linha → acaba só no turno de quem lançou → contar à mesa → inimigo oculto segue "Um inimigo" no log →
    reiniciar leva tudo) e a isca `ISCA_EFEITO_OCULTO` no `vazamento.e2e.ts`. Passaram contra o banco real em 09/10/2026.
- **Eventos do combate** (09/10/2026, migration `0034_eventos_do_combate.sql`; regras puras em `lib/eventosCombate.ts`, 15 testes; hook
  `hooks/useEventos.ts`, que chega às telas por **contexto** (`EventosContext`, sem passar prop pelo `RastreadorCombate`); telas em
  `EventosDoCombate.tsx`). O Mestre programa avisos — "rodada 3: o teto desaba", "quando o Chefe chegar a 50% de PV: ele foge" — que aparecem
  sozinhos no topo da aba Combate (**só pro Mestre**; o celular vibra uma vez por aviso novo). Duas tabelas/colunas: `encontros.eventos` (modelo
  preparado: por rodada, ou por PV de um GRUPO do encontro pelo índice) e `combate_eventos` (os valendo agora). Ao **começar o encontro**
  (`ComecarEncontro`), `eventosParaOCombate` copia os modelos trocando "grupo N" pelos slugs dos monstros criados (a faixa de cada grupo usa a mesma
  conta de `npcsDoEncontro`: `limitarQuantidade`, grupo por grupo); aviso de PV de grupo que sumiu é descartado, e tirar um grupo do encontro leva
  seus avisos e reaponta os dos seguintes (`eventosAoTirarGrupo`). Também há avisos avulsos na gaveta "Eventos do combate".
  - **Disparar é decidido na tela, não guardado**: `disparou`/`pendentes` olham a rodada e o PV de agora (rodada >=; PV <= pct% de qualquer um dos
    monstros; 0% = a 0 PV; sem ninguém na ordem nada dispara). Assim o aviso não se perde se o turno pula a rodada ou o PV cai de 80% a 20% de uma
    vez. `feito` é só "já tratei": o UPDATE leva `.eq("feito", false)`, então dois toques não contam duas vezes.
  - **"Contar à mesa"** (`publico`): o texto só vai pro **log público** (`📜 …`) DEPOIS que o banco aceitou o `feito`, nunca ao disparar.
  - Reiniciar e encerrar o combate apagam os avisos (`limparTodos`, melhor esforço, fora do desfazer). A tabela fica FORA do backup diário
    (estado de um combate); os modelos vão no backup junto com o encontro. Sem a migration, o app abre normal e a gaveta diz "falta rodar a 0034".
  - Robô: `e2e/eventosDoCombate.e2e.ts` (encontro → avisos entram com os slugs certos → rodada 2/3, PV do chefe e de um goblin → "Feito" e "contar à
    mesa" → o jogador não vê nenhum → aviso avulso → reiniciar leva tudo; conferido que falha com `>` no lugar de `>=`) e iscas no
    `e2e/vazamento.e2e.ts` (conferido que falha se o aviso aparece pra todo mundo). **Não cobre:** ação automática ao disparar (pôr condição,
    chamar reforço), aviso por turno de um monstro, e desfazer a criação/apagamento dos avisos.

- **Simulador de encontro** (09/10/2026, sem migration; `lib/simulador.ts`, 17 testes; tela `SimuladorDeEncontro.tsx`, em Mestre → Encontros →
  "🎲 simular este encontro"). Luta o encontro preparado contra o grupo da sala **1000 vezes** (~12 ms por simulação) e mostra a dificuldade em
  uma palavra (Tranquilo / Médio / Difícil / Mortal — os cortes em `dificuldade()` são combinados com a mesa, não do livro: perder todos ≥25% =
  mortal; ≥5% ou alguém cair em ≥70% = difícil; alguém cair em ≥30% = médio), a chance de alguém cair, de cair o grupo inteiro, rodadas
  típicas, PV gastos e a chance de cada um cair. **É um termômetro, não uma previsão — e a tela diz isso.** Não grava nada.
  - **Calibrado contra o livro** (4 de nível 3, 28 PV, CA 16, ataque +5 1d8+3): 4 goblins = tranquilo; 1 ogro = tranquilo (8% de alguém cair);
    2 ogros = difícil (7% de perder todos); 4 ogros = mortal. Bate com as faixas de XP do DMG.
  - **O que a conta usa:** CA, PV de agora (com o temporário; "grupo descansado" usa o máximo; quem está a 0 fica de fora), bônus de iniciativa e os
    ataques lidos do texto (`lerAtaquesRolaveis`, o mesmo do ataque rolado na iniciativa), com 20 natural = crítico e 1 natural = erro. Cada um age
    uma vez por rodada; sem "N ataques:" escolhe o ataque de maior dano médio; o grupo mira no inimigo de menos PV, os monstros em alguém do grupo ao
    acaso; quem chega a 0 PV sai (sem teste de morte nem cura). Companheiros (NPC com dono) lutam do lado do grupo. Ataque sem bônus ("Sopro: CD 13,
    4d6 fogo") é tratado como salvaguarda: sempre causa dano, e metade em metade das vezes.
  - **O que NÃO entra (a conta fica otimista pro grupo e subestima chefe):** magias, Ataque Extra, ações bônus, reações, terreno, vantagem, resistências,
    condições; sopro/magia/ações lendárias do monstro só contam se escritos no campo de ataque. Quem não tem ataque legível causa 0 de dano e a tela lista o
    nome (monstro do catálogo e jogador com ataque escrito como "Espada +5, 1d8+3"). Por isso 4 de nível 7 contra um dragão jovem dão "tranquilo": o
    sopro dele não está no texto. Se um dia quiserem mais fidelidade, o caminho é ler ações especiais (CD + dano) do catálogo e as magias da ficha.
  - Robô: `e2e/simulador.e2e.ts` (extremos de propósito: um rato contra grupo forte = tranquilo 100%; um dragão contra grupo fraco = mortal; quem está a 0
    PV fica de fora; "PV cheio" traz Caio de volta; sem ataque avisa; nada é gravado).
  - **Lição desta rodada:** o robô do GitHub falhou no `mapaIniciativa` depois dos eventos do combate porque o formulário novo reusava a classe
    `.addcombatant` e o teste antigo escolhia `.addcombatant select` (agora há dois). Classe de formulário nova ganha nome próprio (`.evcampos`).
    **Rode `npx playwright test` inteiro (48 testes, ~7 min, com o GitHub parado) antes de subir mudança de tela**, não só os testes novos.
