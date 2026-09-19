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
  subclasse — as 12 classes do SRD 2024 já estão todas populadas. **Pegadinha
  já achada aqui**: a `open5e` erra o nível de algumas habilidades (viu isso
  no Monge — "Deflect Attacks" veio sem nível, "Stunning Strike" veio em dois
  níveis diferentes — e no Bardo, "Bard Subclass" veio sem nível);
  quando o nível não fechar sozinho, cruzar com uma segunda fonte
  (aidedd.org, Roll20 Compendium) antes de confiar.
- **Tela que volta do descanso relê a sala** (`carregar()` em `useSala.ts`):
  o tempo real do Supabase só entrega o que muda enquanto está conectado,
  não repassa o que passou durante a queda. Celular com a tela apagada
  voltava mostrando "sincronizado" com turno e PV velhos. Por isso a sala
  inteira é relida a cada reconexão do canal e sempre que a aba volta a
  ficar visível — **não tirar achando que é leitura repetida à toa**. Se um
  evento chega no meio da releitura, ela descarta e lê de novo (a foto do
  banco podia ser anterior ao evento). Testado derrubando o WebSocket de
  propósito e mudando o PV enquanto estava caído.
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
- **Telão** (`?telao=1`, `Telao.tsx`): mostra de quem é a vez e, abaixo, os 3
  próximos da ordem (`proximosDaOrdem` em `regras.ts`, que dá a volta na
  virada de rodada). Só **nomes** na lista do "a seguir" — PV de NPC é
  informação do Mestre e o telão é visto pela mesa inteira, então continua
  passando por `nomeExibidoIniciativa`/`pvExibidoIniciativa` com
  `souMestre=false` (NPC não revelado aparece como "Inimigo 2").
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
  "±" a mais o nome virava "Go…" (achado testando).
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
- **Ataques do jogador** (`AtaquesPersonagem.tsx`, mesma coluna `ataque`, sem
  migration): no topo da ficha, logo abaixo do PV, uma linha por ataque no
  formato "Nome: acerto, dano" (`separarAtaques()` em `regras.ts` só separa o
  nome pra destacar — não interpreta número). Aparece como lista de ler, com
  "editar" atrás: a ficha do jogador está sempre editável pra ele e pro
  Mestre, e um campo de texto rolando por dentro não dá pra ler no turno.
  Antes os ataques do jogador ficavam escondidos em "+ ver ficha completa".
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
- **GitHub**: [danielbgomes8/painel-de-mesa](https://github.com/danielbgomes8/painel-de-mesa)
  (privado), conectado ao Vercel — push na `main` já republica sozinho.
- **Supabase**: projeto próprio na org "Daniel Lima projetos" (região São
  Paulo), separado do gb-reserva. Migrations `0001` a `0016` e o `seed.sql`
  já rodadas — o banco tem onze tabelas (`rooms` mais dez filhas, todas
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

## Próximos passos (combinados em 17/09/2026)

Lista de melhorias que o Daniel aprovou, na ordem. Os riscados já foram
feitos — ficam aqui pra deixar claro de onde a ordem veio. O próximo é o 7.

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
7. **Explicar a condição na hora**: tocar em "Atordoado" e ver o que ela faz
   pelas regras de 2024.
8. **Funcionar sem internet** por alguns minutos (app instalável de verdade),
   pra queda de wi-fi no meio da luta.

Lacunas mapeadas na mesma revisão e ainda abertas, fora da lista acima: os
componentes não têm teste nenhum (os 176 que existem são todos de funções
puras em `lib/`);
e `combat_log` nunca é podado. (A terceira — `definirBastiao` sem controle de
concorrência — foi fechada em 18/09/2026 com a migration `0015`: mesma trava
de versão do combate, os dois agora passam por `gravarSeVersaoBater` em
`useSala.ts`.)

**Pendente com o Daniel** (não dá pra resolver sozinho): as fichas completas
de **Sigha**, **Mordecai** e **Massaranduba** — os três estão com atributos
10, então o botão "pôr todos na ordem" rola d20+0 pra eles; a classe do
**Mistery Grey**; e confirmar se **"Kensei"** (subclasse de 2014) ainda vale
pra Sigha nas regras de 2024.
