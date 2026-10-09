import { limitarQuantidade } from "./regras";
import type { EventoPreparado, GrupoEncontro } from "./tipos";

/**
 * Eventos do combate (migration 0034): avisos que o Mestre programa pra
 * aparecerem sozinhos — "rodada 3: o teto desaba", "a 50% de PV o dragão
 * levanta voo". As regras ficam aqui (puras); a leitura e a escrita no banco
 * são do `hooks/useEventos.ts`, e a tela é `EventosDoCombate.tsx`.
 *
 * O gatilho é decidido na tela, a partir da rodada e do PV de agora — não se
 * guarda "disparou" no banco. Assim um aviso nunca se perde porque o turno
 * pulou a rodada ou porque o PV caiu de 80% pra 20% numa pancada só: enquanto
 * a condição for verdadeira e ele não foi marcado como feito, ele está
 * pendente. O aviso é só do Mestre; o texto vai pro log público apenas se ele
 * marcou "contar à mesa".
 */

export const TEXTO_MAXIMO = 200;
export const RODADA_MAXIMA = 99;
export const EVENTOS_POR_ENCONTRO = 30;
export const EVENTOS_NO_COMBATE = 60;

export type EventoDoCombate = {
  id: string;
  room_code: string;
  tipo: "rodada" | "pv";
  rodada: number | null;
  slugs: string[];
  pct: number | null;
  texto: string;
  publico: boolean;
  feito: boolean;
  created_at: string;
};

export type NovoEventoDoCombate = Pick<EventoDoCombate, "tipo" | "rodada" | "slugs" | "pct" | "texto" | "publico">;

export function limparTexto(texto: string): string {
  return (texto ?? "").replace(/\s+/g, " ").trim().slice(0, TEXTO_MAXIMO);
}

function inteiro(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Linha do banco → evento; tudo que vier torto vira valor seguro (a linha com id vazio é descartada por quem chama). */
export function normalizarEvento(bruto: unknown): EventoDoCombate {
  const o = (bruto ?? {}) as Record<string, unknown>;
  const tipo = o.tipo === "pv" ? "pv" : "rodada";
  return {
    id: typeof o.id === "string" ? o.id : "",
    room_code: typeof o.room_code === "string" ? o.room_code : "",
    tipo,
    rodada: tipo === "rodada" ? (inteiro(o.rodada, 1, RODADA_MAXIMA) ?? 1) : null,
    slugs: Array.isArray(o.slugs) ? o.slugs.filter((s): s is string => typeof s === "string").slice(0, 40) : [],
    pct: tipo === "pv" ? (inteiro(o.pct, 0, 100) ?? 50) : null,
    texto: limparTexto(typeof o.texto === "string" ? o.texto : ""),
    publico: o.publico === true,
    feito: o.feito === true,
    created_at: typeof o.created_at === "string" ? o.created_at : "",
  };
}

export function normalizarPreparados(bruto: unknown): EventoPreparado[] {
  if (!Array.isArray(bruto)) return [];
  const saida: EventoPreparado[] = [];
  for (const item of bruto.slice(0, EVENTOS_POR_ENCONTRO)) {
    const o = (item ?? {}) as Record<string, unknown>;
    const texto = limparTexto(typeof o.texto === "string" ? o.texto : "");
    if (typeof o.id !== "string" || o.id === "" || texto === "") continue;
    const tipo = o.tipo === "pv" ? "pv" : "rodada";
    saida.push({
      id: o.id,
      tipo,
      rodada: tipo === "rodada" ? (inteiro(o.rodada, 1, RODADA_MAXIMA) ?? 1) : null,
      grupo: tipo === "pv" ? inteiro(o.grupo, 0, 999) : null,
      pct: tipo === "pv" ? (inteiro(o.pct, 0, 100) ?? 50) : null,
      texto,
      publico: o.publico === true,
    });
  }
  return saida;
}

export type SituacaoDoCombate = {
  /** Só vale com o combate de pé (alguém na ordem). */
  combateAtivo: boolean;
  round: number;
  fichas: { slug: string; hp: number; hp_max: number }[];
};

/**
 * O gatilho está verdadeiro agora? Por rodada: a rodada de agora chegou ou passou.
 * Por PV: algum dos monstros do aviso está no percentual ou abaixo (0% = a 0 PV).
 * Monstro que não existe mais na sala (ficha apagada) não dispara nada.
 */
export function disparou(e: Pick<EventoDoCombate, "tipo" | "rodada" | "slugs" | "pct">, s: SituacaoDoCombate): boolean {
  if (!s.combateAtivo) return false;
  if (e.tipo === "rodada") return e.rodada !== null && s.round >= e.rodada;
  if (e.pct === null) return false;
  const pct = e.pct;
  return s.fichas.some((f) => e.slugs.includes(f.slug) && f.hp_max > 0 && f.hp * 100 <= pct * f.hp_max);
}

/** Os que pedem atenção agora: gatilho verdadeiro e ainda não tratados. Rodada primeiro (pela ordem de rodada), depois PV. */
export function pendentes(eventos: EventoDoCombate[], s: SituacaoDoCombate): EventoDoCombate[] {
  return eventos
    .filter((e) => !e.feito && disparou(e, s))
    .sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === "rodada" ? -1 : 1;
      if (a.tipo === "rodada") return (a.rodada ?? 0) - (b.rodada ?? 0) || a.created_at.localeCompare(b.created_at);
      return a.created_at.localeCompare(b.created_at);
    });
}

/** "Rodada 3" ou "50% de PV · Dragão" (vários monstros: "Goblin, Goblin 2 +1"). */
export function rotuloDoGatilho(e: Pick<EventoDoCombate, "tipo" | "rodada" | "slugs" | "pct">, nomeDe: (slug: string) => string | null): string {
  if (e.tipo === "rodada") return `Rodada ${e.rodada ?? "?"}`;
  const nomes = e.slugs.map((s) => nomeDe(s)).filter((n): n is string => Boolean(n));
  const alvo = nomes.length === 0 ? "monstro que saiu da sala" : nomes.length <= 2 ? nomes.join(", ") : `${nomes.slice(0, 2).join(", ")} +${nomes.length - 2}`;
  return `${e.pct === 0 ? "0 PV" : `${e.pct}% de PV`} · ${alvo}`;
}

/**
 * Do modelo do encontro pro combate de agora: o gatilho "grupo N" vira os slugs
 * dos monstros criados daquele grupo. `criados` vem na ordem em que
 * `npcsDoEncontro` gerou (grupo por grupo, `quantidade` de cada, já limitada).
 * Aviso de PV cujo grupo não existe mais (o Mestre tirou o grupo depois) é descartado.
 */
export function eventosParaOCombate(
  preparados: EventoPreparado[],
  grupos: GrupoEncontro[],
  criados: { slug: string }[],
): NovoEventoDoCombate[] {
  const faixas: { de: number; ate: number }[] = [];
  let cursor = 0;
  for (const g of grupos) {
    const qtd = limitarQuantidade(g.quantidade);
    faixas.push({ de: cursor, ate: cursor + qtd });
    cursor += qtd;
  }
  const saida: NovoEventoDoCombate[] = [];
  for (const p of preparados) {
    if (p.tipo === "rodada") {
      saida.push({ tipo: "rodada", rodada: p.rodada ?? 1, slugs: [], pct: null, texto: p.texto, publico: p.publico });
      continue;
    }
    const faixa = p.grupo === null ? undefined : faixas[p.grupo];
    const slugs = faixa ? criados.slice(faixa.de, faixa.ate).map((c) => c.slug) : [];
    if (slugs.length === 0) continue;
    saida.push({ tipo: "pv", rodada: null, slugs, pct: p.pct ?? 50, texto: p.texto, publico: p.publico });
  }
  return saida;
}

/** O que o formulário digitou, validado. */
export function validarNovoEvento(
  e: { tipo: "rodada" | "pv"; rodada: string; pct: string; texto: string },
): { ok: true; rodada: number | null; pct: number | null; texto: string } | { ok: false; motivo: string } {
  const texto = limparTexto(e.texto);
  if (texto === "") return { ok: false, motivo: "Escreva o que vai acontecer." };
  if (e.tipo === "rodada") {
    const r = inteiro(e.rodada, 1, RODADA_MAXIMA);
    if (r === null || e.rodada.trim() === "") return { ok: false, motivo: `Diga em que rodada (1 a ${RODADA_MAXIMA}).` };
    return { ok: true, rodada: r, pct: null, texto };
  }
  const p = inteiro(e.pct, 0, 100);
  if (p === null || e.pct.trim() === "") return { ok: false, motivo: "Diga a porcentagem de PV (0 a 100)." };
  return { ok: true, rodada: null, pct: p, texto };
}

/** A linha pública do log, quando o Mestre marca "contar à mesa". */
export function linhaPublicaDoEvento(texto: string): string {
  return `📜 ${limparTexto(texto)}`;
}

/** Tirar o grupo `i` do encontro: o aviso de PV daquele grupo some e os dos grupos seguintes passam a apontar pro índice certo. */
export function eventosAoTirarGrupo(eventos: EventoPreparado[], i: number): EventoPreparado[] {
  return eventos
    .filter((e) => !(e.tipo === "pv" && e.grupo === i))
    .map((e) => (e.tipo === "pv" && e.grupo !== null && e.grupo > i ? { ...e, grupo: e.grupo - 1 } : e));
}
