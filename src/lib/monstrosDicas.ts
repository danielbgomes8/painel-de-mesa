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
};
