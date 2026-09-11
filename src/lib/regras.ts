/**
 * Regras de negócio da mesa. Fechadas — não reinventar.
 * Cada função é pura pra poder testar sozinha (ver regras.test.ts).
 */

import type { Recurso } from "./tipos";

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

type EstadoVidaTemp = EstadoVida & { hp_temp: number };
type PatchVidaTemp = PatchVida & { hp_temp: number };

/** Dano desconta primeiro do PV temporário, só depois do PV normal. */
export function aplicarDano(alvo: EstadoVidaTemp, dano: number): PatchVidaTemp {
  const d = Math.max(0, Math.round(dano));
  const doTemp = Math.min(alvo.hp_temp, d);
  const doHp = d - doTemp;
  return { ...ajustarPV(alvo, alvo.hp - doHp), hp_temp: alvo.hp_temp - doTemp };
}

/** Cura não mexe no PV temporário (são coisas independentes). */
export function aplicarCura(alvo: EstadoVida, cura: number): PatchVida {
  return ajustarPV(alvo, alvo.hp + Math.max(0, Math.round(cura)));
}

/** Frase pro log de combate a partir da variação real de PV já aplicada. */
export function mensagemAjustePV(nome: string, delta: number, hpDepois: number, hpMax: number): string {
  const verbo = delta >= 0 ? "recuperou" : "sofreu";
  const rotulo = delta >= 0 ? "PV" : "de dano";
  return `${nome} ${verbo} ${Math.abs(delta)} ${rotulo} (${hpDepois}/${hpMax})`;
}

/** Log pro caso em que o dano some inteiro no PV temporário (PV real não muda). */
export function mensagemDanoAbsorvido(nome: string, absorvidoPeloTemp: number): string {
  return `${nome} sofreu ${absorvidoPeloTemp} de dano, todo absorvido pelo PV temporário`;
}

/** Frase pro log quando uma condição é ligada/desligada (ações em massa ou card). */
export function mensagemCondicao(nome: string, condicao: string, ligou: boolean): string {
  return ligou ? `${nome} ficou ${condicao}` : `${nome} não está mais ${condicao}`;
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
// Dados de vida e descanso
// ─────────────────────────────────────────────────────────────────────────────

/** Descanso longo recupera metade dos dados de vida gastos, no mínimo 1. */
export function recuperarDadosDeVida(max: number, atual: number): number {
  const recuperar = Math.max(1, Math.floor(max / 2));
  return Math.min(max, atual + recuperar);
}

/** Gastar 1 dado de vida no descanso curto (a cura em si o jogador aplica à mão). */
export function gastarDadoDeVida(atual: number): number {
  return Math.max(0, atual - 1);
}

/**
 * Descanso longo: PV cheio, -1 nível de exaustão, recupera dados de vida e
 * zera todos os recursos de classe (voltam ao máximo).
 */
export function aplicarDescansoLongo(p: {
  hp_max: number;
  exh: number;
  hd_max: number;
  hd_cur: number;
  resources: Recurso[];
}): { hp: number; exh: number; hd_cur: number; resources: Recurso[] } {
  return {
    hp: p.hp_max,
    exh: descansoLongo(p.exh),
    hd_cur: recuperarDadosDeVida(p.hd_max, p.hd_cur),
    resources: p.resources.map((r) => ({ ...r, cur: r.max })),
  };
}

/** Descanso curto: só os recursos marcados como "recupera no descanso curto". */
export function aplicarDescansoCurto(p: { resources: Recurso[] }): { resources: Recurso[] } {
  return { resources: p.resources.map((r) => (r.short_rest ? { ...r, cur: r.max } : r)) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pips clicáveis (exaustão, testes de morte e recursos usam a mesma lógica)
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

/**
 * Nome exibido na ordem de iniciativa: o Mestre e o próprio nome de
 * personagem de jogador sempre veem o nome real. NPC ainda não revelado
 * aparece como "Inimigo N" pra jogador — evita entregar o monstro antes da
 * hora (ex.: nome do chefão na lista assim que o combate começa).
 */
export function nomeExibidoIniciativa(
  item: { name: string; is_npc: boolean; revealed: boolean },
  numeroDoNpc: number,
  souMestre: boolean,
): string {
  if (souMestre || !item.is_npc || item.revealed) return item.name;
  return `Inimigo ${numeroDoNpc}`;
}

/**
 * PV exibido na ordem de iniciativa (e no telão): PV de NPC é informação só
 * do Mestre, sempre — diferente do nome, revelar o NPC não mostra o PV pro
 * jogador (ele continua sem saber o quão perto da morte o monstro está).
 */
export function pvExibidoIniciativa(
  item: { is_npc: boolean; hp: number; hp_max: number },
  souMestre: boolean,
): { hp: number; hp_max: number } | null {
  if (souMestre || !item.is_npc) return { hp: item.hp, hp_max: item.hp_max };
  return null;
}

/**
 * Numeração estável de NPC ao longo da ordem de iniciativa (1, 2, 3...),
 * pra virar "Inimigo N" — construída sem mutar variável durante o render
 * (regra do compilador do React).
 */
export function numerarNpcsNaOrdem(
  order: { slug: string }[],
  ehNpc: (slug: string) => boolean,
): number[] {
  return order.reduce<number[]>((acc, c) => {
    const anterior = acc.length > 0 ? acc[acc.length - 1] : 0;
    return [...acc, ehNpc(c.slug) ? anterior + 1 : anterior];
  }, []);
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Condição com prazo (some sozinha depois de N rodadas)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A cada rodada nova, desconta 1 de cada condição com prazo marcado; ao
 * chegar a 0, desliga a condição e tira ela do mapa de prazos. Devolve
 * também quais condições expiraram agora, pra registrar no log.
 */
export function reduzirPrazosCondicao(
  cond: Record<string, boolean>,
  prazo: Record<string, number>,
): { cond: Record<string, boolean>; cond_prazo: Record<string, number>; expiraram: string[] } {
  const novoCond = { ...cond };
  const novoPrazo: Record<string, number> = {};
  const expiraram: string[] = [];
  for (const [nome, restante] of Object.entries(prazo)) {
    const restanteNovo = restante - 1;
    if (restanteNovo <= 0) {
      novoCond[nome] = false;
      expiraram.push(nome);
    } else {
      novoPrazo[nome] = restanteNovo;
    }
  }
  return { cond: novoCond, cond_prazo: novoPrazo, expiraram };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bastião — evento do turno (d100)
// ─────────────────────────────────────────────────────────────────────────────

export type FaixaEventoBastiao = { min: number; max: number; nome: string };

/** Acha o nome do evento cuja faixa (min–max, inclusive) contém a rolagem de
 *  d100; undefined se não cair em nenhuma faixa da tabela. */
export function eventoBastiaoPara(rolagem: number, tabela: FaixaEventoBastiao[]): string | undefined {
  return tabela.find((e) => rolagem >= e.min && rolagem <= e.max)?.nome;
}
