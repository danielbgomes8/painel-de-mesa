/**
 * Paredes pelo CONTORNO dos cômodos — pra mapa desenhado sobre um fundo liso (o vazio preto em
 * volta da masmorra). Em vez de procurar linhas, separa o que é mapa do que é fundo e contorna:
 * a borda de cada cômodo e corredor vira parede, e cada saída estreita entre um cômodo e um
 * corredor vira porta. É o método do script `scripts/mapas/detectar_topologia.py`, reescrito
 * pra rodar no aparelho.
 *
 * Passos: (1) máscara do mapa = pixels com cor longe da do fundo; (2) contorno de cada mancha,
 * simplificado em trechos retos; (3) "miolo" dos cômodos = pontos longe de qualquer parede; o
 * que sobra do mapa entre os miolos é corredor, e onde um corredor encosta num cômodo procura-se
 * a seção mais estreita ali perto: é a porta, de parede a parede.
 */
import { simplificar } from "./detectarCurvas";
import { morfologia, otsu, type ResultadoDaDeteccao, type Segmento } from "./detectarParedes";

/** Distância (0–255) da cor de cada pixel até a cor do fundo, e se o fundo é mesmo liso. */
export function distanciaDoFundo(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): { distancia: Uint8Array; fundoLiso: boolean } {
  // O fundo é a cor dos quatro cantos (mediana por canal).
  const lado = Math.max(8, Math.floor(Math.min(w, h) / 60));
  const canais: number[][] = [[], [], []];
  for (const [cx, cy] of [[0, 0], [w - lado, 0], [0, h - lado], [w - lado, h - lado]])
    for (let y = cy; y < cy + lado; y++)
      for (let x = cx; x < cx + lado; x++) {
        const j = (y * w + x) * 4;
        canais[0].push(rgba[j]);
        canais[1].push(rgba[j + 1]);
        canais[2].push(rgba[j + 2]);
      }
  const fundo = canais.map((c) => c.sort((a, b) => a - b)[c.length >> 1]);
  const distancia = new Uint8Array(w * h);
  let longe = 0;
  for (let i = 0, j = 0; i < distancia.length; i++, j += 4) {
    const d = Math.hypot(rgba[j] - fundo[0], rgba[j + 1] - fundo[1], rgba[j + 2] - fundo[2]);
    distancia[i] = Math.min(255, Math.round(d));
  }
  // Liso = quase todos os pixels dos cantos têm a cor do fundo, e o fundo ocupa um bom pedaço da imagem.
  let cantosIguais = 0;
  let cantos = 0;
  for (const [cx, cy] of [[0, 0], [w - lado, 0], [0, h - lado], [w - lado, h - lado]])
    for (let y = cy; y < cy + lado; y++)
      for (let x = cx; x < cx + lado; x++) {
        cantos++;
        if (distancia[y * w + x] <= 16) cantosIguais++;
      }
  for (let i = 0; i < distancia.length; i += 3) if (distancia[i] <= 16) longe++;
  const fracaoDeFundo = longe / Math.ceil(distancia.length / 3);
  return { distancia, fundoLiso: cantosIguais / cantos > 0.9 && fracaoDeFundo > 0.15 && fracaoDeFundo < 0.85 };
}

/** Rotula as manchas (vizinhança de 4) de uma máscara 0/1. Devolve o rótulo de cada pixel (0 = fora) e a área de cada rótulo. */
function rotular(m: Uint8Array, w: number, h: number): { rotulo: Int32Array; areas: number[] } {
  const rotulo = new Int32Array(w * h);
  const areas = [0];
  const pilha: number[] = [];
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || rotulo[i]) continue;
    const r = areas.length;
    let area = 0;
    rotulo[i] = r;
    pilha.push(i);
    while (pilha.length) {
      const p = pilha.pop()!;
      area++;
      const x = p % w;
      if (x > 0 && m[p - 1] && !rotulo[p - 1]) { rotulo[p - 1] = r; pilha.push(p - 1); }
      if (x < w - 1 && m[p + 1] && !rotulo[p + 1]) { rotulo[p + 1] = r; pilha.push(p + 1); }
      if (p >= w && m[p - w] && !rotulo[p - w]) { rotulo[p - w] = r; pilha.push(p - w); }
      if (p < m.length - w && m[p + w] && !rotulo[p + w]) { rotulo[p + w] = r; pilha.push(p + w); }
    }
    areas.push(area);
  }
  return { rotulo, areas };
}

/** A máscara do mapa (1 = chão/desenho, 0 = fundo), sem poeira e sem buraquinhos de textura. */
export function mascaraDoMapa(distancia: Uint8Array, w: number, h: number, limiar: number): Uint8Array {
  let m: Uint8Array = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) m[i] = distancia[i] > limiar ? 255 : 0;
  // Fecha (5×5, duas vezes) e abre (3×3): junta falhas de sombra, tira pontinhos.
  for (let k = 0; k < 2; k++) m = morfologia(morfologia(m, w, h, 5, 5, true), w, h, 5, 5, false);
  m = morfologia(morfologia(m, w, h, 3, 3, false), w, h, 3, 3, true);
  const total = w * h;
  // Mancha pequena demais (menos de 0,15% da imagem) é sujeira, não cômodo.
  const frente = rotular(m, w, h);
  for (let i = 0; i < m.length; i++) m[i] = m[i] && frente.areas[frente.rotulo[i]] >= total * 0.0015 ? 1 : 0;
  // Buraco pequeno e fechado dentro do mapa é sombra/textura: tapa.
  const inverso = new Uint8Array(total);
  for (let i = 0; i < total; i++) inverso[i] = m[i] ? 0 : 1;
  const fundo = rotular(inverso, w, h);
  const tocaBorda = new Uint8Array(fundo.areas.length);
  for (let x = 0; x < w; x++) { tocaBorda[fundo.rotulo[x]] = 1; tocaBorda[fundo.rotulo[(h - 1) * w + x]] = 1; }
  for (let y = 0; y < h; y++) { tocaBorda[fundo.rotulo[y * w]] = 1; tocaBorda[fundo.rotulo[y * w + w - 1]] = 1; }
  const buraco = total * 0.0004;
  for (let i = 0; i < total; i++) if (!m[i] && !tocaBorda[fundo.rotulo[i]] && fundo.areas[fundo.rotulo[i]] <= buraco) m[i] = 1;
  return m;
}

/**
 * Os contornos (fechados) da máscara, andando pelas arestas entre pixel de mapa e pixel de fundo.
 * Cada ponto é um canto de pixel. Sai o contorno de fora de cada mancha e o de cada buraco.
 */
export function contornos(m: Uint8Array, w: number, h: number): [number, number][][] {
  const dentro = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1;
  const W = w + 1;
  // Aresta que SAI de cada canto, por direção (0 = direita, 1 = baixo, 2 = esquerda, 3 = cima), com o mapa à direita de quem anda.
  const sai = new Uint8Array(W * (h + 1)); // bits das direções
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (m[y * w + x] !== 1) continue;
      if (!dentro(x, y - 1)) sai[y * W + x] |= 1; // topo: → 
      if (!dentro(x + 1, y)) sai[y * W + x + 1] |= 2; // direita: ↓
      if (!dentro(x, y + 1)) sai[(y + 1) * W + x + 1] |= 4; // base: ←
      if (!dentro(x - 1, y)) sai[(y + 1) * W + x] |= 8; // esquerda: ↑
    }
  const passo = [1, W, -1, -W];
  const voltas: [number, number][][] = [];
  for (let inicio = 0; inicio < sai.length; inicio++) {
    while (sai[inicio]) {
      let dir = sai[inicio] & 1 ? 0 : sai[inicio] & 2 ? 1 : sai[inicio] & 4 ? 2 : 3;
      let c = inicio;
      const pts: [number, number][] = [];
      for (;;) {
        sai[c] &= ~(1 << dir);
        pts.push([c % W, Math.floor(c / W)]);
        c += passo[dir];
        if (c === inicio) break;
        // No canto novo: prefere virar à direita, depois seguir reto, depois à esquerda (não cruza diagonal).
        const proxima = [(dir + 1) % 4, dir, (dir + 3) % 4].find((d) => sai[c] & (1 << d));
        if (proxima === undefined) break;
        dir = proxima;
      }
      if (pts.length >= 8) voltas.push(pts);
    }
  }
  return voltas;
}

/** Distância (px, aproximada por chanfro 3-4) de cada pixel ligado até o pixel desligado mais perto. */
function distanciaAteZero(m: Uint8Array, w: number, h: number): Float32Array {
  const G = 1e6;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = m[i] ? G : 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      // Fora da imagem conta como fundo: a parede da beirada também é parede.
      v = Math.min(v, (x > 0 ? d[i - 1] : 0) + 3, (y > 0 ? d[i - w] : 0) + 3, (x > 0 && y > 0 ? d[i - w - 1] : 0) + 4, (x < w - 1 && y > 0 ? d[i - w + 1] : 0) + 4);
      d[i] = v;
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      v = Math.min(v, (x < w - 1 ? d[i + 1] : 0) + 3, (y < h - 1 ? d[i + w] : 0) + 3, (x < w - 1 && y < h - 1 ? d[i + w + 1] : 0) + 4, (x > 0 && y < h - 1 ? d[i + w - 1] : 0) + 4);
      d[i] = v;
    }
  for (let i = 0; i < d.length; i++) d[i] /= 3;
  return d;
}

/** O controle "menos linhas ↔ mais linhas" neste modo: quão diferente do fundo a cor precisa ser (menor = pega área mais escura). */
export const LIMIAR_DO_FUNDO_POR_NIVEL: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 28, 2: 22, 3: 16, 4: 12, 5: 8 };

export type OpcoesDoContorno = {
  /** Quão diferente do fundo a cor precisa ser pra contar como mapa (padrão 16). */
  limiarDoFundo?: number;
  /** Teto de trechos (paredes + portas); a simplificação afrouxa até caber. */
  maximo?: number;
  /** Largura máxima de uma porta, em fração do lado maior (padrão 0,06). */
  portaMaxima?: number;
};

export function detectarContorno(distancia: Uint8Array, w: number, h: number, opcoes: OpcoesDoContorno = {}): ResultadoDaDeteccao {
  const lado = Math.max(w, h);
  const m = mascaraDoMapa(distancia, w, h, opcoes.limiarDoFundo ?? 16);
  const voltas = contornos(m, w, h);
  if (voltas.length === 0) return { largura: w, altura: h, paredes: [], portas: [] };

  // ── Portas ───────────────────────────────────────────────────────────────
  const dist = distanciaAteZero(m, w, h);
  // Limiar cômodo × corredor: Otsu sobre a "largura" medida nas cristas (pontos mais longe das paredes que os vizinhos).
  const cristas: number[] = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = dist[i];
      if (v < 2) continue;
      if (v >= dist[i - 1] && v >= dist[i + 1] && v >= dist[i - w] && v >= dist[i + w] && v >= dist[i - w - 1] && v >= dist[i - w + 1] && v >= dist[i + w - 1] && v >= dist[i + w + 1]) cristas.push(v);
    }
  const amostra = new Uint8Array(cristas.length);
  for (let i = 0; i < cristas.length; i++) amostra[i] = Math.min(255, Math.round(cristas[i]));
  // O corte fica no meio do caminho entre a largura típica de corredor e a de cômodo (as médias das duas
  // classes que o Otsu separa) — o valor do Otsu sozinho cola na classe de baixo quando as larguras são bem certinhas.
  let corte = lado * 0.025;
  if (cristas.length >= 32) {
    const t = otsu(amostra);
    let somaBaixo = 0, nBaixo = 0, somaCima = 0, nCima = 0;
    for (const v of cristas) {
      if (v <= t) { somaBaixo += v; nBaixo++; } else { somaCima += v; nCima++; }
    }
    corte = nBaixo && nCima ? (somaBaixo / nBaixo + somaCima / nCima) / 2 : t;
  }
  const limiarComodo = Math.max(lado * 0.01, corte * 0.8);

  const miolo = new Uint8Array(w * h);
  for (let i = 0; i < miolo.length; i++) miolo[i] = dist[i] >= limiarComodo ? 1 : 0;
  const miolos = rotular(miolo, w, h);
  const mioloMinimo = Math.max(40, (lado / 1400) ** 2 * 120);
  // Cômodo = o miolo engordado de volta até as paredes (tudo do mapa a até `limiarComodo` de um miolo válido).
  const foraDoMiolo = new Uint8Array(w * h);
  for (let i = 0; i < foraDoMiolo.length; i++) foraDoMiolo[i] = miolo[i] && miolos.areas[miolos.rotulo[i]] >= mioloMinimo ? 0 : 1;
  const ateMiolo = distanciaAteZero(foraDoMiolo, w, h);
  const corredor = new Uint8Array(w * h);
  for (let i = 0; i < corredor.length; i++) corredor[i] = m[i] && ateMiolo[i] > limiarComodo + 1 ? 1 : 0;
  const corredores = rotular(corredor, w, h);

  // Pontos de encontro: pixel de corredor encostado em cômodo. Agrupados por corredor e por vizinhança.
  const noMapa = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && m[Math.round(y) * w + Math.round(x)] === 1;
  const encontro = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!corredor[i]) continue;
      for (const v of [i - 1, i + 1, i - w, i + w]) if (m[v] && !corredor[v]) { encontro[i] = 1; break; }
    }
  // Vizinhança de 8 pros pontos de encontro (a fronteira é uma linha fina, anda em diagonal).
  const grupos: number[][] = [];
  const visto = new Uint8Array(w * h);
  for (let i = 0; i < encontro.length; i++) {
    if (!encontro[i] || visto[i]) continue;
    const g = [i];
    visto[i] = 1;
    for (let k = 0; k < g.length; k++) {
      const p = g[k];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const q = p + dy * w + dx;
          if (q >= 0 && q < encontro.length && encontro[q] && !visto[q]) { visto[q] = 1; g.push(q); }
        }
    }
    grupos.push(g);
  }
  // Lasca de poucos pixels não é passagem. (As sobras nos cantos dos cômodos caem no teste do "atravessa", abaixo.)
  const areaMinimaDeCorredor = 30;
  const raio = (ox: number, oy: number, dx: number, dy: number, alcance: number): [number, number] | null => {
    if (!noMapa(ox, oy)) return null;
    for (let s = 0.5; s <= alcance; s += 0.5) if (!noMapa(ox + dx * s, oy + dy * s)) return [ox + dx * (s - 0.25), oy + dy * (s - 0.25)];
    return null;
  };
  const portaMaxima = lado * (opcoes.portaMaxima ?? 0.06);
  const portaMinima = Math.max(6, lado * 0.007);
  type Porta = { seg: Segmento; largura: number; cx: number; cy: number };
  // Porta liga dois ESPAÇOS: com ela fechada, cada lado tem de ter área de cômodo ou de corredor. Um nicho
  // (a torrinha no canto de uma sala) tem só uns poucos quadradinhos — fechar ali não é porta.
  const areaDeEspaco = Math.round(limiarComodo * limiarComodo * 1.2);
  const barreira = new Uint8Array(w * h);
  const marca = new Int32Array(w * h);
  let rodada = 0;
  const separaDoisEspacos = (p: Porta): boolean => {
    const [x1, y1, x2, y2] = p.seg;
    const n = Math.ceil(p.largura * 2) + 8;
    const ux = (x2 - x1) / p.largura;
    const uy = (y2 - y1) / p.largura;
    const pintados: number[] = [];
    // A porta como barreira (2 px de espessura, esticada 3 px pra dentro de cada parede).
    for (let i = 0; i <= n; i++) {
      const t = -3 + ((p.largura + 6) * i) / n;
      for (const o of [-0.5, 0.5]) {
        const x = Math.round(x1 + ux * t - uy * o);
        const y = Math.round(y1 + uy * t + ux * o);
        if (x >= 0 && y >= 0 && x < w && y < h && !barreira[y * w + x]) {
          barreira[y * w + x] = 1;
          pintados.push(y * w + x);
        }
      }
    }
    const lado = (sinal: number): boolean => {
      const sx = Math.round(p.cx - uy * 3 * sinal);
      const sy = Math.round(p.cy + ux * 3 * sinal);
      if (!noMapa(sx, sy) || barreira[sy * w + sx]) return false;
      rodada++;
      const fila = [sy * w + sx];
      marca[fila[0]] = rodada;
      for (let k = 0; k < fila.length; k++) {
        if (fila.length >= areaDeEspaco) return true;
        const q = fila[k];
        const x = q % w;
        for (const v of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w])
          if (v >= 0 && v < m.length && m[v] && !barreira[v] && marca[v] !== rodada) {
            marca[v] = rodada;
            fila.push(v);
          }
      }
      return fila.length >= areaDeEspaco;
    };
    const ok = lado(1) && lado(-1);
    for (const i of pintados) barreira[i] = 0;
    return ok;
  };
  const candidatas: Porta[] = [];
  for (const g of grupos) {
    if (g.length < 3) continue;
    // O grupo pode encostar em mais de uma mancha de corredor (uma lasca de canto e o corredor de verdade): vale a maior.
    let maiorArea = 0;
    for (const p of g) maiorArea = Math.max(maiorArea, corredores.areas[corredores.rotulo[p]]);
    if (maiorArea < areaMinimaDeCorredor) continue;
    let sx = 0;
    let sy = 0;
    for (const p of g) { sx += p % w; sy += Math.floor(p / w); }
    const mx = sx / g.length;
    const my = sy / g.length;
    // O ponto do grupo mais perto do meio dele (o meio de um arco pode cair fora do mapa).
    let base = g[0];
    let melhorD = Infinity;
    for (const p of g) {
      const d = (p % w - mx) ** 2 + (Math.floor(p / w) - my) ** 2;
      if (d < melhorD) { melhorD = d; base = p; }
    }
    const bx = base % w;
    const by = Math.floor(base / w);
    // A seção mais estreita que passa por perto: testa direções e pequenos deslocamentos.
    let melhor: Porta | null = null;
    let nota = Infinity;
    const busca = Math.max(6, Math.round(limiarComodo * 0.6));
    const folgaDosLados = limiarComodo * 0.7;
    for (let a = 0; a < 180; a += 7.5) {
      const dx = Math.cos((a * Math.PI) / 180);
      const dy = Math.sin((a * Math.PI) / 180);
      for (let desl = -busca; desl <= busca; desl += 2) {
        // Desloca na perpendicular da seção (ao longo do corredor).
        const ox = bx - dy * desl;
        const oy = by + dx * desl;
        const p1 = raio(ox, oy, -dx, -dy, portaMaxima);
        const p2 = raio(ox, oy, dx, dy, portaMaxima);
        if (!p1 || !p2) continue;
        const largura = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        if (largura < portaMinima || largura > portaMaxima || largura < g.length * 0.6) continue;
        // Porta de verdade ATRAVESSA: dá pra andar do meio dela pros dois lados (cômodo de um, corredor do
        // outro). Num canto de sala um dos lados bate logo na parede.
        const cx = (p1[0] + p2[0]) / 2;
        const cy = (p1[1] + p2[1]) / 2;
        let atravessa = true;
        // (Uma corda que corta um canto reto fica a metade do próprio comprimento do canto: tem de ir além disso.)
        const alcance = Math.max(folgaDosLados, largura * 0.6 + 3);
        for (let s = 3; s <= alcance && atravessa; s += 3) atravessa = noMapa(cx - dy * s, cy + dx * s) && noMapa(cx + dy * s, cy - dx * s);
        if (!atravessa) continue;
        const n = largura + 0.12 * Math.abs(desl);
        if (n < nota) {
          nota = n;
          melhor = { seg: [p1[0], p1[1], p2[0], p2[1]], largura, cx: (p1[0] + p2[0]) / 2, cy: (p1[1] + p2[1]) / 2 };
        }
      }
    }
    if (melhor && separaDoisEspacos(melhor)) candidatas.push(melhor);
  }
  // Duas candidatas no mesmo lugar: fica a mais estreita.
  candidatas.sort((a, b) => a.largura - b.largura);
  const portasAchadas: Porta[] = [];
  const perto = Math.max(12, lado * 0.013);
  for (const c of candidatas) if (portasAchadas.every((k) => Math.hypot(k.cx - c.cx, k.cy - c.cy) > perto)) portasAchadas.push(c);

  // ── Paredes: o contorno simplificado, sem perder os pontos onde as portas encostam ──
  const ancorasDe = (volta: [number, number][]) => {
    const fixos = new Set<number>();
    for (const p of portasAchadas)
      for (const [x, y] of [[p.seg[0], p.seg[1]], [p.seg[2], p.seg[3]]]) {
        let idx = -1;
        let d2 = 5 * 5;
        for (let k = 0; k < volta.length; k++) {
          const d = (volta[k][0] - x) ** 2 + (volta[k][1] - y) ** 2;
          if (d < d2) { d2 = d; idx = k; }
        }
        if (idx >= 0) fixos.add(idx);
      }
    return fixos;
  };
  const voltasComAncoras = voltas.map((v) => ({ v, fixos: [...ancorasDe(v)].sort((a, b) => a - b) }));
  const montar = (tolerancia: number): Segmento[] => {
    const paredes: Segmento[] = [];
    for (const { v, fixos } of voltasComAncoras) {
      const n = v.length;
      const marcas = [...new Set([0, Math.floor(n / 2), ...fixos])].sort((a, b) => a - b);
      const pts: [number, number][] = [];
      for (let k = 0; k < marcas.length; k++) {
        const ini = marcas[k];
        const fim = k + 1 < marcas.length ? marcas[k + 1] : n;
        const trecho = v.slice(ini, fim);
        trecho.push(v[fim % n]);
        const s = simplificar(trecho, tolerancia);
        for (let t = 0; t < s.length - 1; t++) pts.push(s[t]);
      }
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k];
        const b = pts[(k + 1) % pts.length];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) >= 2) paredes.push([a[0], a[1], b[0], b[1]]);
      }
    }
    return paredes;
  };
  const maximo = opcoes.maximo ?? 385;
  // A menor folga de simplificação que ainda cabe no teto: sobe até caber, depois afina entre a última que não coube e a que coube.
  const cabe = (p: Segmento[]) => p.length + portasAchadas.length <= maximo;
  let tolerancia = Math.max(1.5, lado * 0.0012);
  let paredes = montar(tolerancia);
  if (!cabe(paredes)) {
    let baixo = tolerancia;
    while (!cabe(paredes) && tolerancia < lado * 0.04) {
      baixo = tolerancia;
      tolerancia *= 1.3;
      paredes = montar(tolerancia);
    }
    for (let k = 0; k < 6; k++) {
      const meio = (baixo + tolerancia) / 2;
      const tentativa = montar(meio);
      if (cabe(tentativa)) {
        tolerancia = meio;
        paredes = tentativa;
      } else baixo = meio;
    }
  }
  // A porta termina exatamente no ponto do contorno que ficou (sem fresta entre porta e parede).
  const portas = portasAchadas.map((p): Segmento => {
    const colar = (x: number, y: number): [number, number] => {
      let melhor: [number, number] = [x, y];
      let d2 = 6 * 6;
      for (const s of paredes)
        for (const [px, py] of [[s[0], s[1]], [s[2], s[3]]]) {
          const d = (px - x) ** 2 + (py - y) ** 2;
          if (d < d2) { d2 = d; melhor = [px, py]; }
        }
      return melhor;
    };
    const a = colar(p.seg[0], p.seg[1]);
    const b = colar(p.seg[2], p.seg[3]);
    return [a[0], a[1], b[0], b[1]];
  });
  const r = (v: number) => Math.round(v * 10) / 10;
  return { largura: w, altura: h, paredes: paredes.map((s) => s.map(r) as Segmento), portas: portas.map((s) => s.map(r) as Segmento) };
}
