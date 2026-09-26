import type { NovoModeloNpc } from "./tipos";
import { MONSTROS_GERADOS } from "./monstrosSrdGerados";

/** Monstro do catálogo: a ficha que vai pra biblioteca/encontro (só os
 *  campos de `NovoModeloNpc` são copiados), mais o nível de desafio e o nome
 *  no SRD em inglês — pra achar pelo nome do livro ("owlbear"). */
export type MonstroCatalogo = Required<NovoModeloNpc> & { nd: number; en: string };

/**
 * Os 331 monstros do SRD 5.2 = esta lista CURADA (escrita à mão, com dica de
 * tática nas notas) + os gerados de `monstrosSrdGerados.ts` (saem da fonte
 * pelo `scripts/gerar-monstros-srd.mjs`, com notas automáticas: ND,
 * deslocamentos, imunidades). Pra caprichar num gerado, traga-o pra cá e
 * ponha o nome em inglês em `CURADOS_EN` no gerador.
 *
 * Catálogo de referência rápida pra não digitar do zero — conferido contra o
 * SRD 5.2 de 2024 (Creative Commons CC-BY-4.0, Wizards of the Coast), que é a
 * edição desta mesa. São números de PARTIDA: ajuste como quiser depois de
 * "usar" (cada cópia vira um modelo seu, totalmente editável).
 *
 * Atenção ao trocar de edição: em 2024 a **iniciativa é um bônus próprio do
 * monstro**, não o modificador de Destreza — o Gigante do fogo tem Destreza 9
 * e mesmo assim rola iniciativa com +3. Vários bichos também mudaram de tipo
 * (goblinoides viraram fadas, kobold virou dragão) e de PV.
 *
 * O `cls` segue o padrão "Tipo tamanho" porque a busca casa contra ele:
 * procurar "morto-vivo" tem que devolver todos os mortos-vivos.
 */
export const MONSTROS_CURADOS: MonstroCatalogo[] = [
  { name: "Kobold", en: "Kobold Warrior", nd: 0.125, cls: "Dragão pequeno", ac: 14, hp_max: 7, speed: 9, init_mod: 2, ataque: "Adaga +4, 1d4+2 perfurante", notes: "Tática de Bando: vantagem no ataque se um aliado estiver adjacente ao alvo. Sensível à luz solar. Virou dragão na edição 2024." },
  { name: "Goblin", en: "Goblin Warrior", nd: 0.25, cls: "Fada pequena", ac: 15, hp_max: 10, speed: 9, init_mod: 2, ataque: "Cimitarra +4, 1d6+2 cortante · Arco curto +4, 1d6+2 perfurante", notes: "Cimitarra de perto, arco à distância. Virou fada na edição 2024." },
  { name: "Esqueleto", en: "Skeleton", nd: 0.25, cls: "Morto-vivo médio", ac: 14, hp_max: 13, speed: 9, init_mod: 3, ataque: "Espada curta +5, 1d6+3 perfurante · Arco curto +5, 1d6+3 perfurante", notes: "Imune a veneno." },
  { name: "Bandido", en: "Bandit", nd: 0.125, cls: "Humanoide médio ou pequeno", ac: 12, hp_max: 11, speed: 9, init_mod: 1, ataque: "Cimitarra +3, 1d6+1 cortante · Besta leve +3, 1d8+1 perfurante", notes: "Vem sempre em bando: besta à distância, cimitarra de perto." },
  { name: "Cultista", en: "Cultist", nd: 0.125, cls: "Humanoide médio ou pequeno", ac: 12, hp_max: 9, speed: 9, init_mod: 1, ataque: "Foice ritual +3, 1d4+1 cortante", notes: "Frágil sozinho; o perigo é o número." },
  { name: "Hobgoblin", en: "Hobgoblin Warrior", nd: 0.5, cls: "Fada média", ac: 18, hp_max: 11, speed: 9, init_mod: 3, ataque: "Espada longa +3, 2d10+1 cortante · Arco longo +3, 1d8+1 perfurante", notes: "Tática de Bando. A espada longa faz 2d10+1 — dano alto pro nível dele." },
  { name: "Lobo", en: "Wolf", nd: 0.25, cls: "Fera média", ac: 12, hp_max: 11, speed: 12, init_mod: 2, ataque: "Mordida +4, 1d6+2 perfurante", notes: "Tática de Bando: vantagem se um aliado estiver perto do alvo." },
  { name: "Urso-negro", en: "Black Bear", nd: 0.5, cls: "Fera média", ac: 11, hp_max: 19, speed: 9, init_mod: 1, ataque: "2x Dilacerar +4, 1d6+2 cortante", notes: "Dois ataques por turno. Nada e escala bem." },
  { name: "Zumbi", en: "Zombie", nd: 0.25, cls: "Morto-vivo médio", ac: 8, hp_max: 15, speed: 6, init_mod: -2, ataque: "Golpe +3, 1d8+1 contundente", notes: "Fortitude de Morto-vivo: teste de CON pra ficar com 1 PV em vez de cair. Imune a veneno." },
  { name: "Ghoul", en: "Ghoul", nd: 1, cls: "Morto-vivo médio", ac: 12, hp_max: 22, speed: 9, init_mod: 2, ataque: "2x Mordida +4, 1d6+2 perfurante · Garra +4, 1d4+2 cortante", notes: "Duas mordidas por turno. Imune a veneno." },
  { name: "Aranha gigante", en: "Giant Spider", nd: 1, cls: "Fera grande", ac: 14, hp_max: 26, speed: 9, init_mod: 3, ataque: "Mordida +5, 1d8+3 perfurante", notes: "Escala qualquer superfície e anda nas próprias teias sem prender." },
  { name: "Ogro", en: "Ogre", nd: 2, cls: "Gigante grande", ac: 11, hp_max: 68, speed: 12, init_mod: -1, ataque: "Clava grande +6, 2d8+4 contundente · Azagaia +6, 2d6+4 perfurante", notes: "Muito PV e dano; pouquíssima tática." },
  { name: "Wight", en: "Wight", nd: 3, cls: "Morto-vivo médio", ac: 14, hp_max: 82, speed: 9, init_mod: 4, ataque: "2 ataques: Espada necrótica +4, 1d8+2 cortante · Arco necrótico +4, 1d8+2 perfurante", notes: "Dois ataques por turno; pode trocar um por drenar vida. Imune a veneno, sensível à luz solar." },
  { name: "Urso-coruja", en: "Owlbear", nd: 3, cls: "Monstruosidade grande", ac: 13, hp_max: 59, speed: 12, init_mod: 1, ataque: "2x Dilacerar +7, 2d8+5 cortante", notes: "Dois ataques por turno, dano pesado. Escala bem." },
  { name: "Troll", en: "Troll", nd: 5, cls: "Gigante grande", ac: 15, hp_max: 94, speed: 9, init_mod: 1, ataque: "3x Dilacerar +7, 2d6+4 cortante", notes: "Regeneração — só para com fogo ou ácido. Três ataques por turno. Membros Repugnantes 4x/dia." },
  { name: "Rato gigante", en: "Giant Rat", nd: 0.125, cls: "Fera pequena", ac: 13, hp_max: 7, speed: 9, init_mod: 3, ataque: "Mordida +5, 1d4+3 perfurante", notes: "Tática de Bando: fraco sozinho, perigoso em ninhada." },
  { name: "Estirge", en: "Stirge", nd: 0.125, cls: "Monstruosidade miúda", ac: 13, hp_max: 5, speed: 3, init_mod: 3, ataque: "Probóscide +5, 1d6+3 perfurante", notes: "Voa (12m); gruda e drena sangue." },
  { name: "Cobra venenosa gigante", en: "Giant Venomous Snake", nd: 0.25, cls: "Fera média", ac: 14, hp_max: 11, speed: 12, init_mod: 4, ataque: "Mordida +6, 1d4+4 perfurante", notes: "Rápida na iniciativa (+4). Nada tão bem quanto anda." },
  { name: "Gnoll", en: "Gnoll Warrior", nd: 0.5, cls: "Corruptor médio", ac: 15, hp_max: 27, speed: 9, init_mod: 1, ataque: "Dilacerar +4, 1d6+2 perfurante · Arco de osso +3, 1d10+1 perfurante", notes: "Virou corruptor na edição 2024, não humanoide." },
  { name: "Worg", en: "Worg", nd: 0.5, cls: "Fada grande", ac: 13, hp_max: 26, speed: 15, init_mod: 1, ataque: "Mordida +5, 1d8+3 perfurante", notes: "Rápido (15m). Fala Goblin e Comum; carrega goblinoides montados." },
  { name: "Bugbear", en: "Bugbear Warrior", nd: 1, cls: "Fada média", ac: 14, hp_max: 33, speed: 9, init_mod: 2, ataque: "Agarrão +4, 2d6+2 contundente", notes: "Sequestrar: agarra o alvo e sai carregando com ele." },
  { name: "Harpia", en: "Harpy", nd: 1, cls: "Monstruosidade média", ac: 11, hp_max: 38, speed: 6, init_mod: 1, ataque: "Garra +3, 2d4+1 cortante", notes: "Voa (12m); o canto atrai criaturas pra perto antes das garras." },
  { name: "Bandoleiro capitão", en: "Bandit Captain", nd: 2, cls: "Humanoide médio ou pequeno", ac: 15, hp_max: 52, speed: 9, init_mod: 3, ataque: "2 ataques: Cimitarra +5, 1d6+3 cortante · Pistola +5, 1d10+3 perfurante", notes: "Dois ataques por turno, misturando cimitarra e pistola. Costuma vir com bandidos." },
  { name: "Grifo", en: "Griffon", nd: 2, cls: "Monstruosidade grande", ac: 12, hp_max: 59, speed: 9, init_mod: 2, ataque: "2x Dilacerar +6, 1d8+4 perfurante", notes: "Voa (24m); dois ataques por turno. Gosta de perseguir cavalos." },
  { name: "Ettin", en: "Ettin", nd: 4, cls: "Gigante grande", ac: 12, hp_max: 85, speed: 12, init_mod: -1, ataque: "Machado de batalha +7, 2d8+5 cortante e Mangual +7, 2d8+5 perfurante", notes: "Duas cabeças: usa o machado E o mangual no mesmo turno." },
  { name: "Basilisco", en: "Basilisk", nd: 3, cls: "Monstruosidade média", ac: 15, hp_max: 52, speed: 6, init_mod: -1, ataque: "Mordida +5, 2d6+3 perfurante", notes: "Olhar petrificante; lento (6m)." },
  { name: "Minotauro de Baphomet", en: "Minotaur of Baphomet", nd: 3, cls: "Monstruosidade grande", ac: 14, hp_max: 85, speed: 12, init_mod: 0, ataque: "Chifrada +6, 4d6+4 perfurante · Glaive abissal +6, 1d12+4 cortante", notes: "A chifrada faz 4d6+4 — dá pra abrir a luta com investida." },
  { name: "Lobisomem", en: "Werewolf", nd: 3, cls: "Monstruosidade média ou pequena", ac: 15, hp_max: 71, speed: 9, init_mod: 4, ataque: "2 ataques: Arranhão +5, 2d6+3 cortante · Arco longo +4, 2d8+2 perfurante (troca 1 por Mordida +5, 2d8+3)", notes: "Tática de Bando. Dois ataques por turno." },
  { name: "Mantícora", en: "Manticore", nd: 3, cls: "Monstruosidade grande", ac: 14, hp_max: 68, speed: 9, init_mod: 3, ataque: "3 ataques: Dilacerar +5, 1d8+3 cortante · Espinho de cauda +5, 1d8+3 perfurante", notes: "Voa (15m); três ataques por turno, e os espinhos são à distância." },
  { name: "Gigante das colinas", en: "Hill Giant", nd: 5, cls: "Gigante enorme", ac: 13, hp_max: 105, speed: 12, init_mod: 2, ataque: "2 ataques: Clava de tronco +8, 3d8+5 contundente · Arremesso de entulho +8, 2d10+5 contundente", notes: "Dois ataques por turno; o entulho alcança quem ficou longe." },
  { name: "Vampiro subalterno", en: "Vampire Spawn", nd: 5, cls: "Morto-vivo médio ou pequeno", ac: 16, hp_max: 90, speed: 9, init_mod: 3, ataque: "2x Garra +6, 2d4+3 cortante, mais uma mordida", notes: "Escala paredes. Resistente a necrótico, com as fraquezas clássicas de vampiro." },
  { name: "Espectro", en: "Wraith", nd: 5, cls: "Morto-vivo médio ou pequeno", ac: 13, hp_max: 67, speed: 1.5, init_mod: 3, ataque: "Drenar vida +6, 4d8+3 necrótico", notes: "Voa (18m, paira) e atravessa paredes. Imune a necrótico e veneno; sensível à luz solar." },
  { name: "Quimera", en: "Chimera", nd: 6, cls: "Monstruosidade grande", ac: 14, hp_max: 114, speed: 9, init_mod: 0, ataque: "Aríete +7, 1d12+4 contundente e Mordida +7, 2d6+4 perfurante e Garra +7, 1d6+4 cortante", notes: "Voa (18m); os três ataques no mesmo turno, e pode trocar um por sopro de fogo." },
  { name: "Elemental do fogo", en: "Fire Elemental", nd: 5, cls: "Elemental grande", ac: 13, hp_max: 93, speed: 15, init_mod: 3, ataque: "2x Queimadura +6, 2d6+3 de fogo", notes: "Aura de fogo queima quem chega perto. Imune a fogo e veneno; água o machuca." },
  { name: "Gigante do gelo", en: "Frost Giant", nd: 8, cls: "Gigante enorme", ac: 15, hp_max: 149, speed: 12, init_mod: 2, ataque: "2 ataques: Machado gélido +9, 2d12+6 cortante · Arco grande +9, 2d10+6 perfurante", notes: "Imune a frio. Dois ataques por turno, e o arco alcança longe." },
  { name: "Gigante do fogo", en: "Fire Giant", nd: 9, cls: "Gigante enorme", ac: 18, hp_max: 162, speed: 9, init_mod: 3, ataque: "2 ataques: Espada flamejante +11, 4d6+7 cortante · Martelo arremessado +11, 3d10+7 contundente", notes: "Imune a fogo. Armadura pesada (CA 18) e dano altíssimo." },
  { name: "Dragão azul jovem", en: "Young Blue Dragon", nd: 9, cls: "Dragão grande", ac: 18, hp_max: 152, speed: 12, init_mod: 4, ataque: "3x Dilacerar +9, 2d6+5 cortante + 1d6 elétrico", notes: "Voa (24m) e escava. Imune a elétrico; sopro de relâmpago em linha." },
  { name: "Lich", en: "Lich", nd: 21, cls: "Morto-vivo médio", ac: 20, hp_max: 315, speed: 9, init_mod: 17, ataque: "3 ataques: Explosão mística +12, 4d12+5 de energia · Toque paralisante +12, 3d6+5 de frio", notes: "Iniciativa +17 — age antes de todo mundo. Resistência Lendária 4x/dia. Imune a necrótico e veneno. Jarro de Espíritos: só morre de vez se ele for destruído." },
  { name: "Guarda", en: "Guard", nd: 0.125, cls: "Humanoide médio ou pequeno", ac: 16, hp_max: 11, speed: 9, init_mod: 1, ataque: "Lança +3, 1d6+1 perfurante (corpo a corpo ou arremesso)", notes: "CA alta pro CR por causa da armadura. Serve pra qualquer guarda ou escolta genérica de cidade." },
  { name: "Cavaleiro", en: "Knight", nd: 3, cls: "Humanoide médio ou pequeno", ac: 18, hp_max: 52, speed: 9, init_mod: 0, ataque: "2 ataques: Espadão +5, 2d6+3 cortante + 1d8 radiante · Besta pesada +2, 2d10 perfurante + 1d8 radiante", notes: "Dois ataques por turno, misturando espadão e besta pesada. Aparar (reação a ser acertado corpo a corpo): +2 de CA contra aquele ataque." },
  { name: "Mago", en: "Mage", nd: 6, cls: "Humanoide médio ou pequeno", ac: 15, hp_max: 81, speed: 9, init_mod: 2, ataque: "3x Explosão arcana +6, 3d8+3 de força", notes: "Três ataques de Explosão Arcana por turno (corpo a corpo ou até 36m). Conjura Bola de Fogo/Invisibilidade 2x/dia, Cone de Frio ou Voo 1x/dia; Passo Nebuloso e Contramágica/Escudo em reação. CD de magia 14." },
  { name: "Sacerdote", en: "Priest", nd: 2, cls: "Humanoide médio ou pequeno", ac: 13, hp_max: 38, speed: 9, init_mod: 0, ataque: "2 ataques: Maça +5, 1d6+3 contundente + 2d4 radiante · Chama radiante +5, 2d10 radiante", notes: "Dois ataques por turno. Conjura Bênção, Dissipar Magia, Palavra Curativa ou Restauração Menor; Guardiões Espirituais 1x/dia." },
  { name: "Assassino", en: "Assassin", nd: 8, cls: "Humanoide médio ou pequeno", ac: 16, hp_max: 97, speed: 9, init_mod: 10, ataque: "3 ataques: Espada curta +7, 1d6+4 perfurante + 5d6 veneno · Besta leve +7, 1d8+4 perfurante + 6d6 veneno", notes: "Iniciativa altíssima (+10) — quase sempre age primeiro. Três ataques por turno misturando espada e besta, os dois com veneno pesado. Ação Ardilosa: Disparada/Desengajar/Esconder de graça." },
  { name: "Urso pardo", en: "Brown Bear", nd: 1, cls: "Fera grande", ac: 11, hp_max: 22, speed: 12, init_mod: 1, ataque: "Mordida +5, 1d8+3 perfurante e Garra +5, 1d4+3 cortante", notes: "Um de cada ataque por turno; a garra derruba alvo Grande ou menor." },
  { name: "Javali", en: "Boar", nd: 0.25, cls: "Fera média", ac: 11, hp_max: 13, speed: 12, init_mod: 0, ataque: "Presas +3, 1d6+1 perfurante", notes: "Correu 6m ou mais reto antes de acertar? Dano extra de 1d6 e derruba alvo Médio ou menor." },
  { name: "Crocodilo", en: "Crocodile", nd: 0.5, cls: "Fera grande", ac: 12, hp_max: 13, speed: 6, init_mod: 0, ataque: "Mordida +4, 1d8+2 perfurante", notes: "Nada (9m) melhor do que anda. Acertou alvo Médio ou menor? Agarra (CD 12) e ele fica Contido enquanto isso durar." },
  { name: "Águia gigante", en: "Giant Eagle", nd: 1, cls: "Celestial grande", ac: 13, hp_max: 26, speed: 3, init_mod: 3, ataque: "2x Dilacerar +5, 1d4+3 cortante + 1d6 radiante", notes: "Voa (24m); anda pouco no chão (3m). Dois ataques por turno. Virou Celestial na edição 2024 — era Fera." },
  { name: "Elemental do ar", en: "Air Elemental", nd: 5, cls: "Elemental grande", ac: 15, hp_max: 90, speed: 3, init_mod: 5, ataque: "2x Golpe Trovejante +8, 2d8+5 de trovão", notes: "Voa (27m); anda pouco no chão (3m). Dois ataques por turno; pode trocar por Redemoinho (resistência de Força CD 13 em área, empurra e derruba). Imune a trovão e veneno." },
  { name: "Elemental da terra", en: "Earth Elemental", nd: 5, cls: "Elemental grande", ac: 17, hp_max: 147, speed: 9, init_mod: -1, ataque: "2 ataques: Golpe +8, 2d8+5 contundente · Lançar Pedra +8, 1d6+5 contundente", notes: "Muitíssimo PV. Dois ataques por turno, misturando golpe corpo a corpo e pedra à distância (até 18m, derruba). Imune a trovão e veneno." },
  { name: "Elemental da água", en: "Water Elemental", nd: 5, cls: "Elemental grande", ac: 14, hp_max: 114, speed: 9, init_mod: 2, ataque: "2x Golpe +7, 2d8+4 contundente", notes: "Nada (27m) melhor do que anda. Dois ataques por turno; pode trocar por Inundar (agarra e afoga quem estiver no espaço dele). Imune a veneno." },
  { name: "Cubo gelatinoso", en: "Gelatinous Cube", nd: 2, cls: "Limo grande", ac: 6, hp_max: 63, speed: 4.5, init_mod: -4, ataque: "Pseudópode +4, 3d6+2 ácido", notes: "CA baixíssima e iniciativa péssima (-4, quase sempre age por último), mas quem cruza o caminho dele leva resistência de Destreza (CD 12) ou fica engolido — Contido, sufocando, tomando dano por turno lá dentro." },
  { name: "Gárgula", en: "Gargoyle", nd: 2, cls: "Elemental médio", ac: 15, hp_max: 67, speed: 9, init_mod: 2, ataque: "2x Garra +4, 2d4+2 cortante", notes: "Voa (18m). Parece estátua até atacar — bom pra emboscada. É Elemental, não Monstruosidade, apesar da cara de gárgula de pedra." },
  { name: "Fantasma", en: "Ghost", nd: 4, cls: "Morto-vivo médio", ac: 11, hp_max: 45, speed: 1.5, init_mod: 1, ataque: "2x Toque Definhante +5, 3d10+3 necrótico", notes: "Voa e atravessa parede (12m); anda quase nada (1,5m). Visage Horripilante: resistência de Sabedoria CD 13 num cone de 18m, amedronta quem falhar. Possessão (recarga 6): CD 13 de Carisma numa humanoide por perto — o fantasma some e controla o corpo até ele cair a 0 PV." },
  { name: "Sombra", en: "Shadow", nd: 0.5, cls: "Morto-vivo médio", ac: 12, hp_max: 27, speed: 12, init_mod: 2, ataque: "Investida Drenante +4, 1d6+2 necrótico", notes: "Reduz 1d4 de Força na criatura atingida (morre se chegar a 0); se matar uma humanoide assim, nasce outra Sombra do corpo em 1d4 horas. Furtividade de graça em penumbra ou escuridão." },
  { name: "Diabrete", en: "Imp", nd: 1, cls: "Corruptor miúdo", ac: 13, hp_max: 21, speed: 6, init_mod: 3, ataque: "Ferrão +5, 1d6+3 perfurante + 2d6 veneno", notes: "Voa (12m); fica invisível à vontade e vira rato, corvo ou aranha (mesmos atributos, só muda o deslocamento). Bom como espião ou familiar de vilão." },
  { name: "Dragão vermelho jovem", en: "Young Red Dragon", nd: 10, cls: "Dragão grande", ac: 18, hp_max: 178, speed: 12, init_mod: 4, ataque: "3x Dilacerar +10, 2d6+6 cortante + 1d6 de fogo", notes: "Voa e escala (24m/12m). Três ataques por turno; sopro de fogo (recarga 5-6) em cone de 9m, 16d6 de fogo (metade se resistir na de Destreza CD 17). Imune a fogo." },
];

/** O catálogo inteiro, do ND mais baixo pro mais alto. */
export const MONSTROS_SRD: MonstroCatalogo[] = [...MONSTROS_CURADOS, ...MONSTROS_GERADOS].sort(
  (a, b) => a.nd - b.nd || a.name.localeCompare(b.name, "pt-BR"),
);

/** Nível de desafio como se escreve: 1/8, 1/4, 1/2, 1, 2... */
export function ndTexto(nd: number): string {
  return nd === 0.125 ? "1/8" : nd === 0.25 ? "1/4" : nd === 0.5 ? "1/2" : String(nd);
}

/** Faixas pra folhear o catálogo inteiro sem despejar 331 linhas de uma vez:
 *  a maior tem 54 monstros (medido a 375px com a linha compacta: ~2.800px).
 *  Com 5 faixas largas, "ND 0–1" tinha 135 e dava 17 mil px de rolagem. */
export const FAIXAS_ND = [
  { rotulo: "0", min: 0, max: 0 },
  { rotulo: "1/8–1/4", min: 0.125, max: 0.25 },
  { rotulo: "1/2–1", min: 0.5, max: 1 },
  { rotulo: "2", min: 2, max: 2 },
  { rotulo: "3–4", min: 3, max: 4 },
  { rotulo: "5–7", min: 5, max: 7 },
  { rotulo: "8–12", min: 8, max: 12 },
  { rotulo: "13+", min: 13, max: Infinity },
] as const;

export function monstrosDaFaixa(faixa: (typeof FAIXAS_ND)[number]): MonstroCatalogo[] {
  return MONSTROS_SRD.filter((m) => m.nd >= faixa.min && m.nd <= faixa.max);
}

/** Minúsculo e sem acento — quem busca no celular digita "manticora", não "Mantícora". */
function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Casa o termo contra nome, tipo e nome em inglês, pra "morto-vivo" achar
 *  todos os mortos-vivos e "owlbear" achar o Urso-coruja. "nd 5" (ou "nd
 *  1/4") devolve os de exatamente esse nível de desafio — pra montar
 *  encontro. Termo vazio devolve lista vazia: o catálogo só aparece quando
 *  alguém procura. */
export function buscarMonstros(termo: string): MonstroCatalogo[] {
  const alvo = semAcento(termo.trim());
  if (!alvo) return [];
  const nd = alvo.match(/^nd\s*(\d+(?:\/\d+)?)$/);
  if (nd) return MONSTROS_SRD.filter((m) => ndTexto(m.nd) === nd[1]);
  return MONSTROS_SRD.filter((m) => semAcento(`${m.name} ${m.cls} ${m.en}`).includes(alvo));
}
