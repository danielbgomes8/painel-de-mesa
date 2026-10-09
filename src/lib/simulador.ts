import { textoEfetivoDeAtaques } from "./ataquesFicha";
import { lerAtaquesRolaveis, resolverAtaque, limitarQuantidade, type AtaqueRolavel, type LeituraAtaques } from "./regras";
import type { GrupoEncontro } from "./tipos";

/**
 * Simulador de encontro: luta o encontro preparado contra o grupo de verdade
 * centenas de vezes e conta o que acontece — "chance de alguém cair 62%, de
 * perder todos 4%, dura uns 4 rodadas". É um TERMÔMETRO, não uma previsão: a
 * tática é simples e o app só conhece o que está escrito no campo de ataque.
 * As contas são puras (o dado vem de fora, como no resto de `regras.ts`); a
 * tela é `SimuladorDeEncontro.tsx`.
 *
 * O que entra: CA, PV de agora, bônus de iniciativa e os ataques lidos do texto
 * da ficha (`lerAtaquesRolaveis`, o mesmo que rola ataque na iniciativa), com
 * 20 natural em dobro e 1 natural errando. Cada um age uma vez por rodada, na
 * ordem da iniciativa rolada. Quem chega a 0 PV sai da luta ("caiu"): não há
 * teste de morte, cura nem poção.
 *
 * O que NÃO entra (e deixa a conta mais otimista pro grupo): magias,
 * Ataque Extra e outras características de classe que o app não lê, ações bônus,
 * reações, terreno, cobertura, vantagem/desvantagem, resistências, imunidades
 * e condições. Quem não tem ataque legível no texto causa 0 de dano — a tela
 * avisa quem é.
 */

export type Lado = "grupo" | "inimigos";

export type Combatente = {
  id: string;
  nome: string;
  lado: Lado;
  ca: number;
  hp: number;
  init_mod: number;
  /** O que ele faz no turno: já escolhido do texto de ataque (ver `ataquesDoTurno`). */
  turno: AtaqueRolavel[];
};

export const NUM_DE_LUTAS = 1000;
export const RODADAS_MAXIMAS = 30;

/** Dano médio de um ataque (uma vez), sem crítico. */
export function danoMedio(a: AtaqueRolavel): number {
  return a.vezes * a.partes.reduce((s, p) => s + (p.qtd * (p.faces + 1)) / 2 + p.mod, 0);
}

/**
 * O que o combatente faz num turno, a partir do texto: com "N ataques:" são os N primeiros
 * da lista (repetindo o último se a lista é menor); sem isso, um ataque só — o que causa
 * mais dano médio. "2x Dilacerar" já vem como `vezes` e conta como um único ataque repetido.
 */
export function ataquesDoTurno(leitura: LeituraAtaques): AtaqueRolavel[] {
  const { ataques, multiataque } = leitura;
  if (ataques.length === 0) return [];
  if (multiataque !== null && multiataque > 1) {
    return Array.from({ length: multiataque }, (_, i) => ataques[Math.min(i, ataques.length - 1)]);
  }
  return [[...ataques].sort((a, b) => danoMedio(b) - danoMedio(a))[0]];
}

export function turnoDoTexto(texto: string): AtaqueRolavel[] {
  return ataquesDoTurno(lerAtaquesRolaveis(texto));
}

/** Os monstros de um encontro preparado, um combatente por criatura (grupo por grupo, quantidade já limitada). */
export function inimigosDoEncontro(grupos: GrupoEncontro[]): Combatente[] {
  const saida: Combatente[] = [];
  grupos.forEach((g, gi) => {
    const qtd = limitarQuantidade(g.quantidade);
    for (let i = 0; i < qtd; i++) {
      saida.push({
        id: `m${gi}-${i}`,
        nome: qtd > 1 ? `${g.name} ${i + 1}` : g.name,
        lado: "inimigos",
        ca: g.ac,
        hp: Math.max(1, g.hp_max),
        init_mod: g.init_mod,
        turno: turnoDoTexto(g.ataque),
      });
    }
  });
  return saida;
}

type Vivo = Combatente & { atual: number };

/** Um golpe: devolve o dano causado (0 se errou). Ataque sem bônus ("Sopro: CD 13, 4d6") é salvaguarda: sempre causa dano, e metade em metade das vezes. */
function golpe(a: AtaqueRolavel, ca: number, rolar: (faces: number) => number): number {
  let total = 0;
  for (let v = 0; v < a.vezes; v++) {
    const r = resolverAtaque({ ...a, vezes: 1 }, "normal", rolar);
    if (a.bonus === null) {
      total += rolar(2) === 1 ? Math.floor(r.dano / 2) : r.dano;
      continue;
    }
    const acertou = r.critico || (!r.erroCritico && (r.acerto ?? 0) >= ca);
    if (acertou) total += r.dano;
  }
  return total;
}

export type UmaLuta = {
  vencedor: Lado | "empate";
  rodadas: number;
  /** Ids de quem do grupo chegou a 0 PV. */
  caidos: string[];
  /** Dano que o grupo levou, somando tudo (inclui o que passou de 0 PV). */
  danoNoGrupo: number;
};

/** Uma luta até um lado acabar (ou `RODADAS_MAXIMAS`). Cada um mira em quem está de pé: o grupo no inimigo de menor PV, os inimigos num do grupo ao acaso. */
export function simularUmaLuta(grupo: Combatente[], inimigos: Combatente[], rolar: (faces: number) => number): UmaLuta {
  const todos: Vivo[] = [...grupo, ...inimigos].map((c) => ({ ...c, atual: c.hp }));
  const ordem = todos
    .map((c) => ({ c, ini: rolar(20) + c.init_mod }))
    .sort((a, b) => b.ini - a.ini)
    .map((x) => x.c);
  const de = (lado: Lado) => ordem.filter((c) => c.lado === lado && c.atual > 0);
  const caidos = new Set<string>();
  let danoNoGrupo = 0;
  let rodada = 0;

  while (rodada < RODADAS_MAXIMAS && de("grupo").length > 0 && de("inimigos").length > 0) {
    rodada++;
    for (const c of ordem) {
      if (c.atual <= 0) continue;
      const alvos = de(c.lado === "grupo" ? "inimigos" : "grupo");
      if (alvos.length === 0) break;
      for (const a of c.turno) {
        const vivos = alvos.filter((t) => t.atual > 0);
        if (vivos.length === 0) break;
        const alvo = c.lado === "grupo" ? vivos.reduce((m, t) => (t.atual < m.atual ? t : m)) : vivos[Math.floor((rolar(1000) - 1) / 1000 * vivos.length)];
        const dano = golpe(a, alvo.ca, rolar);
        if (c.lado === "inimigos") danoNoGrupo += dano;
        alvo.atual -= dano;
        if (alvo.atual <= 0 && alvo.lado === "grupo") caidos.add(alvo.id);
      }
    }
  }
  const grupoDePe = de("grupo").length > 0;
  const inimigosDePe = de("inimigos").length > 0;
  return {
    vencedor: grupoDePe && !inimigosDePe ? "grupo" : !grupoDePe && inimigosDePe ? "inimigos" : "empate",
    rodadas: rodada,
    caidos: [...caidos],
    danoNoGrupo,
  };
}

export type Resultado = {
  lutas: number;
  /** Frações de 0 a 1. */
  grupoVence: number;
  grupoPerdeTodos: number;
  empate: number;
  alguemCai: number;
  /** Chance de cada um do grupo chegar a 0 PV, na ordem em que foram passados. */
  caiPorPessoa: { id: string; nome: string; chance: number }[];
  rodadasMedia: number;
  rodadasMediana: number;
  /** Quanto do PV total do grupo foi gasto, em média (0 a 1; pode passar de 1 se sobrar dano). */
  pvGasto: number;
};

export function simular(grupo: Combatente[], inimigos: Combatente[], rolar: (faces: number) => number, lutas: number = NUM_DE_LUTAS): Resultado {
  const caiu = new Map<string, number>(grupo.map((g) => [g.id, 0]));
  let vence = 0;
  let perde = 0;
  let empate = 0;
  let alguem = 0;
  let danoTotal = 0;
  const rodadas: number[] = [];
  for (let i = 0; i < lutas; i++) {
    const r = simularUmaLuta(grupo, inimigos, rolar);
    if (r.vencedor === "grupo") vence++;
    else if (r.vencedor === "inimigos") perde++;
    else empate++;
    if (r.caidos.length > 0) alguem++;
    for (const id of r.caidos) caiu.set(id, (caiu.get(id) ?? 0) + 1);
    danoTotal += r.danoNoGrupo;
    rodadas.push(r.rodadas);
  }
  rodadas.sort((a, b) => a - b);
  const pvDoGrupo = grupo.reduce((s, g) => s + g.hp, 0);
  return {
    lutas,
    grupoVence: vence / lutas,
    grupoPerdeTodos: perde / lutas,
    empate: empate / lutas,
    alguemCai: alguem / lutas,
    caiPorPessoa: grupo.map((g) => ({ id: g.id, nome: g.nome, chance: (caiu.get(g.id) ?? 0) / lutas })),
    rodadasMedia: rodadas.reduce((s, x) => s + x, 0) / lutas,
    rodadasMediana: rodadas[Math.floor(lutas / 2)] ?? 0,
    pvGasto: pvDoGrupo > 0 ? danoTotal / lutas / pvDoGrupo : 0,
  };
}

export type Dificuldade = "tranquilo" | "medio" | "dificil" | "mortal";

/** O rótulo de uma palavra pro termômetro. Os cortes são combinados com a mesa, não regra do livro. */
export function dificuldade(r: Pick<Resultado, "grupoPerdeTodos" | "alguemCai" | "empate">): Dificuldade {
  if (r.grupoPerdeTodos >= 0.25) return "mortal";
  if (r.grupoPerdeTodos >= 0.05 || r.alguemCai >= 0.7) return "dificil";
  if (r.alguemCai >= 0.3) return "medio";
  return "tranquilo";
}

export const ROTULO_DA_DIFICULDADE: Record<Dificuldade, string> = {
  tranquilo: "Tranquilo",
  medio: "Médio",
  dificil: "Difícil",
  mortal: "Mortal",
};

/** "62%", "<1%" ou "0%" — nunca "0%" pra algo que aconteceu. */
export function porCento(fracao: number): string {
  const p = fracao * 100;
  if (p <= 0) return "0%";
  if (p < 1) return "<1%";
  if (p > 99 && p < 100) return ">99%";
  return `${Math.round(p)}%`;
}

type FichaDoGrupo = {
  slug: string;
  name: string;
  ac: number;
  hp: number;
  hp_max: number;
  hp_temp: number;
  init_mod: number;
  is_npc: boolean;
  dono?: string | null;
  ataque?: string;
  ataques?: Parameters<typeof textoEfetivoDeAtaques>[0]["ataques"];
  atributos: Parameters<typeof textoEfetivoDeAtaques>[0]["atributos"];
  classes: { nivel: number }[];
};

/** Quem pode lutar do lado do grupo: jogadores e companheiros (NPC com dono). */
export function ehDoGrupo(p: Pick<FichaDoGrupo, "is_npc" | "dono">): boolean {
  return !p.is_npc || Boolean(p.dono);
}

/**
 * O grupo pra simular. `pvCheio`: todos começam com o PV máximo (o Mestre preparando a sessão);
 * senão vale o PV de agora (com o temporário), e quem está a 0 fica de fora. `semAtaque` lista
 * quem não tem nenhum ataque legível (causaria 0 de dano).
 */
export function combatentesDoGrupo(fichas: FichaDoGrupo[], pvCheio: boolean): { grupo: Combatente[]; semAtaque: string[]; deFora: string[] } {
  const grupo: Combatente[] = [];
  const semAtaque: string[] = [];
  const deFora: string[] = [];
  for (const p of fichas.filter(ehDoGrupo)) {
    const hp = pvCheio ? p.hp_max : p.hp + (p.hp_temp ?? 0);
    if (hp <= 0) {
      deFora.push(p.name);
      continue;
    }
    const turno = turnoDoTexto(textoEfetivoDeAtaques({ ...p, ataque: p.ataque ?? "", is_npc: p.is_npc }));
    if (turno.length === 0) semAtaque.push(p.name);
    grupo.push({ id: p.slug, nome: p.name, lado: "grupo", ca: p.ac, hp, init_mod: p.init_mod, turno });
  }
  return { grupo, semAtaque, deFora };
}
