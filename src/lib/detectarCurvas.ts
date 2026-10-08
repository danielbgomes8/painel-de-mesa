/**
 * Paredes curvas e diagonais: o que sobra das linhas escuras depois de tirar as
 * retas já achadas. A máscara do que sobrou é afinada até virar um fio de 1 px
 * (Zhang-Suen), cada ramo do fio vira uma lista de pontos e a lista é simplificada
 * em poucos trechos retos — o mesmo jeito de a parede em curva do painel ser
 * desenhada à mão. Entram só curvas lisas e compridas; contorno picotado (hachura,
 * texto, móvel) fica de fora.
 */
import type { Segmento } from "./detectarParedes";

/** Afina uma máscara 0/1 até 1 px de largura. Altera `m`. */
export function afinar(m: Uint8Array, w: number, h: number): void {
  let vivos: number[] = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (m[y * w + x]) vivos.push(y * w + x);
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (let passo = 0; passo < 2; passo++) {
      const apagar: number[] = [];
      for (const i of vivos) {
        const p2 = m[i - w], p3 = m[i - w + 1], p4 = m[i + 1], p5 = m[i + w + 1], p6 = m[i + w], p7 = m[i + w - 1], p8 = m[i - 1], p9 = m[i - w - 1];
        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;
        const a =
          (p2 === 0 && p3 === 1 ? 1 : 0) + (p3 === 0 && p4 === 1 ? 1 : 0) + (p4 === 0 && p5 === 1 ? 1 : 0) + (p5 === 0 && p6 === 1 ? 1 : 0) +
          (p6 === 0 && p7 === 1 ? 1 : 0) + (p7 === 0 && p8 === 1 ? 1 : 0) + (p8 === 0 && p9 === 1 ? 1 : 0) + (p9 === 0 && p2 === 1 ? 1 : 0);
        if (a !== 1) continue;
        if (passo === 0 ? p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0 : p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) apagar.push(i);
      }
      if (apagar.length) mudou = true;
      for (const i of apagar) m[i] = 0;
      if (apagar.length) vivos = vivos.filter((i) => m[i]);
    }
  }
  // Zhang-Suen deixa cantinhos em "L" nas escadinhas: tirar, senão cada degrau vira uma junção falsa.
  const deltas = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1];
  for (let volta = 0; volta < 2; volta++) {
    for (const i of vivos) {
      if (!m[i]) continue;
      const viz = deltas.map((d) => i + d).filter((j) => m[j]);
      if (viz.length !== 2) continue;
      // Dois vizinhos que se tocam entre si: o pixel do meio é só um canto.
      const ax = viz[0] % w, ay = Math.floor(viz[0] / w), bx = viz[1] % w, by = Math.floor(viz[1] / w);
      if (Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1) m[i] = 0;
    }
  }
}

/** Douglas-Peucker (sem recursão) sobre uma lista de pontos [x, y]. */
export function simplificar(pts: [number, number][], tolerancia: number): [number, number][] {
  const n = pts.length;
  if (n < 3) return pts;
  const manter = new Uint8Array(n);
  manter[0] = manter[n - 1] = 1;
  const pilha: [number, number][] = [[0, n - 1]];
  while (pilha.length) {
    const [i, j] = pilha.pop()!;
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[j];
    const L = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
    let melhor = 0;
    let k = -1;
    for (let t = i + 1; t < j; t++) {
      const d = Math.abs((x2 - x1) * (y1 - pts[t][1]) - (x1 - pts[t][0]) * (y2 - y1)) / L;
      if (d > melhor) {
        melhor = d;
        k = t;
      }
    }
    if (k >= 0 && melhor > tolerancia) {
      manter[k] = 1;
      pilha.push([i, k], [k, j]);
    }
  }
  return pts.filter((_, i) => manter[i]);
}

const VIZ: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

/** Cada ramo do fio (cortado nas junções) como lista ordenada de pontos. */
function ramos(fio: Uint8Array, w: number, h: number, minimoPx: number): [number, number][][] {
  const vizinhos = (i: number, m: Uint8Array) => {
    const x = i % w;
    const y = (i - x) / w;
    const out: number[] = [];
    for (const [dx, dy] of VIZ) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx >= 0 && xx < w && yy >= 0 && yy < h && m[yy * w + xx]) out.push(yy * w + xx);
    }
    return out;
  };
  const cortado = fio.slice();
  // Junção de verdade = o anel de 8 vizinhos tem 3 ou mais "ilhas" de pixels (e não só 3 vizinhos, que
  // também acontece no meio de uma escadinha).
  const anel = [-w - 1, -w, -w + 1, 1, w + 1, w, w - 1, -1];
  for (let i = 0; i < fio.length; i++) {
    if (!fio[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
    let ilhas = 0;
    for (let k = 0; k < 8; k++) if (!fio[i + anel[k]] && fio[i + anel[(k + 1) % 8]]) ilhas++;
    if (ilhas >= 3) cortado[i] = 0;
  }
  const visto = new Uint8Array(fio.length);
  const saida: [number, number][][] = [];
  for (let i = 0; i < cortado.length; i++) {
    if (!cortado[i] || visto[i]) continue;
    const comp: number[] = [i];
    visto[i] = 1;
    for (let k = 0; k < comp.length; k++) for (const v of vizinhos(comp[k], cortado)) if (!visto[v]) { visto[v] = 1; comp.push(v); }
    if (comp.length < minimoPx) continue;
    const doRamo = new Set(comp);
    const ponta = comp.find((c) => vizinhos(c, cortado).length === 1) ?? comp[0];
    const ordem: number[] = [ponta];
    const passou = new Set<number>([ponta]);
    for (let atual = ponta; ; ) {
      const prox = vizinhos(atual, cortado).find((v) => doRamo.has(v) && !passou.has(v));
      if (prox === undefined) break;
      passou.add(prox);
      ordem.push(prox);
      atual = prox;
    }
    if (ordem.length >= minimoPx) saida.push(ordem.map((c) => [c % w, Math.floor(c / w)]));
  }
  return saida;
}

export type OpcoesDeCurvas = { lado: number; espessura: number; maximo?: number; ladoClaro?: boolean };

/**
 * @param binaria  máscara (0/255) das linhas escuras e finas (black-hat limiarizado)
 * @param retas    paredes retas já aceitas: saem da máscara antes de procurar curva
 * @param cinza    níveis de cinza, pra conferir que a curva é escura em relação ao chão
 */
export function detectarCurvas(
  binaria: Uint8Array,
  cinza: Uint8Array,
  w: number,
  h: number,
  retas: Segmento[],
  { lado, espessura, maximo = 150, ladoClaro = false }: OpcoesDeCurvas,
): Segmento[] {
  const resto = new Uint8Array(w * h);
  for (let i = 0; i < resto.length; i++) resto[i] = binaria[i] ? 1 : 0;
  // Tira as retas (retângulo de 1 espessura em volta de cada uma).
  const meia = Math.ceil(espessura / 2) + 1;
  for (const s of retas) {
    const x0 = Math.max(0, Math.floor(Math.min(s[0], s[2]) - meia));
    const x1 = Math.min(w - 1, Math.ceil(Math.max(s[0], s[2]) + meia));
    const y0 = Math.max(0, Math.floor(Math.min(s[1], s[3]) - meia));
    const y1 = Math.min(h - 1, Math.ceil(Math.max(s[1], s[3]) + meia));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) resto[y * w + x] = 0;
  }
  // Abertura 3×3: some o pó e as pontes finas.
  const erodida = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (resto[i] && resto[i - 1] && resto[i + 1] && resto[i - w] && resto[i + w] && resto[i - w - 1] && resto[i - w + 1] && resto[i + w - 1] && resto[i + w + 1]) erodida[i] = 1;
    }
  const aberta = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (erodida[i] || erodida[i - 1] || erodida[i + 1] || erodida[i - w] || erodida[i + w] || erodida[i - w - 1] || erodida[i - w + 1] || erodida[i + w - 1] || erodida[i + w + 1]) aberta[i] = 1;
    }
  afinar(aberta, w, h);

  const tolerancia = Math.max(2.5, lado * 0.005);
  const candidatas: { segs: Segmento[]; comp: number }[] = [];
  for (const ramo of ramos(aberta, w, h, lado * 0.06)) {
    const ap = simplificar(ramo, tolerancia);
    if (ap.length < 3) continue; // reta simples: já saiu pelo caminho das retas
    let comp = 0;
    for (let k = 0; k < ap.length - 1; k++) comp += Math.hypot(ap[k + 1][0] - ap[k][0], ap[k + 1][1] - ap[k][1]);
    if (comp < lado * 0.1 || comp / (ap.length - 1) < lado * 0.018) continue;
    // Curva inteira dentro da faixa de 5% da borda: é moldura ou beira de papel, não parede.
    const margem = lado * 0.05;
    const xs = ap.map((p) => p[0]);
    const ys = ap.map((p) => p[1]);
    if (Math.max(...xs) < margem || Math.min(...xs) > w - margem || Math.max(...ys) < margem || Math.min(...ys) > h - margem) continue;
    const segs: Segmento[] = [];
    for (let k = 0; k < ap.length - 1; k++) segs.push([ap[k][0], ap[k][1], ap[k + 1][0], ap[k + 1][1]]);
    if (!escuraEmRelacaoAoChao(cinza, w, h, segs, espessura, ladoClaro)) continue;
    candidatas.push({ segs, comp });
  }
  candidatas.sort((a, b) => b.comp - a.comp);
  const saida: Segmento[] = [];
  for (const c of candidatas) {
    if (saida.length + c.segs.length > maximo) continue;
    saida.push(...c.segs);
  }
  return saida;
}

/** Mesma conta do filtro das retas, mas na normal de cada trecho (a curva não é horizontal nem vertical). */
function escuraEmRelacaoAoChao(cinza: Uint8Array, w: number, h: number, segs: Segmento[], afastamento: number, ladoClaro: boolean): boolean {
  const amostra = (x: number, y: number) => cinza[Math.min(h - 1, Math.max(0, Math.round(y))) * w + Math.min(w - 1, Math.max(0, Math.round(x)))];
  const dentro = (x: number, y: number) => x >= 0 && x <= w - 1 && y >= 0 && y <= h - 1;
  let linha = 0;
  let n = 0;
  const lados = [0, 0];
  const validos = [0, 0];
  for (const s of segs) {
    const comp = Math.hypot(s[2] - s[0], s[3] - s[1]) || 1;
    const nx = -(s[3] - s[1]) / comp;
    const ny = (s[2] - s[0]) / comp;
    const passos = Math.max(2, Math.floor(comp));
    for (let i = 0; i <= passos; i++) {
      const x = s[0] + ((s[2] - s[0]) * i) / passos;
      const y = s[1] + ((s[3] - s[1]) * i) / passos;
      let escuro = 255;
      for (let o = -3; o <= 3; o++) escuro = Math.min(escuro, amostra(x + nx * o, y + ny * o));
      linha += escuro;
      n++;
      [-afastamento, afastamento].forEach((o, k) => {
        const px = x + nx * o;
        const py = y + ny * o;
        if (dentro(px, py)) {
          lados[k] += amostra(px, py);
          validos[k]++;
        }
      });
    }
  }
  const medias = lados.map((v, k) => (validos[k] > n * 0.5 ? v / validos[k] : Infinity));
  const lado = ladoClaro ? Math.max(...medias.filter(Number.isFinite)) : Math.min(...medias);
  if (!Number.isFinite(lado)) return true;
  return linha / n / Math.max(1, lado) <= 0.6;
}
