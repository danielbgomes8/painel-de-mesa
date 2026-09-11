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
  { name: "Bandido", cls: "Humanoide médio", ac: 12, hp_max: 11, speed: 9, init_mod: 1, notes: "Vem sempre em bando; besta leve à distância, cimitarra de perto." },
  { name: "Cultista", cls: "Humanoide médio", ac: 12, hp_max: 9, speed: 9, init_mod: 1, notes: "Devoção Fanática: vantagem contra ser enfeitiçado ou amedrontado." },
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
  { name: "Rato gigante", cls: "Fera pequena", ac: 12, hp_max: 7, speed: 9, init_mod: 0, notes: "Fraco sozinho; perigoso em ninhada (Tática de Bando)." },
  { name: "Estirge", cls: "Monstruosidade minúscula", ac: 14, hp_max: 5, speed: 12, init_mod: 3, notes: "Voa; bico gruda e suga PV por turno até morrer ou ser arrancado." },
  { name: "Cobra venenosa gigante", cls: "Fera média", ac: 14, hp_max: 11, speed: 9, init_mod: 4, notes: "Mordida injeta veneno (teste de CON); nada tão bem quanto anda." },
  { name: "Gnoll", cls: "Humanoide médio", ac: 15, hp_max: 22, speed: 9, init_mod: 2, notes: "Fúria de Caça Rancorosa: ataque extra se um inimigo caiu perto neste turno." },
  { name: "Worg", cls: "Monstruosidade média", ac: 13, hp_max: 26, speed: 12, init_mod: 1, notes: "Lobo monstruoso: fala Goblin e Comum; carrega goblinoides montados." },
  { name: "Bugbear", cls: "Humanoide médio", ac: 16, hp_max: 27, speed: 9, init_mod: 2, notes: "Investida Surpresa: dano extra se acertar antes do alvo agir neste combate." },
  { name: "Harpia", cls: "Monstruosidade média", ac: 11, hp_max: 38, speed: 6, init_mod: 1, notes: "Voa (15m); canto atrai criaturas pra perto, depois garras em quem chega." },
  { name: "Bandoleiro capitão", cls: "Humanoide médio", ac: 15, hp_max: 65, speed: 9, init_mod: 2, notes: "Ataque extra por turno e reação pra desviar de um golpe; costuma vir com bandidos." },
  { name: "Grifo", cls: "Monstruosidade grande", ac: 12, hp_max: 59, speed: 9, init_mod: 2, notes: "Voa (24m); bicada e garras, gosta de perseguir cavalos." },
  { name: "Fera deslocadora", cls: "Monstruosidade grande", ac: 13, hp_max: 85, speed: 12, init_mod: 2, notes: "Parece estar meio metro fora do lugar real — ataques à distância contra ela têm desvantagem." },
  { name: "Ettin", cls: "Gigante grande", ac: 12, hp_max: 85, speed: 12, init_mod: -1, notes: "Duas cabeças: ataca duas vezes por turno e é difícil pegar de surpresa." },
  { name: "Basilisco", cls: "Monstruosidade média", ac: 15, hp_max: 52, speed: 6, init_mod: -1, notes: "Olhar petrifica em falha de teste repetido; vira pedra de vez na 2ª falha." },
  { name: "Minotauro", cls: "Monstruosidade grande", ac: 14, hp_max: 76, speed: 12, init_mod: 0, notes: "Investida em linha reta; nunca se perde, mesmo em labirintos." },
  { name: "Lobisomem", cls: "Humanoide médio (licantropo)", ac: 12, hp_max: 58, speed: 9, init_mod: 1, notes: "Só dano de prata ou mágico machuca de verdade na forma híbrida/lobo." },
  { name: "Mantícora", cls: "Monstruosidade grande", ac: 14, hp_max: 68, speed: 9, init_mod: 0, notes: "Voa (15m); rajada de espinhos da cauda à distância, até acabar a munição." },
  { name: "Gigante das colinas", cls: "Gigante grande", ac: 13, hp_max: 105, speed: 12, init_mod: -1, notes: "PV e dano de porrete altíssimos; pouquíssima tática." },
  { name: "Vampiro subalterno", cls: "Morto-vivo médio", ac: 15, hp_max: 82, speed: 9, init_mod: 3, notes: "Regenera PV se não tomou dano radiante/de estaca no turno; teme luz solar direta." },
  { name: "Espectro", cls: "Morto-vivo médio", ac: 13, hp_max: 67, speed: 18, init_mod: 3, notes: "Flutua e atravessa paredes; toque drena PV vital de verdade (reduz o máximo)." },
  { name: "Quimera", cls: "Monstruosidade grande", ac: 14, hp_max: 114, speed: 9, init_mod: 0, notes: "Voa (15m); três ataques (chifre, mordida, garra) mais sopro de fogo da cabeça de dragão." },
  { name: "Elemental do fogo", cls: "Elemental grande", ac: 13, hp_max: 102, speed: 15, init_mod: 3, notes: "Quem toca ou é tocado queima; ateia fogo em madeira/vegetação ao passar." },
  { name: "Gigante do gelo", cls: "Gigante grande", ac: 15, hp_max: 138, speed: 12, init_mod: -1, notes: "Resistente a frio; joga rochas grandes à distância." },
  { name: "Gigante do fogo", cls: "Gigante grande", ac: 18, hp_max: 162, speed: 9, init_mod: -1, notes: "Resistente a fogo; armadura pesada, machado de guerra gigante." },
  { name: "Dragão azul jovem", cls: "Dragão grande", ac: 18, hp_max: 152, speed: 12, init_mod: 0, notes: "Sopro de relâmpago em linha (recarrega); enxerga através de terra solta." },
  { name: "Observador", cls: "Aberração grande", ac: 18, hp_max: 180, speed: 6, init_mod: 2, notes: "Flutua; raio ocular diferente por olho a cada turno, cone antimagia no olho central." },
  { name: "Lich", cls: "Morto-vivo médio", ac: 17, hp_max: 135, speed: 9, init_mod: 3, notes: "Filactério escondido — só morre de vez se ele também for destruído." },
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
