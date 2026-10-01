/**
 * Régua em metros — mede a distância entre dois pontos do mapa. Tudo puro.
 *
 * Duas coisas moram em cada cena (editáveis em "Grade e névoa"): o lado do
 * quadradinho em pixels da imagem (`grade_px`) e quantos metros ele vale
 * (`metros`, 1,5 m = 5 pés, o padrão do D&D). A medida em tela não importa:
 * os pontos são sempre em pixels da imagem, então o zoom não muda a conta.
 *
 * Duas formas de medir:
 * - "grade": a regra do jogo. Conferida no texto das Regras Gratuitas 2024
 *   ("Playing on a Grid"): entrar num quadrado vizinho custa 1 quadrado, em linha
 *   reta OU na diagonal, e o alcance se conta "pelo caminho mais curto". Então a
 *   distância é a maior diferença entre as colunas e as linhas dos dois
 *   quadradinhos (a diagonal vale 1, não existe a variante 5-10-5 nessa edição).
 *   Os pontos encaixam no centro do quadradinho.
 * - "reta": a distância em linha reta, pra quando a grade está desligada ou pra
 *   medir fora das regras de grade.
 */
import { celulaNoPonto, gradeUsavel, type Cena, type Ponto } from "./cenas";
import { formatarMetros } from "./regras";
import { COR_PING_MESTRE, CORES_JOGADORES } from "./ping";

export type ModoRegua = "grade" | "reta";

export type CenaParaRegua = Pick<Cena, "grade_ligada" | "grade_px" | "grade_dx" | "grade_dy" | "metros" | "largura" | "altura">;

export type Medida = {
  /** Extremos da linha: no modo grade, os centros dos quadradinhos. */
  a: Ponto;
  b: Ponto;
  /** Quadradinhos de distância (inteiro na grade; com uma casa na reta). */
  quadrados: number;
  metros: number;
  /** O modo que valeu (grade vira reta quando a grade está desligada). */
  modo: ModoRegua;
};

function arredondar(n: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
}

export function medirRegua(cena: CenaParaRegua, de: Ponto, para: Ponto, modo: ModoRegua): Medida {
  const g = cena.grade_px;
  if (modo === "grade" && gradeUsavel(cena)) {
    const ca = celulaNoPonto(cena, de[0], de[1]);
    const cb = celulaNoPonto(cena, para[0], para[1]);
    const centro = (col: number, row: number): Ponto => [cena.grade_dx + (col + 0.5) * g, cena.grade_dy + (row + 0.5) * g];
    const quadrados = Math.max(Math.abs(cb.col - ca.col), Math.abs(cb.row - ca.row));
    return {
      a: centro(ca.col, ca.row),
      b: centro(cb.col, cb.row),
      quadrados,
      metros: arredondar(quadrados * cena.metros, 2),
      modo: "grade",
    };
  }
  const quadrados = Math.hypot(para[0] - de[0], para[1] - de[1]) / g;
  return { a: de, b: para, quadrados: arredondar(quadrados, 1), metros: arredondar(quadrados * cena.metros, 1), modo: "reta" };
}

/** O texto da etiqueta em duas partes: a medida ("4 quadrados · 6 m") e, quando se
 *  sabe o deslocamento de quem está se mexendo, se cabe ou quanto passa. O
 *  desenho põe cada parte numa linha (a etiqueta inteira não cabe na largura de
 *  um celular). */
export function partesDoRotulo(
  m: Pick<Medida, "quadrados" | "metros">,
  deslocamento: number | null = null,
): { principal: string; detalhe: string | null } {
  const q = m.quadrados.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const principal = `${q} ${m.quadrados === 1 ? "quadrado" : "quadrados"} · ${formatarMetros(m.metros)}`;
  if (deslocamento === null || deslocamento <= 0) return { principal, detalhe: null };
  if (m.metros <= deslocamento + 1e-9) return { principal, detalhe: `cabe nos ${formatarMetros(deslocamento)}` };
  return { principal, detalhe: `passa ${formatarMetros(arredondar(m.metros - deslocamento, 2))} dos ${formatarMetros(deslocamento)}` };
}

/** "4 quadrados · 6 m · cabe nos 9 m" numa linha só (o que se lê em voz alta e nos testes). */
export function rotuloDaMedida(m: Pick<Medida, "quadrados" | "metros">, deslocamento: number | null = null): string {
  const { principal, detalhe } = partesDoRotulo(m, deslocamento);
  return detalhe ? `${principal} · ${detalhe}` : principal;
}

// ── Régua que viaja entre aparelhos ────────────────────────────────────────

export const REGUA_DURACAO_MS = 7000;
export const REGUAS_MAXIMAS = 8;
/** Medida menor que isso (px da tela) é um toque, não uma régua. */
export const REGUA_MINIMA_PX = 12;

export type ReguaRecebida = {
  id: string;
  a: Ponto;
  b: Ponto;
  modo: ModoRegua;
  de: string;
  cor: string;
  /** Deslocamento (m) de quem foi medido, se a régua começou num peão. */
  desloc: number | null;
};
export type ReguaNaTela = ReguaRecebida & { chegouEm: number };

const CORES_VALIDAS: ReadonlySet<string> = new Set([COR_PING_MESTRE, ...CORES_JOGADORES]);

function pontoValido(v: unknown, cena: { largura: number; altura: number }): Ponto | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [x, y] = v;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || y < 0 || x > cena.largura || y > cena.altura) return null;
  return [x, y];
}

/** Lê o que chegou pelo canal. A distância NÃO vem no pacote: quem recebe
 *  refaz a conta com a grade da própria cena, então ninguém consegue mostrar um
 *  número falso na tela da mesa. */
export function validarRegua(bruto: unknown, cena: { largura: number; altura: number }): ReguaRecebida | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;
  if (typeof o.id !== "string" || o.id.length === 0 || o.id.length > 64) return null;
  const a = pontoValido(o.a, cena);
  const b = pontoValido(o.b, cena);
  if (!a || !b) return null;
  const modo: ModoRegua | null = o.modo === "grade" || o.modo === "reta" ? o.modo : null;
  if (!modo) return null;
  const nome = typeof o.de === "string" ? o.de.trim().slice(0, 30) : "";
  const cor = typeof o.cor === "string" && CORES_VALIDAS.has(o.cor) ? o.cor : COR_PING_MESTRE;
  const desloc = typeof o.desloc === "number" && Number.isFinite(o.desloc) && o.desloc > 0 && o.desloc <= 200 ? o.desloc : null;
  return { id: o.id, a, b, modo, de: nome || "alguém", cor, desloc };
}

export function reguasAtivas<T extends { chegouEm: number }>(lista: readonly T[], agora: number): T[] {
  return lista.filter((r) => agora - r.chegouEm < REGUA_DURACAO_MS);
}

export function adicionarRegua(lista: readonly ReguaNaTela[], nova: ReguaNaTela): ReguaNaTela[] {
  if (lista.some((r) => r.id === nova.id)) return [...lista];
  return [...reguasAtivas(lista, nova.chegouEm), nova].slice(-REGUAS_MAXIMAS);
}

/** Opacidade da régua `idadeMs` depois de chegar: firme e some no último quarto; null = acabou. */
export function opacidadeDaRegua(idadeMs: number): number | null {
  if (idadeMs < 0 || idadeMs >= REGUA_DURACAO_MS) return null;
  const inicioDoFim = REGUA_DURACAO_MS * 0.75;
  return idadeMs < inicioDoFim ? 1 : 1 - (idadeMs - inicioDoFim) / (REGUA_DURACAO_MS - inicioDoFim);
}
