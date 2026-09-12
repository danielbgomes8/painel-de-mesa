import type { NovoModeloNpc } from "./tipos";

/**
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
export const MONSTROS_SRD: Required<NovoModeloNpc>[] = [
  { name: "Kobold", cls: "Dragão pequeno", ac: 14, hp_max: 7, speed: 9, init_mod: 2, ataque: "Adaga +4, 1d4+2 perfurante", notes: "Tática de Bando: vantagem no ataque se um aliado estiver adjacente ao alvo. Sensível à luz solar. Virou dragão na edição 2024." },
  { name: "Goblin", cls: "Fada pequena", ac: 15, hp_max: 10, speed: 9, init_mod: 2, ataque: "Cimitarra +4, 1d6+2 cortante · Arco curto +4, 1d6+2 perfurante", notes: "Cimitarra de perto, arco à distância. Virou fada na edição 2024." },
  { name: "Esqueleto", cls: "Morto-vivo médio", ac: 14, hp_max: 13, speed: 9, init_mod: 3, ataque: "Espada curta +5, 1d6+3 perfurante · Arco curto +5, 1d6+3 perfurante", notes: "Imune a veneno." },
  { name: "Bandido", cls: "Humanoide pequeno", ac: 12, hp_max: 11, speed: 9, init_mod: 1, ataque: "Cimitarra +3, 1d6+1 cortante · Besta leve +3, 1d8+1 perfurante", notes: "Vem sempre em bando: besta à distância, cimitarra de perto." },
  { name: "Cultista", cls: "Humanoide pequeno", ac: 12, hp_max: 9, speed: 9, init_mod: 1, ataque: "Foice ritual +3, 1d4+1 cortante", notes: "Frágil sozinho; o perigo é o número." },
  { name: "Hobgoblin", cls: "Fada média", ac: 18, hp_max: 11, speed: 9, init_mod: 3, ataque: "Espada longa +3, 2d10+1 cortante · Arco longo +3, 1d8+1 perfurante", notes: "Tática de Bando. A espada longa faz 2d10+1 — dano alto pro nível dele." },
  { name: "Lobo", cls: "Fera média", ac: 12, hp_max: 11, speed: 12, init_mod: 2, ataque: "Mordida +4, 1d6+2 perfurante", notes: "Tática de Bando: vantagem se um aliado estiver perto do alvo." },
  { name: "Urso-negro", cls: "Fera média", ac: 11, hp_max: 19, speed: 9, init_mod: 1, ataque: "2x Dilacerar +4, 1d6+2 cortante", notes: "Dois ataques por turno. Nada e escala bem." },
  { name: "Zumbi", cls: "Morto-vivo médio", ac: 8, hp_max: 15, speed: 6, init_mod: -2, ataque: "Golpe +3, 1d8+1 contundente", notes: "Fortitude de Morto-vivo: teste de CON pra ficar com 1 PV em vez de cair. Imune a veneno." },
  { name: "Ghoul", cls: "Morto-vivo médio", ac: 12, hp_max: 22, speed: 9, init_mod: 2, ataque: "2x Mordida +4, 1d6+2 perfurante · Garra +4, 1d4+2 cortante", notes: "Duas mordidas por turno. Imune a veneno." },
  { name: "Aranha gigante", cls: "Fera grande", ac: 14, hp_max: 26, speed: 9, init_mod: 3, ataque: "Mordida +5, 1d8+3 perfurante", notes: "Escala qualquer superfície e anda nas próprias teias sem prender." },
  { name: "Ogro", cls: "Gigante grande", ac: 11, hp_max: 68, speed: 12, init_mod: -1, ataque: "Clava grande +6, 2d8+4 contundente · Azagaia +6, 2d6+4 perfurante", notes: "Muito PV e dano; pouquíssima tática." },
  { name: "Wight", cls: "Morto-vivo médio", ac: 14, hp_max: 82, speed: 9, init_mod: 4, ataque: "2 ataques: Espada necrótica +4, 1d8+2 cortante · Arco necrótico +4, 1d8+2 perfurante", notes: "Dois ataques por turno; pode trocar um por drenar vida. Imune a veneno, sensível à luz solar." },
  { name: "Urso-coruja", cls: "Monstruosidade grande", ac: 13, hp_max: 59, speed: 12, init_mod: 1, ataque: "2x Dilacerar +7, 2d8+5 cortante", notes: "Dois ataques por turno, dano pesado. Escala bem." },
  { name: "Troll", cls: "Gigante grande", ac: 15, hp_max: 94, speed: 9, init_mod: 1, ataque: "3x Dilacerar +7, 2d6+4 cortante", notes: "Regeneração — só para com fogo ou ácido. Três ataques por turno. Membros Repugnantes 4x/dia." },
  { name: "Rato gigante", cls: "Fera pequena", ac: 13, hp_max: 7, speed: 9, init_mod: 3, ataque: "Mordida +5, 1d4+3 perfurante", notes: "Tática de Bando: fraco sozinho, perigoso em ninhada." },
  { name: "Estirge", cls: "Monstruosidade pequena", ac: 13, hp_max: 5, speed: 12, init_mod: 3, ataque: "Probóscide +5, 1d6+3 perfurante", notes: "Voa (12m); gruda e drena sangue." },
  { name: "Cobra venenosa gigante", cls: "Fera média", ac: 14, hp_max: 11, speed: 12, init_mod: 4, ataque: "Mordida +6, 1d4+4 perfurante", notes: "Rápida na iniciativa (+4). Nada tão bem quanto anda." },
  { name: "Gnoll", cls: "Corruptor médio", ac: 15, hp_max: 27, speed: 9, init_mod: 1, ataque: "Dilacerar +4, 1d6+2 perfurante · Arco de osso +3, 1d10+1 perfurante", notes: "Virou corruptor na edição 2024, não humanoide." },
  { name: "Worg", cls: "Fada grande", ac: 13, hp_max: 26, speed: 15, init_mod: 1, ataque: "Mordida +5, 1d8+3 perfurante", notes: "Rápido (15m). Fala Goblin e Comum; carrega goblinoides montados." },
  { name: "Bugbear", cls: "Fada média", ac: 14, hp_max: 33, speed: 9, init_mod: 2, ataque: "Agarrão +4, 2d6+2 contundente", notes: "Sequestrar: agarra o alvo e sai carregando com ele." },
  { name: "Harpia", cls: "Monstruosidade média", ac: 11, hp_max: 38, speed: 6, init_mod: 1, ataque: "Garra +3, 2d4+1 cortante", notes: "Voa (12m); o canto atrai criaturas pra perto antes das garras." },
  { name: "Bandoleiro capitão", cls: "Humanoide pequeno", ac: 15, hp_max: 52, speed: 9, init_mod: 3, ataque: "2 ataques: Cimitarra +5, 1d6+3 cortante · Pistola +5, 1d10+3 perfurante", notes: "Dois ataques por turno, misturando cimitarra e pistola. Costuma vir com bandidos." },
  { name: "Grifo", cls: "Monstruosidade grande", ac: 12, hp_max: 59, speed: 9, init_mod: 2, ataque: "2x Dilacerar +6, 1d8+4 perfurante", notes: "Voa (24m); dois ataques por turno. Gosta de perseguir cavalos." },
  { name: "Ettin", cls: "Gigante grande", ac: 12, hp_max: 85, speed: 12, init_mod: -1, ataque: "Machado de batalha +7, 2d8+5 cortante e Mangual +7, 2d8+5 perfurante", notes: "Duas cabeças: usa o machado E o mangual no mesmo turno." },
  { name: "Basilisco", cls: "Monstruosidade média", ac: 15, hp_max: 52, speed: 6, init_mod: -1, ataque: "Mordida +5, 2d6+3 perfurante", notes: "Olhar petrificante; lento (6m)." },
  { name: "Minotauro de Baphomet", cls: "Monstruosidade grande", ac: 14, hp_max: 85, speed: 12, init_mod: 0, ataque: "Chifrada +6, 4d6+4 perfurante · Glaive abissal +6, 1d12+4 cortante", notes: "A chifrada faz 4d6+4 — dá pra abrir a luta com investida." },
  { name: "Lobisomem", cls: "Monstruosidade pequena", ac: 15, hp_max: 71, speed: 9, init_mod: 4, ataque: "2 ataques: Arranhão +5, 2d6+3 cortante · Arco longo +4, 2d8+2 perfurante (troca 1 por Mordida +5, 2d8+3)", notes: "Tática de Bando. Dois ataques por turno." },
  { name: "Mantícora", cls: "Monstruosidade grande", ac: 14, hp_max: 68, speed: 9, init_mod: 3, ataque: "3 ataques: Dilacerar +5, 1d8+3 cortante · Espinho de cauda +5, 1d8+3 perfurante", notes: "Voa (15m); três ataques por turno, e os espinhos são à distância." },
  { name: "Gigante das colinas", cls: "Gigante enorme", ac: 13, hp_max: 105, speed: 12, init_mod: 2, ataque: "2 ataques: Clava de tronco +8, 3d8+5 contundente · Arremesso de entulho +8, 2d10+5 contundente", notes: "Dois ataques por turno; o entulho alcança quem ficou longe." },
  { name: "Vampiro subalterno", cls: "Morto-vivo pequeno", ac: 16, hp_max: 90, speed: 9, init_mod: 3, ataque: "2x Garra +6, 2d4+3 cortante, mais uma mordida", notes: "Escala paredes. Resistente a necrótico, com as fraquezas clássicas de vampiro." },
  { name: "Espectro", cls: "Morto-vivo pequeno", ac: 13, hp_max: 67, speed: 18, init_mod: 3, ataque: "Drenar vida +6, 4d8+3 necrótico", notes: "Atravessa paredes. Imune a necrótico e veneno; sensível à luz solar." },
  { name: "Quimera", cls: "Monstruosidade grande", ac: 14, hp_max: 114, speed: 9, init_mod: 0, ataque: "Aríete +7, 1d12+4 contundente e Mordida +7, 2d6+4 perfurante e Garra +7, 1d6+4 cortante", notes: "Voa (18m); os três ataques no mesmo turno, e pode trocar um por sopro de fogo." },
  { name: "Elemental do fogo", cls: "Elemental grande", ac: 13, hp_max: 93, speed: 15, init_mod: 3, ataque: "2x Queimadura +6, 2d6+3 de fogo", notes: "Aura de fogo queima quem chega perto. Imune a fogo e veneno; água o machuca." },
  { name: "Gigante do gelo", cls: "Gigante enorme", ac: 15, hp_max: 149, speed: 12, init_mod: 2, ataque: "2 ataques: Machado gélido +9, 2d12+6 cortante · Arco grande +9, 2d10+6 perfurante", notes: "Imune a frio. Dois ataques por turno, e o arco alcança longe." },
  { name: "Gigante do fogo", cls: "Gigante enorme", ac: 18, hp_max: 162, speed: 9, init_mod: 3, ataque: "2 ataques: Espada flamejante +11, 4d6+7 cortante · Martelo arremessado +11, 3d10+7 contundente", notes: "Imune a fogo. Armadura pesada (CA 18) e dano altíssimo." },
  { name: "Dragão azul jovem", cls: "Dragão grande", ac: 18, hp_max: 152, speed: 12, init_mod: 4, ataque: "3x Dilacerar +9, 2d6+5 cortante + 1d6 elétrico", notes: "Voa (24m) e escava. Imune a elétrico; sopro de relâmpago em linha." },
  { name: "Lich", cls: "Morto-vivo médio", ac: 20, hp_max: 315, speed: 9, init_mod: 17, ataque: "3 ataques: Explosão mística +12, 4d12+5 de energia · Toque paralisante +12, 3d6+5 de frio", notes: "Iniciativa +17 — age antes de todo mundo. Resistência Lendária 4x/dia. Imune a necrótico e veneno. Jarro de Espíritos: só morre de vez se ele for destruído." },
];

/** Minúsculo e sem acento — quem busca no celular digita "manticora", não "Mantícora". */
function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Casa o termo contra nome e tipo, pra "morto-vivo" achar todos os mortos-vivos.
 *  Termo vazio devolve lista vazia: o catálogo só aparece quando alguém procura. */
export function buscarMonstros(termo: string): Required<NovoModeloNpc>[] {
  const alvo = semAcento(termo.trim());
  if (!alvo) return [];
  return MONSTROS_SRD.filter((m) => semAcento(`${m.name} ${m.cls}`).includes(alvo));
}
