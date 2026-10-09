# Catálogo de monstros (SRD 5.2)

> Parte do `AGENTS.md` (dividido em 09/10/2026; o texto é o mesmo de antes, só mudou de lugar). **Leia quando:** Antes de acrescentar, editar ou regerar monstros.

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
    traria os 31 KB pra abertura do app). A montagem de encontro
    (`EncontrosPreparados`) tem o mesmo botão "ficha" (02/10/2026), sem o
    "copiar": lá tocar na linha adiciona ao grupo e a ficha serve só pra olhar
    o bicho antes. Conferido a 375px: o botão fica no canto e a linha não engorda.
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
