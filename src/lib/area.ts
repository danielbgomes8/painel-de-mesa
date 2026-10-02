/**
 * Modelos de magia no mapa — cone, esfera, cubo e linha. Qualquer pessoa
 * escolhe a forma e o tamanho em metros, arrasta no mapa, e a mesa inteira vê a
 * área por alguns segundos (como a régua: viaja pelo canal de transmissão, não
 * grava nada). Tudo puro.
 *
 * As formas seguem o Rules Glossary das Regras Gratuitas 2024, conferido no
 * texto bruto da página ("Area of Effect", "Cone", "Cube", "Line", "Sphere"):
 * - Cone: a largura em qualquer ponto é igual à distância daquele ponto até a
 *   origem (então na ponta de um cone de 9 m a largura também é 9 m). A origem
 *   é a ponta e, por padrão, não entra na área.
 * - Cubo: a origem fica em qualquer lugar de UMA FACE; o tamanho é o lado. Aqui
 *   a origem é o meio de uma face e o cubo segue na direção arrastada.
 * - Linha: sai da origem em linha reta, com comprimento e largura definidos pela
 *   magia (5 pés = 1,5 m de largura é o comum).
 * - Esfera: a origem é o CENTRO; o tamanho é o raio. (O cilindro, visto de cima,
 *   é o mesmo círculo.)
 * Emanação (a área acompanha uma criatura) não está aqui: ela se move com o
 * peão e fica pra outra etapa.
 *
 * Como na régua, tamanhos viajam em METROS e quem recebe converte com a grade da
 * PRÓPRIA cena: o zoom e o tamanho da tela não entram na conta, e ninguém consegue
 * mandar uma figura de tamanho falso.
 */
import { gradeUsavel, type Cena, type Ponto } from "./cenas";
import { formatarMetros } from "./regras";
import { COR_PING_MESTRE, CORES_JOGADORES } from "./ping";

export type FormaArea = "cone" | "esfera" | "cubo" | "linha";
export const FORMAS_AREA: readonly FormaArea[] = ["cone", "esfera", "cubo", "linha"];

export const NOME_DA_FORMA: Record<FormaArea, string> = {
  cone: "Cone",
  esfera: "Esfera",
  cubo: "Cubo",
  linha: "Linha",
};

/** O que `metros` quer dizer em cada forma (pra rotular o campo e a figura). */
export const MEDIDA_DA_FORMA: Record<FormaArea, string> = {
  cone: "comprimento",
  esfera: "raio",
  cubo: "lado",
  linha: "comprimento",
};

/** Tamanhos prontos em metros (5 pés = 1,5 m): os que as magias mais usam. */
export const TAMANHOS_PRONTOS: Record<FormaArea, readonly number[]> = {
  cone: [4.5, 9, 18, 27],
  esfera: [1.5, 3, 4.5, 6, 9, 12],
  cubo: [1.5, 3, 4.5, 6, 9],
  linha: [9, 18, 30, 36],
};
export const TAMANHO_PADRAO: Record<FormaArea, number> = { cone: 4.5, esfera: 6, cubo: 4.5, linha: 30 };
export const LARGURAS_DA_LINHA: readonly number[] = [1.5, 3, 6];
export const LARGURA_PADRAO_DA_LINHA = 1.5;

/** O que a pessoa escolheu: a forma, o tamanho e (só na linha) a largura. */
export type ModeloArea = { forma: FormaArea; metros: number; largura: number };

export const MODELO_INICIAL: ModeloArea = { forma: "esfera", metros: TAMANHO_PADRAO.esfera, largura: LARGURA_PADRAO_DA_LINHA };

/** Troca de forma já com o tamanho que costuma servir pra ela. */
export function trocarForma(modelo: ModeloArea, forma: FormaArea): ModeloArea {
  return { ...modelo, forma, metros: TAMANHO_PADRAO[forma] };
}

export const METROS_MAXIMO = 200;
export const LARGURA_MAXIMA = 60;
/** Um número digitado (ou vindo de fora) que dá pra usar como tamanho, ou null. */
export function metrosValidos(v: unknown, maximo = METROS_MAXIMO): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > maximo) return null;
  return Math.round(v * 100) / 100;
}

export type CenaParaArea = Pick<Cena, "grade_ligada" | "grade_px" | "grade_dx" | "grade_dy" | "metros" | "largura" | "altura">;

/** Metros → pixels da imagem, pela grade da cena. */
export function metrosParaPx(cena: Pick<Cena, "grade_px" | "metros">, metros: number): number {
  return cena.metros > 0 ? (metros * cena.grade_px) / cena.metros : 0;
}

/** O cruzamento de linhas da grade mais perto do ponto (a origem de uma magia
 *  costuma ser um canto de quadradinho). Sem grade, o próprio ponto. Nunca sai do mapa. */
export function cruzamentoMaisPerto(cena: CenaParaArea, p: Ponto): Ponto {
  const [x, y] = p;
  if (!gradeUsavel(cena)) return [x, y];
  const g = cena.grade_px;
  const col = Math.round((x - cena.grade_dx) / g);
  const row = Math.round((y - cena.grade_dy) / g);
  return [
    Math.min(cena.largura, Math.max(0, cena.grade_dx + col * g)),
    Math.min(cena.altura, Math.max(0, cena.grade_dy + row * g)),
  ];
}

export type FormaNoMapa =
  | { tipo: "circulo"; centro: Ponto; raio: number }
  | { tipo: "poligono"; pontos: Ponto[] };

/** O que uma área é, em px da imagem: um círculo ou um polígono. `d` só dá a
 *  direção (de `o` pra `d`); sem direção (mesmo ponto), aponta pra direita. */
export function formaNoMapa(
  cena: Pick<Cena, "grade_px" | "metros">,
  area: { forma: FormaArea; o: Ponto; d: Ponto; metros: number; largura: number },
): FormaNoMapa {
  const [ox, oy] = area.o;
  const comprimento = metrosParaPx(cena, area.metros);
  if (area.forma === "esfera") return { tipo: "circulo", centro: [ox, oy], raio: comprimento };

  let ux = area.d[0] - ox;
  let uy = area.d[1] - oy;
  const t = Math.hypot(ux, uy);
  if (t < 1e-6) {
    ux = 1;
    uy = 0;
  } else {
    ux /= t;
    uy /= t;
  }
  const nx = -uy;
  const ny = ux;
  const ponto = (frente: number, lado: number): Ponto => [ox + ux * frente + nx * lado, oy + uy * frente + ny * lado];

  if (area.forma === "cone") {
    // Largura = distância: na ponta, metade da largura de cada lado.
    return { tipo: "poligono", pontos: [ponto(0, 0), ponto(comprimento, comprimento / 2), ponto(comprimento, -comprimento / 2)] };
  }
  const meiaLargura = (area.forma === "cubo" ? comprimento : metrosParaPx(cena, area.largura)) / 2;
  return {
    tipo: "poligono",
    pontos: [ponto(0, meiaLargura), ponto(comprimento, meiaLargura), ponto(comprimento, -meiaLargura), ponto(0, -meiaLargura)],
  };
}

// ── Quem está dentro ───────────────────────────────────────────────────────

/** Uma criatura pra conta de "quem está na área": o centro, o raio do espaço dela
 *  (px da imagem) e se a MESA a enxerga (não oculta e fora da névoa). */
export type CriaturaParaArea = { x: number; y: number; raio: number; naMesa: boolean };

function distanciaAoLado(px: number, py: number, a: Ponto, b: Ponto): number {
  const sx = b[0] - a[0];
  const sy = b[1] - a[1];
  const quad = sx * sx + sy * sy;
  const k = quad === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * sx + (py - a[1]) * sy) / quad));
  return Math.hypot(px - (a[0] + k * sx), py - (a[1] + k * sy));
}

function pontoNoPoligono(px: number, py: number, pontos: readonly Ponto[]): boolean {
  let dentro = false;
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const [xi, yi] = pontos[i];
    const [xj, yj] = pontos[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** O espaço da criatura (um círculo de `raio` em volta do centro) toca a figura?
 *  É a regra do D&D: está na área quem tem QUALQUER PARTE do espaço dentro dela. */
export function areaToca(figura: FormaNoMapa, c: Pick<CriaturaParaArea, "x" | "y" | "raio">): boolean {
  if (figura.tipo === "circulo") return Math.hypot(c.x - figura.centro[0], c.y - figura.centro[1]) <= figura.raio + c.raio;
  const { pontos } = figura;
  if (pontoNoPoligono(c.x, c.y, pontos)) return true;
  for (let i = 0; i < pontos.length; i++) {
    if (distanciaAoLado(c.x, c.y, pontos[i], pontos[(i + 1) % pontos.length]) <= c.raio) return true;
  }
  return false;
}

/** Quantas criaturas a área pega: `mesa` = as que a mesa enxerga (é o número que todo
 *  mundo vê, pra não entregar peão oculto); `ocultos` = as que estão dentro mas a mesa
 *  não enxerga (só o Mestre vê esse número). */
export function contagemNaArea(figura: FormaNoMapa, criaturas: readonly CriaturaParaArea[]): { mesa: number; ocultos: number } {
  let mesa = 0;
  let ocultos = 0;
  for (const c of criaturas) {
    if (!areaToca(figura, c)) continue;
    if (c.naMesa) mesa++;
    else ocultos++;
  }
  return { mesa, ocultos };
}

/** A contagem em texto curto: "3 criaturas", "1 criatura", "ninguém". Pro Mestre, os
 *  ocultos entram à parte: "2 criaturas (+1 oculto)". Quem não é Mestre nunca vê o `+`. */
export function rotuloDaContagem(c: { mesa: number; ocultos: number }, mestre: boolean): string {
  const base = c.mesa === 0 ? "ninguém" : `${c.mesa} ${c.mesa === 1 ? "criatura" : "criaturas"}`;
  if (!mestre || c.ocultos === 0) return base;
  return `${base} (+${c.ocultos} ${c.ocultos === 1 ? "oculto" : "ocultos"})`;
}

/** A figura em texto curto: "Cone · 9 m", "Esfera · raio 6 m", "Linha · 30 m × 1,5 m". */
export function rotuloDaArea(a: { forma: FormaArea; metros: number; largura: number }): string {
  const m = formatarMetros(a.metros);
  switch (a.forma) {
    case "cone":
      return `Cone · ${m}`;
    case "esfera":
      return `Esfera · raio ${m}`;
    case "cubo":
      return `Cubo · lado ${m}`;
    case "linha":
      return `Linha · ${m} × ${formatarMetros(a.largura)}`;
  }
}

/** Quantos quadradinhos o tamanho tem (pra dizer "= 4 quadrados" ao lado dos metros). */
export function quadradosDoTamanho(cena: Pick<Cena, "metros">, metros: number): number {
  return cena.metros > 0 ? Math.round((metros / cena.metros) * 10) / 10 : 0;
}

// ── Área que viaja entre aparelhos ─────────────────────────────────────────

export const AREA_DURACAO_MS = 9000;
export const AREAS_MAXIMAS = 6;

export type AreaRecebida = {
  id: string;
  forma: FormaArea;
  /** Origem (px da imagem). Na esfera, o centro. */
  o: Ponto;
  /** Pra onde aponta (px da imagem); só dá a direção. */
  d: Ponto;
  metros: number;
  largura: number;
  de: string;
  cor: string;
};
export type AreaNaTela = AreaRecebida & { chegouEm: number };

const CORES_VALIDAS: ReadonlySet<string> = new Set([COR_PING_MESTRE, ...CORES_JOGADORES]);

function pontoValido(v: unknown, cena: { largura: number; altura: number }): Ponto | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [x, y] = v;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || y < 0 || x > cena.largura || y > cena.altura) return null;
  return [x, y];
}

/** Lê o que chegou pelo canal; null se não for uma área de verdade. O canal é
 *  aberto, então forma, tamanho e cor são conferidos (cor fora da paleta vira a
 *  do Mestre, nunca vai pro desenho como veio). */
export function validarArea(bruto: unknown, cena: { largura: number; altura: number }): AreaRecebida | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;
  if (typeof o.id !== "string" || o.id.length === 0 || o.id.length > 64) return null;
  const forma = FORMAS_AREA.find((f) => f === o.forma);
  if (!forma) return null;
  const origem = pontoValido(o.o, cena);
  const direcao = pontoValido(o.d, cena);
  if (!origem || !direcao) return null;
  const metros = metrosValidos(o.metros);
  if (metros === null) return null;
  const largura = o.largura === undefined ? LARGURA_PADRAO_DA_LINHA : metrosValidos(o.largura, LARGURA_MAXIMA);
  if (largura === null) return null;
  const nome = typeof o.de === "string" ? o.de.trim().slice(0, 30) : "";
  const cor = typeof o.cor === "string" && CORES_VALIDAS.has(o.cor) ? o.cor : COR_PING_MESTRE;
  return { id: o.id, forma, o: origem, d: direcao, metros, largura, de: nome || "alguém", cor };
}

export function areasAtivas<T extends { chegouEm: number }>(lista: readonly T[], agora: number): T[] {
  return lista.filter((a) => agora - a.chegouEm < AREA_DURACAO_MS);
}

/** Cada pessoa tem UMA figura na tela por vez: a nova substitui a anterior dela
 *  (várias empilhadas, com as etiquetas por cima umas das outras, viravam
 *  bagunça — achado nas fotos). Figuras de pessoas diferentes convivem. */
export function adicionarArea(lista: readonly AreaNaTela[], nova: AreaNaTela): AreaNaTela[] {
  if (lista.some((a) => a.id === nova.id)) return [...lista];
  return [...areasAtivas(lista, nova.chegouEm).filter((a) => a.de !== nova.de), nova].slice(-AREAS_MAXIMAS);
}

/** Opacidade da área `idadeMs` depois de chegar: firme e some no último quarto; null = acabou. */
export function opacidadeDaArea(idadeMs: number): number | null {
  if (idadeMs < 0 || idadeMs >= AREA_DURACAO_MS) return null;
  const inicioDoFim = AREA_DURACAO_MS * 0.75;
  return idadeMs < inicioDoFim ? 1 : 1 - (idadeMs - inicioDoFim) / (AREA_DURACAO_MS - inicioDoFim);
}
