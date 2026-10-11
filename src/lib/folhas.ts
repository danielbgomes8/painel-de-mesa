/**
 * Folhas de entrega — cartas, pergaminhos, o mapa do tesouro: o Mestre escreve (com foto, se quiser), escolhe
 * pra QUEM vai (um jogador ou a mesa toda) e entrega. Quem recebeu lê no celular, na aba Campanha.
 *
 * Só o Mestre cria, edita e entrega. Rascunho (`entregue_em` nulo) só o Mestre vê. Esconde NA TELA, como a névoa
 * e o Quadro: o banco é aberto (README, "Segurança"). O que o Quadro já faz — mostrar uma foto em tela cheia
 * pra mesa toda — continua sendo o "📣 Mostrar à mesa agora" dos cartões; a folha é o que faltava: entregar algo
 * a UM jogador, em segredo.
 */
import type { Identidade } from "./identidade";

export type Folha = {
  id: string;
  room_code: string;
  titulo: string;
  texto: string;
  /** Caminho da foto no bucket "mapas" (`<sala>/folhas/...`); null = sem foto. */
  foto: string | null;
  /** Slug do jogador que recebe; null = a mesa toda. */
  para: string | null;
  /** Quando o Mestre entregou (texto ISO); null = rascunho, só o Mestre vê. */
  entregue_em: string | null;
  created_at: string;
};

export type NovaFolha = Pick<Folha, "titulo" | "texto" | "para">;

export const FOLHAS_MAXIMAS = 60;
export const TITULO_MAXIMO = 80;
export const TEXTO_MAXIMO = 2000;
/** A foto da folha é lida no celular: 1400 px de lado sobra e fica em ~200 KB. */
export const LADO_MAXIMO_DA_FOLHA = 1400;

function cortar(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

export function normalizarFolha(linha: unknown): Folha | null {
  if (!linha || typeof linha !== "object") return null;
  const o = linha as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id) return null;
  return {
    id: o.id,
    room_code: typeof o.room_code === "string" ? o.room_code : "",
    titulo: cortar(o.titulo, TITULO_MAXIMO),
    texto: cortar(o.texto, TEXTO_MAXIMO),
    foto: typeof o.foto === "string" && o.foto ? o.foto : null,
    para: typeof o.para === "string" && o.para ? o.para : null,
    entregue_em: typeof o.entregue_em === "string" && o.entregue_em ? o.entregue_em : null,
    created_at: typeof o.created_at === "string" ? o.created_at : "",
  };
}

export function estaEntregue(f: Pick<Folha, "entregue_em">): boolean {
  return f.entregue_em !== null;
}

/** Título pra mostrar: vazio vira "Folha sem título". */
export function tituloDaFolha(f: Pick<Folha, "titulo">): string {
  return f.titulo.trim() || "Folha sem título";
}

/**
 * O que cada pessoa enxerga: o Mestre, tudo (rascunhos inclusive); o jogador, só o que foi entregue a ele ou à mesa
 * toda; o telão e quem não escolheu quem é, nada. Mais recente primeiro (as entregues pela hora da entrega).
 */
export function folhasVisiveis(folhas: readonly Folha[], quem: Identidade | null): Folha[] {
  const lista =
    quem?.tipo === "mestre"
      ? [...folhas]
      : quem?.tipo === "jogador"
        ? folhas.filter((f) => estaEntregue(f) && (f.para === null || f.para === quem.slug))
        : [];
  const marca = (f: Folha) => f.entregue_em ?? f.created_at;
  return lista.sort((a, b) => marca(b).localeCompare(marca(a)));
}

/** As folhas que este jogador ainda não abriu: entregues a ele (ou à mesa) e fora do conjunto das já vistas. */
export function folhasNovas(folhas: readonly Folha[], slug: string, vistas: ReadonlySet<string>): Folha[] {
  return folhasVisiveis(folhas, { tipo: "jogador", slug }).filter((f) => !vistas.has(f.id));
}

/** "a mesa toda" ou "só Ana" — pro Mestre ver pra quem foi. */
export function rotuloDoDestino(f: Pick<Folha, "para">, nomeDe: (slug: string) => string): string {
  return f.para === null ? "a mesa toda" : `só ${nomeDe(f.para)}`;
}

/** Cada foto tem caminho próprio (com um sufixo): trocar a foto muda o endereço, e o cache de um ano nunca mostra a antiga. */
export function caminhoDaFolha(codigoSala: string, idFolha: string, sufixo: string): string {
  return `${codigoSala}/folhas/${idFolha}-${sufixo}.jpg`;
}

// ── O que o aparelho já viu (só nele; nunca vai ao banco) ───────────────────

const PREFIXO_VISTAS = "mesa-folhas-vistas:";

export function lerVistas(codigo: string, ler: (chave: string) => string | null = (c) => localStorage.getItem(c)): Set<string> {
  try {
    const cru = ler(`${PREFIXO_VISTAS}${codigo}`);
    const lista: unknown = cru ? JSON.parse(cru) : [];
    return new Set(Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function guardarVistas(codigo: string, vistas: ReadonlySet<string>, gravar: (chave: string, valor: string) => void = (c, v) => localStorage.setItem(c, v)): void {
  try {
    // Só as últimas 200: o resto é de folha que já nem existe.
    gravar(`${PREFIXO_VISTAS}${codigo}`, JSON.stringify([...vistas].slice(-200)));
  } catch {
    // sem armazenamento: o aviso reaparece na próxima abertura, e só.
  }
}
