/**
 * Mapa de ligações: onde cada cartão fica e como as linhas entre eles são
 * desenhadas. Tudo puro (sem tela): o posicionamento é uma simulação de forças
 * (Fruchterman–Reingold) que roda sempre igual pros mesmos cartões e ligações,
 * então todo aparelho desenha o mesmo mapa.
 */

export type NoDoGrafo = { id: string };
export type ArestaDoGrafo = { id: string; de: string; para: string };
export type PosicaoDoNo = { x: number; y: number };

/** Raio do círculo de cada cartão no mapa (unidades do desenho). */
export const RAIO_DO_NO = 34;

/** Tamanho do desenho: cresce com a quantidade de cartões pra não amontoar. */
export function tamanhoDoMapa(qtd: number): { largura: number; altura: number } {
  const lado = Math.max(360, Math.ceil(Math.sqrt(Math.max(qtd, 1)) * 170));
  return { largura: lado, altura: Math.round(lado * 0.9) };
}

/** Posição de cada cartão, dentro do desenho e com margem pra borda. Mesmo
 *  resultado pra mesma entrada (a ordem dos ids não importa: são ordenados). */
export function posicionarNos(nos: NoDoGrafo[], arestas: ArestaDoGrafo[]): Map<string, PosicaoDoNo> {
  const ids = [...new Set(nos.map((n) => n.id))].sort();
  const n = ids.length;
  const resultado = new Map<string, PosicaoDoNo>();
  if (n === 0) return resultado;
  const { largura, altura } = tamanhoDoMapa(n);
  const margem = RAIO_DO_NO + 14;
  const cx = largura / 2;
  const cy = altura / 2;
  if (n === 1) {
    resultado.set(ids[0], { x: cx, y: cy });
    return resultado;
  }

  const indice = new Map(ids.map((id, i) => [id, i]));
  const liga: [number, number][] = [];
  const vistas = new Set<string>();
  for (const a of arestas) {
    const i = indice.get(a.de);
    const j = indice.get(a.para);
    if (i === undefined || j === undefined || i === j) continue;
    const chave = i < j ? `${i}-${j}` : `${j}-${i}`;
    if (vistas.has(chave)) continue; // várias ligações entre o mesmo par puxam como uma só
    vistas.add(chave);
    liga.push([i, j]);
  }

  // Ponto de partida: círculo, na ordem dos ids (determinístico).
  const raioInicial = Math.min(largura, altura) / 3;
  const x = ids.map((_, i) => cx + raioInicial * Math.cos((2 * Math.PI * i) / n));
  const y = ids.map((_, i) => cy + raioInicial * Math.sin((2 * Math.PI * i) / n));
  const k = Math.sqrt((largura * altura) / n) * 0.8; // distância ideal entre vizinhos
  const iteracoes = 300;
  let temperatura = Math.min(largura, altura) / 6;

  for (let it = 0; it < iteracoes; it++) {
    const dx = new Array<number>(n).fill(0);
    const dy = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let ex = x[i] - x[j];
        let ey = y[i] - y[j];
        let d = Math.hypot(ex, ey);
        if (d < 0.01) {
          // Dois no mesmo ponto: separa por um empurrão fixo (nunca aleatório).
          ex = ((i + j) % 2 === 0 ? 1 : -1) * 0.5;
          ey = 0.5;
          d = Math.hypot(ex, ey);
        }
        const f = (k * k) / d;
        dx[i] += (ex / d) * f;
        dy[i] += (ey / d) * f;
        dx[j] -= (ex / d) * f;
        dy[j] -= (ey / d) * f;
      }
    }
    for (const [i, j] of liga) {
      const ex = x[i] - x[j];
      const ey = y[i] - y[j];
      const d = Math.max(Math.hypot(ex, ey), 0.01);
      const f = (d * d) / k;
      dx[i] -= (ex / d) * f;
      dy[i] -= (ey / d) * f;
      dx[j] += (ex / d) * f;
      dy[j] += (ey / d) * f;
    }
    for (let i = 0; i < n; i++) {
      // Um empurrãozinho pro centro mantém os grupos soltos dentro da tela.
      dx[i] += (cx - x[i]) * 0.02;
      dy[i] += (cy - y[i]) * 0.02;
      const d = Math.max(Math.hypot(dx[i], dy[i]), 0.01);
      const passo = Math.min(d, temperatura);
      x[i] += (dx[i] / d) * passo;
      y[i] += (dy[i] / d) * passo;
      x[i] = Math.min(largura - margem, Math.max(margem, x[i]));
      y[i] = Math.min(altura - margem, Math.max(margem, y[i]));
    }
    temperatura *= 0.97;
  }

  // Última passada: afasta o que ainda ficou colado (círculos não podem se cobrir).
  for (let rodada = 0; rodada < 40; rodada++) {
    let mexeu = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ex = x[i] - x[j];
        const ey = y[i] - y[j];
        const d = Math.hypot(ex, ey);
        const minimo = 2 * RAIO_DO_NO + 10;
        if (d >= minimo) continue;
        const ux = d < 0.01 ? 1 : ex / d;
        const uy = d < 0.01 ? 0 : ey / d;
        const empurra = (minimo - d) / 2 + 0.5;
        x[i] += ux * empurra;
        y[i] += uy * empurra;
        x[j] -= ux * empurra;
        y[j] -= uy * empurra;
        mexeu = true;
      }
      x[i] = Math.min(largura - margem, Math.max(margem, x[i]));
      y[i] = Math.min(altura - margem, Math.max(margem, y[i]));
    }
    if (!mexeu) break;
  }

  ids.forEach((id, i) => resultado.set(id, { x: Math.round(x[i] * 10) / 10, y: Math.round(y[i] * 10) / 10 }));
  return resultado;
}

export type LinhaDesenhada = {
  id: string;
  /** Pontos da linha: começa na borda do círculo de origem e termina na do destino (onde fica a seta). */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Ponto de controle da curva (linhas do mesmo par se abrem em leque). */
  cx: number;
  cy: number;
  /** Onde fica o rótulo (meio da curva). */
  rx: number;
  ry: number;
};

/** Linhas entre os círculos. Várias ligações entre o mesmo par (inclusive em
 *  sentidos opostos) viram curvas separadas, em leque, pra não se cobrirem. */
export function desenharLinhas(arestas: ArestaDoGrafo[], pos: Map<string, PosicaoDoNo>): LinhaDesenhada[] {
  const porPar = new Map<string, ArestaDoGrafo[]>();
  for (const a of arestas) {
    if (!pos.has(a.de) || !pos.has(a.para) || a.de === a.para) continue;
    const chave = a.de < a.para ? `${a.de}|${a.para}` : `${a.para}|${a.de}`;
    porPar.set(chave, [...(porPar.get(chave) ?? []), a]);
  }
  const linhas: LinhaDesenhada[] = [];
  for (const grupo of porPar.values()) {
    grupo.sort((a, b) => a.id.localeCompare(b.id));
    grupo.forEach((a, i) => {
      const p = pos.get(a.de)!;
      const q = pos.get(a.para)!;
      const ex = q.x - p.x;
      const ey = q.y - p.y;
      const d = Math.max(Math.hypot(ex, ey), 0.01);
      const ux = ex / d;
      const uy = ey / d;
      // Sempre o mesmo lado em relação à linha entre o menor e o maior id, senão
      // duas ligações opostas cairiam uma em cima da outra.
      const sentido = a.de < a.para ? 1 : -1;
      const desvio = (i - (grupo.length - 1) / 2) * 34 * sentido;
      const mx = (p.x + q.x) / 2 + -uy * desvio;
      const my = (p.y + q.y) / 2 + ux * desvio;
      // Ponto de controle de uma curva quadrática que passa por (mx, my) no meio.
      const cx = 2 * mx - (p.x + q.x) / 2;
      const cy = 2 * my - (p.y + q.y) / 2;
      const fim = (de: PosicaoDoNo, para: PosicaoDoNo) => {
        const vx = cx - de.x;
        const vy = cy - de.y;
        const dv = Math.max(Math.hypot(vx, vy), 0.01);
        return { x: de.x + (vx / dv) * (RAIO_DO_NO + 2), y: de.y + (vy / dv) * (RAIO_DO_NO + 2), para };
      };
      const ini = fim(p, q);
      const fm = fim(q, p);
      linhas.push({ id: a.id, x1: ini.x, y1: ini.y, x2: fm.x, y2: fm.y, cx, cy, rx: mx, ry: my });
    });
  }
  return linhas;
}

/** Só entra no mapa o cartão que tem ao menos uma ligação visível; os demais ficam de fora (lista à parte). */
export function separarConectados<T extends { id: string }>(nos: T[], arestas: { de: string; para: string }[]): { conectados: T[]; soltos: T[] } {
  const comLigacao = new Set<string>();
  for (const a of arestas) {
    comLigacao.add(a.de);
    comLigacao.add(a.para);
  }
  return { conectados: nos.filter((n) => comLigacao.has(n.id)), soltos: nos.filter((n) => !comLigacao.has(n.id)) };
}

/** Um aviso de que o desenho mudou: junta ids e ligações, pra o mapa saber quando refazer a posição. */
export function chaveDoMapa(nos: NoDoGrafo[], arestas: ArestaDoGrafo[]): string {
  return [
    [...new Set(nos.map((n) => n.id))].sort().join(","),
    [...arestas].map((a) => `${a.de}>${a.para}`).sort().join(","),
  ].join("#");
}

/** Dá pra tocar no cartão sem ter arrastado: o dedo andou pouco desde que desceu. */
export const TOQUE_MAXIMO_PX = 6;
export function foiToque(inicio: { x: number; y: number }, fim: { x: number; y: number }): boolean {
  return Math.hypot(fim.x - inicio.x, fim.y - inicio.y) <= TOQUE_MAXIMO_PX;
}
