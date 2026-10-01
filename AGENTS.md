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

## Estado (15/09/2026) — já está tudo publicado e funcionando

- **No ar**: https://painel-de-mesa.vercel.app — testado de ponta a ponta
  (leitura e escrita reais), sala `setimo-raio` com o Tibério Vaz.
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
  + CON, só com uma classe), tiles (CA, iniciativa e deslocamento só leitura —
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
  `souMestre=false` (NPC não revelado aparece como "Inimigo 2"). Desde
  19/09/2026 mostra também **as condições de quem está na vez** (com o prazo,
  a exaustão e o "Inconsciente" de jogador a 0 PV) — elas valem pra mesa
  inteira ver, como já valiam na ordem e no log; NPC a 0 PV não entra nisso,
  que é PV dele disfarçado. A folga do corpo da página some no telão
  (`body:has(.telao)`): ela empurrava o conteúdo pra fora da tela da TV e
  deixava a página rolando 84px à toa (achado medindo). Desde 25/09/2026
  **segura a tela acesa** — ver "Revisão de tecnologia" mais abaixo.
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
- **Vantagens & resistências** (`vantagens_resistencias`, migration `0011`):
  campo próprio na ficha, separado das Notas rápidas, só pra personagem de
  jogador. Antes isso ficava misturado em texto livre.
- **Catálogo de monstros**: o SRD 5.2 inteiro, **331 criaturas** (desde
  26/09/2026; antes eram 56), com CA, PV, iniciativa, ND, linha de ataque
  (acerto + dano) e notas. A busca ignora acento de propósito — no teclado do
  celular se digita "manticora", não "Mantícora" — e casa também contra o
  tipo ("morto-vivo" devolve todos os mortos-vivos) e o **nome em inglês**
  ("owlbear", o do livro); "nd 5" ou "nd 1/4" devolve os daquele nível de
  desafio. Por isso o campo `cls` tem que seguir o padrão "Monstruosidade
  média", "Morto-vivo médio": inventar outro formato tira o bicho da busca
  por tipo (o teste confere o padrão nos 331). Como é montado:
  - **Duas listas.** `MONSTROS_CURADOS` (`monstrosSrd.ts`, 56, escritos à mão
    com dica de tática) + `MONSTROS_GERADOS` (`monstrosSrdGerados.ts`, 275,
    **gerado** por `scripts/gerar-monstros-srd.mjs` — não editar à mão). O
    gerador lê a open5e (`srd-2024`) e traduz com tabelas próprias (nomes,
    142 ataques, 48 ações de resistência, danos, condições, tipos/tamanhos,
    algumas habilidades); as notas saem automáticas: ND e XP, deslocamentos
    além de andar, imunidades/resistências, Resistência Lendária, magia (CD),
    ações lendárias. Rodar de novo dá o mesmo arquivo (conferido baixando da
    fonte).
  - **Dica de tática dos gerados** mora em `monstrosDicas.ts`
    (`DICAS_TATICA`, chave = nome em inglês), **separada dos números** — o
    gerador pode rodar de novo sem apagar nada; `MONSTROS_SRD` põe a dica na
    frente da nota automática. Cada dica sai da **leitura da ficha 2024
    daquele monstro na fonte** (traços, ações, ações bônus, reações), nunca de
    memória: no lote 1 caíram três frases do tipo "parece decoração até
    atacar", que era a Falsa Aparência de 2014 e não está na ficha 2024 da
    Armadura animada, da Espada voadora nem do Limo cinzento. A dica não repete
    o que a nota automática já diz (ND, voo, imunidades). Ordem combinada com
    o Daniel em 26/09: **ND 0–2 primeiro** (a Forgotten Realms é nível 1; a
    Salamina é nível 7), depois ND 3–10, ND 11+ e os animais por último.
    Em 26/09 saíram os lotes 1 (20, PNJs e clássicos de masmorra), 2 (28, o
    resto de ND 0 a 1) e 3 (23, ND 2): **todos os 71 monstros gerados de ND 0
    a 2 que não são animais têm dica**. Próximo: ND 3–10 (71), depois ND 11+
    (46) e os 87 animais. O lote 3 achou mais um erro do gerador: a vírgula de
    lista ("using Bite, Claw, or Harpoon") cortava a frase do ataque múltiplo
    e o Merrow saía sem "2 ataques:" — só ele mudou ao corrigir. **Na open5e, "RECHARGE" também é recarga no dado** (o
    "Recharge 4-6" do cão intermitente) — o gerador chegou a traduzir como
    "1x por descanso"; não afetava linha nenhuma (as 13 são ações bônus),
    mas foi corrigido.
  - **Pegadinhas da fonte, já tratadas no gerador:** (1) o `speed_all`
    inventa escalada/natação pela metade do deslocamento (regra geral) — usar
    só `speed`; (2) o **tamanho** "Small" da open5e junta Miúdo, Pequeno e
    "Médio ou Pequeno" — o dado de vida desempata (d4 / d6 / d8; os 84
    "Small" caem certinho), o que corrigiu 13 dos curados (humanoides eram
    "pequeno", Diabrete e Estirge são miúdos); (3) o dano da desc é a fonte
    confiável (o `attacks[]` estruturado troca o tipo de lugar), e o "+1d4 se
    tiver vantagem" do goblin é condicional — fica fora da linha e vai pra
    nota. Na conferência de 26/09 os 56 curados bateram 100% em CA, PV e
    iniciativa; Estirge e Espectro tinham o **voo** no lugar do deslocamento
    (corrigido: `speed` é andar, o voo vai na nota).
  - O "Espectro" curado é o **Wraith**; o Specter entrou como "Aparição".
  - Bicho miúdo tem **dano fixo** ("Arranhão +4, 1 cortante", "Mordida +4, 1
    perfurante + 1d4 veneno"): `lerDanoFixo` em `regras.ts` lê isso, e o
    resultado diz "(fixo)". O teste de `ataquesRolados.test.ts` confere que
    **cada pedaço** de cada uma das 331 linhas vira um botão — foi ele que
    achou a aranha. Três criaturas não atacam (Mosca gigante, Cavalo-marinho,
    Fungo gritador) e ficam com `ataque` vazio.
  - **Carrega sob demanda** (`useCatalogoMonstros`, `import()` dinâmico): o
    catálogo é um pedaço de ~31 KB compactado (era 17,6 antes das
    estatísticas, medido no build de 01/10/2026) que só baixa quando a
    biblioteca ou a montagem de encontro aparece — nunca na abertura do app.
    Sem internet e sem ter baixado antes, a tela diz e oferece tentar de novo.
  - **Nome do monstro é o do livro, em inglês** (pedido do Daniel, 30/09/2026
    — "Ursopar" não agradou; o do catálogo era "Urso-coruja"). Só o nome: tipo,
    notas, ataque e o resto continuam em português. Nos dados nada mudou (`name`
    segue em português, `en` é o do livro, e a busca casa os dois): quem troca é
    a tela — `BibliotecaNpcs`/`EncontrosPreparados` mostram `m.en` grande e
    `m.name` pequeno, e o que vai pra biblioteca/encontro/combate é `m.en`.
    **Monstro novo que sai do catálogo passa `name: m.en`**, senão o português
    volta pra ordem de iniciativa.
  - **Estatísticas da ficha clássica** (`monstrosSrdEstatisticas.ts`, 01/10/2026,
    **gerado** por `estatisticasDaFonte` no mesmo script — não editar à mão):
    os seis atributos (valor, não modificador), perícias, sentidos, idiomas, XP e
    percepção passiva das **331** (curados também; chave = nome em inglês),
    juntados em `MONSTROS_SRD` por `comEstatisticas`.
  - **Ficha clássica na tela** (`FichaClassicaMonstro.tsx`, 01/10/2026): na
    busca do catálogo (aba Mestre → Biblioteca de NPCs), cada resultado tem um
    botão "ficha" no canto que abre a ficha embaixo da linha (uma por vez), com
    "copiar pra minha biblioteca" dentro — só confirma "copiado" depois que o
    banco aceitar. O componente só importa **tipo** do catálogo (valor dele
    traria os 31 KB pra abertura do app). Ainda não existe na montagem de
    encontro (`EncontrosPreparados`), só na biblioteca.
    **A linha da biblioteca (monstro já copiado) também é a ficha**: abre
    recolhida (nome + "ND · CA · PV · inic.", 67px a 375px; aberta tem ~660px,
    e 15 monstros abertos dariam 10 mil px), ao toque abre a ficha, e
    "✎ editar" volta ao formulário de campos de antes. Sem migration: o monstro
    copiado leva o nome do livro, então atributos/perícias/sentidos/idiomas/XP
    saem do catálogo **pelo nome** (`achaNoCatalogo`, casa inglês ou
    português); os números da linha (CA, PV, ataque, notas) são sempre os da
    biblioteca, que o Mestre pode ter editado. Renomeou ou é NPC cadastrado à
    mão: a ficha mostra só o que ele tem, sem atributo inventado. O catálogo é
    carregado uma vez em `BibliotecaNpcs` e dividido entre a busca e as linhas.
    **Lição medida a 375px:** o botão ao lado da linha tirava 56px de largura e
    as estatísticas quebravam em 3 linhas — linha compacta média de 62 → 82px e
    a faixa maior de ~3.900 → 4.700px. Sobreposto no canto (`position:
    absolute`, com o `::after` pro alvo de toque de ~36px) deu 3.993px contra
    3.950px sem o botão. Botão novo em linha de lista: sobrepor, não somar.
  - O que **não** entra na ficha: ações e características em texto corrido — é prosa em
    inglês, e traduzir 331 à mão com conferência é projeto à parte (como as dicas
    de tática); `ataque` e `notes` continuam sendo o resumo. Idiomas: 70 frases
    diferentes na fonte em meia dúzia de moldes, traduzidas por `idiomas()`, que
    **dá erro em frase nova** de propósito (rodar o gerador acusa na hora).
    **Erro da fonte achado pelo teste de faixa (1–30): o Octopus vem com CON 0 e
    CAR −3** — corrigido em `CORRECOES_ATRIBUTOS` (CON 11, CAR 4, conferido no
    D&D Beyond). Se a open5e consertar, a correção vira inofensiva, mas dá pra
    tirar.
  - **Medido a 375px:** "ver todos" abre por **faixa de ND** (8 faixas, a maior
    com 54, ~3.900px), com a **linha compacta** (~62px: nome, ND, CA, PV, tipo);
    ataque e notas só aparecem quando a busca devolve até 8. Com as 5 faixas
    largas da primeira versão, "ND 0–1" tinha 135 monstros e 16.800px.
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
- **Bastião desligado por enquanto** (01/10/2026, a mesa não está usando):
  `BASTIAO_ATIVO = false` em `BarraAbas.tsx` esconde a aba. **Nada foi apagado**:
  o `PainelBastiao`, a tabela, os dados da campanha, o carregamento no `useSala`
  e o backup (que leva o Bastião) seguem como estavam. Religar = trocar por
  `true`. Quem está no `Painel` com a aba "bastiao" aberta cai no Diário
  (`abaEfetiva`).
- **GitHub**: [danielbgomes8/painel-de-mesa](https://github.com/danielbgomes8/painel-de-mesa)
  (privado), conectado ao Vercel — push na `main` já republica sozinho.
- **Supabase**: projeto próprio na org "Daniel Lima projetos" (região São
  Paulo), separado do gb-reserva. Migrations `0001` a `0019` e o `seed.sql`
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

- **Ficha completa abre pra LER** (`FichaCompleta.tsx`): texto inteiro, sem a
  caixinha de 3 linhas com rolagem por dentro, e as seções vêm **recolhidas**
  (sumário; a ficha do Daniel Gracewick ia de ~22 mil px pra ~5 mil). Quem pode
  editar liga o modo edição no botão "✎ editar ficha" do topo (`editando`,
  local — fecha junto com a ficha). Seção criada agora nasce **aberta**
  (`qtdAoAbrir`), senão sumiria da tela. O cabeçalho inteiro de qualquer
  `SecaoRecolhivel` abre/fecha ao toque, não só a setinha (campo/botão dentro do
  cabeçalho seguem funcionando: o clique só alterna se não veio de
  `button, input, select, textarea, a`).
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
- **Nome de ataque não leva parênteses** (`lerSegmentoAtaque`): tudo entre `()`
  é descartado como observação, então "Espada Longa (1 mão)" e "(2 mãos)" viravam
  dois botões 🎲 idênticos. Use "Espada Longa, uma mão: +7, 1d8+5 …".

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
  (1.1.18 → 1.1.21 e 5.0.9 → 5.0.12, só no lockfile). Ficou só o do Vitest.
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
  **Os alertas de segurança do GitHub estão desligados** no repositório
  (`vulnerability-alerts` = 404, `automated-security-fixes` = false). Ligar é
  configuração de segurança da conta: é o Daniel quem liga (Settings →
  Advanced Security → Dependabot alerts + security updates), não mexer por API.
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
   de tela, trava de sala e restauração do backup"). O `useSala` (1.854 linhas)
   ainda não tem teste próprio; o robô cobre o caminho principal do combate.
5. ~~Trava no apagar sala~~ — feito em 01/10/2026 (`0020`, rodada e conferida).
   **A lista de salas é pública**: `GET /rest/v1/rooms?select=code` com a
   chave `anon` devolve todos os códigos (conferido). Então "código difícil de
   chutar" (seção de trocar campanha, acima) **não esconde campanha nenhuma**.
   Trava barata sem login: o app nunca apaga sala inteira, dá pra tirar o
   `delete` de `rooms` do `anon` (as tabelas filhas continuam abertas).
6. ~~O backup diário nunca foi restaurado~~ — feito em 01/10/2026: script
   `restaurar-backup-bruto.mjs` + ensaio contra o banco de verdade, sem
   diferenças.
7. Menores: 280 KB compactados de JS na primeira abertura (o de monstros
   saiu dela em 26/09, carrega sob demanda; o de classes continua); nada confere sozinho se o banco
   bate com `tipos.ts` (conferido à mão em 25/09: bate). O log **não**
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

## Mapas com névoa de guerra (01/10/2026, migration `0018_cenas.sql`, já rodada)

O Daniel pediu "algo como o Roll20 faz pra mapa". Quatro etapas combinadas; a
**1 está construída** (cena + grade + névoa ao vivo + telão + celular), a **2
está completa** (ping, peões, régua e condições como ícone no peão) e a 3 e a 4
ainda não. Prioridade dita pelo Daniel em 01/10: **o ping é
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
- **Backup:** `cenas` e `cena_nevoa` entram no backup DIÁRIO bruto, mas **não a
  imagem** (fica no Storage) e **não** no botão "backup" do Mestre. O Mestre
  deve guardar o arquivo original do mapa.
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
- Medido: a primeira abertura do app cresceu ~31 KB sem compactar com o código
  do mapa (estático em `Painel`). Se pesar, dá pra carregar `PainelMapa` sob
  demanda como o catálogo de monstros (`import()` dinâmico).

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
  **Já achou um erro de verdade:** com a tabela dos peões ainda não criada o
  console mostra um 404 (o app trata, mas o robô falha de propósito). Com a 0019
  rodada, os 4 cenários passam (~20 s).
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
  restaurada. As imagens dos mapas NÃO estão no backup. **Ensaiado em 01/10/2026
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
componentes não têm teste nenhum (os 219 que existem são todos de funções
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
