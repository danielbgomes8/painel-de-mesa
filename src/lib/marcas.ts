/**
 * Desenhos e notas no mapa — as regras puras: o que vem do banco, o que cada
 * pessoa enxerga, o traço simplificado antes de gravar, qual marca está sob o
 * dedo (borracha) e como as notas são numeradas.
 *
 * Só o Mestre desenha e anota. Cada marca pode ficar só pra ele
 * (`visivel = false`, preparo de sessão) ou aparecer pra mesa. Como a névoa e
 * as paredes, isso esconde NA TELA (ver README, "Segurança").
 */
import type { Ponto } from "./cenas";
import { simplificarTraco } from "./paredes";
import { distanciaAoSegmento } from "./visao";

export type TipoMarca = "traco" | "nota";

/** Uma marca como está no banco (px da imagem da cena). */
export type Marca = {
  id: string;
  cena_id: string;
  room_code: string;
  tipo: TipoMarca;
  cor: string;
  /** Só traço: a linha reta tem dois pontos. */
  pontos: Ponto[];
  /** Só nota: onde fica o alfinete e o que está escrito. */
  x: number;
  y: number;
  texto: string;
  visivel: boolean;
  created_at: string;
};

export type NovaMarca =
  | { tipo: "traco"; cor: string; pontos: Ponto[]; visivel: boolean }
  | { tipo: "nota"; cor: string; x: number; y: number; texto: string; visivel: boolean };

/** O que o Mestre faz com a ferramenta de marcas. */
export type ModoMarca = "livre" | "linha" | "circulo" | "retangulo" | "nota" | "editar" | "apagar";

/** Por cena. Cada marca é redesenhada a cada quadro; passar disso pesa no celular. */
export const MARCAS_MAXIMAS = 300;
/** O banco recusa mais que isso por traço (ver migration 0022). */
export const PONTOS_MAXIMOS_DO_TRACO = 400;
export const TEXTO_MAXIMO_DA_NOTA = 140;
/** Quanto o traço pode se afastar do que o dedo fez ao ser simplificado (px da TELA). */
export const TOLERANCIA_DO_TRACO_PX = 1;
/** Traço menor que isso (px da TELA, do primeiro ao último ponto) é um toque, não um desenho. */
export const TRACO_MINIMO_PX = 6;
/** Quanto perto (px da TELA) o dedo precisa estar de uma marca pra apagá-la. */
export const TOQUE_NA_MARCA_PX = 16;

/** Cores do Mestre: bem distintas entre si e legíveis sobre mapa claro e escuro. */
export const CORES_MARCA = ["#f0c24b", "#e0504f", "#4caf6a", "#4a9ae0", "#b06ad8", "#f5f0e6"] as const;
export const COR_MARCA_PADRAO = CORES_MARCA[0];
const COR_VALIDA = /^#[0-9a-fA-F]{6}$/;

function numero(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function lerPontos(v: unknown): Ponto[] | null {
  if (!Array.isArray(v)) return null;
  const pontos: Ponto[] = [];
  for (const p of v) {
    if (!Array.isArray(p) || p.length < 2) return null;
    const [x, y] = [numero(p[0]), numero(p[1])];
    if (x === null || y === null) return null;
    pontos.push([x, y]);
  }
  return pontos;
}

export function normalizarMarca(linha: unknown): Marca | null {
  if (!linha || typeof linha !== "object") return null;
  const o = linha as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.cena_id !== "string") return null;
  const tipo: TipoMarca | null = o.tipo === "traco" || o.tipo === "nota" ? o.tipo : null;
  if (!tipo) return null;
  const pontos = lerPontos(o.pontos ?? []);
  if (!pontos) return null;
  const x = numero(o.x);
  const y = numero(o.y);
  // Cada tipo exige o seu: traço sem trajeto e nota sem lugar não desenham nada.
  if (tipo === "traco" && pontos.length < 2) return null;
  if (tipo === "nota" && (x === null || y === null)) return null;
  return {
    id: o.id,
    cena_id: o.cena_id,
    room_code: typeof o.room_code === "string" ? o.room_code : "",
    tipo,
    cor: typeof o.cor === "string" && COR_VALIDA.test(o.cor) ? o.cor : COR_MARCA_PADRAO,
    pontos,
    x: x ?? 0,
    y: y ?? 0,
    texto: typeof o.texto === "string" ? o.texto.slice(0, TEXTO_MAXIMO_DA_NOTA) : "",
    visivel: o.visivel !== false,
    created_at: typeof o.created_at === "string" ? o.created_at : "",
  };
}

/** O que cada um enxerga: a mesa só as marcas liberadas; o Mestre, todas. */
export function marcasVisiveis(marcas: readonly Marca[], mestre: boolean): Marca[] {
  return mestre ? [...marcas] : marcas.filter((m) => m.visivel);
}

/** Corta o texto da nota (sem espaço sobrando nas pontas). */
export function textoDaNota(bruto: string): string {
  return bruto.trim().slice(0, TEXTO_MAXIMO_DA_NOTA);
}

/** O que o caminho do dedo (px da imagem) vira ao gravar: sem pontos repetidos,
 *  simplificado (Douglas-Peucker) e, se ainda passar do limite do banco,
 *  afrouxado até caber. `escala` é o zoom de quem desenhou: a tolerância é em
 *  px da tela, então um traço feito com zoom guarda mais detalhe. Menos de dois
 *  pontos distintos não é traço: devolve null. */
export function simplificarDesenho(caminho: readonly Ponto[], escala: number, maximo = PONTOS_MAXIMOS_DO_TRACO): Ponto[] | null {
  const limpos: Ponto[] = [];
  for (const p of caminho) {
    const ult = limpos[limpos.length - 1];
    if (!ult || ult[0] !== p[0] || ult[1] !== p[1]) limpos.push(p);
  }
  if (limpos.length < 2) return null;
  let tol = TOLERANCIA_DO_TRACO_PX / Math.max(escala, 0.01);
  let saida = simplificarTraco(limpos, tol);
  for (let i = 0; saida.length > maximo && i < 40; i++) {
    tol *= 1.5;
    saida = simplificarTraco(limpos, tol);
  }
  return saida.length > maximo ? saida.slice(0, maximo) : saida;
}

/** A linha reta entre dois pontos (null se for um toque, sem comprimento). */
export function linhaReta(a: Ponto, b: Ponto): Ponto[] | null {
  return a[0] === b[0] && a[1] === b[1] ? null : [a, b];
}

/** Lados do polígono que faz as vezes de círculo: 64 passa por redondo até com
 *  zoom no celular, e fica longe do limite de 400 pontos do banco. */
export const LADOS_DO_CIRCULO = 64;

/** Círculo do `centro` até a `borda` (o raio é a distância entre os dois), como um
 *  traço fechado: o último ponto repete o primeiro. Raio zero não é círculo (null). */
export function circuloDe(centro: Ponto, borda: Ponto): Ponto[] | null {
  const raio = Math.hypot(borda[0] - centro[0], borda[1] - centro[1]);
  if (raio === 0) return null;
  const pontos: Ponto[] = [];
  for (let i = 0; i < LADOS_DO_CIRCULO; i++) {
    const ang = (i / LADOS_DO_CIRCULO) * Math.PI * 2;
    pontos.push([centro[0] + raio * Math.cos(ang), centro[1] + raio * Math.sin(ang)]);
  }
  pontos.push([pontos[0][0], pontos[0][1]]);
  return pontos;
}

/** Retângulo de um canto `a` ao oposto `b`, como um traço fechado (cinco pontos).
 *  Sem largura ou sem altura é uma linha, não um retângulo (null). */
export function retanguloDe(a: Ponto, b: Ponto): Ponto[] | null {
  if (a[0] === b[0] || a[1] === b[1]) return null;
  return [a, [b[0], a[1]], b, [a[0], b[1]], [a[0], a[1]]];
}

/** A distância (px da imagem) do ponto até a marca: ao traço mais perto dos
 *  segmentos, ou ao alfinete da nota. */
export function distanciaDaMarca(m: Marca, x: number, y: number): number {
  if (m.tipo === "nota") return Math.hypot(x - m.x, y - m.y);
  let menor = Infinity;
  for (let i = 1; i < m.pontos.length; i++) {
    const d = distanciaAoSegmento(x, y, [m.pontos[i - 1][0], m.pontos[i - 1][1], m.pontos[i][0], m.pontos[i][1]]);
    if (d < menor) menor = d;
  }
  return menor;
}

/** A marca sob o dedo (a mais perto, dentro de `raio` px da imagem); a mais nova ganha o empate. */
export function acharMarcaNoPonto(marcas: readonly Marca[], ponto: Ponto, raio: number): Marca | null {
  let melhor: Marca | null = null;
  let menor = raio;
  for (const m of marcas) {
    const d = distanciaDaMarca(m, ponto[0], ponto[1]);
    if (d <= menor) {
      melhor = m;
      menor = d;
    }
  }
  return melhor;
}

/** Notas na ordem em que foram criadas, com o número que aparece no alfinete e
 *  na lista. Só entram as que `marcas` traz (já filtradas por quem olha), então
 *  a mesa vê 1, 2, 3 sem buraco onde há nota oculta. */
export function notasNumeradas(marcas: readonly Marca[]): { numero: number; marca: Marca }[] {
  return marcas
    .filter((m) => m.tipo === "nota")
    .sort((a, b) => (a.created_at === b.created_at ? 0 : a.created_at < b.created_at ? -1 : 1))
    .map((marca, i) => ({ numero: i + 1, marca }));
}

// ---------------------------------------------------------------------------
// Editar um desenho que já existe (mover, redimensionar, girar). Tudo vira uma
// conta nos mesmos pontos do traço: o círculo é um polígono de 64 lados e o
// retângulo, cinco pontos, então escalar e girar funcionam nos dois sem tipo novo.
// ---------------------------------------------------------------------------

/** O menor desenho que se pode encolher até (px da imagem, lado maior da caixa). */
export const TAMANHO_MINIMO_DO_DESENHO_PX = 12;
/** Quanto (px da TELA) a alça de girar fica acima do topo da caixa. */
export const DISTANCIA_DA_ALCA_DE_GIRAR_PX = 30;
/** Quanto perto (px da TELA) o dedo precisa estar de uma alça pra pegá-la. */
export const TOQUE_NA_ALCA_PX = 20;

export type Caixa = { x1: number; y1: number; x2: number; y2: number };

/** A caixa que envolve os pontos (eixos alinhados com o mapa). */
export function caixaDosPontos(pontos: readonly Ponto[]): Caixa {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const [x, y] of pontos) {
    if (x < x1) x1 = x;
    if (x > x2) x2 = x;
    if (y < y1) y1 = y;
    if (y > y2) y2 = y;
  }
  return { x1, y1, x2, y2 };
}

export function centroDaCaixa(c: Caixa): Ponto {
  return [(c.x1 + c.x2) / 2, (c.y1 + c.y2) / 2];
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

export function moverPontos(pontos: readonly Ponto[], dx: number, dy: number): Ponto[] {
  return pontos.map(([x, y]) => [x + dx, y + dy]);
}

/** Aumenta ou diminui em torno de `centro`, com a mesma proporção nos dois eixos. */
export function escalarPontos(pontos: readonly Ponto[], centro: Ponto, fator: number): Ponto[] {
  return pontos.map(([x, y]) => [centro[0] + (x - centro[0]) * fator, centro[1] + (y - centro[1]) * fator]);
}

/** Gira `angulo` radianos (positivo = sentido horário na tela) em torno de `centro`. */
export function girarPontos(pontos: readonly Ponto[], centro: Ponto, angulo: number): Ponto[] {
  const c = Math.cos(angulo);
  const s = Math.sin(angulo);
  return pontos.map(([x, y]) => {
    const dx = x - centro[0];
    const dy = y - centro[1];
    return [centro[0] + dx * c - dy * s, centro[1] + dx * s + dy * c];
  });
}

/** Deixa o desenho todo dentro da imagem: se for maior que ela, encolhe até caber;
 *  se só estiver pra fora, empurra de volta. Arredonda pra 2 casas (o banco guarda JSON). */
export function manterNoMapa(pontos: readonly Ponto[], largura: number, altura: number): Ponto[] {
  let atual: Ponto[] = pontos.map(([x, y]) => [x, y]);
  const caixa = caixaDosPontos(atual);
  const w = caixa.x2 - caixa.x1;
  const h = caixa.y2 - caixa.y1;
  if (w > largura || h > altura) {
    const fator = Math.min(largura / Math.max(w, 1e-9), altura / Math.max(h, 1e-9));
    atual = escalarPontos(atual, centroDaCaixa(caixa), fator);
  }
  const c = caixaDosPontos(atual);
  let dx = 0;
  let dy = 0;
  if (c.x1 < 0) dx = -c.x1;
  else if (c.x2 > largura) dx = largura - c.x2;
  if (c.y1 < 0) dy = -c.y1;
  else if (c.y2 > altura) dy = altura - c.y2;
  return moverPontos(atual, dx, dy).map(([x, y]) => [arredondar(Math.min(largura, Math.max(0, x))), arredondar(Math.min(altura, Math.max(0, y)))]);
}

/** O fator de escala que não deixa o desenho ficar menor que o mínimo. */
export function fatorPermitido(pontos: readonly Ponto[], fator: number): number {
  const c = caixaDosPontos(pontos);
  const lado = Math.max(c.x2 - c.x1, c.y2 - c.y1);
  if (lado <= 0) return 1;
  return Math.max(fator, TAMANHO_MINIMO_DO_DESENHO_PX / lado);
}

export type AlcaDeMarca = "escala" | "giro";

/** Onde ficam as alças do desenho selecionado (px da imagem): a de redimensionar no canto de
 *  baixo à direita da caixa e a de girar acima do meio do topo. */
export function alcasDaMarca(pontos: readonly Ponto[], escala: number): Record<AlcaDeMarca, Ponto> {
  const c = caixaDosPontos(pontos);
  return {
    escala: [c.x2, c.y2],
    giro: [(c.x1 + c.x2) / 2, c.y1 - DISTANCIA_DA_ALCA_DE_GIRAR_PX / escala],
  };
}

/** A alça sob o dedo (a mais perto, dentro de `raio` px da imagem), ou null. */
export function acharAlca(pontos: readonly Ponto[], escala: number, ponto: Ponto, raio: number): AlcaDeMarca | null {
  const alcas = alcasDaMarca(pontos, escala);
  let melhor: AlcaDeMarca | null = null;
  let menor = raio;
  for (const nome of ["escala", "giro"] as const) {
    const d = Math.hypot(ponto[0] - alcas[nome][0], ponto[1] - alcas[nome][1]);
    if (d <= menor) {
      melhor = nome;
      menor = d;
    }
  }
  return melhor;
}
