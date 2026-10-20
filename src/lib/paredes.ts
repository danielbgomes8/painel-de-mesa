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
  /** Só na porta: trancada (o Mestre vê o cadeado e a CD pra arrombar; não abre sem destrancar antes). */
  trancada: boolean;
  /** Só na porta: secreta (ninguém sabe dela até alguém achar; a Percepção passiva pode avisar o Mestre). */
  secreta: boolean;
  /** CD pra arrombar/destrancar; null = não definida. */
  cd: number | null;
  /** CD pra achar a porta secreta pela Percepção passiva; null = ninguém repara sozinho. */
  cd_achar: number | null;
  created_at: string;
};

export type NovaParede = { tipo: TipoParede; x1: number; y1: number; x2: number; y2: number; aberta?: boolean };

/** O que o Mestre faz com a ferramenta de paredes. */
export type ModoParede = "parede" | "porta" | "comodo" | "curva" | "apagar" | "propriedades";

/** Por cena: o app não aceita mais que isso (cada parede entra na conta de visão de
 *  cada aparelho, a cada vez que um peão se mexe). */
export const PAREDES_MAXIMAS = 400;
/** Parede menor que isso (px da imagem) é um toque, não uma parede. */
export const PAREDE_MINIMA_PX = 6;
/** Quanto perto (px da TELA) o dedo precisa estar da ponta de uma parede pra encaixar nela. */
export const ENCAIXE_NA_PONTA_PX = 14;
/** Parede em curva: quanto (px da TELA) os trechos retos podem se afastar do
 *  traço do dedo. Menor = mais fiel, e mais trechos gastos do limite da cena. */
export const TOLERANCIA_DA_CURVA_PX = 1.2;
/** Quanto perto (px da TELA) o dedo precisa estar de uma parede pra tocar nela. */
export const TOQUE_NA_PAREDE_PX = 16;

function numero(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** CD de porta: inteiro de 1 a 40; qualquer outra coisa = não definida. */
function cdDaPorta(v: unknown): number | null {
  const n = typeof v === "string" ? (v.trim() === "" ? NaN : Number(v)) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i >= 1 && i <= 40 ? i : null;
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
    trancada: tipo === "porta" && o.trancada === true,
    secreta: tipo === "porta" && o.secreta === true,
    cd: tipo === "porta" ? cdDaPorta(o.cd) : null,
    cd_achar: tipo === "porta" ? cdDaPorta(o.cd_achar) : null,
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

/** A ponta de parede mais perto de `p`, se houver uma dentro do alcance do
 *  encaixe (em px da TELA; `escala` = px da tela por px do mapa). */
export function pontaDeParedePerto(paredes: readonly Pick<Parede, "x1" | "y1" | "x2" | "y2">[], p: Ponto, escala: number): Ponto | null {
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
  return melhor;
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
  return pontaDeParedePerto(paredes, p, escala) ?? dentroDoMapa(cena, cruzamentoMaisPerto(cena, p));
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

// ── Parede em curva ────────────────────────────────────────────────────────

/** Trechos por traço: uma curva comprida não pode comer o limite da cena sozinha. */
export const TRECHOS_MAXIMOS_DO_TRACO = 60;

/** Tira os pontos que quase não mudam o desenho (Douglas-Peucker): fica quem
 *  se afasta mais que `tolerancia` da reta entre os vizinhos que ficaram. */
export function simplificarTraco(pontos: readonly Ponto[], tolerancia: number): Ponto[] {
  if (pontos.length <= 2) return [...pontos];
  const fica = new Array<boolean>(pontos.length).fill(false);
  fica[0] = fica[pontos.length - 1] = true;
  const pilha: [number, number][] = [[0, pontos.length - 1]];
  while (pilha.length > 0) {
    const [i, j] = pilha.pop()!;
    let maior = 0;
    let onde = -1;
    for (let k = i + 1; k < j; k++) {
      const d = distanciaAoSegmento(pontos[k][0], pontos[k][1], [pontos[i][0], pontos[i][1], pontos[j][0], pontos[j][1]]);
      if (d > maior) {
        maior = d;
        onde = k;
      }
    }
    if (onde >= 0 && maior > tolerancia) {
      fica[onde] = true;
      pilha.push([i, onde], [onde, j]);
    }
  }
  return pontos.filter((_, k) => fica[k]);
}

/**
 * Parede em curva: o caminho do dedo (`pontos`, em px da imagem) vira uma
 * fileira de paredes retas e curtas, emendadas uma na outra sem fresta — é o
 * que dá pra fazer caverna, torre redonda e corredor torto, que as paredes de
 * cruzamento a cruzamento da grade não acompanham.
 *
 * `tolerancia` (px da imagem) é o quanto o resultado pode se afastar do traço:
 * menor = mais fiel e mais trechos. Se passar de `maximo` trechos, afrouxa até
 * caber. Com o fim do traço a menos de `fecharEm` do começo, emenda os dois (a
 * volta fecha: pilar, sala redonda). Traço curto demais não vira nada.
 */
export function paredesDoTraco(pontos: readonly Ponto[], tolerancia: number, fecharEm = 0, maximo = TRECHOS_MAXIMOS_DO_TRACO): NovaParede[] {
  // Sem pontos repetidos em sequência.
  const limpos: Ponto[] = [];
  for (const p of pontos) {
    const ultimo = limpos[limpos.length - 1];
    if (!ultimo || ultimo[0] !== p[0] || ultimo[1] !== p[1]) limpos.push(p);
  }
  if (limpos.length < 2) return [];
  let comprimento = 0;
  for (let i = 1; i < limpos.length; i++) comprimento += Math.hypot(limpos[i][0] - limpos[i - 1][0], limpos[i][1] - limpos[i - 1][1]);
  if (comprimento < PAREDE_MINIMA_PX) return [];
  const primeiro = limpos[0];
  const fim = limpos[limpos.length - 1];
  const fecha = fecharEm > 0 && comprimento > fecharEm * 4 && Math.hypot(fim[0] - primeiro[0], fim[1] - primeiro[1]) <= fecharEm;
  if (fecha) limpos[limpos.length - 1] = primeiro;

  let tol = Math.max(tolerancia, 0.05);
  let chaves = simplificarTraco(limpos, tol);
  while (chaves.length - 1 > maximo) {
    tol *= 1.25;
    chaves = simplificarTraco(limpos, tol);
  }
  // Trecho curtinho demais some emendando os vizinhos (nunca as duas pontas do traço).
  const firmes: Ponto[] = [chaves[0]];
  for (let i = 1; i < chaves.length; i++) {
    const ant = firmes[firmes.length - 1];
    const ehUltimo = i === chaves.length - 1;
    if (Math.hypot(chaves[i][0] - ant[0], chaves[i][1] - ant[1]) >= PAREDE_MINIMA_PX) firmes.push(chaves[i]);
    else if (ehUltimo && firmes.length > 1) firmes[firmes.length - 1] = chaves[i];
    else if (ehUltimo) firmes.push(chaves[i]);
  }
  const saida: NovaParede[] = [];
  for (let i = 1; i < firmes.length; i++) {
    const [a, b] = [firmes[i - 1], firmes[i]];
    if (a[0] === b[0] && a[1] === b[1]) continue;
    saida.push({ tipo: "parede", x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
  }
  return saida;
}

/** As paredes do último desenho (pra "desfazer"): um cômodo ou uma curva entram
 *  no banco numa escrita só e saem com a mesma hora — desfazer tira o desenho
 *  inteiro, não um trecho por toque. As ainda não confirmadas (hora vazia) são
 *  as mais novas de todas. */
export function ultimoDesenho(paredes: readonly Parede[]): Parede[] {
  const pendentes = paredes.filter((p) => p.created_at === "");
  if (pendentes.length > 0) return pendentes;
  const ultima = ultimaParede(paredes);
  return ultima ? paredes.filter((p) => p.created_at === ultima.created_at) : [];
}

/** A mais recente (pra "desfazer parede"): pela data; a ainda não confirmada (hora vazia) é a mais nova de todas,
 *  e entre iguais vale a última da lista. */
export function ultimaParede(paredes: readonly Parede[]): Parede | null {
  if (paredes.length === 0) return null;
  const hora = (p: Parede) => p.created_at || "￿";
  return [...paredes].sort((a, b) => (hora(a) < hora(b) ? -1 : hora(a) > hora(b) ? 1 : 0))[paredes.length - 1];
}

// ── Andar ──────────────────────────────────────────────────────────────────

/** Fresta menor que isso (px da imagem) entre duas paredes não deixa passar. */
const FRESTA_PX = 0.5;

/**
 * O passo reto de `de` a `para` bate em algum bloqueio (parede ou porta
 * fechada — ver `segmentosQueBloqueiam`)? Encostar conta, e terminar em cima
 * de uma parede também: senão dava pra atravessar em dois passos (subir na
 * linha, descer do outro lado). Só SAIR de cima de uma não conta — o peão que
 * já está na linha (um peão 2×2 fica no cruzamento da grade, onde as paredes
 * passam) precisa poder se afastar.
 */
export function passoBloqueado(de: Ponto, para: Ponto, bloqueios: readonly Segmento[]): boolean {
  const dx = para[0] - de[0];
  const dy = para[1] - de[1];
  const passo2 = dx * dx + dy * dy;
  if (passo2 === 0) return false;
  for (const [x1, y1, x2, y2] of bloqueios) {
    const sx = x2 - x1;
    const sy = y2 - y1;
    const comprimento = Math.hypot(sx, sy);
    if (comprimento === 0) continue;
    const qx = x1 - de[0];
    const qy = y1 - de[1];
    const det = dx * sy - dy * sx;
    if (Math.abs(det) < 1e-9) {
      // Paralelo à parede: só bate se andar POR CIMA dela (mesma linha, com trecho em comum).
      if (Math.abs(qx * dy - qy * dx) / Math.sqrt(passo2) > 1e-6) continue;
      const t1 = (qx * dx + qy * dy) / passo2;
      const t2 = ((x2 - de[0]) * dx + (y2 - de[1]) * dy) / passo2;
      if (Math.max(t1, t2) > 1e-9 && Math.min(t1, t2) <= 1) return true;
      continue;
    }
    // de + t·passo = ponta1 + u·parede
    const t = (qx * sy - qy * sx) / det;
    const u = (qx * dy - qy * dx) / det;
    const folga = FRESTA_PX / comprimento;
    if (t > 1e-9 && t <= 1 + 1e-9 && u >= -folga && u <= 1 + folga) return true;
  }
  return false;
}

/**
 * Onde o peão vai parar quando o dedo o leva de `de` pra `para` e há paredes
 * no caminho: se o passo é livre, vai; se bate, tenta deslizar ao longo da
 * parede (só na horizontal ou só na vertical — o que render mais primeiro);
 * se nem assim, fica onde está. É chamado a cada movimento do dedo, então o
 * peão "encosta" na parede e acompanha o dedo por ela, sem atravessar.
 */
export function andarComParedes(de: Ponto, para: Ponto, bloqueios: readonly Segmento[]): Ponto {
  if (bloqueios.length === 0 || !passoBloqueado(de, para, bloqueios)) return para;
  const soX: Ponto = [para[0], de[1]];
  const soY: Ponto = [de[0], para[1]];
  const tentativas = Math.abs(para[0] - de[0]) >= Math.abs(para[1] - de[1]) ? [soX, soY] : [soY, soX];
  for (const t of tentativas) {
    if ((t[0] !== de[0] || t[1] !== de[1]) && !passoBloqueado(de, t, bloqueios)) return t;
  }
  return de;
}

/**
 * Onde o peão pousa ao ser solto: dos encaixes candidatos (o do quadradinho em
 * que ele está e os dos vizinhos), o mais perto a que dá pra chegar sem cruzar
 * parede. Quase sempre é o do próprio quadradinho; só muda quando uma parede
 * corta o quadradinho ao meio (parede na diagonal ou fora da grade) e o centro
 * dele ficou do outro lado. null = nenhum serve: o peão volta pra onde saiu.
 */
export function pousoLivre(de: Ponto, encaixes: readonly Ponto[], bloqueios: readonly Segmento[]): Ponto | null {
  let melhor: Ponto | null = null;
  let menor = Infinity;
  for (const e of encaixes) {
    const d = Math.hypot(e[0] - de[0], e[1] - de[1]);
    if (d >= menor || passoBloqueado(de, e, bloqueios)) continue;
    menor = d;
    melhor = e;
  }
  return melhor;
}
