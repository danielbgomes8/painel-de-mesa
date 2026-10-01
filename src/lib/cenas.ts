/**
 * Regras do mapa (cenas) e da névoa — tudo puro, sem tela e sem banco.
 * O componente `CenaMapa` desenha; aqui moram as contas: onde fica cada
 * ponto, o zoom, a grade, o pincel, e a validação do que vem do banco.
 *
 * Todas as coordenadas guardadas (névoa, câmera, grade) são em PIXELS DA
 * IMAGEM da cena, nunca da tela: o telão, o celular e o notebook enxergam o
 * mesmo ponto no mesmo lugar, qualquer que seja o tamanho de cada tela.
 */

export type Ponto = readonly [x: number, y: number];
/** x, y, largura, altura (px da imagem). */
export type Retangulo = readonly [x: number, y: number, w: number, h: number];
export type Regiao = { x: number; y: number; w: number; h: number };

export type Cena = {
  id: string;
  room_code: string;
  nome: string;
  /** Caminho no bucket "mapas"; null = ainda sem imagem. */
  imagem: string | null;
  largura: number;
  altura: number;
  grade_ligada: boolean;
  /** Lado do quadradinho, em px da imagem. */
  grade_px: number;
  grade_dx: number;
  grade_dy: number;
  /** Quantos metros vale um quadradinho (1,5 m = 5 pés, o padrão do D&D). */
  metros: number;
  /** A cena nasce coberta de névoa. */
  nevoa_ligada: boolean;
  na_mesa: boolean;
  /** Pedaço do mapa que a mesa enquadra; null = o mapa todo. */
  camera: Regiao | null;
  created_at: string;
};

export type ModoNevoa = "revelar" | "esconder";

/** Uma pincelada de névoa. `seq` dá a ordem em que foram feitas. */
export type RegraNevoa = { id: string; seq: number; modo: ModoNevoa } & (
  | { forma: "retangulos"; dados: { r: Retangulo[] } }
  | { forma: "pincel"; dados: { r: number; p: Ponto[] } }
);

/** O que se manda pro banco (o id é gerado no aparelho, pra tela mostrar na
 *  hora e o evento de tempo real que volta não duplicar a linha). */
export type NovaRegra = { modo: ModoNevoa } & (
  | { forma: "retangulos"; dados: { r: Retangulo[] } }
  | { forma: "pincel"; dados: { r: number; p: Ponto[] } }
);

export type Vista = { escala: number; tx: number; ty: number };

// ── Limites ────────────────────────────────────────────────────────────────

/** Maior lado da imagem depois de reduzida. 3000 px cobre um telão de 4K com
 *  sobra e fica em 1–3 MB de JPEG. */
export const LADO_MAXIMO_IMAGEM = 3000;
/** Pontos por pincelada: o banco recusa linha com mais de ~32 KB. */
export const PONTOS_MAXIMOS_PINCEL = 400;
/** Retângulos por pincelada de quadradinhos (mesmo motivo). */
export const RETANGULOS_MAXIMOS = 600;
export const ZOOM_MAXIMO = 8;

function numero(v: unknown, padrao: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : padrao;
}

function ehPonto(v: unknown): v is Ponto {
  return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n));
}

// ── Validação do que vem do banco ─────────────────────────────────────────
// Ficha estragada já derrubou o app inteiro uma vez (AGENTS.md): linha de mapa
// com formato torto vira "ignorar", nunca um erro na tela.

function regiaoValida(v: unknown): Regiao | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const { x, y, w, h } = o;
  if (![x, y, w, h].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  if ((w as number) <= 0 || (h as number) <= 0) return null;
  return { x: x as number, y: y as number, w: w as number, h: h as number };
}

export function normalizarCena(linha: unknown): Cena | null {
  if (!linha || typeof linha !== "object") return null;
  const o = linha as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.room_code !== "string") return null;
  return {
    id: o.id,
    room_code: o.room_code,
    nome: typeof o.nome === "string" ? o.nome : "",
    imagem: typeof o.imagem === "string" && o.imagem ? o.imagem : null,
    largura: Math.max(0, Math.round(numero(o.largura, 0))),
    altura: Math.max(0, Math.round(numero(o.altura, 0))),
    grade_ligada: o.grade_ligada !== false,
    grade_px: Math.max(8, numero(o.grade_px, 70)),
    grade_dx: numero(o.grade_dx, 0),
    grade_dy: numero(o.grade_dy, 0),
    metros: Math.max(0.1, numero(o.metros, 1.5)),
    nevoa_ligada: o.nevoa_ligada !== false,
    na_mesa: o.na_mesa === true,
    camera: regiaoValida(o.camera),
    created_at: typeof o.created_at === "string" ? o.created_at : "",
  };
}

export function normalizarRegra(linha: unknown): RegraNevoa | null {
  if (!linha || typeof linha !== "object") return null;
  const o = linha as Record<string, unknown>;
  if (typeof o.id !== "string") return null;
  const modo: ModoNevoa | null = o.modo === "revelar" || o.modo === "esconder" ? o.modo : null;
  if (!modo) return null;
  const seq = numero(typeof o.seq === "string" ? Number(o.seq) : o.seq, 0);
  const dados = o.dados as Record<string, unknown> | null | undefined;
  if (!dados || typeof dados !== "object") return null;

  if (o.forma === "retangulos") {
    if (!Array.isArray(dados.r)) return null;
    const r = dados.r.filter(
      (q): q is Retangulo => Array.isArray(q) && q.length === 4 && q.every((n) => typeof n === "number" && Number.isFinite(n)),
    );
    return { id: o.id, seq, modo, forma: "retangulos", dados: { r } };
  }
  if (o.forma === "pincel") {
    if (!Array.isArray(dados.p)) return null;
    const raio = numero(dados.r, 0);
    if (raio <= 0) return null;
    return { id: o.id, seq, modo, forma: "pincel", dados: { r: raio, p: dados.p.filter(ehPonto) } };
  }
  return null;
}

/** Ordem em que as pinceladas valem: a mais antiga primeiro. */
export function ordenarRegras(regras: RegraNevoa[]): RegraNevoa[] {
  return [...regras].sort((a, b) => a.seq - b.seq);
}

/** O banco respondeu que as tabelas de mapa não existem — a migration 0018
 *  ainda não foi rodada. O app abre normal e só esconde o mapa, em vez de
 *  tratar como erro (o código vai ao ar antes do SQL, às vezes por dias). */
export function ehTabelaAusente(erro: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!erro) return false;
  if (erro.code === "42P01" || erro.code === "PGRST205") return true;
  const m = (erro.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("could not find the table") || m.includes("schema cache");
}

// ── Imagem ─────────────────────────────────────────────────────────────────

/** Tamanho depois de reduzir a imagem pro máximo, mantendo a proporção.
 *  Imagem menor que o limite não é ampliada. */
export function tamanhoReduzido(largura: number, altura: number, maximo = LADO_MAXIMO_IMAGEM): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= maximo || maior <= 0) return { largura: Math.round(largura), altura: Math.round(altura) };
  const f = maximo / maior;
  return { largura: Math.max(1, Math.round(largura * f)), altura: Math.max(1, Math.round(altura * f)) };
}

/** Nome da cena sugerido pelo nome do arquivo: "masmorra-do_lich.png" →
 *  "masmorra do lich". */
export function nomeDaCenaPeloArquivo(nomeArquivo: string): string {
  const semExtensao = nomeArquivo.replace(/\.[^./\\]+$/, "");
  const limpo = semExtensao.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return (limpo || "Mapa").slice(0, 60);
}

export function caminhoDaImagem(codigoSala: string, idCena: string): string {
  return `${codigoSala}/${idCena}.jpg`;
}

// ── Grade ──────────────────────────────────────────────────────────────────

export function gradeUsavel(c: Pick<Cena, "grade_ligada" | "grade_px">): boolean {
  return c.grade_ligada && c.grade_px >= 8;
}

/** Quantos quadradinhos cabem na largura do mapa (com uma casa). */
export function quadradosNaLargura(c: Pick<Cena, "largura" | "grade_px">): number {
  return c.grade_px > 0 ? Math.round((c.largura / c.grade_px) * 10) / 10 : 0;
}

/** O contrário: o Mestre diz "30 quadrados de largura" e a grade sai disso. */
export function gradePxParaQuadrados(largura: number, quadrados: number): number {
  if (!(quadrados > 0)) return 70;
  return Math.max(8, Math.round((largura / quadrados) * 100) / 100);
}

/** Lado do quadradinho usado pra medir o pincel: o da grade, ou — sem grade —
 *  um trinta avos do mapa. */
export function ladoDeReferencia(c: Pick<Cena, "grade_ligada" | "grade_px" | "largura" | "altura">): number {
  return gradeUsavel(c) ? c.grade_px : Math.max(c.largura, c.altura, 300) / 30;
}

export type TamanhoPincel = "p" | "m" | "g";
/** Raio do pincel em px da imagem: 0,5 / 1 / 2 quadradinhos. */
export function raioDoPincel(c: Pick<Cena, "grade_ligada" | "grade_px" | "largura" | "altura">, tamanho: TamanhoPincel): number {
  const quadrados = tamanho === "p" ? 0.5 : tamanho === "m" ? 1 : 2;
  return ladoDeReferencia(c) * quadrados;
}

export function celulaNoPonto(c: Pick<Cena, "grade_px" | "grade_dx" | "grade_dy">, x: number, y: number): { col: number; row: number } {
  return { col: Math.floor((x - c.grade_dx) / c.grade_px), row: Math.floor((y - c.grade_dy) / c.grade_px) };
}

/** O retângulo do quadradinho (col, row), cortado nas bordas da imagem;
 *  null se ele cai todo fora do mapa. */
export function retanguloDaCelula(
  c: Pick<Cena, "grade_px" | "grade_dx" | "grade_dy" | "largura" | "altura">,
  col: number,
  row: number,
): Retangulo | null {
  const x0 = Math.max(0, c.grade_dx + col * c.grade_px);
  const y0 = Math.max(0, c.grade_dy + row * c.grade_px);
  const x1 = Math.min(c.largura, c.grade_dx + (col + 1) * c.grade_px);
  const y1 = Math.min(c.altura, c.grade_dy + (row + 1) * c.grade_px);
  if (x1 <= x0 || y1 <= y0) return null;
  return [round2(x0), round2(y0), round2(x1 - x0), round2(y1 - y0)];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Quadradinhos tocados por um arrasto de `a` até `b` (dedo rápido pula
 *  quadradinhos entre dois eventos; isto preenche o caminho). Chaves "col,row". */
export function celulasNoSegmento(
  c: Pick<Cena, "grade_px" | "grade_dx" | "grade_dy">,
  a: Ponto,
  b: Ponto,
): { col: number; row: number }[] {
  const passo = Math.max(1, c.grade_px / 3);
  const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(dist / passo));
  const vistos = new Set<string>();
  const saida: { col: number; row: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cel = celulaNoPonto(c, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    const chave = `${cel.col},${cel.row}`;
    if (!vistos.has(chave)) {
      vistos.add(chave);
      saida.push(cel);
    }
  }
  return saida;
}

/** Junta os retângulos de uma pincelada de quadradinhos sem repetir. */
export function retangulosDasCelulas(
  c: Pick<Cena, "grade_px" | "grade_dx" | "grade_dy" | "largura" | "altura">,
  celulas: { col: number; row: number }[],
): Retangulo[] {
  const vistos = new Set<string>();
  const saida: Retangulo[] = [];
  for (const { col, row } of celulas) {
    const chave = `${col},${row}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const r = retanguloDaCelula(c, col, row);
    if (r) saida.push(r);
    if (saida.length >= RETANGULOS_MAXIMOS) break;
  }
  return saida;
}

/** Retângulo entre dois pontos (em qualquer sentido), cortado na imagem. */
export function retanguloEntre(c: Pick<Cena, "largura" | "altura">, a: Ponto, b: Ponto): Retangulo | null {
  const x0 = Math.max(0, Math.min(a[0], b[0]));
  const y0 = Math.max(0, Math.min(a[1], b[1]));
  const x1 = Math.min(c.largura, Math.max(a[0], b[0]));
  const y1 = Math.min(c.altura, Math.max(a[1], b[1]));
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  return [round2(x0), round2(y0), round2(x1 - x0), round2(y1 - y0)];
}

/** Tira pontos colados num traço de pincel e limita a quantidade (o banco
 *  recusa linha grande). Mantém sempre o primeiro e o último. */
export function simplificarTrilha(pontos: Ponto[], distanciaMinima: number, maximo = PONTOS_MAXIMOS_PINCEL): Ponto[] {
  if (pontos.length <= 2) return pontos.map(arredondar);
  const saida: Ponto[] = [pontos[0]];
  for (let i = 1; i < pontos.length - 1; i++) {
    const ult = saida[saida.length - 1];
    if (Math.hypot(pontos[i][0] - ult[0], pontos[i][1] - ult[1]) >= distanciaMinima) saida.push(pontos[i]);
  }
  saida.push(pontos[pontos.length - 1]);
  if (saida.length <= maximo) return saida.map(arredondar);
  // Ainda grande: amostra por igual, guardando as pontas.
  const passo = (saida.length - 1) / (maximo - 1);
  const amostra: Ponto[] = [];
  for (let i = 0; i < maximo; i++) amostra.push(saida[Math.min(saida.length - 1, Math.round(i * passo))]);
  return amostra.map(arredondar);
}

function arredondar(p: Ponto): Ponto {
  return [round2(p[0]), round2(p[1])];
}

// ── Vista (zoom e arrastar) ────────────────────────────────────────────────

export function telaParaMapa(v: Vista, x: number, y: number): Ponto {
  return [(x - v.tx) / v.escala, (y - v.ty) / v.escala];
}

export function mapaParaTela(v: Vista, x: number, y: number): Ponto {
  return [x * v.escala + v.tx, y * v.escala + v.ty];
}

/** A região do mapa que a tela mostra agora. */
export function regiaoVisivel(v: Vista, larguraTela: number, alturaTela: number): Regiao {
  const [x, y] = telaParaMapa(v, 0, 0);
  return { x, y, w: larguraTela / v.escala, h: alturaTela / v.escala };
}

/** Vista que encaixa `regiao` na tela, centralizada, com uma folga nas bordas. */
export function enquadrar(regiao: Regiao, larguraTela: number, alturaTela: number, folga = 0.03): Vista {
  if (larguraTela <= 0 || alturaTela <= 0 || regiao.w <= 0 || regiao.h <= 0) return { escala: 1, tx: 0, ty: 0 };
  const escala = Math.min(larguraTela / (regiao.w * (1 + 2 * folga)), alturaTela / (regiao.h * (1 + 2 * folga)));
  return {
    escala,
    tx: larguraTela / 2 - (regiao.x + regiao.w / 2) * escala,
    ty: alturaTela / 2 - (regiao.y + regiao.h / 2) * escala,
  };
}

/** Escala que mostra o mapa inteiro — o piso do zoom (um pouco abaixo dele). */
export function escalaMinima(c: Pick<Cena, "largura" | "altura">, larguraTela: number, alturaTela: number): number {
  return enquadrar({ x: 0, y: 0, w: Math.max(1, c.largura), h: Math.max(1, c.altura) }, larguraTela, alturaTela).escala * 0.6;
}

/** Zoom em volta do ponto (fx, fy) da tela: o ponto do mapa embaixo do dedo
 *  continua embaixo do dedo. */
export function zoomEm(v: Vista, fx: number, fy: number, fator: number, minimo: number, maximo: number): Vista {
  const escala = Math.min(maximo, Math.max(minimo, v.escala * fator));
  const real = escala / v.escala;
  return { escala, tx: fx - (fx - v.tx) * real, ty: fy - (fy - v.ty) * real };
}

/** Não deixa o mapa sair da tela: sempre sobra um pedaço visível. */
export function limitarVista(v: Vista, c: Pick<Cena, "largura" | "altura">, larguraTela: number, alturaTela: number): Vista {
  const folga = Math.min(larguraTela, alturaTela) * 0.25;
  const wMapa = c.largura * v.escala;
  const hMapa = c.altura * v.escala;
  const tx = Math.min(larguraTela - folga, Math.max(folga - wMapa, v.tx));
  const ty = Math.min(alturaTela - folga, Math.max(folga - hMapa, v.ty));
  return { escala: v.escala, tx, ty };
}

export function regioesIguais(a: Regiao | null, b: Regiao | null): boolean {
  if (!a || !b) return a === b;
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/** A câmera da mesa fica dentro da imagem e com tamanho sensato. */
export function cameraValida(r: Regiao, c: Pick<Cena, "largura" | "altura">): Regiao | null {
  const x = Math.max(0, r.x);
  const y = Math.max(0, r.y);
  const w = Math.min(c.largura, r.x + r.w) - x;
  const h = Math.min(c.altura, r.y + r.h) - y;
  if (w < 8 || h < 8) return null;
  return { x: round2(x), y: round2(y), w: round2(w), h: round2(h) };
}
