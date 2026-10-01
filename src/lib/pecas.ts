/**
 * Peões no mapa — as fichas e os marcadores sobre a cena. Tudo puro: o banco e
 * o canvas ficam em outro lugar; aqui moram as contas (encaixe na grade, quem
 * pode mover, o que cada pessoa enxerga, o rótulo sem entregar inimigo).
 *
 * Regras que vêm do resto do app e valem aqui também:
 * - NPC não revelado aparece como "?" pra jogador (nunca o nome, igual ao
 *   "Inimigo N" da ordem de iniciativa) e PV de NPC nunca aparece;
 * - o telão e os celulares tratam quem olha como jogador;
 * - peão sob a névoa não aparece pra mesa, a não ser o do próprio jogador.
 */
import { celulaNoPonto, gradeUsavel, ladoDeReferencia, type Cena, type Ponto, type Regiao } from "./cenas";
import { corDoJogador } from "./ping";

export type TamanhoPeca = 1 | 2 | 3 | 4;

/** Um peão como está no banco (x, y = centro, em px da imagem da cena). */
export type Peca = {
  id: string;
  cena_id: string;
  room_code: string;
  /** Ficha ligada (`characters.slug`); null = marcador avulso. */
  slug: string | null;
  nome: string;
  x: number;
  y: number;
  /** Lado em quadradinhos: 1 = pequeno/médio, 2 = grande, 3 = enorme, 4 = imenso. */
  tamanho: TamanhoPeca;
  cor: string | null;
  /** Escondido da mesa; só o Mestre vê. */
  oculto: boolean;
  created_at: string;
};

export type NovaPeca = Pick<Peca, "slug" | "nome" | "x" | "y"> & Partial<Pick<Peca, "tamanho" | "cor" | "oculto">>;

/** O que o canvas desenha: já com rótulo, cor e "é a vez dele" calculados. */
export type PecaNaTela = {
  id: string;
  x: number;
  y: number;
  /** Lado em quadradinhos (1 a 4). */
  tamanho: TamanhoPeca;
  /** Diâmetro em px da imagem. */
  diametro: number;
  /** Letras dentro do peão. */
  rotulo: string;
  /** Nome completo (pra leitor de tela e dica); "?" pra inimigo não revelado. */
  nome: string;
  cor: string;
  oculto: boolean;
  /** É a vez dele na iniciativa. */
  vez: boolean;
  selecionada: boolean;
  /** Quem olha pode arrastá-lo. */
  podeMover: boolean;
  /** Aparece mesmo coberto de névoa (o Mestre vê tudo; o jogador vê o próprio). */
  semNevoa: boolean;
};

export const COR_PECA_INIMIGO = "#c0443a";
export const COR_PECA_MARCADOR = "#8a97a8";
const COR_VALIDA = /^#[0-9a-fA-F]{6}$/;

function numero(v: unknown, padrao: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : padrao;
}

export function normalizarPeca(linha: unknown): Peca | null {
  if (!linha || typeof linha !== "object") return null;
  const o = linha as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.cena_id !== "string") return null;
  const x = typeof o.x === "string" ? Number(o.x) : o.x;
  const y = typeof o.y === "string" ? Number(o.y) : o.y;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const tam = Math.round(numero(o.tamanho, 1));
  return {
    id: o.id,
    cena_id: o.cena_id,
    room_code: typeof o.room_code === "string" ? o.room_code : "",
    slug: typeof o.slug === "string" && o.slug ? o.slug : null,
    nome: typeof o.nome === "string" ? o.nome.slice(0, 30) : "",
    x,
    y,
    tamanho: (tam >= 1 && tam <= 4 ? tam : 1) as TamanhoPeca,
    cor: typeof o.cor === "string" && COR_VALIDA.test(o.cor) ? o.cor : null,
    oculto: o.oculto === true,
    created_at: typeof o.created_at === "string" ? o.created_at : "",
  };
}

// ── Posição ────────────────────────────────────────────────────────────────

/** Diâmetro do peão: um pouco menos que o quadradinho, pra não encostar no vizinho. */
export function diametroDaPeca(c: Pick<Cena, "grade_ligada" | "grade_px" | "largura" | "altura">, tamanho: TamanhoPeca): number {
  return ladoDeReferencia(c) * tamanho * 0.88;
}

/**
 * Encaixa o ponto na grade: peão de tamanho ímpar vai pro CENTRO do
 * quadradinho; de tamanho par (2×2, 4×4) vai pro CRUZAMENTO das linhas, que é
 * onde fica o centro dele. Sem grade, só mantém dentro da imagem.
 */
export function encaixarNaGrade(
  c: Pick<Cena, "grade_ligada" | "grade_px" | "grade_dx" | "grade_dy" | "largura" | "altura">,
  x: number,
  y: number,
  tamanho: TamanhoPeca,
): Ponto {
  const dentro = (px: number, py: number): Ponto => [
    Math.round(Math.min(c.largura, Math.max(0, px)) * 10) / 10,
    Math.round(Math.min(c.altura, Math.max(0, py)) * 10) / 10,
  ];
  if (!gradeUsavel(c)) return dentro(x, y);
  const g = c.grade_px;
  if (tamanho % 2 === 1) {
    const { col, row } = celulaNoPonto(c, x, y);
    return dentro(c.grade_dx + (col + 0.5) * g, c.grade_dy + (row + 0.5) * g);
  }
  return dentro(c.grade_dx + Math.round((x - c.grade_dx) / g) * g, c.grade_dy + Math.round((y - c.grade_dy) / g) * g);
}

/** Posições de partida pra `n` peões novos: numa fileira centrada no meio do
 *  que se está vendo, um por quadradinho. Se esse lugar já tem peão (o grupo
 *  entrou, agora entram os inimigos), a fileira desce — ou sobe — até achar um
 *  trecho livre, em vez de empilhar um peão em cima do outro. */
export function posicoesIniciais(
  c: Pick<Cena, "grade_ligada" | "grade_px" | "grade_dx" | "grade_dy" | "largura" | "altura">,
  n: number,
  regiao: Regiao | null,
  ocupadas: readonly Ponto[] = [],
): Ponto[] {
  const lado = ladoDeReferencia(c);
  const centro: Ponto = regiao ? [regiao.x + regiao.w / 2, regiao.y + regiao.h / 2] : [c.largura / 2, c.altura / 2];
  // Quantos cabem na largura que se vê; o resto desce uma fileira.
  const porLinha = Math.max(1, Math.min(n, regiao ? Math.floor(regiao.w / lado) - 1 : 8, 10));
  const montar = (deslocamentoDeFileiras: number): Ponto[] => {
    const saida: Ponto[] = [];
    for (let i = 0; i < n; i++) {
      const col = i % porLinha;
      const lin = Math.floor(i / porLinha) + deslocamentoDeFileiras;
      const largura = Math.min(n - Math.floor(i / porLinha) * porLinha, porLinha);
      const x = centro[0] + (col - (largura - 1) / 2) * lado;
      const y = centro[1] + lin * lado;
      saida.push(encaixarNaGrade(c, x, y, 1));
    }
    return saida;
  };
  const livre = (ps: Ponto[]) =>
    ps.every(([x, y]) => !ocupadas.some(([ox, oy]) => Math.hypot(x - ox, y - oy) < lado * 0.6));
  // Tenta 0, +1, -1, +2, -2... fileiras de deslocamento; sem trecho livre, fica no primeiro.
  for (let k = 0; k <= 24; k++) {
    for (const d of k === 0 ? [0] : [k, -k]) {
      const ps = montar(d);
      if (livre(ps)) return ps;
    }
  }
  return montar(0);
}

/** O peão mais "por cima" (o último da lista) que contém o ponto, entre os candidatos. */
export function acharPecaNoPonto(pecas: readonly PecaNaTela[], x: number, y: number): PecaNaTela | null {
  for (let i = pecas.length - 1; i >= 0; i--) {
    const p = pecas[i];
    if (Math.hypot(x - p.x, y - p.y) <= p.diametro / 2) return p;
  }
  return null;
}

// ── Quem vê e quem mexe ────────────────────────────────────────────────────

export type Visao = { mestre: boolean; meuSlug: string | null };

/** O Mestre mexe em qualquer peão; o jogador, só no da própria ficha. */
export function podeMoverPeca(peca: Pick<Peca, "slug">, v: Visao): boolean {
  return v.mestre || (peca.slug !== null && peca.slug === v.meuSlug);
}

/** O peão aparece pra esta pessoa? `cobertoDeNevoa` = o centro dele está na névoa. */
export function pecaVisivel(peca: Pick<Peca, "slug" | "oculto">, v: Visao, cobertoDeNevoa: boolean): boolean {
  if (v.mestre) return true;
  if (peca.slug !== null && peca.slug === v.meuSlug) return true;
  return !peca.oculto && !cobertoDeNevoa;
}

// ── Rótulo ─────────────────────────────────────────────────────────────────

/** Letras do peão: "Tibério Vaz" → "TV", "Goblin 2" → "G2", "Milo" → "Mi". */
export function iniciais(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return "?";
  if (palavras.length === 1) {
    const w = palavras[0];
    return w.length === 1 ? w.toUpperCase() : w[0].toUpperCase() + w[1].toLowerCase();
  }
  const ultima = palavras[palavras.length - 1];
  if (/^\d{1,2}$/.test(ultima)) return palavras[0][0].toUpperCase() + ultima;
  return (palavras[0][0] + palavras[1][0]).toUpperCase();
}

type FichaParaPeca = { slug: string; name: string; is_npc: boolean; revealed: boolean };

/** O nome que esta pessoa pode ler no peão: o do marcador, o da ficha, ou "?"
 *  quando é um inimigo que a mesa ainda não conhece. */
export function nomeDaPeca(peca: Pick<Peca, "slug" | "nome">, ficha: FichaParaPeca | undefined, souMestre: boolean): string {
  if (!ficha) return peca.nome || "?";
  if (souMestre || !ficha.is_npc || ficha.revealed) return ficha.name;
  return "?";
}

/** Tudo que o canvas precisa saber de cada peão, do ponto de vista de `visao`. */
export function montarPecasNaTela(entrada: {
  pecas: readonly Peca[];
  cena: Pick<Cena, "grade_ligada" | "grade_px" | "largura" | "altura">;
  fichas: readonly FichaParaPeca[];
  /** Slug de quem tem a vez na iniciativa (ou null). */
  vezDe: string | null;
  slugsDosJogadores: readonly string[];
  visao: Visao;
  selecionadaId: string | null;
}): PecaNaTela[] {
  const { pecas, cena, fichas, vezDe, slugsDosJogadores, visao, selecionadaId } = entrada;
  return pecas.map((p) => {
    const ficha = p.slug ? fichas.find((f) => f.slug === p.slug) : undefined;
    const nome = nomeDaPeca(p, ficha, visao.mestre);
    const cor = p.cor ?? corDoPeca(p, ficha, slugsDosJogadores);
    return {
      id: p.id,
      x: p.x,
      y: p.y,
      tamanho: p.tamanho,
      diametro: diametroDaPeca(cena, p.tamanho),
      rotulo: nome === "?" ? "?" : iniciais(nome),
      nome,
      cor,
      oculto: p.oculto,
      vez: p.slug !== null && p.slug === vezDe,
      selecionada: p.id === selecionadaId,
      podeMover: podeMoverPeca(p, visao),
      semNevoa: visao.mestre || (p.slug !== null && p.slug === visao.meuSlug),
    };
  });
}

/** Jogador com a cor dele (a mesma do ping), inimigo vermelho, marcador cinza. */
function corDoPeca(peca: Pick<Peca, "slug">, ficha: FichaParaPeca | undefined, slugsDosJogadores: readonly string[]): string {
  if (!peca.slug || !ficha) return COR_PECA_MARCADOR;
  if (ficha.is_npc) return COR_PECA_INIMIGO;
  return corDoJogador(peca.slug, slugsDosJogadores, ficha.name);
}

