# Fichas, classes e progressão

> Parte do `AGENTS.md` (dividido em 09/10/2026; o texto é o mesmo de antes, só mudou de lugar). **Leia quando:** Antes de mexer em ficha de personagem, em `atualizarPersonagem`/`alterarListasDoPersonagem` ou em qualquer coluna que viaja inteira.

- **Ficha clássica do jogador** (`FichaClassicaJogador.tsx`, 01/10/2026, sem
  migration). **Quem joga abre a própria ficha já na folha; o resumo de
  combate completo é só do Mestre** (combinado com o Daniel; a primeira versão
  deixou a folha atrás de "+ ver ficha completa" pra todo mundo e ele
  cobrou). `FichaPersonagem` tem `modoJogador = !souMestre && !p.is_npc`: o
  jogador vê PV (−/+, máx/atual/temp), os testes de morte **no topo quando
  está a 0 PV**, inspiração/concentração, CA/iniciativa/deslocamento/PP/CD
  editáveis, **a folha** (`modo="jogador"`: não repete CA/iniciativa/
  deslocamento, e chama o cartão de "resumo", que é o que o Mestre vê), ataques
  e descansos, exaustão/dados de vida/condições, recursos, munição,
  vantagens, notas, "Classe e conjuração" e as seções da ficha completa — sem
  botão pra abrir; a linha editável de "Bônus de resistência" some (os blocos
  da folha cobrem). O Mestre vê o cartão resumido de sempre, com o "+ ver ficha
  completa" (que abre a mesma folha). A 375px o cartão do jogador tem ~3.600px
  numa ficha enxuta e **5.030px na do Tibério** (o do Mestre, ~1.800px): é uma
  ficha inteira, as seções recolhem. Medido em 01/10/2026: com as quatro seções
  de `FichaClasse` abertas o Tibério dava 6.170px (só "Classe e conjuração" tinha
  1.572px), e a ficha completa, recolhida, ficava empurrada lá pra baixo. Hoje
  "Classe e conjuração", "Espaços de magia" (é só o botão de gerar) e "Habilidades
  de <classe>" abrem **recolhidas**; "Modificadores" abre aberta porque é onde se
  liga/desliga bônus durante a luta; e "Classe e conjuração" abre aberta quando o
  personagem não tem classe (a folha manda cadastrar ali). Seção nova de
  configuração nasce recolhida. **O arranjo
  da folha é o da folha de papel** (o Daniel pediu o arranjo, não o visual de
  papel: a paleta é a do app): faixa de identidade ("Classe · Nível ·
  Proficiência"), card recolhido "Próximo nível · Paladino 2" (o que a classe
  ganha, `habilidadesDoNivel`, e o PV ao subir, `pvAoSubir`: valor fixo do dado
  + CON, só com uma classe) — desde 02/10/2026 com o botão que SOBE o nível (ver "Subir de nível"), tiles (CA, iniciativa e deslocamento só leitura —
  edita-se no cartão —, percepção passiva, CD e ataque de magia) e **seis blocos
  de atributo**: caixa à esquerda (sigla, modificador grande, valor editável) e,
  à direita, a resistência e as perícias DAQUELE atributo (o agrupamento sai de
  `PERICIAS[].atributo`, não de memória), com bolinha de proficiência e ×2 pra
  especialista. A 375px os blocos empilham (1.180px, tudo à vista); a partir de
  560px viram duas colunas empacotadas (`column-count`, sem esticar um bloco até
  a altura do vizinho). **As contas são todas de `regras.ts`**
  (`bonusResistencia`, `bonusPericia`, `cdMagia`...) — nada reimplementado.
  **Calcular continua sendo sugestão**: o cartão de combate manda (item mágico
  soma por cima da fórmula), então cada diferença aparece como "cartão +0 ·
  usar", e há um "usar todos os calculados" que grava só as colunas que
  mudaram. O que era do `FichaClasse` (grade de atributos, resistências,
  perícias, PP/CD) saiu de lá; ficou "Classe e conjuração", espaços de magia,
  modificadores e habilidades por nível. `FichaPersonagem` (o cartão de
  combate) não mudou. Dado conferido: Paladino de FOR 20/CON 14/CAR 14 dá CD
  12, ataque +4, Atletismo +7 — os números da ficha real do Daniel Gracewick.
  A primeira versão (discos + listas separadas, perícias recolhida) foi
  publicada e o Daniel disse que não era a folha de papel: lição, **mostrar o
  arranjo antes de portar pro app**.
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
  subclasse — as 12 classes do SRD 2024 já estão todas populadas. **Pegadinha
  já achada aqui**: a `open5e` erra o nível de algumas habilidades (viu isso
  no Monge — "Deflect Attacks" veio sem nível, "Stunning Strike" veio em dois
  níveis diferentes — e no Bardo, "Bard Subclass" veio sem nível);
  quando o nível não fechar sozinho, cruzar com uma segunda fonte
  (aidedd.org, Roll20 Compendium) antes de confiar.
- **Vantagens & resistências** (`vantagens_resistencias`, migration `0011`):
  campo próprio na ficha, separado das Notas rápidas, só pra personagem de
  jogador. Antes isso ficava misturado em texto livre.
- **Ataques do jogador** (`AtaquesPersonagem.tsx`, mesma coluna `ataque`, sem
  migration): no topo da ficha, logo abaixo do PV, uma linha por ataque no
  formato "Nome: acerto, dano" (`separarAtaques()` em `regras.ts` só separa o
  nome pra destacar — não interpreta número). Aparece como lista de ler, com
  "editar" atrás: a ficha do jogador está sempre editável pra ele e pro
  Mestre, e um campo de texto rolando por dentro não dá pra ler no turno.
  Antes os ataques do jogador ficavam escondidos em "+ ver ficha completa".
- **Ficha completa abre pra LER** (`FichaCompleta.tsx`): texto inteiro, sem a
  caixinha de 3 linhas com rolagem por dentro, e as seções vêm **recolhidas**
  (sumário; a ficha do Daniel Gracewick ia de ~22 mil px pra ~5 mil). Quem pode
  editar liga o modo edição no botão "✎ editar ficha" do topo (`editando`,
  local — fecha junto com a ficha). Seção criada agora nasce **aberta**
  (`qtdAoAbrir`), senão sumiria da tela. O cabeçalho inteiro de qualquer
  `SecaoRecolhivel` abre/fecha ao toque, não só a setinha (campo/botão dentro do
  cabeçalho seguem funcionando: o clique só alterna se não veio de
  `button, input, select, textarea, a`).
- **Nome de ataque não leva parênteses** (`lerSegmentoAtaque`): tudo entre `()`
  é descartado como observação, então "Espada Longa (1 mão)" e "(2 mãos)" viravam
  dois botões 🎲 idênticos. Use "Espada Longa, uma mão: +7, 1d8+5 …".

## Inventário, magias e baú do grupo (02/10/2026, migration `0026`)

O Daniel pediu "o que falta pra ficar completo" e escolheu inventário + magias. Três peças:

- **Inventário e moedas** (`InventarioPersonagem.tsx`, regras em `lib/inventario.ts`, testadas): colunas
  `moedas`/`inventario` em `characters` (viajam no backup sozinhas). Peso em **kg** por unidade;
  capacidade = Força × 7,5 kg (a tradução brasileira de "Força × 15 lb"); moeda pesa 0,01 kg; sintonia
  máxima 3 (o botão recusa o 4º). Item comum repetido empilha; mágico nunca empilha.
- **Magias** (`MagiasPersonagem.tsx`, regras em `lib/magias.ts`, testadas): coluna `magias`. **Espaço de
  magia NÃO é campo novo** — continua sendo o recurso "Espaço de magia Nv. N" que a calculadora de classe
  gera (`PREFIXO_ESPACO_MAGIA`); conjurar só gasta esse recurso e liga a concentração que a ficha já tinha
  (`concentration`/`concentration_on`, e segurar outra larga a anterior e avisa). Truque não gasta;
  ritual (só se a magia for ritual) não gasta; escolher espaço maior sobe o nível. O gasto vai pro log do
  combate ("X conjura Y"). Magia não preparada fica esmaecida mas pode ser conjurada (conhecida × preparada
  varia por classe; não travar a mesa).
- **Catálogo do SRD 5.2** (339 magias): `scripts/gerar-magias-srd.mjs` baixa da open5e e grava
  `lib/magiasSrdGerados.ts` (**não editar à mão**). Dados (nível, escola, tempo, alcance em metros, duração,
  dano, salvaguarda, classes) vêm da fonte e são traduzidos por tabelas no gerador. **O texto das regras
  está em português**: foi traduzido com a skill baoyu-translate (modo normal, estilo técnico, glossário em
  `.baoyu-skills/baoyu-translate/EXTEND.md`, pés/milhas → metros) e vive em `scripts/magias-ptbr.json`;
  `scripts/importar-traducao-magias.mjs` só aceita tradução em que toda magia e seção existem, os dados de
  rolagem (8d6...) são idênticos e não sobrou pé/milha. O gerador recusa rodar se faltar magia no JSON.
  O nome em português segue a tradução do livro de **2014**; 18 ficaram em inglês por falta de nome em que
  se confie — pode divergir do livro de 2024. A fonte tem duas lacunas: Invisibilidade Maior vem sem texto
  (`TEXTO_FALTANTE` no gerador) e Tsunami tem um "### U-Z Spells" solto do PDF (a tradução já tirou).
  O catálogo é **lazy** (`useCatalogoMagias`, ~340 KB, só baixa ao abrir "+ magia"), busca-primeiro como o de monstros.
- **Baú do grupo** (aba Campanha → 🎒 Baú; `useBau.ts`, `BauDoGrupo.tsx`): tabela `bau_itens`, uma linha por
  item; **o dinheiro também é linha** (`moeda` preenchida, única por tipo e sala). Mexer na quantidade é
  "troco só se ninguém mexeu antes" (`update ... where qtd = a que li`, repete até 6×): dois celulares
  tirando a mesma poção não tiram a mesma unidade. Passar do baú pra ficha é DOIS passos (tira do baú, põe no
  personagem); se o segundo falha, o primeiro é desfeito. **A escrita no personagem lê o inventário da cópia
  em memória** (igual o resto da ficha): dois aparelhos mexendo no inventário da MESMA pessoa no mesmo segundo
  ainda podem se atropelar. Qualquer um da mesa guarda/pega; o Mestre escolhe quem recebe. Não escreve no
  log de combate (seria ruído); se a mesa quiser histórico de quem pegou o quê, é a próxima melhoria.
- **Tolerante à migration ausente**: `normalizar*` aceitam coluna inexistente; o baú mostra "falta rodar a
  0026" (`ehTabelaAusente`). Mesmo assim, **rode a 0026 antes do push**: sem ela, gravar inventário/magias falha.
- Fora do escopo desta leva (decidido; o limite de preparadas, a subida de nível e o histórico do baú
  entraram depois, ver abaixo): backup do baú dentro do botão "backup" do app (ele entra no backup bruto diário,
  `TABELAS_COM_SALA`, como o Quadro).

## Corrida de escrita da ficha (02/10/2026) — LEIA antes de mexer em `atualizarPersonagem`

O robô do inventário perdia item/magia adicionado em sequência (2 de 3 salvavam). Era um defeito antigo do app, que o
inventário e as magias (listas inteiras numa coluna) só deixaram mais visível. **Quatro causas, todas fechadas no
`useSala.ts`**:

1. **Escritas em paralelo na mesma ficha chegavam ao banco trocadas** (a mais velha por último desfazia a mais nova).
   Agora `escreverNaFicha` serializa as escritas de **cada ficha** (`cadeiaDeEscritaRef`); fichas diferentes seguem em
   paralelo. `atualizarPersonagem` e `atualizarVariosPersonagens` passam por ela.
2. **O eco do tempo real de uma escrita ANTERIOR chegava no meio da seguinte e revertia a tela**, e a ação seguinte
   partia da lista velha. O evento da ficha é **ignorado enquanto há escrita nossa em voo**; quando a fila da ficha
   esvazia, ela é **relida uma vez** (isso também traz o que outro aparelho mudou nesse meio tempo).
3. **Evento fora de ordem** (o tempo real não garante a ordem): `lib/ecoAtrasado.ts` descarta o evento mais velho que a
   linha da tela, pelo `updated_at` (trigger `tocar_updated_at`, migration 0001). Sem carimbo legível, o evento passa.
4. **A releitura da sala inteira (`carregar`, roda a cada inscrição do canal) trazia uma foto lida antes da escrita.**
   Ficha com escrita em voo, ou mais nova na tela que na foto, é mantida.

Armadilha que custou horas: eu tinha feito um hook (`useValorOtimista`) que "lembrava o último valor gravado até o banco
confirmar" — **não funcionava**, porque a "lista do banco" que o componente enxerga já é o estado OTIMISTA do `useSala`
(igual ao que acabou de gravar desde o primeiro milissegundo), então a confirmação vinha na hora. O log mostrou
"PEND set" e "PEND limpa" com 20 ms de diferença, antes do PATCH sair. Foi removido. Lição: **achar a causa no log
(console.log temporário + o PATCH que saiu) antes de empilhar remendo**; três remendos seguidos só mudaram a taxa de falha.
Os robôs `inventario`/`recap` rodaram 15 vezes seguidas sem falhar, sem nenhuma espera artificial.

### Mesma corrida nas tabelas do mapa e da campanha (12/10/2026)

Tudo acima vale para `characters`/`combat_state`, as únicas tabelas com `updated_at`. As outras (`cena_paredes`, `relogios`,
`cena_pecas`, `cena_armadilhas`, `cena_marcas`...) trocam a linha inteira pelo `msg.new` do tempo real, sem filtro. Resultado
**reproduzido em teste de hook** (`useRelogios.test.ts`, `useParedes.test.ts`, com o banco falso segurando os ecos): em toques
seguidos o eco do PRIMEIRO chega depois de a tela já ter ido ao segundo, a tela volta atrás, e o toque seguinte parte do valor
velho (relógio: três toques davam 2 fatias; porta: abrir, fechar, abrir deixava fechada). É a explicação mais provável de um dos
testes instáveis do robô (a caixa "secreta" da porta piscava e o `uncheck()` não clicava) e, sem reprodução, do de `andarComParedes`.

- **`lib/escudoDeEco.ts`**: sem `updated_at` o critério é o TEMPO. Ao gravar numa linha, `escudo.proteger(id)`; durante 3 s o
  aviso dessa linha é ignorado (`escudo.protegido(id)`); passada a janela o hook RELÊ a tabela uma vez (`escudo.aoFechar`), o que
  traz o que outro aparelho mudou nesse meio tempo. Falta só o atraso, nunca o dado.
- **Aplicado em** `useRelogios` (`atualizar`) e `useParedes` (`alternarPorta`, `atualizarPorta`). **Não precisa** de `loja`, `bau` e
  `tempo`: eles gravam por comparar-e-trocar contra o BANCO (leem a linha, só gravam se ela ainda for a que leram), não contra a tela.
- **Se for escrever hook novo** que grava valor CALCULADO do que a tela mostra (`cheias + 1`, `!aberta`), use o escudo, ou
  compare-e-troque contra o banco como `useBau.ajustar`. Teste com `bd.reterEcos()` / `bd.soltarEcos(n)` (`bancoFalsoParaTeste.ts`).
- **Ainda sem escudo**: `usePecas`, `useArmadilhas`, `useMarcas`, `useEfeitos`, `useCenas`, `useNevoa`, `useFolhas`, `useQuadro`. Numa
  BUSCA por contas sobre o estado (`+ delta`, `!x.aberta`...) não achei gravação calculada da tela neles (não li um por um), então
  no pior caso piscam por instantes. Se aparecer toque perdido num deles, o conserto é o mesmo e já tem molde pronto.
~~O que NÃO foi resolvido: dois aparelhos mexendo na MESMA lista da MESMA pessoa~~ — resolvido em 05/10/2026, ver "Listas da
ficha com trava de versão" logo abaixo.

### Listas da ficha com trava de versão (05/10/2026, migration `0032_versao_listas.sql`, rodada e conferida)

`inventario`, `magias` e `moedas` viajam como a lista INTEIRA, montada a partir da cópia local. O caso real: o Mestre passa um
item do baú pro inventário de um jogador (`BauDoGrupo`) enquanto o jogador edita o dele — quem gravasse por último apagava a
mudança do outro. **O baú em si nunca teve esse problema** (uma linha por item, moeda troca só se ninguém mexeu).
- **Coluna `characters.versao_listas`** (inteiro, começa em 0). **`alterarListasDoPersonagem(id, fazer)`** no `useSala`:
  `fazer(fichaDeAgora)` devolve o patch, ou `null` se o que a pessoa tocou já não existe. O UPDATE leva
  `.eq("versao_listas", v)` e soma 1; se zero linhas mudam (outro aparelho mexeu), relê a ficha direto do banco e chama `fazer`
  de novo em cima dela (até 5 vezes, `MAX_TENTATIVAS_VERSAO`). Devolve `"ok" | "mudou" | "erro"`. Roda dentro da mesma fila por
  ficha das outras escritas (`naCadeiaDaFicha`), então a ordem se mantém.
- **Edição por item acha o item pelo CONTEÚDO, não pela posição** (`acharIgual` em `lib/inventario.ts`): a posição muda quando
  alguém apaga ou acrescenta antes. Item que saiu ou mudou → não grava e a tela diz "mudou em outro aparelho".
- **Lista nova da ficha (ou qualquer coluna que viaje inteira) passa por aqui, nunca por `atualizarPersonagem`.** Os componentes
  recebem `alterarListas` (tipo `AlterarListas` em `tipos.ts`); `patch` fica pro resto (PV, concentração, recursos).
- **Dividir moedas do baú**: se uma escrita falha, só a parte de quem não recebeu volta ao baú (antes devolvia tudo e duplicava
  o dinheiro de quem já tinha recebido).
- **Compatibilidade**: sem a coluna (linha de antes da migration) ou sem internet, cai no caminho antigo (a fila sem internet já
  só grava o que o banco ainda tem como a mudança encontrou). O resto da ficha continua mandando só a coluna que mudou.
- **Testes**: `useSala.test.ts` (grava e soma a versão; outro aparelho mexeu no meio → nenhum item some; item saiu → "mudou").
  Conferido plantando o defeito (tirar o `.eq` da versão): 2 testes falham. **Não testado com dois celulares de verdade** — só
  o banco de mentira. `versao_listas` entrou na lista de `e2e/esquema.e2e.ts`.

## Subir de nível (02/10/2026, sem migration)

Antes existia só a PRÉVIA ("Próximo nível · Paladino 2": o que a classe ganha e o PV sugerido) e o jogador somava tudo
à mão. Agora o card tem **⬆ Subir para o nível N** (`SubirDeNivel.tsx`, regras puras em `lib/subirDeNivel.ts`, 33 testes):
mostra EXATAMENTE o que vai mudar, e só então grava tudo numa escrita, escreve no log ("X subiu para o nível N (Classe N)") e
entra no botão ↩ Desfazer (`lembrarDesfazer`, igual aos PV). Quem pode: o dono da ficha e o Mestre (`editavel`).

- **PV**: valor fixo (metade do dado + 1) ou o que o jogador rolou (1 até as faces), mais Constituição, **no mínimo 1**. O dado
  é o **da classe que sobe** (`DADO_DE_VIDA`, conferido na fonte), não o `hd_die` da ficha — importa na multiclasse. PV atual
  sobe junto, **menos pra quem está a 0** (nível não levanta ninguém caído). Dado de vida +1 (o gasto continua gasto); `hd_die`
  só é trocado quando há UMA classe.
- **Aumento de atributo** nos níveis 4, 8, 12 e 16 (**6 e 14 pro Guerreiro, 10 pro Ladino**; `NIVEIS_DE_ATRIBUTO`, tabela própria
  porque o catálogo de habilidades só marca o nível 4): +2 num atributo ou +1 em dois, ninguém passa de 20, ou "talento" (o app
  não conhece os efeitos: manda anotar). A Constituição vale pro nível novo e, **se o modificador dela sobe, soma o retroativo de
  todos os níveis de antes** (+1 PV por nível por ponto). Nível 19: só avisa da Dádiva Épica.
- **Espaços de magia**: só quando há UMA classe conjuradora e é ela que sobe; mexe só nos recursos "Espaço de magia Nv. N" que
  a calculadora gerou. O máximo sobe e **o que já foi gasto continua gasto**. Sem espaços gerados na ficha: não inventa, avisa.
  Duas conjuradoras (tabela de multiclasse): avisa e deixa pra pessoa. Pacto do Bruxo: o nível do espaço sobe e o antigo some.
- **Habilidades novas** (do catálogo) listadas na confirmação; marcada a opção (liga por padrão), vão pra uma seção de lista
  "Habilidades de <Classe>" na ficha completa — sem duplicar se o nível for refeito e sem apagar o que o jogador escreveu.
- **Bônus de proficiência** é derivado do nível (nada a gravar), mas CD/resistências/percepção do cartão NÃO mudam sozinhos
  (o cartão manda, item mágico soma por cima): quando a proficiência sobe, a confirmação manda usar "usar o calculado".
- **Contadores da classe** (19/10/2026, `RECURSOS_DE_CLASSE`): o botão também sobe o máximo de Fúria, Canalizar Divindade, Segundo Fôlego,
  Pontos de Foco, Pontos de Feitiçaria e Mãos Consagradas (valores da tabela do SRD 5.2). Acha o contador pelo nome (sem acento), o
  gasto continua gasto, e cria o contador só no nível em que a habilidade nasce. Forma Selvagem fica de fora (fonte sem tabela). Antes
  só os espaços subiam e o resto ficava velho — foi o "ficou pela metade" do Daniel e da Bárbara.
- **Multiclasse nova** (primeiro nível de uma classe que o personagem ainda não tem) NÃO está aqui: continua sendo cadastrar a
  classe em "Classe e conjuração". O botão sobe níveis de classes que já estão na ficha. Teto de 20 no total.
- Robô: `e2e/subirDeNivel.e2e.ts` (Paladino 3→4 com +1 FOR/+1 CON, PV retroativo, log, habilidades na ficha completa e desfazer).

## Limite de magias preparadas (03/10/2026, sem migration)

Em Magias, o contador virou "3/5 preparadas" (`limiteDePreparadas` em `lib/magias.ts`, 4 testes). O limite é a soma, por
classe, da coluna "Prepared Spells" da tabela de classe do SRD 5.2 no nível dela (lida da open5e `srd-2024`, conferida
linha a linha; Bardo, Clérigo, Druida, Feiticeiro, Bruxo, Mago, Paladino, Patrulheiro). **É aviso, não trava**: preparar
acima do limite funciona, o contador fica na cor de alerta e aparece uma frase, porque magia sempre preparada de
subclasse/juramento não conta no limite e o app não sabe quais são (mesmo critério da conjuração sem espaço travado).
Multiclasse soma, porque a ficha não guarda de qual classe é cada magia. **Fica sem limite** (mostra só o número, como
antes): personagem sem classe cadastrada e Guerreiro/Ladino/Bárbaro/Monge — Cavaleiro Arcano e Trapaceiro Arcano são
subclasses que o SRD não publica, e não chutei tabela. Truque não conta nas preparadas (já era assim).

**Truques conhecidos** (mesmo dia): ao lado do contador, "2/3 truques" (`limiteDeTruques`/`contarTruques`, 3 testes), coluna "Cantrips" do SRD 5.2, mesma soma por classe e mesmo critério de aviso (truque de espécie, talento e subclasse vêm de fora da tabela). Só Bardo, Clérigo, Druida, Feiticeiro, Bruxo e Mago têm coluna; Paladino/Patrulheiro não têm truque. Sem truque na lista, o contador não aparece.

**Sempre preparada** (04/10/2026, sem migration — `magias` é jsonb): campo `sempre` na magia (`MagiaPersonagem.sempre`), marcado
num checkbox nos detalhes da magia ("sempre preparada: subclasse, juramento, espécie"; só nível 1+). Marcar liga
`preparada` junto; `normalizarMagia` também faz isso se o banco trouxer `sempre` sem `preparada`, e ficha antiga lê como
`false`. Magia sempre preparada **não conta** em `contarPreparadas` (nem no limite), e o contador mostra "3/5 preparadas · +2
sempre". O chip vira "sempre" (desabilitado; desmarcar é nos detalhes). Isso fecha a ressalva dos avisos de limite: quem
marca fica exato. Truque extra de subclasse/espécie/talento usa o mesmo campo `sempre`: no truque (nível 0) o checkbox dos detalhes vira "truque extra", ele sai de `contarTruques` e o contador mostra "4/3 truques · +1 extra" (`contarTruquesExtras`). Marcar não mexe em `preparada` (truque não se prepara).

## Ataques calculados do jogador (04/10/2026, migration `0027`)

Na ficha do jogador, "Ataques" → "editar" ganhou **ataques calculados** (`AtaquesPersonagem.tsx`, regras em `lib/ataquesFicha.ts`, 13
testes): cada um guarda atributo, proficiência, bônus extra de acerto e de dano, dado (`1d8`) e tipo. O acerto e o dano saem dos
atributos e do nível total NA HORA (nada de resultado guardado: subiu a Força ou o nível, muda sozinho). Acerto = modificador +
proficiência (se marcada) + extra; dano = dado + modificador + extra (proficiência só no acerto). Coluna `ataques jsonb` em
`characters` (máx. 30). **O campo livre `ataque` continua valendo**: a lista mostra os calculados primeiro e o texto livre depois,
então ficha antiga não perde nada e o que não cabe na conta (magia de ataque, ataque especial) segue como texto.
**O painel de rolagem da iniciativa não mudou**: `textoEfetivoDeAtaques(p)` devolve o texto no mesmo formato do campo livre ("Espada
longa: +7, 1d8+4 cortante", sinal ASCII `-`, não o `−` da ficha clássica) e o `RolarAtaques`/`lerAtaquesRolaveis` lê igual; o teste
confere que o texto gerado volta com o mesmo acerto e dano. NPC só usa o texto livre. Não cobre: dano versátil/duas mãos, ataque
extra, crítico de classe, arma de ataque à distância com desvantagem, bônus de estilo de luta automático (vai em "acerto/dano extra").


## XP do personagem (04/10/2026, migration `0030`)

Coluna `xp integer` em `characters` (0 a 10.000.000). **Só o Mestre mexe** (a trava é na tela): pelas **Ações em massa** (aba
Combate: "🏅 XP pra cada" dá o mesmo valor a cada selecionado, "🏅 Dividir XP" reparte um prêmio — o que não divide certo sobra e
o aviso diz quanto; valor negativo só no "pra cada", pra corrigir erro; NPC não tem XP; vai pro log e dá pra desfazer) ou
acertando o número na ficha (`XpDoPersonagem.tsx`, dentro da ficha clássica, acima dos cards "Próximo nível": placar "1.250 / 2.700",
barra e "Faltam 1.450 XP pro nível 4" ou "XP suficiente pro nível 4"). Contas em `lib/experiencia.ts` (10 testes).
- **O XP não sobe o nível nem trava nada.** Campanha por marco simplesmente não usa (a barra fica vazia e o "Subir de nível" da ficha
  continua valendo pros dois jeitos de jogar). O nível mostrado vem das classes da ficha, não do XP.
- **Tabela de XP por nível**: a do livro (igual em 2014 e 2024). O SRD 5.2 na open5e só me deixou conferir dois pontos (64.000 no nível
  10 e 355.000 no 20); o resto veio do livro básico. Multiclasse usa o nível TOTAL.
- Log: toda linha começa com 🏅 ("🏅 Ana ganhou 300 XP (total 1.250)"); o recap da sessão ganhou a seção "XP" com essas linhas.
- **Não cobre**: calcular o XP pelos monstros derrotados (o catálogo tem o XP por ND, mas o app não sabe quem morreu "de verdade"),
  XP por jogador diferente no mesmo prêmio, e subir o nível automático ao bater o limite.

## Efeito de magia na CA (19/10/2026, sem migration)

O Daniel jogou de Paladino e conjurou Escudo da Fé: o app gastava o espaço e ligava a concentração, mas a CA não mudava. Hoje `conjurar` (`lib/magias.ts`) também liga um **Modificador** de campo `"ca"` (o mesmo sistema de "Modificadores" da ficha de classe, então sem coluna nova) para as magias de `EFEITOS_DE_CA`: Escudo da Fé +2 e Velocidade +2 (concentração), Escudo Arcano +5 (sem concentração, encerra à mão). **A CA digitada (`p.ac`) nunca é alterada**: as telas mostram `p.ac + efeitosDeCa(p).bonus` (`regras.ts`). Efeito de concentração (`Modificador.concentracao`) só conta enquanto `concentration_on` for o nome dele — perdeu a concentração, a CA volta sozinha. Armadura Arcana fica de fora de propósito (troca a conta da CA, não soma). Tela de CA nova deve usar `efeitosDeCa`. Os espaços de magia agora ficam no cabeçalho da seção Magias (visíveis fechada), e conjurar mostra uma confirmação (`.mg-feito`). Robô: `e2e/inventario.e2e.ts`.
