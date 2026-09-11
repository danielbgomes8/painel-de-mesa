import type { NovoModeloNpc } from "./tipos";

/**
 * Catálogo de referência rápida pra não digitar do zero — baseado no SRD 5.2
 * (Creative Commons CC-BY-4.0, Wizards of the Coast). São números de PARTIDA:
 * confira contra o livro antes de uma luta importante e ajuste como quiser
 * depois de "usar" (cada cópia vira um modelo seu, totalmente editável).
 */
export const MONSTROS_SRD: Required<NovoModeloNpc>[] = [
  { name: "Kobold", cls: "Humanoide pequeno", ac: 12, hp_max: 5, speed: 9, init_mod: 2, notes: "Covardia: desvantagem em ataque se um aliado consciente não estiver a 3m." },
  { name: "Goblin", cls: "Humanoide pequeno", ac: 15, hp_max: 7, speed: 9, init_mod: 2, notes: "Fúria dos Pequenos: vantagem em ataque se um aliado maior estiver adjacente ao alvo." },
  { name: "Esqueleto", cls: "Morto-vivo médio", ac: 13, hp_max: 13, speed: 9, init_mod: 2, notes: "Vulnerável a dano contundente. Imune a veneno." },
  { name: "Bandido", cls: "Humanoide médio", ac: 12, hp_max: 11, speed: 9, init_mod: 1, notes: "" },
  { name: "Cultista", cls: "Humanoide médio", ac: 12, hp_max: 9, speed: 9, init_mod: 1, notes: "" },
  { name: "Orc", cls: "Humanoide médio", ac: 13, hp_max: 15, speed: 12, init_mod: 1, notes: "Fúria Implacável: quando cairia a 0 PV, 1x por combate fica com 1 PV." },
  { name: "Hobgoblin", cls: "Humanoide médio", ac: 18, hp_max: 11, speed: 9, init_mod: 1, notes: "Tática Marcial: 1x por turno, dá vantagem no ataque de um aliado próximo." },
  { name: "Lobo", cls: "Fera média", ac: 13, hp_max: 11, speed: 12, init_mod: 2, notes: "Tática de Matilha: vantagem se um aliado estiver perto do alvo." },
  { name: "Urso-negro", cls: "Fera média", ac: 11, hp_max: 19, speed: 12, init_mod: 1, notes: "Nada e escala bem." },
  { name: "Zumbi", cls: "Morto-vivo médio", ac: 8, hp_max: 22, speed: 6, init_mod: -2, notes: "Fortitude de Morto-vivo: teste de CON pra não cair a 0 PV." },
  { name: "Ghoul", cls: "Morto-vivo médio", ac: 12, hp_max: 22, speed: 9, init_mod: 2, notes: "Garra paralisa (menos elfos)." },
  { name: "Aranha gigante", cls: "Fera grande", ac: 14, hp_max: 26, speed: 9, init_mod: 3, notes: "Teia e veneno; escala em qualquer superfície." },
  { name: "Ogro", cls: "Gigante grande", ac: 11, hp_max: 59, speed: 12, init_mod: -1, notes: "PV e dano altos, pouca tática." },
  { name: "Wight", cls: "Morto-vivo médio", ac: 14, hp_max: 45, speed: 9, init_mod: 1, notes: "Toque drena PV vital; quem morre assim vira zumbi sob comando dele." },
  { name: "Urso-coruja", cls: "Monstruosidade grande", ac: 13, hp_max: 59, speed: 12, init_mod: 1, notes: "Investida e agarrão brutais." },
  { name: "Troll", cls: "Gigante grande", ac: 15, hp_max: 84, speed: 12, init_mod: 1, notes: "Regeneração — só para com dano de fogo ou ácido." },
];
