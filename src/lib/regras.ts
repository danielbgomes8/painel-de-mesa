/**
 * Regras de negócio da mesa. Fechadas — não reinventar.
 * Cada função é pura pra poder testar sozinha (ver regras.test.ts).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Pontos de vida
// ─────────────────────────────────────────────────────────────────────────────

/** PV nunca passa do máximo nem fica negativo (trava em 0). */
export function limitarPV(valor: number, maximo: number): number {
  const teto = Math.max(0, Math.round(maximo));
  return Math.max(0, Math.min(Math.round(valor), teto));
}

type EstadoVida = { hp: number; hp_max: number; dss: number; dsf: number };
type PatchVida = { hp: number; dss?: number; dsf?: number };

/**
 * Monta o patch pra gravar quando o PV de alguém muda.
 * Regra: testes de resistência contra a morte zeram sozinhos assim que a
 * criatura recupera QUALQUER PV acima de 0.
 */
export function ajustarPV(alvo: EstadoVida, novoHp: number): PatchVida {
  const hp = limitarPV(novoHp, alvo.hp_max);
  const patch: PatchVida = { hp };
  const estava0 = alvo.hp <= 0;
  if (estava0 && hp > 0 && (alvo.dss > 0 || alvo.dsf > 0)) {
    patch.dss = 0;
    patch.dsf = 0;
  }
  return patch;
}

export type FaixaPV = "cheio" | "baixo" | "critico";

/** Cor da barra de PV: verde acima de 60%, âmbar até 60%, vermelho até 1/3 ou a 0. */
export function faixaPV(hp: number, hpMax: number): FaixaPV {
  const pct = hpMax > 0 ? hp / hpMax : 0;
  if (hp <= 0) return "critico";
  if (pct <= 1 / 3) return "critico";
  if (pct <= 0.6) return "baixo";
  return "cheio";
}

/** PV a 0 = Caído: inconsciente, faz os testes de morte. */
export function estaCaido(hp: number): boolean {
  return hp <= 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exaustão (D&D 2024: trilha única 0–6)
// ─────────────────────────────────────────────────────────────────────────────

export const EXAUSTAO_MAX = 6;

export function limitarExaustao(n: number): number {
  return Math.max(0, Math.min(EXAUSTAO_MAX, Math.round(n)));
}

/** Penalidade em TODO teste de D20 (perícia, ataque, resistência): -2 por nível. */
export function penalidadeD20(exh: number): number {
  return limitarExaustao(exh) * 2;
}

/** Redução de deslocamento: -1,5 m por nível (5 pés na régua imperial). */
export function reducaoDeslocamento(exh: number): number {
  return limitarExaustao(exh) * 1.5;
}

/** Deslocamento efetivo depois da exaustão, em metros, nunca abaixo de 0. */
export function deslocamentoEfetivo(base: number, exh: number): number {
  return Math.max(0, base - reducaoDeslocamento(exh));
}

/** Descanso longo tira 1 nível de exaustão — não zera tudo. */
export function descansoLongo(exh: number): number {
  return limitarExaustao(exh) - 1 < 0 ? 0 : limitarExaustao(exh) - 1;
}

/** Formata um número de metros no padrão pt-BR (vírgula decimal). */
export function formatarMetros(n: number): string {
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m`;
}

/** Texto do efeito da exaustão, já calculado, pra mostrar no card. */
export function efeitoExaustao(exh: number): string {
  const nivel = limitarExaustao(exh);
  if (nivel === 0) return "Sem penalidade";
  const partes = [
    `-${penalidadeD20(nivel)} em todos os testes de D20 (perícia, ataque, resistência)`,
    `-${formatarMetros(reducaoDeslocamento(nivel))} de deslocamento`,
  ];
  if (nivel >= EXAUSTAO_MAX) partes.push("morte");
  return partes.join(" · ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Testes de resistência contra a morte
// ─────────────────────────────────────────────────────────────────────────────

export const TESTES_MORTE_MAX = 3;

export function limitarTesteMorte(n: number): number {
  return Math.max(0, Math.min(TESTES_MORTE_MAX, Math.round(n)));
}

export type SituacaoMorte = "em-jogo" | "estavel" | "morto";

export function situacaoMorte(dss: number, dsf: number): SituacaoMorte {
  if (dsf >= TESTES_MORTE_MAX) return "morto";
  if (dss >= TESTES_MORTE_MAX) return "estavel";
  return "em-jogo";
}

// ─────────────────────────────────────────────────────────────────────────────
// Pips clicáveis (exaustão e testes de morte usam a mesma lógica)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clicar num pip: se o pip clicado é o último preenchido, esvazia até ele
 * (fica com `indice`); senão, preenche até ele (fica com `indice + 1`).
 */
export function alternarPips(indiceClicado: number, preenchidosAgora: number): number {
  return indiceClicado + 1 === preenchidosAgora ? indiceClicado : indiceClicado + 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Iniciativa / combate
// ─────────────────────────────────────────────────────────────────────────────

/** Próximo turno: anda na ordem; ao dar a volta, incrementa a rodada. */
export function proximoTurno(
  estado: { round: number; turn: number; order: unknown[] },
): { round: number; turn: number } {
  if (estado.order.length === 0) return { round: estado.round, turn: estado.turn };
  let turn = estado.turn + 1;
  let round = estado.round;
  if (turn >= estado.order.length) {
    turn = 0;
    round += 1;
  }
  return { round, turn };
}

/** Ordena por iniciativa, maior primeiro (empates ficam na ordem de entrada). */
export function ordenarPorIniciativa<T extends { init: number }>(itens: T[]): T[] {
  return itens
    .map((item, i) => ({ item, i }))
    .sort((a, b) => b.item.init - a.item.init || a.i - b.i)
    .map(({ item }) => item);
}

/**
 * Índice do turno depois de remover a posição `removida` da ordem.
 * Mantém o turno apontando pra mesma pessoa quando possível.
 */
export function turnoAposRemover(turnoAtual: number, removida: number, tamanhoNovo: number): number {
  let turno = turnoAtual;
  if (removida < turnoAtual) turno -= 1;
  if (turno >= tamanhoNovo) turno = Math.max(0, tamanhoNovo - 1);
  return Math.max(0, turno);
}

/** Índice do turno depois de trocar `i` e `j` de lugar. */
export function turnoAposTrocar(turnoAtual: number, i: number, j: number): number {
  if (turnoAtual === i) return j;
  if (turnoAtual === j) return i;
  return turnoAtual;
}
