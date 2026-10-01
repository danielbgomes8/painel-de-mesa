/**
 * Visão automática — o que o grupo enxerga, calculado a partir dos peões dos
 * jogadores e das paredes da cena. Tudo puro.
 *
 * Como funciona: de cada peão sai um leque de raios; cada raio anda até bater na
 * primeira parede (ou porta fechada) ou até o alcance. Ligando as pontas dos raios
 * sai o POLÍGONO DE VISÃO: tudo dentro dele está "visto agora". A névoa se abre
 * nesses polígonos, e o que já foi visto fica numa MÁSCARA de quadradinhos
 * (a memória do grupo: escurecido, não preto).
 *
 * Os raios apontam pra cada PONTA de parede (com uma folguinha pra cada lado) e,
 * entre elas, pra um círculo de pontos: assim os cantos saem exatos e o limite
 * do alcance sai redondo. Todas as coordenadas são em px da imagem da cena.
 */
import { ladoDeReferencia, type Cena, type Ponto } from "./cenas";

/** Uma parede como a vista a vê: x1, y1, x2, y2. */
export type Segmento = readonly [x1: number, y1: number, x2: number, y2: number];

/** Pontos do círculo do alcance entre uma ponta de parede e outra. */
const PONTOS_DO_CIRCULO = 96;
const FOLGA_DO_RAIO = 0.0003;

/** Onde o raio `origem + t·(dx, dy)` (t ≥ 0) encontra o segmento; Infinity se não encontra. */
function distanciaAteSegmento(ox: number, oy: number, dx: number, dy: number, s: Segmento): number {
  const sx = s[2] - s[0];
  const sy = s[3] - s[1];
  const den = dx * sy - dy * sx;
  if (Math.abs(den) < 1e-9) return Infinity; // paralelo
  const t = ((s[0] - ox) * sy - (s[1] - oy) * sx) / den;
  const u = ((s[0] - ox) * dy - (s[1] - oy) * dx) / den;
  return t >= 0 && u >= 0 && u <= 1 ? t : Infinity;
}

/** Distância do ponto ao segmento (a mais curta, até o ponto mais próximo dele). */
export function distanciaAoSegmento(px: number, py: number, s: Segmento): number {
  const sx = s[2] - s[0];
  const sy = s[3] - s[1];
  const quad = sx * sx + sy * sy;
  const k = quad === 0 ? 0 : Math.max(0, Math.min(1, ((px - s[0]) * sx + (py - s[1]) * sy) / quad));
  return Math.hypot(px - (s[0] + k * sx), py - (s[1] + k * sy));
}

/** O polígono que um peão em `origem` enxerga, com no máximo `alcance` px de raio.
 *  Sem paredes por perto, sai o círculo do alcance. */
export function poligonoDeVisao(origem: Ponto, segmentos: readonly Segmento[], alcance: number): Ponto[] {
  const [ox, oy] = origem;
  // Só as paredes que o alcance toca: com alcance curto, poupa muita conta.
  const perto = segmentos.filter((s) => distanciaAoSegmento(ox, oy, s) <= alcance);
  const angulos: number[] = [];
  for (const s of perto) {
    for (const [x, y] of [[s[0], s[1]], [s[2], s[3]]] as const) {
      const a = Math.atan2(y - oy, x - ox);
      angulos.push(a - FOLGA_DO_RAIO, a, a + FOLGA_DO_RAIO);
    }
  }
  for (let i = 0; i < PONTOS_DO_CIRCULO; i++) angulos.push((i / PONTOS_DO_CIRCULO) * Math.PI * 2 - Math.PI);
  angulos.sort((a, b) => a - b);
  return angulos.map((a) => {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let t = alcance;
    for (const s of perto) {
      const k = distanciaAteSegmento(ox, oy, dx, dy, s);
      if (k < t) t = k;
    }
    return [ox + dx * t, oy + dy * t] as const;
  });
}

/** O ponto está dentro do polígono? (o de sempre: cruzamentos de um raio horizontal) */
export function pontoNoPoligono(x: number, y: number, poligono: readonly Ponto[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i];
    const [xj, yj] = poligono[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Alcance em px: o da cena em metros, ou "até onde der" (a diagonal do mapa). */
export function alcanceEmPx(cena: Pick<Cena, "grade_px" | "metros" | "largura" | "altura" | "visao_alcance">): number {
  const diagonal = Math.hypot(cena.largura, cena.altura);
  if (cena.visao_alcance === null || cena.visao_alcance <= 0 || cena.metros <= 0) return diagonal;
  return Math.min(diagonal, (cena.visao_alcance * cena.grade_px) / cena.metros);
}

// ── Memória do que já foi explorado ────────────────────────────────────────

/** Uma célula por quadradinho (ou, sem grade, um pedaço de ~1/30 do mapa), com
 *  piso de 32 px pra a máscara não crescer à toa em mapas de grade pequena. */
export const LADO_MINIMO_MEMORIA = 32;

export type Mascara = { cols: number; rows: number; lado: number; celulas: Uint8Array };

export function ladoDaMemoria(cena: Pick<Cena, "grade_ligada" | "grade_px" | "largura" | "altura">): number {
  return Math.max(LADO_MINIMO_MEMORIA, ladoDeReferencia(cena));
}

export function criarMascara(cena: Pick<Cena, "grade_ligada" | "grade_px" | "largura" | "altura">): Mascara {
  const lado = ladoDaMemoria(cena);
  const cols = Math.max(1, Math.ceil(cena.largura / lado));
  const rows = Math.max(1, Math.ceil(cena.altura / lado));
  return { cols, rows, lado, celulas: new Uint8Array(cols * rows) };
}

export function contarCelulas(m: Mascara): number {
  let n = 0;
  for (const c of m.celulas) if (c) n++;
  return n;
}

/** Marca como vista toda célula cujo CENTRO está dentro de algum polígono.
 *  Devolve quantas células novas foram marcadas. */
export function marcarVistos(m: Mascara, poligonos: readonly (readonly Ponto[])[]): number {
  let novas = 0;
  for (const poli of poligonos) {
    if (poli.length < 3) continue;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of poli) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const c0 = Math.max(0, Math.floor(minX / m.lado));
    const c1 = Math.min(m.cols - 1, Math.floor(maxX / m.lado));
    const r0 = Math.max(0, Math.floor(minY / m.lado));
    const r1 = Math.min(m.rows - 1, Math.floor(maxY / m.lado));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * m.cols + c;
        if (m.celulas[i]) continue;
        if (pontoNoPoligono((c + 0.5) * m.lado, (r + 0.5) * m.lado, poli)) {
          m.celulas[i] = 1;
          novas++;
        }
      }
    }
  }
  return novas;
}

/** Soma as células de `b` em `a` (a máscara de `a` cresce; devolve quantas eram novas).
 *  Máscaras de tamanhos diferentes não se misturam: devolve 0. */
export function juntarMascaras(a: Mascara, b: Mascara): number {
  if (a.cols !== b.cols || a.rows !== b.rows || a.lado !== b.lado) return 0;
  let novas = 0;
  for (let i = 0; i < a.celulas.length; i++) {
    if (b.celulas[i] && !a.celulas[i]) {
      a.celulas[i] = 1;
      novas++;
    }
  }
  return novas;
}

/** "colsxrowsxlado:base64 dos bits"; máscara vazia = texto vazio (nada gravado). */
export function codificarMascara(m: Mascara): string {
  if (contarCelulas(m) === 0) return "";
  const bytes = new Uint8Array(Math.ceil(m.celulas.length / 8));
  for (let i = 0; i < m.celulas.length; i++) if (m.celulas[i]) bytes[i >> 3] |= 1 << (i & 7);
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return `${m.cols}x${m.rows}x${Math.round(m.lado * 100) / 100}:${btoa(binario)}`;
}

/** Lê o texto guardado. null = vazio, torto, ou de uma grade/tamanho que não é
 *  mais o da cena (a memória antiga não vale: o mapa mudou de escala). */
export function decodificarMascara(texto: string, cena: Pick<Cena, "grade_ligada" | "grade_px" | "largura" | "altura">): Mascara | null {
  if (!texto) return null;
  const esperada = criarMascara(cena);
  const corte = texto.indexOf(":");
  if (corte < 0) return null;
  const [cols, rows, lado] = texto.slice(0, corte).split("x").map(Number);
  if (cols !== esperada.cols || rows !== esperada.rows || Math.abs(lado - Math.round(esperada.lado * 100) / 100) > 0.01) return null;
  let binario: string;
  try {
    binario = atob(texto.slice(corte + 1));
  } catch {
    return null;
  }
  if (binario.length !== Math.ceil(esperada.celulas.length / 8)) return null;
  for (let i = 0; i < esperada.celulas.length; i++) {
    if (binario.charCodeAt(i >> 3) & (1 << (i & 7))) esperada.celulas[i] = 1;
  }
  return esperada;
}
