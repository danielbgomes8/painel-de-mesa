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
export const LADO_DA_ANALISE = 1000;

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
 * Só vale vão que ficou dentro de uma linha comprida (`compridas`) e perto de um
 * trecho que passou no filtro de contraste: vão no meio de linha falsa (borda de
 * tapete) não sobra nenhum trecho por perto e some.
 */
function portasDosVaos(vaos: Vao[], compridas: Segmento[], paredes: Segmento[], perto: number): Segmento[] {
  const portas: Segmento[] = [];
  for (const v of vaos) {
    const naLinha = (lista: Segmento[]) =>
      lista.filter((w) => (v.eixo === "h" ? w[1] === w[3] && Math.abs(w[1] - v.pos) <= 4 : w[0] === w[2] && Math.abs(w[0] - v.pos) <= 4));
    const a = v.eixo === "h" ? 0 : 1;
    const b = v.eixo === "h" ? 2 : 3;
    const dentro = naLinha(compridas).some((w) => w[a] <= v.ini + 1 && w[b] >= v.fim - 1);
    const sobrou = naLinha(paredes).some((w) => w[b] >= v.ini - perto && w[a] <= v.fim + perto);
    if (!dentro || !sobrou) continue;
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
function filtrarPorContraste(cinza: Uint8Array, w: number, h: number, paredes: Segmento[], afastamento: number, minimo: number, ladoClaro = false, razaoMaxima = RAZAO_PADRAO): Segmento[] {
  const amostra = (x: number, y: number) => cinza[Math.min(h - 1, Math.max(0, Math.round(y))) * w + Math.min(w - 1, Math.max(0, Math.round(x)))];
  const dentro = (x: number, y: number) => x >= 0 && x <= w - 1 && y >= 0 && y <= h - 1;
  const saida: Segmento[] = [];
  const janelaMedia = Math.max(2, Math.round(afastamento * 0.4));
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
      bom[i] = mLinha(i).media / Math.max(1, referencia) <= razaoMaxima ? 1 : 0;
    }
    // Trechos contínuos bons, tolerando quebras curtas (uma mancha, uma emenda).
    const quebra = Math.max(3, Math.round(afastamento * 0.3));
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
 * as de um labirinto).
 */
export type Sensibilidade = 1 | 2 | 3 | 4 | 5;
export const NIVEIS_DE_SENSIBILIDADE: Record<Sensibilidade, { minimo: number; razao: number; comp: number }> = {
  1: { minimo: 0.2, razao: 0.4, comp: 1 / 18 },
  2: { minimo: 0.15, razao: 0.48, comp: 1 / 18 },
  3: { minimo: PAREDE_MINIMA, razao: RAZAO_PADRAO, comp: 1 / 18 },
  4: { minimo: 0.07, razao: 0.63, comp: 1 / 26 },
  5: { minimo: 0.035, razao: 0.72, comp: 1 / 40 },
};

/** A parte pesada da detecção (não depende de `minimo` nem da `razao`): guarde e reaproveite ao mexer no controle. */
export type DeteccaoPreparada = {
  cinza: Uint8Array;
  largura: number;
  altura: number;
  lado: number;
  esp: number;
  claras: boolean;
  binaria: Uint8Array;
  juntas: Segmento[];
  vaos: Vao[];
};

export function prepararDeteccao(
  cinzaOriginal: Uint8Array,
  largura: number,
  altura: number,
  opcoes: { linhas?: "escuras" | "claras"; espessura?: number; comp?: number } = {},
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

  const limiar = otsu(blackhat);
  const binaria = new Uint8Array(largura * altura);
  for (let i = 0; i < binaria.length; i++) binaria[i] = blackhat[i] > limiar ? 255 : 0;

  const comp = Math.max(12, Math.floor(lado * (opcoes.comp ?? 1 / 18)));
  const abrir = (kx: number, ky: number) => morfologia(morfologia(binaria, largura, altura, kx, ky, false), largura, altura, kx, ky, true);
  const hor = abrir(comp, 1);
  const ver = abrir(1, comp);

  const brutos = [...segmentosDaMascara(hor, largura, altura, false), ...segmentosDaMascara(ver, largura, altura, true)];
  const { juntas, vaos } = fundir(brutos, lado);
  return { cinza, largura, altura, lado, esp, claras, binaria, juntas, vaos };
}

/** A parte barata: escolhe o que fica, dado o nível de sensibilidade (ou os números soltos). */
export function aplicarDeteccao(p: DeteccaoPreparada, opcoes: { minimo?: number; razao?: number; curvas?: boolean } = {}): ResultadoDaDeteccao {
  const { cinza, largura, altura, lado, esp, claras, binaria, juntas, vaos } = p;
  const razao = opcoes.razao ?? RAZAO_PADRAO;
  const minimo = lado * (opcoes.minimo ?? PAREDE_MINIMA);
  const compridas = juntas.filter((s) => Math.hypot(s[2] - s[0], s[3] - s[1]) >= minimo);
  const paredes = recortarPontas(tirarMoldura(cinza, largura, altura, filtrarPorContraste(cinza, largura, altura, compridas, esp, minimo * 0.6, claras, razao)), esp);
  const portas = portasDosVaos(vaos, compridas, paredes, esp * 2);

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

/** Converte RGBA (do canvas) em níveis de cinza, no peso de luminosidade usual. */
export function rgbaParaCinza(rgba: Uint8ClampedArray | Uint8Array, largura: number, altura: number): Uint8Array {
  const out = new Uint8Array(largura * altura);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) {
    out[i] = Math.round(0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]);
  }
  return out;
}

/** O JSON no mesmo formato do "Importar paredes" (largura/altura da imagem analisada). */
export function comoTextoDeImportacao(r: ResultadoDaDeteccao): string {
  return JSON.stringify({ largura: r.largura, altura: r.altura, paredes: r.paredes, portas: r.portas });
}
