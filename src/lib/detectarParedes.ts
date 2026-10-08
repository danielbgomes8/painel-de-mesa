import { detectarCurvas } from "./detectarCurvas";

/**
 * Detectar paredes e portas numa imagem de mapa, no próprio aparelho.
 *
 * Parede de mapa é uma linha escura e fina em cima de um chão mais claro. O
 * "black-hat" (fechamento menos a imagem) realça justamente isso: escuro e mais
 * fino que o núcleo. Funciona com fundo de papel, madeira ou textura — não
 * depende de o fundo ser preto. Depois só ficam as linhas retas (horizontais e
 * verticais) e compridas, e cada VAO de largura de porta no meio de uma parede
 * vira uma porta.
 *
 * Parede curva ou diagonal sai de `detectarCurvas` (o que sobra das linhas escuras
 * depois de tirar as retas, afinado e simplificado em trechos retos).
 *
 * É um RASCUNHO: móvel, tapete e quadriculado ainda enganam, e as curvas trazem mais
 * linhas falsas que as retas (contorno de mesa redonda, por exemplo). O Mestre
 * confere no mapa e corrige. Regras puras, sem DOM:
 * recebem os níveis de cinza e devolvem segmentos em px da imagem analisada.
 */

export type Segmento = [number, number, number, number];

export type ResultadoDaDeteccao = {
  largura: number;
  altura: number;
  paredes: Segmento[];
  portas: Segmento[];
};

export type OpcoesDaDeteccao = {
  /**
   * Como a parede foi desenhada: "escuras" (padrão) = linha escura sobre chão mais claro;
   * "claras" = contorno claro (branco) entre o chão e um fundo escuro, como nos mapas de
   * ficção científica ou de caverna escura. No segundo caso a imagem é invertida e a linha
   * só precisa se destacar de UM dos lados (o do vazio), não dos dois.
   */
  linhas?: "escuras" | "claras";
  /** Procurar também paredes curvas e diagonais (padrão: sim). */
  curvas?: boolean;
  /** Comprimento mínimo de uma parede, em fração do lado maior. */
  minimo?: number;
  /** Largura do núcleo do black-hat (px); padrão: lado / 28. */
  espessura?: number;
};

/** Lado maior em que a imagem é analisada: acima disso só custa tempo. */
export const LADO_DA_ANALISE = 1400;

const PAREDE_MINIMA = 0.12;

/** Janela deslizante em uma linha (máximo ou mínimo): O(n·k), simples e sem alocação por pixel. */
function janela(origem: Uint8Array, destino: Uint8Array, n: number, passo: number, fora: number, k: number, maximo: boolean) {
  const r = k >> 1;
  for (let i = 0; i < n; i++) {
    let v = maximo ? 0 : 255;
    const ini = Math.max(0, i - r);
    const fim = Math.min(n - 1, i + r);
    for (let j = ini; j <= fim; j++) {
      const p = origem[fora + j * passo];
      if (maximo ? p > v : p < v) v = p;
    }
    destino[fora + i * passo] = v;
  }
}

/** Dilata (máximo) ou erode (mínimo) com janela retangular `kx × ky`, em duas passadas. */
function morfologia(g: Uint8Array, w: number, h: number, kx: number, ky: number, maximo: boolean): Uint8Array {
  const meio = new Uint8Array(w * h);
  const saida = new Uint8Array(w * h);
  if (kx > 1) for (let y = 0; y < h; y++) janela(g, meio, w, 1, y * w, kx, maximo);
  else meio.set(g);
  if (ky > 1) for (let x = 0; x < w; x++) janela(meio, saida, h, w, x, ky, maximo);
  else saida.set(meio);
  return saida;
}

function borrar(g: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let soma = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          soma += g[yy * w + xx];
          n++;
        }
      }
      out[y * w + x] = Math.round(soma / n);
    }
  }
  return out;
}

function otsu(g: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of g) hist[v]++;
  const total = g.length;
  let somaTotal = 0;
  for (let i = 0; i < 256; i++) somaTotal += i * hist[i];
  let somaFundo = 0;
  let pesoFundo = 0;
  let melhor = 0;
  let melhorVar = -1;
  for (let t = 0; t < 256; t++) {
    pesoFundo += hist[t];
    if (pesoFundo === 0) continue;
    const pesoFrente = total - pesoFundo;
    if (pesoFrente === 0) break;
    somaFundo += t * hist[t];
    const mFundo = somaFundo / pesoFundo;
    const mFrente = (somaTotal - somaFundo) / pesoFrente;
    const v = pesoFundo * pesoFrente * (mFundo - mFrente) ** 2;
    if (v > melhorVar) {
      melhorVar = v;
      melhor = t;
    }
  }
  return melhor;
}

/**
 * Limiar por região. Num mapa com luz e sombra (o clarão no meio de um salão), a parede da
 * parte clara tem um décimo do contraste da parede contra o vazio, e um limiar só pra imagem
 * inteira a perde. Aqui cada bloco (`bloco` px) guarda a resposta mais forte que tem; o limiar
 * do ponto é uma `fracao` dessa resposta (interpolada entre os blocos vizinhos), nunca abaixo
 * de `piso` — senão região lisa viraria ruído.
 */
function limiarPorRegiao(resp: Uint8Array, w: number, h: number, bloco: number, fracao: number, piso: number): Float32Array {
  const bw = Math.max(1, Math.ceil(w / bloco));
  const bh = Math.max(1, Math.ceil(h / bloco));
  // Percentil alto (98%) do bloco, e não o máximo: um pixel estourado não manda no bloco.
  const forte = new Float32Array(bw * bh);
  const hist = new Uint32Array(256);
  for (let by = 0; by < bh; by++)
    for (let bx = 0; bx < bw; bx++) {
      hist.fill(0);
      let n = 0;
      for (let y = by * bloco; y < Math.min(h, (by + 1) * bloco); y++)
        for (let x = bx * bloco; x < Math.min(w, (bx + 1) * bloco); x++) {
          hist[resp[y * w + x]]++;
          n++;
        }
      let resto = Math.floor(n * 0.02);
      let v = 255;
      while (v > 0 && resto >= hist[v]) resto -= hist[v--];
      forte[by * bw + bx] = v;
    }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(bh - 1, Math.max(0, y / bloco - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(bh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(bw - 1, Math.max(0, x / bloco - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(bw - 1, x0 + 1);
      const tx = fx - x0;
      const v = (forte[y0 * bw + x0] * (1 - tx) + forte[y0 * bw + x1] * tx) * (1 - ty) + (forte[y1 * bw + x0] * (1 - tx) + forte[y1 * bw + x1] * tx) * ty;
      out[y * w + x] = Math.max(piso, v * fracao);
    }
  }
  return out;
}

/**
 * Espessura típica (px) das linhas finas da máscara: a mediana dos trechos seguidos de
 * pixels ligados, lendo linha por linha e coluna por coluna, ignorando os que passam de
 * `teto` (mancha, não linha). É o que dá a ESCALA do mapa: num labirinto de corredores
 * estreitos a parede tem 4 px e o corredor 25; num mapa grande, 12 e 80. As folgas do
 * filtro saem daqui, e não do tamanho da imagem.
 */
function espessuraDoTraco(m: Uint8Array, w: number, h: number, teto: number): number {
  const hist = new Uint32Array(teto + 1);
  const contar = (n: number, passo: number, inicio: number) => {
    let seguido = 0;
    for (let i = 0; i <= n; i++) {
      if (i < n && m[inicio + i * passo]) seguido++;
      else {
        if (seguido >= 2 && seguido <= teto) hist[seguido]++;
        seguido = 0;
      }
    }
  };
  for (let y = 0; y < h; y += 2) contar(w, 1, y * w);
  for (let x = 0; x < w; x += 2) contar(h, w, x);
  let total = 0;
  for (let i = 2; i <= teto; i++) total += hist[i];
  if (total === 0) return Math.max(3, teto / 4);
  let acumulado = 0;
  for (let i = 2; i <= teto; i++) {
    acumulado += hist[i];
    if (acumulado * 2 >= total) return i;
  }
  return teto;
}

/** Segmentos (centro da caixa) das componentes ligadas cuja caixa é bem mais comprida que larga. */
function segmentosDaMascara(m: Uint8Array, w: number, h: number, vertical: boolean): Segmento[] {
  const visto = new Uint8Array(w * h);
  const out: Segmento[] = [];
  const pilha: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || visto[i]) continue;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    pilha.length = 0;
    pilha.push(i);
    visto[i] = 1;
    while (pilha.length) {
      const p = pilha.pop()!;
      const x = p % w;
      const y = (p - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const q = yy * w + xx;
          if (m[q] && !visto[q]) {
            visto[q] = 1;
            pilha.push(q);
          }
        }
      }
    }
    const ww = maxX - minX + 1;
    const hh = maxY - minY + 1;
    if (vertical) {
      if (hh < ww * 3) continue;
      const cx = minX + ww / 2;
      out.push([cx, minY, cx, maxY + 1]);
    } else {
      if (ww < hh * 3) continue;
      const cy = minY + hh / 2;
      out.push([minX, cy, maxX + 1, cy]);
    }
  }
  return out;
}

export type Vao = { eixo: "h" | "v"; pos: number; ini: number; fim: number };

/** Junta segmentos na mesma linha; cada vão de largura de porta entre dois pedaços vira candidato a porta. */
function fundir(segs: Segmento[], lado: number): { juntas: Segmento[]; vaos: Vao[] } {
  const folgaOff = 4;
  const folgaVao = lado * 0.09;
  const vaoMinimo = lado * 0.025;
  const hs = segs.filter((s) => s[1] === s[3]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const vs = segs.filter((s) => s[0] === s[2]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const vaos: Vao[] = [];
  const juntar = (lista: Segmento[], eixo: "h" | "v"): Segmento[] => {
    const off = eixo === "h" ? 1 : 0;
    const a = eixo === "h" ? 0 : 1;
    const b = eixo === "h" ? 2 : 3;
    const out: Segmento[] = [];
    for (const s of lista) {
      const o = out.find((o) => Math.abs(o[off] - s[off]) <= folgaOff && s[a] <= o[b] + folgaVao && s[b] >= o[a] - folgaVao);
      if (!o) {
        out.push([...s] as Segmento);
        continue;
      }
      if (s[a] - o[b] >= vaoMinimo) vaos.push({ eixo, pos: (o[off] + s[off]) / 2, ini: o[b], fim: s[a] });
      o[a] = Math.min(o[a], s[a]);
      o[b] = Math.max(o[b], s[b]);
      o[off] = o[off + 2] = (o[off] + s[off]) / 2;
    }
    return out;
  };
  return { juntas: [...juntar(hs, "h"), ...juntar(vs, "v")], vaos };
}

/**
 * Vão que vira porta precisa de três coisas: (1) estar dentro de uma linha comprida; (2) ter
 * parede aceita terminando perto das DUAS pontas — vão no meio de linha falsa (borda de tapete)
 * perde um lado; (3) ter alguma coisa desenhada dentro dele (a folha da porta, o batente, o
 * degrau): vão de chão liso é corredor aberto ou passagem, e passagem aberta fica sem nada.
 */
function portasDosVaos(vaos: Vao[], compridas: Segmento[], paredes: Segmento[], perto: number, resp: Uint8Array, w: number, h: number, marca: number, larguraMaxima: number): Segmento[] {
  const portas: Segmento[] = [];
  const pico = (x: number, y: number, vertical: boolean) => {
    let m = 0;
    for (let o = -2; o <= 2; o++) {
      const xx = Math.min(w - 1, Math.max(0, Math.round(x + (vertical ? o : 0))));
      const yy = Math.min(h - 1, Math.max(0, Math.round(y + (vertical ? 0 : o))));
      m = Math.max(m, resp[yy * w + xx]);
    }
    return m;
  };
  for (const v of vaos) {
    if (v.fim - v.ini > larguraMaxima) continue; // largo demais pra porta: é sala ou corredor
    const naLinha = (lista: Segmento[]) =>
      lista.filter((s) => (v.eixo === "h" ? s[1] === s[3] && Math.abs(s[1] - v.pos) <= 4 : s[0] === s[2] && Math.abs(s[0] - v.pos) <= 4));
    const a = v.eixo === "h" ? 0 : 1;
    const b = v.eixo === "h" ? 2 : 3;
    if (!naLinha(compridas).some((s) => s[a] <= v.ini + 1 && s[b] >= v.fim - 1)) continue;
    const aceitas = naLinha(paredes);
    const antes = aceitas.some((s) => Math.abs(s[b] - v.ini) <= perto);
    const depois = aceitas.some((s) => Math.abs(s[a] - v.fim) <= perto);
    if (!antes || !depois) continue;
    // O miolo do vão (sem as pontas, que ainda pegam o fim da parede).
    const folga = (v.fim - v.ini) * 0.2;
    let soma = 0;
    let n = 0;
    for (let t = v.ini + folga; t <= v.fim - folga; t++) {
      soma += v.eixo === "h" ? pico(t, v.pos, false) : pico(v.pos, t, true);
      n++;
    }
    if (n > 0 && soma / n < marca) continue;
    portas.push(v.eixo === "h" ? [v.ini, v.pos, v.fim, v.pos] : [v.pos, v.ini, v.pos, v.fim]);
  }
  return portas;
}

/** Parede é escura NELA e clara dos lados; borda de tapete e de móvel é mais clara que isso. */
const RAZAO_PADRAO = 0.55;

/**
 * Mede a linha ponto a ponto e fica só com os trechos que parecem parede: escuros
 * em relação ao chão ao lado. O ponto é medido no mais escuro de uma faixa de
 * ±3 px (o detector erra um pixel ou dois) e comparado com o lado MAIS ESCURO
 * (a 1 espessura de distância); lado fora da imagem não conta — parede na borda
 * do mapa só tem um lado. A média corre numa janela de 1 espessura pra uma
 * mancha não picotar a parede. Assim a parte falsa de uma linha que é meio
 * parede, meio borda de tapete, sai sem derrubar a parte verdadeira.
 */
function filtrarPorContraste(
  cinza: Uint8Array,
  w: number,
  h: number,
  paredes: Segmento[],
  afastamento: number,
  minimo: number,
  ladoClaro = false,
  razaoMaxima = RAZAO_PADRAO,
  traco = afastamento * 0.4,
): Segmento[] {
  const amostra = (x: number, y: number) => cinza[Math.min(h - 1, Math.max(0, Math.round(y))) * w + Math.min(w - 1, Math.max(0, Math.round(x)))];
  const dentro = (x: number, y: number) => x >= 0 && x <= w - 1 && y >= 0 && y <= h - 1;
  const saida: Segmento[] = [];
  const janelaMedia = Math.max(2, Math.round(traco));
  for (const s of paredes) {
    const vertical = s[0] === s[2];
    const comp = Math.hypot(s[2] - s[0], s[3] - s[1]);
    const n = Math.max(2, Math.floor(comp));
    const linha = new Float32Array(n + 1);
    const lados = [new Float32Array(n + 1), new Float32Array(n + 1)];
    const valido = [new Uint8Array(n + 1), new Uint8Array(n + 1)];
    for (let i = 0; i <= n; i++) {
      const x = s[0] + ((s[2] - s[0]) * i) / n;
      const y = s[1] + ((s[3] - s[1]) * i) / n;
      let escuro = 255;
      for (let o = -3; o <= 3; o++) escuro = Math.min(escuro, amostra(x + (vertical ? o : 0), y + (vertical ? 0 : o)));
      linha[i] = escuro;
      [-afastamento, afastamento].forEach((o, k) => {
        const px = x + (vertical ? o : 0);
        const py = y + (vertical ? 0 : o);
        if (dentro(px, py)) {
          lados[k][i] = amostra(px, py);
          valido[k][i] = 1;
        }
      });
    }
    // Médias em janela (somas acumuladas).
    const acum = (v: Float32Array, m?: Uint8Array) => {
      const a = new Float64Array(n + 2);
      const c = new Float64Array(n + 2);
      for (let i = 0; i <= n; i++) {
        a[i + 1] = a[i] + (m ? (m[i] ? v[i] : 0) : v[i]);
        c[i + 1] = c[i] + (m ? m[i] : 1);
      }
      return (i: number) => {
        const ini = Math.max(0, i - janelaMedia);
        const fim = Math.min(n, i + janelaMedia) + 1;
        const cont = c[fim] - c[ini];
        return { media: cont ? (a[fim] - a[ini]) / cont : NaN, cont };
      };
    };
    const mLinha = acum(linha);
    const mLados = [acum(lados[0], valido[0]), acum(lados[1], valido[1])];
    const bom = new Uint8Array(n + 1);
    for (let i = 0; i <= n; i++) {
      const candidatos = mLados.map((f) => f(i)).filter((r) => r.cont > janelaMedia * 0.5).map((r) => r.media);
      if (candidatos.length === 0) {
        bom[i] = 1; // sem lado pra comparar: não dá pra condenar
        continue;
      }
      const referencia = ladoClaro ? Math.max(...candidatos) : Math.min(...candidatos);
      // Linha clara: a imagem veio invertida, mas a razão tem de ser medida no brilho de verdade
      // (lado ÷ linha), senão um contraste de 85 pra 136 vira 119 ÷ 170 e parece fraco.
      const razaoAqui = ladoClaro ? (255 - referencia) / Math.max(1, 255 - mLinha(i).media) : mLinha(i).media / Math.max(1, referencia);
      bom[i] = razaoAqui <= razaoMaxima ? 1 : 0;
    }
    // Trechos contínuos bons, tolerando quebras curtas (uma mancha, uma emenda).
    const quebra = Math.max(2, Math.round(traco));
    let ini = -1;
    let ultimoBom = -1;
    const fechar = () => {
      if (ini < 0) return;
      // Aparar as pontas: o detector passa alguns px do canto (o núcleo do black-hat
      // estica a linha). Enquanto o ponto da ponta for bem mais claro que a parede
      // que ele mesmo mediu, é chão, não parede.
      const dentro = Array.from(linha.slice(ini, ultimoBom + 1)).sort((x, y) => x - y);
      const corte = Math.max(70, dentro[Math.floor(dentro.length / 2)] * 1.8 + 10);
      while (ini < ultimoBom && linha[ini] > corte) ini++;
      while (ultimoBom > ini && linha[ultimoBom] > corte) ultimoBom--;
      const t = ((ultimoBom - ini) * comp) / n;
      if (t >= minimo) {
        const a = ini / n;
        const b = ultimoBom / n;
        saida.push([s[0] + (s[2] - s[0]) * a, s[1] + (s[3] - s[1]) * a, s[0] + (s[2] - s[0]) * b, s[1] + (s[3] - s[1]) * b]);
      }
      ini = -1;
    };
    for (let i = 0; i <= n; i++) {
      if (bom[i]) {
        if (ini < 0) ini = i;
        ultimoBom = i;
      } else if (ini >= 0 && i - ultimoBom > quebra) fechar();
    }
    fechar();
  }
  return saida;
}

/**
 * Pontas que passam do canto: o núcleo do black-hat estica a linha alguns pixels
 * além de onde a parede perpendicular a corta. Se a ponta passa (até `alcance`)
 * do eixo de uma parede perpendicular que cobre aquela linha, recua até o eixo.
 */
function recortarPontas(paredes: Segmento[], alcance: number): Segmento[] {
  const horizontais = paredes.filter((s) => s[1] === s[3]);
  const verticais = paredes.filter((s) => s[0] === s[2]);
  const folga = 3;
  return paredes.map((s) => {
    const horizontal = s[1] === s[3];
    const cruzam = horizontal ? verticais : horizontais;
    const [a, b, fixo] = horizontal ? [0, 2, 1] : [1, 3, 0];
    const eixoDe = (c: Segmento) => (horizontal ? c[0] : c[1]);
    const cobre = (c: Segmento) => (horizontal ? c[1] - folga <= s[fixo] && c[3] + folga >= s[fixo] : c[0] - folga <= s[fixo] && c[2] + folga >= s[fixo]);
    const nova: Segmento = [...s] as Segmento;
    let melhorFim = 0;
    let melhorIni = 0;
    for (const c of cruzam) {
      if (!cobre(c)) continue;
      const e = eixoDe(c);
      const passouFim = s[b] - e; // ponta do fim passou do eixo?
      if (passouFim > 0.5 && passouFim <= alcance && s[a] < e - 4 && (melhorFim === 0 || passouFim < melhorFim)) {
        melhorFim = passouFim;
        nova[b] = e;
      }
      const passouIni = e - s[a];
      if (passouIni > 0.5 && passouIni <= alcance && s[b] > e + 4 && (melhorIni === 0 || passouIni < melhorIni)) {
        melhorIni = passouIni;
        nova[a] = e;
      }
    }
    return nova;
  });
}

/**
 * Moldura de pergaminho ou papel em volta do mapa: linha fina paralela à borda da
 * imagem, com a faixa entre ela e a borda CLARA (papel). Parede que encosta no
 * limite da imagem (a faixa de fora é a própria parede, escura) não é moldura.
 */
function tirarMoldura(cinza: Uint8Array, w: number, h: number, paredes: Segmento[]): Segmento[] {
  const margem = Math.max(w, h) * 0.05;
  const px = (x: number, y: number) => cinza[Math.min(h - 1, Math.max(0, Math.round(y))) * w + Math.min(w - 1, Math.max(0, Math.round(x)))];
  return paredes.filter((s) => {
    const horizontal = Math.abs(s[2] - s[0]) >= Math.abs(s[3] - s[1]);
    const pos = horizontal ? (s[1] + s[3]) / 2 : (s[0] + s[2]) / 2;
    const lim = horizontal ? h : w;
    const dist = Math.min(pos, lim - pos);
    if (dist > margem || dist < Math.max(8, Math.max(w, h) * 0.015)) return true;
    const alta = pos < lim - pos ? 0 : lim - 1; // a borda da imagem mais perto
    const comp = Math.hypot(s[2] - s[0], s[3] - s[1]);
    const n = Math.max(2, Math.floor(comp));
    let linha = 0;
    let fora = 0;
    for (let i = 0; i <= n; i++) {
      const x = s[0] + ((s[2] - s[0]) * i) / n;
      const y = s[1] + ((s[3] - s[1]) * i) / n;
      linha += horizontal ? px(x, y) : px(x, y);
      // Ponto no meio da faixa entre a linha e a borda.
      fora += horizontal ? px(x, (y + alta) / 2) : px((x + alta) / 2, y);
    }
    return fora / linha <= 1.8;
  });
}

const arredondar = (n: number) => Math.round(n * 10) / 10;

/**
 * Níveis do controle "menos linhas ↔ mais linhas". O padrão (3) é o comportamento de sempre.
 * `minimo`: comprimento mínimo da parede (fração do lado maior); `razao`: o quanto a linha
 * precisa ser mais escura que o chão ao lado (maior = aceita linha mais fraca); `comp`: o
 * núcleo que corta linhas curtas (fração do lado maior; menor = acha parede curta, como
 * as de um labirinto); `limiar`: fração do limiar automático da imagem (menor = entra linha mais
 * fraca, como a parede interna de um mapa com muita luz e sombra).
 */
export type Sensibilidade = 1 | 2 | 3 | 4 | 5;
export const NIVEIS_DE_SENSIBILIDADE: Record<Sensibilidade, { minimo: number; razao: number; comp: number; limiar: number; limiarLocal: number }> = {
  1: { minimo: 0.2, razao: 0.4, comp: 1 / 18, limiar: 1, limiarLocal: 0 },
  2: { minimo: 0.15, razao: 0.48, comp: 1 / 18, limiar: 1, limiarLocal: 0 },
  3: { minimo: PAREDE_MINIMA, razao: RAZAO_PADRAO, comp: 1 / 18, limiar: 1, limiarLocal: 0 },
  4: { minimo: 0.07, razao: 0.63, comp: 1 / 26, limiar: 0.8, limiarLocal: 0.5 },
  5: { minimo: 0.035, razao: 0.72, comp: 1 / 40, limiar: 0.6, limiarLocal: 0.4 },
};

/** A parte pesada da detecção (não depende de `minimo` nem da `razao`): guarde e reaproveite ao mexer no controle. */
export type DeteccaoPreparada = {
  cinza: Uint8Array;
  largura: number;
  altura: number;
  lado: number;
  esp: number;
  claras: boolean;
  /** Espessura típica das linhas finas deste mapa (px): a escala das folgas. */
  traco: number;
  /** Resposta de linha fina (black-hat) e o limiar da imagem: pra conferir o que há dentro de um vão. */
  resp: Uint8Array;
  limiar: number;
  binaria: Uint8Array;
  juntas: Segmento[];
  vaos: Vao[];
};

export function prepararDeteccao(
  cinzaOriginal: Uint8Array,
  largura: number,
  altura: number,
  opcoes: { linhas?: "escuras" | "claras"; espessura?: number; comp?: number; limiar?: number; limiarLocal?: number } = {},
): DeteccaoPreparada {
  const claras = opcoes.linhas === "claras";
  // Linha clara: inverte a imagem e cai no caso da linha escura.
  const cinza = claras ? cinzaOriginal.map((v) => 255 - v) : cinzaOriginal;
  const lado = Math.max(largura, altura);
  const borrada = borrar(cinza, largura, altura);

  const esp = (opcoes.espessura ?? Math.max(5, Math.floor(lado / 28))) | 1;
  // Fechamento = dilatar e depois erodir com a mesma janela.
  const fechamento = morfologia(morfologia(borrada, largura, altura, esp, esp, true), largura, altura, esp, esp, false);
  const blackhat = new Uint8Array(largura * altura);
  for (let i = 0; i < blackhat.length; i++) blackhat[i] = Math.max(0, fechamento[i] - borrada[i]);

  // O limiar de Otsu é puxado pelos contrastes mais fortes do mapa (a borda contra o vazio); `limiar`
  // abaixo de 1 deixa entrar também as linhas mais fracas (parede interna de labirinto, por exemplo).
  const limiar = otsu(blackhat) * (opcoes.limiar ?? 1);
  const local = opcoes.limiarLocal ? limiarPorRegiao(blackhat, largura, altura, esp * 3, opcoes.limiarLocal, Math.max(6, limiar * 0.3)) : null;
  const binaria = new Uint8Array(largura * altura);
  // Com limiar local: vale o MENOR dos dois, então nada que já entrava deixa de entrar.
  for (let i = 0; i < binaria.length; i++) binaria[i] = blackhat[i] > (local ? Math.min(limiar, local[i]) : limiar) ? 255 : 0;

  const comp = Math.max(12, Math.floor(lado * (opcoes.comp ?? 1 / 18)));
  const abrir = (kx: number, ky: number) => morfologia(morfologia(binaria, largura, altura, kx, ky, false), largura, altura, kx, ky, true);
  const hor = abrir(comp, 1);
  const ver = abrir(1, comp);

  const brutos = [...segmentosDaMascara(hor, largura, altura, false), ...segmentosDaMascara(ver, largura, altura, true)];
  const { juntas, vaos } = fundir(brutos, lado);
  const traco = espessuraDoTraco(binaria, largura, altura, esp);
  return { cinza, largura, altura, lado, esp, claras, traco, resp: blackhat, limiar, binaria, juntas, vaos };
}

/** A parte barata: escolhe o que fica, dado o nível de sensibilidade (ou os números soltos). */
export function aplicarDeteccao(p: DeteccaoPreparada, opcoes: { minimo?: number; razao?: number; curvas?: boolean } = {}): ResultadoDaDeteccao {
  const { cinza, largura, altura, lado, esp, claras, traco, resp, limiar, binaria, juntas, vaos } = p;
  const lateral = Math.min(esp, Math.max(4, Math.round(traco * 2.5)));
  const razao = opcoes.razao ?? RAZAO_PADRAO;
  const minimo = lado * (opcoes.minimo ?? PAREDE_MINIMA);
  const compridas = juntas.filter((s) => Math.hypot(s[2] - s[0], s[3] - s[1]) >= minimo);
  const paredes = recortarPontas(tirarMoldura(cinza, largura, altura, filtrarPorContraste(cinza, largura, altura, compridas, lateral, minimo * 0.6, claras, razao, traco)), esp);
  const portas = portasDosVaos(vaos, compridas, paredes, Math.max(6, traco * 3), resp, largura, altura, limiar * 0.35, Math.max(14, traco * 8));

  const curvas =
    opcoes.curvas === false
      ? []
      : tirarMoldura(cinza, largura, altura, detectarCurvas(binaria, cinza, largura, altura, [...paredes, ...portas], { lado, espessura: esp, ladoClaro: claras, razao: razao + 0.05 }));

  const r = (s: Segmento): Segmento => [arredondar(s[0]), arredondar(s[1]), arredondar(s[2]), arredondar(s[3])];
  return { largura, altura, paredes: [...paredes, ...curvas].map(r), portas: portas.map(r) };
}

/** `cinza`: um byte por pixel (0 = preto), `largura × altura`. Atalho: prepara e aplica de uma vez. */
export function detectarParedes(cinza: Uint8Array, largura: number, altura: number, opcoes: OpcoesDaDeteccao = {}): ResultadoDaDeteccao {
  const preparada = prepararDeteccao(cinza, largura, altura, { linhas: opcoes.linhas, espessura: opcoes.espessura });
  return aplicarDeteccao(preparada, { minimo: opcoes.minimo, curvas: opcoes.curvas });
}

/**
 * Junta duas detecções do MESMO mapa feitas com sinais diferentes (brilho e saturação, por
 * exemplo): fica tudo da primeira e, da segunda, só o que a primeira não tinha — um trecho
 * da segunda que corre colado a um da primeira (mesma direção, a até `perto` px) é a mesma
 * parede vista de novo e sai.
 */
export function unirDeteccoes(a: ResultadoDaDeteccao, b: ResultadoDaDeteccao, perto: number): ResultadoDaDeteccao {
  const distancia = (px: number, py: number, s: Segmento) => {
    const dx = s[2] - s[0];
    const dy = s[3] - s[1];
    const q = dx * dx + dy * dy;
    const t = q === 0 ? 0 : Math.max(0, Math.min(1, ((px - s[0]) * dx + (py - s[1]) * dy) / q));
    return Math.hypot(px - (s[0] + t * dx), py - (s[1] + t * dy));
  };
  const paralelos = (s: Segmento, o: Segmento) => {
    const c1 = Math.hypot(s[2] - s[0], s[3] - s[1]) || 1;
    const c2 = Math.hypot(o[2] - o[0], o[3] - o[1]) || 1;
    return Math.abs(((s[2] - s[0]) * (o[2] - o[0]) + (s[3] - s[1]) * (o[3] - o[1])) / (c1 * c2)) > 0.94; // ~20°
  };
  const repetido = (s: Segmento, base: Segmento[]) => {
    const n = Math.max(2, Math.floor(Math.hypot(s[2] - s[0], s[3] - s[1]) / 3));
    const vizinhos = base.filter((o) => paralelos(s, o));
    if (vizinhos.length === 0) return false;
    let cobertos = 0;
    for (let i = 0; i <= n; i++) {
      const x = s[0] + ((s[2] - s[0]) * i) / n;
      const y = s[1] + ((s[3] - s[1]) * i) / n;
      if (vizinhos.some((o) => distancia(x, y, o) <= perto)) cobertos++;
    }
    return cobertos / (n + 1) >= 0.6;
  };
  const paredes = [...a.paredes];
  for (const s of b.paredes) if (!repetido(s, paredes)) paredes.push(s);
  const portas = [...a.portas];
  for (const s of b.portas) if (!repetido(s, portas) && !repetido(s, paredes)) portas.push(s);
  return { largura: a.largura, altura: a.altura, paredes, portas };
}

/**
 * Parede clara num mapa colorido: junta a leitura do BRILHO (parede mais clara que o chão) com a
 * da COR (parede menos colorida que o chão — pedra bege sobre piso marrom tem quase o mesmo brilho
 * sob a luz, mas bem menos cor). A cor entra primeiro: ela cai em cima da parede; o brilho completa
 * o que a cor não viu (o contorno contra o vazio escuro).
 */
/**
 * Na leitura pela cor a parede cai bem em cima do desenho e quase não há linha falsa, então dá
 * pra aceitar trechos mais curtos que na leitura pelo brilho: o comprimento mínimo e o núcleo que
 * corta linha curta são multiplicados por isto (medido no trecho do labirinto: de 74% pra 84% das
 * paredes, com a precisão subindo de 85% pra 92%).
 */
export const FATOR_DA_COR = 0.57;

export function aplicarComCor(
  brilho: DeteccaoPreparada,
  cor: DeteccaoPreparada,
  opcoes: { minimo?: number; razao?: number; curvas?: boolean; minimoDaCor?: number; razaoDaCor?: number } = {},
): ResultadoDaDeteccao {
  const pelaCor = aplicarDeteccao(cor, {
    minimo: opcoes.minimoDaCor ?? opcoes.minimo,
    razao: opcoes.razaoDaCor ?? Math.min(0.9, (opcoes.razao ?? RAZAO_PADRAO) + 0.15),
    curvas: false,
  });
  const peloBrilho = aplicarDeteccao(brilho, opcoes);
  // No vazio escuro em volta do mapa a cor é só ruído (preto não tem cor que se meça): sai o trecho
  // lido pela cor que passa por um lugar com menos da metade do brilho típico da imagem.
  const { largura: w, altura: h } = brilho;
  const real = (i: number) => (brilho.claras ? 255 - brilho.cinza[i] : brilho.cinza[i]);
  const hist = new Uint32Array(256);
  for (let i = 0; i < w * h; i += 7) hist[real(i)]++;
  let mediana = 0;
  for (let soma = 0, meio = Math.ceil((w * h) / 14); mediana < 255 && (soma += hist[mediana]) < meio; mediana++);
  const noMapa = (s: Segmento) => {
    const n = Math.max(2, Math.floor(Math.hypot(s[2] - s[0], s[3] - s[1]) / 2));
    let soma = 0;
    for (let i = 0; i <= n; i++) {
      const x = Math.min(w - 1, Math.max(0, Math.round(s[0] + ((s[2] - s[0]) * i) / n)));
      const y = Math.min(h - 1, Math.max(0, Math.round(s[1] + ((s[3] - s[1]) * i) / n)));
      soma += real(y * w + x);
    }
    return soma / (n + 1) >= mediana * 0.5;
  };
  const corNoMapa = { ...pelaCor, paredes: pelaCor.paredes.filter(noMapa), portas: pelaCor.portas.filter(noMapa) };
  return unirDeteccoes(corNoMapa, peloBrilho, Math.max(5, brilho.traco * 2.5));
}

/** Saturação (0 = cinza, 255 = cor viva) de cada pixel RGBA: separa pedra clara de chão colorido mesmo com o mesmo brilho. */
export function rgbaParaSaturacao(rgba: Uint8ClampedArray | Uint8Array, largura: number, altura: number): Uint8Array {
  const out = new Uint8Array(largura * altura);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) {
    const maior = Math.max(rgba[j], rgba[j + 1], rgba[j + 2]);
    const menor = Math.min(rgba[j], rgba[j + 1], rgba[j + 2]);
    out[i] = maior === 0 ? 0 : Math.round(((maior - menor) / maior) * 255);
  }
  return out;
}

/** Converte RGBA (do canvas) em níveis de cinza, no peso de luminosidade usual. */
export function rgbaParaCinza(rgba: Uint8ClampedArray | Uint8Array, largura: number, altura: number): Uint8Array {
  const out = new Uint8Array(largura * altura);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) {
    out[i] = Math.round(0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]);
  }
  return out;
}

/** Só as `n` paredes mais compridas (na ordem em que estavam); as portas ficam todas. */
export function soAsMaiores(r: ResultadoDaDeteccao, n: number): ResultadoDaDeteccao {
  if (r.paredes.length <= n) return r;
  const comp = (s: Segmento) => Math.hypot(s[2] - s[0], s[3] - s[1]);
  const corte = r.paredes.map(comp).sort((x, y) => y - x)[Math.max(0, n - 1)];
  let sobra = n;
  return { ...r, paredes: r.paredes.filter((s) => comp(s) >= corte && sobra-- > 0) };
}

/** O JSON no mesmo formato do "Importar paredes" (largura/altura da imagem analisada). */
export function comoTextoDeImportacao(r: ResultadoDaDeteccao): string {
  return JSON.stringify({ largura: r.largura, altura: r.altura, paredes: r.paredes, portas: r.portas });
}
