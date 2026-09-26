/**
 * Dica de tática, escrita à mão, dos monstros GERADOS (monstrosSrdGerados.ts).
 * A chave é o nome no SRD em inglês (`en`). Fica separada dos números de
 * propósito: o gerador pode rodar de novo sem apagar as dicas.
 *
 * Cada dica sai da leitura do texto 2024 daquele monstro na fonte (traços,
 * ações, ações bônus, reações) — não de memória (ver AGENTS.md, "A mesa joga
 * D&D 2024"). Não repete o que a nota automática já diz (ND, voo, imunidades,
 * Tática de bando): a dica vai na frente dela (ver MONSTROS_SRD).
 * Distâncias em metros (5 pés = 1,5 m).
 *
 * Ordem de escrita, combinada com o Daniel em 26/09/2026: ND 0 a 2 primeiro
 * (os dois grupos estão no nível 1), depois ND 3–10, ND 11+ e por último os
 * animais.
 */
export const DICAS_TATICA: Record<string, string> = {
  // ── Lote 1 (26/09/2026): PNJs e clássicos de masmorra de ND 0 a 2 ──
  "Goblin Minion":
    "Frágil, mas escorregadio: toda rodada pode Desengajar ou se Esconder como ação bônus (Fuga Ágil) — ataca e some atrás da cobertura. Furtividade +6. A adaga também é arremessada (até 6m).",
  "Goblin Boss":
    "Dois ataques por turno, de cimitarra ou arco, e Fuga Ágil (Desengajar ou Esconder como ação bônus). Reação Redirecionar Ataque: quando é atacado, troca de lugar com um aliado Pequeno ou Médio a até 1,5m e o ataque vai no aliado — derrube os lacaios em volta dele primeiro.",
  "Scout":
    "Vigia: Percepção +5 e Furtividade +6, costuma ver o grupo antes de ser visto. Prefere ficar longe com o arco longo (alcance 45m); dois ataques por turno, podendo misturar com a espada curta.",
  "Tough":
    "Capanga de gangue ou de taverna. Anda em grupo: com um aliado ao lado do alvo, ataca com vantagem. Maça de perto, besta pesada de longe (alcance 30m).",
  "Warrior Infantry":
    "Soldado raso de patrulha ou exército. Fraco sozinho; em formação, ataca com vantagem sempre que outro aliado está ao lado do alvo. A lança também é arremessada (até 6m).",
  "Priest Acolyte":
    "Apoio do grupo inimigo: 1x/dia, como ação bônus, conjura Bênção, Palavra Curativa ou Santuário — cura o chefe ou se protege. Chama radiante à distância (18m), ou maça com dano radiante extra.",
  "Cultist Fanatic":
    "Líder de culto. 2x/dia cria uma Arma Espiritual com ação bônus, que ataca de novo a cada turno. Conjura Comando 2x/dia e Imobilizar Pessoa 1x/dia (CD 12) — tira um herói da luta logo no começo. A lâmina soma 2d6 necrótico.",
  "Pirate":
    "Duas adagas por turno, de perto ou arremessadas. Pode trocar uma delas por Charme Arrebatador: um alvo a até 9m faz teste de Sabedoria CD 12 ou fica Enfeitiçado até o próximo turno do pirata.",
  "Spy":
    "Ação Ardilosa: Disparada, Desengajar ou Esconder como ação bônus — ataca e some. Os dois ataques somam 2d6 de veneno. Percepção +6 e Furtividade +6: bom pra emboscada, e escala pra fugir pelos telhados.",
  "Berserker":
    "Um ataque só, e pesado (machado grande). Com metade dos PV ou menos, ataca e faz testes de resistência com vantagem — fica mais perigoso quando está perdendo.",
  "Noble":
    "Luta mal; vale mais pela conversa: Enganação e Persuasão +5, Intuição +4. Reação Aparar: +2 de CA contra um ataque corpo a corpo que ia acertar.",
  "Commoner":
    "Aldeão, servo, trabalhador. É treinado numa perícia à escolha do Mestre, com vantagem nela — o ferreiro, o barqueiro, o guia do lugar.",
  "Dretch":
    "Demônio menor e lento. 1x/dia solta Nuvem Fétida: quem estiver a até 3m faz teste de Constituição CD 11 ou fica Envenenado — e, envenenado, no próprio turno faz ação OU ação bônus (não as duas) e fica sem reação.",
  "Grimlock":
    "Cego, mas percebe tudo a até 9m sem precisar enxergar — escuridão, invisibilidade e se esconder na frente dele não adiantam. Escala bem e embosca em túnel; o porrete soma dano psíquico.",
  "Gray Ooze":
    "Arma não mágica que o acerta fica com −1 no acerto (quebra em −5), e munição comum se desfaz. O pseudópode corrói armadura não mágica: −1 de CA a cada acerto. Magia e arma mágica resolvem.",
  "Rust Monster":
    "Não quer matar ninguém — quer comer metal, e fareja metal a até 9m. Todo turno morde e usa as Antenas duas vezes (mais uma como reação quando é atingido): o dono da armadura ou arma de metal não mágica faz teste de Destreza CD 11 ou ela perde 1 (armadura se desfaz ao chegar a CA 10; arma, em −5).",
  "Animated Armor":
    "CA 18: difícil de acertar pra grupo de nível baixo. Dois golpes por turno, e percebe tudo a até 18m sem precisar enxergar.",
  "Animated Flying Sword":
    "Difícil de acertar (CA 17), mas cai rápido (14 PV). Percebe tudo a até 18m sem precisar enxergar.",
  "Darkmantle":
    "Ataca de cima. O Esmagar prende no alvo; se o ataque teve vantagem e o alvo é Médio ou menor, cobre a vítima: Cega e sufocando enquanto estiver preso, e ele só ataca aquele alvo, com vantagem. Soltar: ação e teste de Força (Atletismo) CD 13. 1x/dia, escuridão mágica de 4,5m em volta, que visão no escuro não atravessa.",
  "Mimic":
    "Com ação bônus vira objeto (baú, porta, móvel). Na forma de objeto, quem encosta gruda: fica Agarrado (escapar CD 13, com desvantagem). Contra quem está agarrado, a mordida tem vantagem e causa 2d8+3 em vez de 1d8+3.",
  // ── Lote 2 (26/09/2026): o resto de ND 0 a 1 ──
  "Awakened Shrub":
    "Fraco e lento, com um arranhão de 1 de dano: serve mais de vigia ou distração do que de ameaça.",
  "Homunculus":
    "Serve a um mestre, com quem fala por telepatia no mesmo plano — é os olhos e ouvidos dele. A mordida pede Constituição CD 12: falhou, Envenenado até o fim do próximo turno do homúnculo; falhou por 5 ou mais, Envenenado por 1 minuto e Inconsciente enquanto isso (acorda se levar dano).",
  "Lemure":
    "Diabo menor, lento e sem cabeça pra tática: o perigo é vir em massa. Morto nos Nove Infernos, volta em 1d10 dias — a menos que quem matou esteja sob Bênção ou os restos levem água benta.",
  "Shrieker Fungus":
    "Não ataca: é um alarme. Reação: quando uma criatura ou uma luz forte chega a até 9m, grita por 1 minuto, e o grito se ouve a 90m — acorda o que mora por perto.",
  "Merfolk Skirmisher":
    "Nada rápido e anda mal: luta na água. A lança oceânica tira 3m do deslocamento do alvo até o fim do próximo turno dele e volta pra mão depois de arremessada (até 6m).",
  "Axe Beak":
    "Ave grande e veloz (15m), sem truque nenhum: corre, bica e alcança quem tenta fugir a pé.",
  "Blink Dog":
    "Ação bônus: teleporta até 12m (recarga 4-6) — aparece do lado de quem está sozinho ou some quando cercado. Percepção e Furtividade +5.",
  "Pseudodragon":
    "Duas mordidas por turno, ou o ferrão: Constituição CD 12 ou 2d4 de veneno e Envenenado por 1 hora; falhou por 5 ou mais, também Inconsciente enquanto envenenado (acorda com dano ou se alguém ao lado usar uma ação pra acordar).",
  "Sprite":
    "Fica invisível quando quer (magia Invisibilidade em si mesmo). O arco encantador faz só 1 de dano, mas deixa o alvo Enfeitiçado até o próximo turno do sprite. Furtividade +8. Visão do Coração: descobre emoções e alinhamento de quem está a 1,5m (Carisma CD 10).",
  "Steam Mephit":
    "Ataques contra ele têm desvantagem (forma embaçada), a não ser que esteja Incapacitado. Sopro de vapor (recarga 6): cone de 4,5m, 2d4 de fogo e −3m de deslocamento (Constituição CD 10). A explosão ao morrer causa 2d4 de fogo a 1,5m (Destreza CD 10, metade se passar).",
  "Violet Fungus":
    "Quase não se mexe, mas o toque apodrecido alcança 3m, duas vezes por turno. Percebe tudo a até 9m sem precisar enxergar.",
  "Cockatrice":
    "A mordida petrifica: o alvo faz Constituição CD 11 — na primeira falha fica Contido e repete o teste no fim do próximo turno; na segunda falha vira pedra (Petrificado) por 24 horas.",
  "Dust Mephit":
    "Sopro cegante (recarga 6): cone de 4,5m, Destreza CD 10 ou Cego até o fim do próximo turno do mefite. 1x/dia conjura Sono (CD 10). A explosão ao morrer causa 2d4 contundente a 1,5m (Destreza CD 10, metade se passar).",
  "Ice Mephit":
    "Sopro gélido (recarga 6): cone de 4,5m, 3d4 de frio (Constituição CD 10, metade se passar). 1x/dia, Névoa Obscurecente pra cobrir a fuga. A explosão ao morrer causa 2d4 de frio a 1,5m (Constituição CD 10).",
  "Magma Mephit":
    "Sopro de fogo (recarga 6): cone de 4,5m, 2d6 de fogo (Destreza CD 11, metade se passar). A explosão ao morrer causa 2d6 de fogo a 1,5m (Destreza CD 11).",
  "Magmin":
    "O toque põe fogo no alvo (e em objeto inflamável que ninguém esteja segurando), que continua queimando até apagar. Acende ou apaga as próprias chamas com ação bônus (luz de 3m). Ao morrer, explode: 2d6 de fogo a até 3m (Destreza CD 11, metade se passar).",
  "Sahuagin Warrior":
    "Contra quem já perdeu PV, ataca com vantagem (Frenesi de Sangue) — cai em cima do ferido. Ação bônus: nada todo o deslocamento em linha reta até um inimigo. Controla tubarões a até 36m por telepatia. Fora d'água precisa mergulhar a cada 4 horas.",
  "Satyr":
    "O coice empurra alvo Médio ou menor até 3m. Zombaria à distância (até 27m): Sabedoria CD 12 ou 1d6+2 psíquico. Atuação +6.",
  "Troll Limb":
    "Pedaço de troll que continua lutando. Regenera 5 PV no começo de cada turno; fogo ou ácido cortam isso no turno seguinte, e ele só morre se começar o turno com 0 PV sem regenerar. Se não for destruído em 24h, rola 1d12: no 12 vira um troll inteiro.",
  "Warhorse Skeleton":
    "Rápido (18m). Correu 6m ou mais em linha reta antes de acertar o casco: alvo Grande ou menor fica Caído.",
  "Brass Dragon Wyrmling":
    "Sopro de fogo (recarga 5-6) em linha de 6m: 4d6 (Destreza CD 11). Tem também o Sopro do Sono, em cone de 4,5m (Constituição CD 11): Incapacitado até o fim do próximo turno e testa de novo; na segunda falha, Inconsciente por 1 minuto (acorda com dano ou se alguém ao lado usar uma ação).",
  "Copper Dragon Wyrmling":
    "Sopro ácido (recarga 5-6) em linha de 6m: 4d8 (Destreza CD 11). Tem também o Sopro Retardante, em cone de 4,5m (Constituição CD 11): até o fim do próximo turno o alvo fica sem reação, com metade do deslocamento, e faz ação OU ação bônus.",
  "Death Dog":
    "Duas mordidas por turno. A mordida pede Constituição CD 12: na falha, Envenenado — e, enquanto envenenado, o PV máximo não volta no descanso longo, o alvo testa de novo a cada 24h e, a cada nova falha, perde 1d10 de PV máximo.",
  "Dryad":
    "Encanta antes de lutar: Enfeitiçar Monstro à vontade (CD 14), e no mesmo turno ainda ataca — chicote de vinha (alcance 3m) ou espinhos (18m). 1x/dia, Constrição e Passos sem Pegadas. Ação bônus: de uma árvore grande pula pra outra a até 18m. Fala com feras e plantas.",
  "Hippogriff":
    "Dois ataques por turno, e sai voando de perto sem provocar ataque de oportunidade. Percepção +5.",
  "Quasit":
    "Demônio espião: fica invisível quando quer e vira morcego, centopeia ou sapo (só muda o deslocamento). O rasgo deixa Envenenado até o próximo turno dele. 1x/dia, Assustar: Sabedoria CD 10 a até 6m ou Amedrontado (repete o teste no fim de cada turno).",
  "Specter":
    "Cada acerto do Drenar Vida também reduz o PV máximo do alvo no mesmo tanto — perigoso pra personagem de nível baixo. Terminar o turno dentro de parede custa 1d10 de força. Resiste a quase todo dano elemental; arma comum, radiante e força funcionam.",
  "Sphinx of Wonder":
    "Reação 2x/dia, Lampejo de Engenho: +2 num teste de atributo ou de resistência dela ou de outra criatura a até 9m. O rasgo soma 2d6 radiante. Arcanismo e Religião +4.",
  // ── Lote 3 (26/09/2026): ND 2 — fecha tudo de ND 0 a 2 ──
  "Animated Rug of Smothering":
    "Em alvo Médio ou menor, pode agarrar em vez de causar dano (escapar CD 13): a vítima fica Cega, Contida, sufocando e leva 2d6+3 contundente no começo de cada turno dela. Enquanto agarra, o tapete toma metade do dano que recebe, e a vítima leva o mesmo tanto — bater no tapete machuca o amigo.",
  "Ankheg":
    "Sente vibração a até 18m e sai do chão por baixo. A mordida agarra alvo Grande ou menor (escapar CD 13), e contra quem está agarrado ataca com vantagem. Borrifo ácido (recarga 6) em linha de 9m: 4d6 ácido (Destreza CD 12).",
  "Awakened Tree":
    "Lenta, mas bate forte e de longe (alcance 3m, 2d8+4), e tem muito PV pro nível de desafio.",
  "Azer Sentinel":
    "No fim de cada turno dele, quem ele escolher a até 1,5m leva 1d10 de fogo — ficar colado custa caro. Brilha (luz forte de 3m): não se esconde no escuro.",
  "Black Dragon Wyrmling":
    "Dois rasgos por turno. Sopro ácido (recarga 5-6) em linha de 4,5m: 5d8 (Destreza CD 11) — derruba um personagem de nível 1 sozinho.",
  "Bronze Dragon Wyrmling":
    "Dois rasgos por turno. Sopro de relâmpago (recarga 5-6) em linha de 12m: 3d10 (Destreza CD 12). Tem também o Sopro de Repulsão, em cone de 9m (Força CD 12): empurra 9m e derruba.",
  "Green Dragon Wyrmling":
    "Dois rasgos por turno. Sopro venenoso (recarga 5-6) em cone de 4,5m: 6d6 (Constituição CD 11) — pega o grupo junto se estiver amontoado.",
  "Silver Dragon Wyrmling":
    "Dois rasgos por turno. Sopro de frio (recarga 5-6) em cone de 4,5m: 4d8 (Constituição CD 13). Tem também o Sopro Paralisante (mesmo cone e CD): na primeira falha, Incapacitado até o fim do próximo turno e testa de novo; na segunda, Paralisado (repete o teste no fim de cada turno, até 1 minuto).",
  "White Dragon Wyrmling":
    "Dois rasgos por turno. Sopro de frio (recarga 5-6) em cone de 4,5m: 5d8 (Constituição CD 12). Anda e escala gelo sem teste, e neve ou gelo não atrasam ele.",
  "Centaur Trooper":
    "Rápido (15m). Dois ataques por turno: pique (alcance 3m) ou arco longo. Ação bônus Investida Pisoteadora (recarga 5-6): corre sem provocar ataque de oportunidade, atravessando criaturas Médias ou menores; cada uma faz Força CD 14 ou leva 1d6+4 contundente e cai.",
  "Druid":
    "Dois ataques por turno (cajado de vinha, ou fagulha a até 27m). Conjura Constrição e Onda Trovejante 2x/dia e Raio Lunar 1x/dia (CD 13) — prende e separa o grupo. Percepção e Medicina +5.",
  "Ettercap":
    "Vive entre teias: anda nelas sem prender e sente quem encosta. Fio de teia (recarga 5-6), até 9m: Destreza CD 12 ou Contido (a teia tem CA 10 e 5 PV, e fogo a destrói fácil); com ação bônus puxa o preso 7,5m pra perto. A mordida envenena até o próximo turno dele.",
  "Ghast":
    "Fedor: quem começa o turno a até 1,5m faz Constituição CD 10 ou fica Envenenado até o próximo turno (passou, fica imune por 24h). A garra paralisa quem não é morto-vivo até o fim do próximo turno (Constituição CD 10), e a mordida soma 2d8 necrótico — ele morde o paralisado.",
  "Gibbering Mouther":
    "Balbucio: quem começa o turno a até 6m faz Sabedoria CD 10 ou rola 1d8 — 1-4 não faz nada, 5-6 anda pra direção aleatória, 7-8 ataca alguém aleatório ao alcance. O chão a até 3m é terreno difícil. A mordida derruba alvo Médio ou menor, e quem cai a 0 PV por ela morre e é absorvido.",
  "Grick":
    "Bico e tentáculos no mesmo turno; os tentáculos agarram alvo Médio ou menor (escapar CD 12). Escala e tem Furtividade +4: bom pra emboscada em caverna.",
  "Merrow":
    "Luta melhor na água. O arpão (arremessado até 6m) puxa alvo Grande ou menor 4,5m pra perto — arrasta pra dentro d'água. A mordida deixa Envenenado até o fim do próximo turno dele.",
  "Minotaur Skeleton":
    "Um ataque por turno: chifrada ou pancada (2d10+4). Correu 6m ou mais em linha reta antes de acertar a chifrada: +2d8 perfurante, e o alvo Grande ou menor cai.",
  "Ochre Jelly":
    "Escala parede e teto e passa por frestas. Reação Dividir: com 10 PV ou mais, quando chega à metade dos PV ou leva dano elétrico ou cortante, vira duas geleias menores com os PV divididos — machado e raio multiplicam o problema. Prefira contundente, perfurante, fogo ou frio.",
  "Ogre Zombie":
    "Muito PV e CA baixíssima. Ao cair a 0 PV, faz Constituição (CD 5 + o dano) pra ficar com 1 PV — não vale contra dano radiante nem acerto crítico.",
  "Pegasus":
    "Muito rápido, a pé (18m) e voando; o coice soma 2d4 radiante. Percepção +6.",
  "Sea Hag":
    "Aparência Vil: fera ou humanoide que começa o turno a até 9m vendo a forma verdadeira dela faz Sabedoria CD 11 ou fica Amedrontado (passou, imune por 24h). Olhar Mortal (recarga 5-6), só em alvo Amedrontado: falhou na Sabedoria CD 11, com 20 PV ou menos cai direto a 0 PV. Usa Disfarçar-se por 24h.",
  "Wererat":
    "Ação bônus: vira rato (Pequeno) ou híbrido. Dois ataques por turno, e pode trocar um por mordida: humanoide mordido faz Constituição CD 11 ou é amaldiçoado — se cair a 0 PV, vira homem-rato sob controle do Mestre, com 10 PV (passou, imune por 24h). Furtividade +5.",
  "Will-o'-Wisp":
    "Ação bônus: fica invisível, com a luz junto, até atacar. Com outra ação bônus mata quem está a 0 PV a até 1,5m (Constituição CD 10) e recupera 3d6 PV — proteja o caído perto dele. CA 19: difícil de acertar.",
};
