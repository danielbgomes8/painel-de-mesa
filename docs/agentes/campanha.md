# Campanha: Quadro, recap, tempo e várias salas

> Parte do `AGENTS.md` (dividido em 09/10/2026; o texto é o mesmo de antes, só mudou de lugar). **Leia quando:** Antes de mexer na aba Campanha, em salas/campanhas ou em linhas de log que o recap lê.

- **Várias campanhas no mesmo deploy** (19/09/2026, sem migration): cada
  campanha é uma sala (`?sala=codigo`), criada sozinha no primeiro acesso,
  com dados totalmente separados. O que prendia tudo à sala padrão foi solto:
  o título da aba vem do `<title>` que o `Painel` renderiza com o nome da sala
  (não do metadata do layout — o Next aplica aquele por último e passava por
  cima), o manifest ficou genérico, e o app instalado abre a **última sala em
  que o aparelho entrou** (só grava depois de entrar, não num link espiado).
  A sala só é montada **depois da hidratação** (`useNoNavegador`): montando
  antes, o efeito que grava `?sala=` no endereço prendia a pessoa na sala
  padrão e ainda abria uma conexão à toa com ela — achado testando.
- **Trocar de campanha sem link** (19/09/2026, sem migration,
  `EscolherCampanha.tsx`): na tela de entrada (antes de escolher quem é — quem
  abre o link puro cai na Salamina e precisa sair dela) e no botão
  "⇄ trocar campanha" do topo. Lista as campanhas do grupo (`CAMPANHAS` em
  `sala.ts`, hoje Salamina do Maeta e Forgotten Realms do Diogo), depois as salas
  que o aparelho já abriu por código e a sala aberta agora
  (`campanhasParaEscolher`), mais um campo pra digitar o código de outra
  (`codigoDigitado`, que devolve `null` em vez de cair no padrão). A troca é
  **sem recarregar**: `irParaSala` faz `pushState` com `?sala=` e dispara um
  evento que o `useCodigoSala` assina junto com o `popstate` (voltar do
  Android volta pra campanha anterior); o `key={codigo}` do `Painel` remonta a
  sala e o cleanup do `useSala` fecha o canal da anterior — testado: tempo
  real certo depois de várias idas e voltas, sem vazar evento de uma sala pra
  outra. O Enter do campo de código é tratado no `onKeyDown` (como no
  Portão), sem depender do envio implícito do form — a ferramenta de teste
  manda Enter sem `keypress` e o form não enviava. O código da sala é a única
  "senha" (modelo aberto, ver "Segurança" no README): as da lista aparecem
  pra qualquer um; campanha que não deve aparecer fica fora dela, com código
  difícil de chutar.
## Quadro da Campanha (02/10/2026, migrations `0024` e `0025`, rodadas)

O Daniel achava o diário sem utilidade e pediu algo "como o Trello": o Mestre põe NPCs e vilões
com foto, e decide o que os jogadores veem. A aba **Diário virou Campanha**: `AbaCampanha.tsx` tem
dois botões, **🗂 Quadro** (novo) e **📖 Sessões** (o `DiarioCampanha` de antes, intacto). O id interno
da aba continua `"diario"` (`BarraAbas.tsx`); só o rótulo mudou.

- **Cartões** (`quadro_cartoes`; regras puras em `lib/quadro.ts`, testadas): tipo (NPC, Vilão, Local,
  Facção, Item, Pista, Missão, Outro), nome, subtítulo, foto, texto que a mesa lê e **segredo só do
  Mestre**. `revelacao`: `escondido` (só o Mestre), `silhueta` (a mesa vê a foto escura e "???",
  sem texto) ou `revelado`. **Quem vê o quê está TODO em `visaoDoCartao`** — não reimplementar em
  componente. Como a névoa do mapa, isso esconde NA TELA: o banco é aberto (README, "Segurança").
- **Cartão da mesa × pessoal**: `dono` nulo = da mesa (o Mestre edita, `revelacao` vale). `dono` = slug
  de um jogador = pessoal: **só ele vê, nem o Mestre**, até compartilhar (`revelacao = revelado`; aí a
  mesa vê, mas só o dono edita). O "pessoal do Mestre" são os cartões da mesa que ficam escondidos.
  Todo cartão pessoal mostra o nome do dono (miniatura e folha); sem isso ninguém sabia de quem era.
- **📣 Mostrar à mesa agora**: revela e grava `destaque_em` numa escrita só. Cada aparelho compara o
  `destaque_em` novo com o que já tinha (`virouDestaque`, por instante — o banco devolve o horário em
  outro formato) e abre a foto em tela cheia (`DestaqueDoCartao`). **Releitura da sala não dispara**
  (senão quem acorda o celular leva o cartão de minutos atrás) e o aparelho do Mestre não vê o próprio.
  O telão também recebe (fecha sozinho em 30 s); **só foi testado em celular, não no telão de verdade**.
  **🌫️ Mostrar só a silhueta** (02/10/2026, sem migration): mesmo caminho, mas deixa o cartão em
  `silhueta` (em vez de `revelado`) e grava `destaque_em`; jogador e telão veem a foto **borrada**
  e "???" em tela cheia, sem nome, tipo nem texto (`destaqueEmSilhueta`; o rótulo de acessibilidade
  também não vaza). O botão some quando o cartão já está revelado (não há o que esconder). Só vale pra
  cartão da mesa. **O visual foi afinado em quatro rodadas com o Daniel, e três eram erradas:** escurecer
  (ele queria BORRAR, não escurecer); desfoque forte demais (6% da altura apagava a foto); e preto e
  branco (ele perguntou se precisava; ficou cor a 40%, `saturate(0.4)`, pra não entregar a cor do bicho
  e manter o clima). Hoje: `brightness(.9) blur(1.6vh) saturate(.4)` no telão — o desfoque é em `vh`
  porque a foto de TV é grande e pixel fixo ficaria nítido — e `blur(6px)` nas miniaturas da galeria.
  **Lição: afinar desfoque com FOTO REAL**, nunca com figura desenhada — a minha tinha contraste alto e
  o valor "bom" nela apagava a foto de verdade (usei as fotos de `forgotten-realms/quadro/` só pra olhar,
  leitura pública do Storage). Antes de 02/10 a silhueta não virava tela cheia nem no telão.
- **Colunas**: não existe tabela de colunas — `coluna` é um texto no cartão, e a coluna vazia só existe no
  aparelho de quem a criou, até um cartão cair nela. Ordem: as sugeridas (`COLUNAS_SUGERIDAS`) primeiro,
  depois alfabética, "Sem coluna" por último (então uma coluna nova pode aparecer no meio).
- **Arrastar** (alça `⠿` entre colunas, `🔗` pra ligar): `useArrastoDeColuna`/`useArrastoDeLigacao`, eventos
  de ponteiro, com `touch-action: none` só na alça. A rolagem automática na borda (`rolarPelaBorda`, uma
  função pros dois) roda por `requestAnimationFrame`: no celular não dá pra rolar com outro dedo. **O
  `scroll-snap` da lista de colunas desfaz essa rolagem** (a lista ficava parada e não chegava na coluna da
  esquerda); fica desligado durante o arrasto (`.qd-colunas[data-arrastando]`). Não tirar.
- **Ligações** (`quadro_ligacoes`): "Barão → serve a → Culto". Só aparecem pra quem vê os DOIS cartões, e
  se um lado está em silhueta o tipo da ligação some ("ligado a" / "?"). A vista **🕸 Mapa**
  (`MapaDeLigacoes.tsx`, posições em `lib/grafo.ts`) é um SVG: simulação de forças determinística (todo
  aparelho desenha igual; os ids são ordenados), arrastar círculo só muda a SUA tela. Os ouvintes do
  arrasto do círculo são ligados no instante do toque (não num efeito): se o dedo levantar antes, o
  círculo não pode ficar grudado. Nomes ficam numa camada própria sem captar toque, senão o nome de um
  cartão tapa o círculo do vizinho. O desenho tem largura máxima (1,7×) — em tela larga ele passava de
  1000 px de altura.
- **O Mestre arrasta entre colunas o cartão pessoal que o dono compartilhou** (`podeMoverCartao`, 08/10/2026): só a coluna, nada mais do cartão (editar segue sendo só do dono, `podeEditarCartao`). A coluna é uma só por cartão, então o dono vê a mudança. Escondido ou silhueta: o Mestre nem enxerga por inteiro, não move. A alça 🔗 (ligar) continua só pra quem edita.
- **Anotações** (`quadro_notas`): qualquer um anota num cartão que enxerga por inteiro, **todos leem**
  (o Daniel confirmou: visível, não privada). Cada um apaga a sua; o Mestre apaga qualquer uma.
- **Sessões**: `diario.cartoes` (lista de ids). O Mestre marca quem apareceu; no cartão aparece "Apareceu
  em: Sessão N". Cada um só vê os cartões que já pode ver.
- **Foto**: vai pro bucket `mapas` (já existia) em `<sala>/quadro/`, reduzida a 1200 px no aparelho
  (`prepararImagem(arquivo, LADO_MAXIMO_FOTO)`). Trocar a foto muda o caminho (sufixo), senão o cache de
  um ano do Storage mostraria a antiga. O backup diário e o restaurador levam as fotos dos cartões junto.
- **Canal próprio** (`useQuadro`, fora do `useSala`) e tolerante à tabela ausente: o código pode ir ao ar
  antes do SQL. **Exceção**: sem a `0025` ligações e anotações somem, mas marcar cartão numa sessão
  falha (a coluna `diario.cartoes` não existe).
- **Robô** (`e2e/quadro.e2e.ts`, 4 cenários contra o banco): foto carrega, os três estados, ligação que
  não entrega cartão escondido, anotação, destaque, sessão, colunas arrastando (mouse), arrastar até coluna
  fora da tela à esquerda, mapa de ligações, rolagem ao ligar. A limpeza do robô (`limparImagens` em
  `apoio.ts`) agora apaga também `<sala>/quadro/`.
- **Lições**: (1) **conferir `git log -1 --format=%ae` depois de commitar** — dois commits saíram com o
  e-mail padrão do Mac e o Vercel bloqueou o deploy (o celular do Daniel seguia na versão antiga e ele
  achou que "não apareceu"). Este checkout agora tem `user.email` local certo. (2) **Não rodar o robô aqui
  enquanto o do GitHub roda** (`gh run list --workflow e2e.yml --limit 1` → `completed`): mesma sala, um
  apaga o do outro (derrubou testes que pareciam defeito; um alerta de falha no GitHub teve essa causa).
  (3) Teste que mede posição na tela: os ids são sorteados, então o desenho muda a cada rodada — arraste em
  direção ao centro, e role até o elemento antes de apertar.

## Recap da sessão (02/10/2026, sem migration)

Botão **📝 Gerar recap da sessão** em Campanha → Sessões (só o Mestre). Escolhe uma sessão e o app escreve um
RASCUNHO que cai no formulário "nova entrada" do Diário; **nada é salvo** até o Mestre editar e apertar
"+ nova entrada". Regras puras em `lib/recap.ts` (testadas, 22 testes), tela em `RecapDaSessao.tsx`.

- **Não existe "sessão" no banco.** Sessão = trecho do log de combate sem buraco de mais de 3 h
  (`detectarSessoes`); trecho com menos de 5 linhas é mexida avulsa e não aparece. A lista mostra até 6.
- **O `sala.log` da tela guarda só as últimas 40 linhas** (`TAMANHO_LOG`). O recap NÃO usa ele:
  `hooks/lerHistoricoDoLog.ts` lê o `combat_log` direto do banco (até 3 páginas de 1000 linhas) na hora do clique.
- **O recap lê as frases do log por regex** (`resumirSessao`): "X sofreu N de dano (hp/max)", "recuperou N PV",
  "entrou no combate", "Rodada N começou", teste de morte, "conjura", "ficou <condição>", e linhas que começam com 🎒/💰
  (baú). Os testes geram as linhas com as funções reais de `regras.ts` (`mensagemAjustePV`, `resolverTesteMorte`...):
  **se alguém mudar uma frase do log, o teste do recap quebra de propósito.** Linha não reconhecida é ignorada
  (contar de menos é melhor que inventar). Quem não é jogador conta como inimigo; PV de inimigo não vai pro log, então
  o recap só sabe o dano total que eles sofreram, não quantos caíram.
- **Por isso o baú agora escreve no log** (`🎒 Ana pegou 2× Poção do baú`, `💰 O Mestre guardou 41 PO no baú`, divisão
  de dinheiro, item jogado fora, e "guardar no baú" a partir do inventário). É a única fonte do tesouro no recap.
- Cartões do Quadro mostrados à mesa (`destaque_em` dentro da sessão + 30 min, só os `revelado`) entram como
  "Mostrado à mesa". O texto cabe no limite do diário (2000 caracteres); se passar, as últimas seções caem e um "…" avisa.
- Robô: `e2e/recap.e2e.ts` (semeia 54 linhas de log de dois dias atrás, mais que as 40 da tela, e confere o rascunho,
  a edição e o salvar no diário).

## Histórico do baú (02/10/2026, sem migration)

Em Campanha → 🎒 Baú, seção **📜 Histórico do baú** (fechada por padrão; `HistoricoDoBau.tsx`, regras em `lib/historicoBau.ts`, 8 testes):
quem guardou, pegou, dividiu ou jogou fora o quê, e quando, agrupado por Hoje / Ontem / dia, com filtro Tudo / 🎒 Itens / 💰 Dinheiro.

- **Não há tabela de histórico**: é o log do combate. Cada troca do baú já escreve uma linha que começa com 🎒 (item) ou 💰 (dinheiro);
  o histórico é essas linhas. É a MESMA fonte do recap da sessão (`ehLinhaDoBau` é um só, em `historicoBau.ts`, e o recap importa de lá) —
  **se mudar o prefixo das frases do baú, mude as marcas lá**, senão histórico e recap perdem as linhas.
- **Só existe a partir de 02/10/2026** (dia em que o baú passou a escrever no log). O que foi mexido antes não deixou rastro.
- Lê do banco com o filtro no servidor (`or=(text.like.🎒*,text.like.💰*)`, as 200 mais novas): o `sala.log` da tela guarda só 40 linhas
  misturadas com o combate. Abre sob pedido e, aberto, **relê sozinho** quando chega linha nova no log (`gatilho` = id da linha mais nova).
  Mostra 30 e abre mais de 30 em 30. O dia é o do fuso de quem olha (a sessão da noite não cai no "dia seguinte").
- É público como o log: qualquer um da mesa abre. O telão não mostra.
- Robô: `e2e/historicoBau.e2e.ts`.

## Tempo da campanha (04/10/2026, migration `0028`)

Em Campanha, o chip **🗓 Dia N** (ou "Tempo", antes de começar) abre `TempoDaCampanha.tsx`. Todo mundo vê; **só o Mestre mexe**
(a trava é na tela, o banco é aberto como o resto). Duas tabelas novas, `campanha_tempo` (uma linha por sala, chave = a sala; `dia`
é um contador que começa em 1) e `campanha_efeitos` (um efeito por linha: nome, quem, `inicio_dia`, `duracao` em dias, nota).
Canal próprio (`useTempo.ts`, molde do `useBau`) e tolerante à migration ausente ("falta rodar a migration 0028").

- **Avançar o dia é "troco só se ninguém mexeu antes"** (`update ... where dia = o que li`, repete até 6×): dois aparelhos tocando
  "+1 dia" juntos passam UM dia, não dois. Botões: "+ 1 dia", "passar dias" (N), "voltar 1 dia" (corrigir clique errado, com
  confirmação) e **🌙 Descanso longo do grupo**: aplica `aplicarDescansoLongo` em todos os personagens de jogador numa escrita só
  (`atualizarVariosPersonagens`) e SÓ ENTÃO passa 1 dia; se a escrita das fichas falha, o dia não passa. O descanso longo da
  ficha individual não mexe no dia: nem todo jogador descansa junto, então **o dia é do Mestre**. Por isso o Mestre também tem
  **🌙 Descanso longo nas Ações em massa** (aba Combate): descansa só quem está selecionado e, com a campanha contando, passa 1 dia
  (um só, não um por selecionado), com o log "🗓 Descanso longo de Ana, Beto. Passou 1 dia...". Decidido em 04/10/2026; tentei
  antes ligar o botão da ficha ao dia (com trava `descanso_dia`, migration 0029) e o Daniel recusou, então não existe.
  **O botão "Descanso longo" da ficha só aparece pro Mestre** (o jogador vê só "Descanso curto"; decidido por ele em 04/10/2026):
  o descanso longo é recurso do Mestre. O jogador não tem mais jeito de fazer descanso longo sozinho.
- **Calendário** (`lib/tempoCampanha.ts`, 17 testes): "só Dia N" (padrão) ou **Harptos** (Forgotten Realms: 12 meses de 30 dias + 5
  festivais = 365; **Shieldmeet, o dia extra de a cada 4 anos, não entra**). A data é derivada do contador + uma âncora
  (`inicio_dia_do_ano`, `inicio_ano`), então "hoje é 16 de Flamerule de 1492" (Calendário → "Hoje é…") só move a âncora, nunca o
  contador nem os efeitos.
- **Efeitos**: nascem no dia atual e vencem em `inicio_dia + duracao`. A lista mostra "faltam 3 dias" / "falta 1 dia" (cor de alerta)
  / "venceu hoje" / "venceu há N dias" (esmaecido); vencidos ficam até o Mestre encerrar. Ao avançar o dia, os que acabam de vencer
  ganham uma linha no log e um aviso na tela. Máx. 100 por sala.
- **Log e recap**: toda linha do tempo começa com 🗓 (`MARCA_DE_TEMPO`); o recap da sessão ganhou a seção "Tempo da campanha"
  (`resumirSessao().tempo`) com essas linhas.
- Backup: as duas tabelas entram no backup bruto diário (`TABELAS_COM_SALA`; `campanha_tempo` não tem `id`, então vai em
  `UMA_LINHA_POR_SALA`) e o robô de tela limpa as duas. O robô de esquema confere as colunas contra o banco.
- **Não cobre**: relógio/hora do dia, estações e clima, efeito ligado à ficha do personagem (a lista é à parte; o "quem" é texto),
  contagem em rodadas de combate (isso já existe nos prazos das condições), mudar o dia pelo jogador.

## Folhas de entrega (11/10/2026, migration `0037_perigos_e_folhas.sql`)

Cartas, pergaminhos e o mapa do tesouro. Escolha do Daniel: o Mestre entrega a **um jogador (em segredo) ou à mesa toda**.
Parte nova **📜 Folhas** da aba Campanha (`FolhasDaCampanha.tsx`, `useFolhas.ts`, regras em `lib/folhas.ts`, testadas).

- **O que o Quadro já fazia e a folha NÃO repete**: mostrar uma foto em tela cheia pra mesa (o "📣 Mostrar à mesa agora" dos cartões,
  telão e celulares, com silhueta). O que faltava era entregar algo a **um** jogador, em segredo.
- Tabela `folhas`: `titulo`, `texto` (até 2000), `foto` (caminho no bucket `mapas`, em `<sala>/folhas/`), `para` (slug do jogador; nulo =
  a mesa toda) e `entregue_em` (nulo = **rascunho**, só o Mestre vê). `folhasVisiveis` decide quem vê o quê (rascunho: só o Mestre; entregue:
  o destinatário, ou todos; telão e quem não escolheu quem é: nada). Esconde NA TELA, como o resto.
- **Aviso**: o jogador recebe o banner "📜 Chegou uma folha pra você" (`BannerFolhaNova`, com vibração curta) em qualquer aba menos a
  Campanha; "ler" abre direto as Folhas. O que cada aparelho **já abriu** fica só nele (`localStorage`, `lerVistas`/`guardarVistas`); abrir a
  lista dá as folhas por vistas e o botão mostra "📜 Folhas (2)" enquanto há novas.
- Foto: reduzida a 1400 px no aparelho (`prepararImagem`), caminho novo a cada envio (cache de um ano), apagada do Storage quando a folha ou
  a foto sai. Entra no backup bruto (tabela e fotos) e no robô de esquema.
- Robô `e2e/folhas.e2e.ts`: rascunho invisível, entrega pra Ana (aviso só pra ela, foto carrega, Beto não vê), recolher, mudar pra mesa toda,
  apagar (some a foto do Storage).

## Relógios de tensão e Loja (12/10/2026, migration `0038_relogios_loja_percepcao_portas.sql`)

Duas partes novas da aba Campanha, pedidas pelo Daniel: **⏳ Relógios** (só o Mestre) e **🛒 Loja** (Mestre monta, jogador compra).

- **Relógios** (`lib/relogios.ts`, `hooks/useRelogios.ts`, `RelogiosDaCampanha.tsx`). Círculo de 4, 6, 8, 10 ou 12 fatias que o Mestre enche
  com "+" e esvazia com "−"; `visivel = false` deixa só pra ele (preparo). A mesa vê uma **faixa de relógios** logo abaixo das abas, em qualquer
  tela, e no **telão** um cartão no canto de cima (`RelogiosNaMesa`). **A consequência é segredo até o relógio fechar** (`consequenciaVisivel`).
  Cada passo vira uma linha no log ("⏳ Ritual: 3 de 6"; ao fechar, "⏰ Ritual fechou (6 de 6)! <consequência>"), **menos os escondidos**, que
  andam em silêncio. Cheio fica vermelho; o "+" desliga. Limite de 20 por sala.
- **Loja** (`lib/loja.ts`, `hooks/useLoja.ts`, `LojaDaCampanha.tsx`; tabelas `lojas` e `loja_itens`). O Mestre cria a loja (nasce **fechada**),
  põe itens (nome, preço, estoque ou "sempre tem", peso, mágico, descrição) e toca em "abrir pra mesa". **O preço é guardado em peças de cobre**
  (`preco_pc`, inteiro; 1 PO = 100 PC): sem centavo quebrado; a tela mostra "5 PO", "3 PP" ou "2 PO · 5 PP" (platina não aparece, a mesa conta em ouro).
  - **Comprar** (no celular do jogador): 1) baixa o estoque (`tirarEstoque`: "troco só se ninguém mexeu antes", como o baú, então duas pessoas
    na última unidade não levam as duas); 2) `alterarListasDoPersonagem` paga e põe o item no inventário **com a conta refeita em cima da ficha de
    verdade** (se o dinheiro não chega mais, devolve null e o estoque volta); 3) loga "🛒 Ana comprou 2× Poção por 100 PO (Loja)".
    Se o passo 2 falha, o estoque é **devolvido**: nada sai da loja se a compra não terminou.
  - **O troco** (`pagar`): gasta primeiro as moedas pequenas; se falta, quebra a menor moeda que cobre e devolve o troco em ouro, prata e cobre
    (electro e platina nunca são troco). Testado que nunca cria nem perde dinheiro. O botão mostra o motivo quando não dá ("Faltam 4 PO.",
    "Só restam 2.", "Esgotado.").
  - Loja fechada é invisível pra mesa (`lojasVisiveis`, esconde NA TELA). Apagar a loja apaga os itens (`on delete cascade`).
- Backup bruto: `relogios`, `lojas` e `loja_itens` entram em `TABELAS_COM_SALA`; robô de esquema confere as colunas; `limparSala` limpa as três.
- Robôs `e2e/relogios.e2e.ts` (criar, encher, a mesa vê, consequência só ao fechar, esconder, apagar) e `e2e/loja.e2e.ts` (montar, abrir, comprar com
  troco, sem dinheiro, esgotar, **duas pessoas na última unidade: só uma leva e a outra não paga**, fechar, apagar).
- **Não cobre**: vender de volta, desconto/regateio, loja só pra um jogador, catálogo pronto do SRD, relógio que avança sozinho por rodada.
