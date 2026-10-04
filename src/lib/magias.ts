/**
 * Magias do personagem — as regras puras: achar o espaço de magia certo,
 * gastar, ligar a concentração, agrupar por nível. A tela só chama estas
 * funções (ver `MagiasPersonagem.tsx`).
 *
 * Os espaços de magia NÃO são um campo novo: já moram em `resources`, com o
 * nome "Espaço de magia Nv. N" (é o que a calculadora de classe gera — ver
 * `PREFIXO_ESPACO_MAGIA` em regras.ts). Conjurar só mexe nesses recursos e na
 * concentração que a ficha já tem (`concentration`/`concentration_on`).
 */
import { PREFIXO_ESPACO_MAGIA } from "./regras";
import type { ClasseBase, ClassePersonagem, MagiaPersonagem, Recurso } from "./tipos";

export const NIVEL_MAXIMO_MAGIA = 9;

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

export function normalizarMagia(v: unknown): MagiaPersonagem {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const n = typeof o.nivel === "number" && Number.isFinite(o.nivel) ? Math.round(o.nivel) : 0;
  return {
    nome: texto(o.nome, 80),
    nivel: Math.max(0, Math.min(NIVEL_MAXIMO_MAGIA, n)),
    preparada: o.preparada === true,
    concentracao: o.concentracao === true,
    ritual: o.ritual === true,
    escola: texto(o.escola, 30),
    tempo: texto(o.tempo, 40),
    alcance: texto(o.alcance, 40),
    duracao: texto(o.duracao, 60),
    componentes: texto(o.componentes, 200),
    descricao: texto(o.descricao, 4000),
  };
}

export function normalizarMagias(v: unknown): MagiaPersonagem[] {
  return Array.isArray(v) ? v.map(normalizarMagia) : [];
}

export function magiaNova(nome: string, nivel = 0): MagiaPersonagem {
  return {
    nome,
    nivel,
    preparada: false,
    concentracao: false,
    ritual: false,
    escola: "",
    tempo: "",
    alcance: "",
    duracao: "",
    componentes: "",
    descricao: "",
  };
}

export function rotuloDeNivel(nivel: number): string {
  return nivel === 0 ? "Truques" : `${nivel}º nível`;
}

/** Um espaço de magia lido dos recursos: o nível dele, o que sobra e o máximo. */
export type EspacoDeMagia = { nivel: number; cur: number; max: number; indice: number; curto: boolean };

/** Lê os espaços de magia dos recursos (ordem crescente de nível). Recurso que
 *  não segue o nome "Espaço de magia Nv. N" é de outra coisa e fica de fora. */
export function espacosDosRecursos(recursos: Recurso[]): EspacoDeMagia[] {
  const espacos: EspacoDeMagia[] = [];
  recursos.forEach((r, indice) => {
    if (!r.name.startsWith(PREFIXO_ESPACO_MAGIA)) return;
    const nivel = Number.parseInt(r.name.slice(PREFIXO_ESPACO_MAGIA.length), 10);
    if (!Number.isInteger(nivel) || nivel < 1 || nivel > NIVEL_MAXIMO_MAGIA) return;
    espacos.push({ nivel, cur: r.cur, max: r.max, indice, curto: r.short_rest });
  });
  return espacos.sort((a, b) => a.nivel - b.nivel);
}

/** Espaços em que a magia pode ser conjurada agora: do nível dela pra cima,
 *  só os que ainda têm uso. Vazio = sem espaço pra essa magia. */
export function espacosPossiveis(recursos: Recurso[], magiaNivel: number): EspacoDeMagia[] {
  return espacosDosRecursos(recursos).filter((e) => e.nivel >= magiaNivel && e.cur > 0);
}

/** Gasta um uso do espaço de nível `nivel`. Devolve a lista de recursos nova,
 *  ou null se esse espaço não existe ou já acabou (a tela mostra o aviso). */
export function gastarEspaco(recursos: Recurso[], nivel: number): Recurso[] | null {
  const e = espacosDosRecursos(recursos).find((x) => x.nivel === nivel && x.cur > 0);
  if (!e) return null;
  return recursos.map((r, i) => (i === e.indice ? { ...r, cur: r.cur - 1 } : r));
}

/** Devolve um uso ao espaço de nível `nivel` (desfazer um gasto errado), sem passar do máximo. */
export function devolverEspaco(recursos: Recurso[], nivel: number): Recurso[] | null {
  const e = espacosDosRecursos(recursos).find((x) => x.nivel === nivel && x.cur < x.max);
  if (!e) return null;
  return recursos.map((r, i) => (i === e.indice ? { ...r, cur: r.cur + 1 } : r));
}

export type EstadoConjuracao = {
  resources: Recurso[];
  concentration: boolean;
  concentration_on: string;
};

export type ResultadoConjuracao = {
  /** Os campos da ficha que mudam, prontos pro `patch` (só os que mudaram). */
  mudanca: Partial<EstadoConjuracao>;
  /** O que foi feito, em uma frase, pro log e pra confirmação na tela. */
  resumo: string;
  /** Concentração que foi interrompida pra segurar esta magia, se havia outra. */
  largouConcentracao: string | null;
};

/**
 * Conjura uma magia.
 *  - Truque (nível 0): não gasta espaço.
 *  - Ritual (`comoRitual`): não gasta espaço (vale só pra magia com a marca ritual).
 *  - Senão gasta um espaço de `nivelDoEspaco` (≥ nível da magia); sem espaço, devolve null.
 *  - Se a magia exige concentração, liga a concentração e passa a apontar pra ela; se já
 *    havia outra, a anterior é largada (regra do livro: só uma por vez) e avisada.
 */
export function conjurar(
  estado: EstadoConjuracao,
  magia: Pick<MagiaPersonagem, "nome" | "nivel" | "concentracao" | "ritual">,
  opcoes: { nivelDoEspaco?: number; comoRitual?: boolean } = {},
): ResultadoConjuracao | null {
  const mudanca: Partial<EstadoConjuracao> = {};
  let resumo = magia.nome;

  if (magia.nivel > 0 && !(opcoes.comoRitual && magia.ritual)) {
    const nivel = opcoes.nivelDoEspaco ?? magia.nivel;
    if (nivel < magia.nivel) return null;
    const resources = gastarEspaco(estado.resources, nivel);
    if (!resources) return null;
    mudanca.resources = resources;
    resumo = nivel > magia.nivel ? `${magia.nome} (espaço de ${nivel}º nível)` : magia.nome;
  } else if (magia.nivel > 0) {
    resumo = `${magia.nome} (ritual)`;
  }

  let largouConcentracao: string | null = null;
  if (magia.concentracao) {
    if (estado.concentration) {
      const antes = estado.concentration_on.trim();
      if (antes && antes.toLowerCase() !== magia.nome.toLowerCase()) largouConcentracao = antes;
      else if (!antes) largouConcentracao = "outra magia";
    }
    mudanca.concentration = true;
    mudanca.concentration_on = magia.nome;
  }

  return { mudanca, resumo, largouConcentracao };
}

/** Magias agrupadas por nível (0 a 9), só os níveis que têm magia, em ordem —
 *  dentro do nível, as preparadas primeiro e depois alfabética. */
export function agruparPorNivel(magias: MagiaPersonagem[]): { nivel: number; magias: { magia: MagiaPersonagem; indice: number }[] }[] {
  const grupos = new Map<number, { magia: MagiaPersonagem; indice: number }[]>();
  magias.forEach((magia, indice) => {
    const lista = grupos.get(magia.nivel) ?? [];
    lista.push({ magia, indice });
    grupos.set(magia.nivel, lista);
  });
  return [...grupos.entries()]
    .sort(([a], [b]) => a - b)
    .map(([nivel, lista]) => ({
      nivel,
      magias: lista.sort((a, b) => {
        if (a.magia.preparada !== b.magia.preparada) return a.magia.preparada ? -1 : 1;
        return a.magia.nome.localeCompare(b.magia.nome, "pt-BR");
      }),
    }));
}

/** Quantas magias de nível 1+ estão preparadas (truque não conta no limite de preparadas). */
export function contarPreparadas(magias: MagiaPersonagem[]): number {
  return magias.filter((m) => m.nivel > 0 && m.preparada).length;
}

/** Magias preparadas por nível de classe (índice 0 = nível 1) — coluna "Prepared
 *  Spells" das tabelas de classe do SRD 5.2, lida da open5e (srd-2024). Só entram as
 *  classes que o SRD traz com a coluna: Guerreiro e Ladino conjuradores vêm de
 *  subclasse (Cavaleiro Arcano, Trapaceiro Arcano) que o SRD não publica, então
 *  ficam sem limite aqui em vez de eu chutar uma tabela. */
const PREPARADAS_POR_CLASSE: Partial<Record<ClasseBase, number[]>> = {
  bardo: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  clerigo: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  druida: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  feiticeiro: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  bruxo: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  mago: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25],
  paladino: [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],
  patrulheiro: [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],
};

export type LimitePreparadas = { total: number; porClasse: { classe: ClasseBase; nivel: number; limite: number }[] };

/** Quantas magias de nível 1+ o personagem pode ter preparadas: soma, por classe, a
 *  coluna "Prepared Spells" do nível dela. Multiclasse soma porque a ficha não guarda de
 *  qual classe é cada magia. null = nenhuma classe com tabela (sem limite a mostrar).
 *  É AVISO, não trava: magia sempre preparada de subclasse/juramento não conta no limite e o
 *  app não sabe quais são. */
export function limiteDePreparadas(classes: ClassePersonagem[]): LimitePreparadas | null {
  const porClasse: LimitePreparadas["porClasse"] = [];
  for (const c of classes) {
    const tabela = PREPARADAS_POR_CLASSE[c.classe];
    if (!tabela || !Number.isFinite(c.nivel) || c.nivel < 1) continue;
    const nivel = Math.min(20, Math.round(c.nivel));
    porClasse.push({ classe: c.classe, nivel, limite: tabela[nivel - 1] });
  }
  if (porClasse.length === 0) return null;
  return { total: porClasse.reduce((s, c) => s + c.limite, 0), porClasse };
}

/** Truques conhecidos por nível de classe (índice 0 = nível 1) — coluna "Cantrips" das
 *  tabelas de classe do SRD 5.2 (open5e, srd-2024). Paladino e Patrulheiro não têm truque. */
const TRUQUES_POR_CLASSE: Partial<Record<ClasseBase, number[]>> = {
  bardo: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  clerigo: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  druida: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  feiticeiro: [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  bruxo: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  mago: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
};

/** Quantos truques o personagem conhece pelas classes: mesma soma e mesmo critério de
 *  `limiteDePreparadas` (aviso, não trava: truque de espécie, talento e subclasse vem de
 *  fora da tabela). null = nenhuma classe com truque na tabela. */
export function limiteDeTruques(classes: ClassePersonagem[]): LimitePreparadas | null {
  const porClasse: LimitePreparadas["porClasse"] = [];
  for (const c of classes) {
    const tabela = TRUQUES_POR_CLASSE[c.classe];
    if (!tabela || !Number.isFinite(c.nivel) || c.nivel < 1) continue;
    const nivel = Math.min(20, Math.round(c.nivel));
    porClasse.push({ classe: c.classe, nivel, limite: tabela[nivel - 1] });
  }
  if (porClasse.length === 0) return null;
  return { total: porClasse.reduce((s, c) => s + c.limite, 0), porClasse };
}

/** Quantos truques a lista tem (todos contam: truque não se prepara). */
export function contarTruques(magias: MagiaPersonagem[]): number {
  return magias.filter((m) => m.nivel === 0).length;
}

/** A magia já está na lista? (mesmo nome, ignorando maiúscula e acento) */
export function jaTemMagia(magias: MagiaPersonagem[], nome: string): boolean {
  const k = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  return magias.some((m) => k(m.nome) === k(nome));
}
