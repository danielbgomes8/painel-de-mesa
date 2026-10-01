/**
 * Paredes e portas do mapa — as regras puras: o que vem do banco, onde as
 * pontas se encaixam ao desenhar, o cômodo de quatro paredes, qual parede está
 * sob o dedo, e quais bloqueiam a vista.
 *
 * Quem enxerga paredes e portas é só o Mestre. A mesa vê o desenho do mapa e a
 * névoa se abrir — nunca a marcação —, então uma passagem secreta é uma "porta"
 * fechada que o mapa mostra como parede comum; quando os jogadores a descobrem, o
 * Mestre a abre. Como o resto do mapa, isso esconde NA TELA (ver README).
 */
import { cruzamentoMaisPerto } from "./area";
import type { Cena, Ponto } from "./cenas";
import { distanciaAoSegmento, type Segmento } from "./visao";

export type TipoParede = "parede" | "porta";

/** Uma parede ou porta como está no banco (px da imagem da cena). */
export type Parede = {
  id: string;
  cena_id: string;
  room_code: string;
  tipo: TipoParede;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Só importa na porta: aberta deixa a vista passar. */
  aberta: boolean;
  created_at: string;
};

export type NovaParede = { tipo: TipoParede; x1: number; y1: number; x2: number; y2: number; aberta?: boolean };

/** O que o Mestre faz com a ferramenta de paredes. */
export type ModoParede = "parede" | "porta" | "comodo" | "apagar";

/** Por cena: o app não aceita mais que isso (cada parede entra na conta de visão de
 *  cada aparelho, a cada vez que um peão se mexe). */
export const PAREDES_MAXIMAS = 400;
/** Parede menor que isso (px da imagem) é um toque, não uma parede. */
export const PAREDE_MINIMA_PX = 6;
/** Quanto perto (px da TELA) o dedo precisa estar da ponta de uma parede pra encaixar nela. */
export const ENCAIXE_NA_PONTA_PX = 14;
/** Quanto perto (px da TELA) o dedo precisa estar de uma parede pra tocar nela. */
export const TOQUE_NA_PAREDE_PX = 16;

function numero(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function normalizarParede(linha: unknown): Parede | null {
  if (!linha || typeof linha !== "object") return null;
  const o = linha as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.cena_id !== "string") return null;
  const tipo: TipoParede | null = o.tipo === "parede" || o.tipo === "porta" ? o.tipo : null;
  if (!tipo) return null;
  const [x1, y1, x2, y2] = [numero(o.x1), numero(o.y1), numero(o.x2), numero(o.y2)];
  if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
  return {
    id: o.id,
    cena_id: o.cena_id,
    room_code: typeof o.room_code === "string" ? o.room_code : "",
    tipo,
    x1,
    y1,
    x2,
    y2,
    aberta: o.aberta === true,
    created_at: typeof o.created_at === "string" ? o.created_at : "",
  };
}

/** Quais bloqueiam a vista: toda parede e toda porta FECHADA. */
export function segmentosQueBloqueiam(paredes: readonly Parede[]): Segmento[] {
  return paredes.filter((p) => p.tipo === "parede" || !p.aberta).map((p) => [p.x1, p.y1, p.x2, p.y2] as const);
}

function dentroDoMapa(cena: Pick<Cena, "largura" | "altura">, [x, y]: Ponto): Ponto {
  return [Math.min(cena.largura, Math.max(0, x)), Math.min(cena.altura, Math.max(0, y))];
}

/** Onde a ponta de uma parede cai quando o dedo está em `p`: na ponta de outra
 *  parede que esteja perto (cantos fecham sem fresta), senão no cruzamento da
 *  grade mais perto, senão onde o dedo está. `escala` é a da tela (px da tela por px do mapa). */
export function pontoParaParede(
  cena: Pick<Cena, "grade_ligada" | "grade_px" | "grade_dx" | "grade_dy" | "metros" | "largura" | "altura">,
  paredes: readonly Parede[],
  p: Ponto,
  escala: number,
): Ponto {
  const alcance = ENCAIXE_NA_PONTA_PX / Math.max(escala, 1e-6);
  let melhor: Ponto | null = null;
  let menor = alcance;
  for (const w of paredes) {
    for (const q of [[w.x1, w.y1], [w.x2, w.y2]] as const) {
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d <= menor) {
        menor = d;
        melhor = q;
      }
    }
  }
  if (melhor) return melhor;
  return dentroDoMapa(cena, cruzamentoMaisPerto(cena, p));
}

/** Uma parede entre dois pontos já encaixados, ou null se for curta demais (um toque). */
export function paredeEntre(tipo: TipoParede, a: Ponto, b: Ponto): NovaParede | null {
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) < PAREDE_MINIMA_PX) return null;
  return { tipo, x1: a[0], y1: a[1], x2: b[0], y2: b[1], ...(tipo === "porta" ? { aberta: false } : {}) };
}

/** As quatro paredes de um cômodo entre dois cantos opostos; null se não tem área. */
export function paredesDoComodo(a: Ponto, b: Ponto): NovaParede[] | null {
  const [x1, x2] = a[0] <= b[0] ? [a[0], b[0]] : [b[0], a[0]];
  const [y1, y2] = a[1] <= b[1] ? [a[1], b[1]] : [b[1], a[1]];
  if (x2 - x1 < PAREDE_MINIMA_PX || y2 - y1 < PAREDE_MINIMA_PX) return null;
  return [
    { tipo: "parede", x1, y1, x2, y2: y1 },
    { tipo: "parede", x1: x2, y1, x2, y2 },
    { tipo: "parede", x1: x2, y1: y2, x2: x1, y2 },
    { tipo: "parede", x1, y1: y2, x2: x1, y2: y1 },
  ];
}

/** A parede (ou porta) mais perto do ponto, se estiver a no máximo `tolerancia` px do mapa. */
export function acharParedeNoPonto(paredes: readonly Parede[], p: Ponto, tolerancia: number, tipo?: TipoParede): Parede | null {
  let melhor: Parede | null = null;
  let menor = tolerancia;
  for (const w of paredes) {
    if (tipo && w.tipo !== tipo) continue;
    const d = distanciaAoSegmento(p[0], p[1], [w.x1, w.y1, w.x2, w.y2]);
    if (d <= menor) {
      menor = d;
      melhor = w;
    }
  }
  return melhor;
}

/** Cabem mais `n` paredes nesta cena? */
export function cabemParedes(atuais: number, n: number): boolean {
  return atuais + n <= PAREDES_MAXIMAS;
}

/** A mais recente (pra "desfazer parede"): pela data, e na falta dela a última da lista. */
export function ultimaParede(paredes: readonly Parede[]): Parede | null {
  if (paredes.length === 0) return null;
  return [...paredes].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))[paredes.length - 1];
}
