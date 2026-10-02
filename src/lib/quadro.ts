/**
 * Quadro da Campanha — as regras puras: o que vem do banco, o que cada pessoa
 * enxerga de cada cartão, quem pode editar e como as colunas se ordenam.
 *
 * Duas famílias de cartão:
 *  - da mesa (`dono` nulo): o Mestre cria e controla, e a `revelacao` decide o
 *    que a mesa vê — escondido (nada), silhueta (foto escura e "???") ou
 *    revelado (tudo). Cartão escondido é o rascunho/preparo do Mestre.
 *  - pessoal (`dono` = slug do jogador): o jogador anota o que quiser. Só ele
 *    vê, a não ser que marque como compartilhado (`revelacao = "revelado"`).
 *
 * Como a névoa e as marcas do mapa, isso esconde NA TELA: o banco é aberto
 * (ver README, "Segurança").
 */
import type { Identidade } from "./identidade";

export const TIPOS_DE_CARTAO = [
  { id: "npc", rotulo: "NPC", emoji: "🧑" },
  { id: "vilao", rotulo: "Vilão", emoji: "🦹" },
  { id: "local", rotulo: "Local", emoji: "🏰" },
  { id: "faccao", rotulo: "Facção", emoji: "⚔️" },
  { id: "item", rotulo: "Item", emoji: "🗝️" },
  { id: "pista", rotulo: "Pista", emoji: "🔎" },
  { id: "missao", rotulo: "Missão", emoji: "📜" },
  { id: "outro", rotulo: "Outro", emoji: "📌" },
] as const;

export type TipoCartao = (typeof TIPOS_DE_CARTAO)[number]["id"];
export type Revelacao = "escondido" | "silhueta" | "revelado";

export type Cartao = {
  id: string;
  room_code: string;
  tipo: TipoCartao;
  titulo: string;
  subtitulo: string;
  /** Caminho da foto no bucket `mapas`, ou nulo. */
  foto: string | null;
  /** O que a mesa lê. */
  texto: string;
  /** Só o Mestre vê (e só nos cartões da mesa). */
  segredo: string;
  revelacao: Revelacao;
  /** Nulo = cartão da mesa; senão, o slug do jogador dono. */
  dono: string | null;
  /** Nome da coluna na visão em colunas ("" = sem coluna). */
  coluna: string;
  /** Quando o Mestre mandou "mostrar à mesa agora" (só muda; nunca apaga). */
  destaque_em: string | null;
  created_at: string;
};

export type NovoCartao = Pick<Cartao, "tipo" | "titulo" | "dono"> & Partial<Pick<Cartao, "subtitulo" | "texto" | "segredo" | "revelacao" | "coluna">>;

export const LIMITE_TITULO = 80;
export const LIMITE_SUBTITULO = 80;
export const LIMITE_TEXTO = 1500;
export const LIMITE_COLUNA = 30;
/** Por sala. Cada cartão com foto é uma imagem baixada em cada celular. */
export const CARTOES_MAXIMOS = 200;
/** A foto de cartão é retrato, não mapa: 1200 px bastam e poupam o 4G da mesa. */
export const LADO_MAXIMO_FOTO = 1200;

const IDS_DE_TIPO = new Set<string>(TIPOS_DE_CARTAO.map((t) => t.id));
const REVELACOES = new Set<string>(["escondido", "silhueta", "revelado"]);

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

export function normalizarCartao(linha: unknown): Cartao | null {
  if (!linha || typeof linha !== "object") return null;
  const l = linha as Record<string, unknown>;
  if (typeof l.id !== "string" || typeof l.room_code !== "string") return null;
  return {
    id: l.id,
    room_code: l.room_code,
    tipo: typeof l.tipo === "string" && IDS_DE_TIPO.has(l.tipo) ? (l.tipo as TipoCartao) : "outro",
    titulo: texto(l.titulo, LIMITE_TITULO),
    subtitulo: texto(l.subtitulo, LIMITE_SUBTITULO),
    foto: typeof l.foto === "string" && l.foto ? l.foto : null,
    texto: texto(l.texto, LIMITE_TEXTO),
    segredo: texto(l.segredo, LIMITE_TEXTO),
    revelacao: typeof l.revelacao === "string" && REVELACOES.has(l.revelacao) ? (l.revelacao as Revelacao) : "escondido",
    dono: typeof l.dono === "string" && l.dono ? l.dono : null,
    coluna: texto(l.coluna, LIMITE_COLUNA),
    destaque_em: typeof l.destaque_em === "string" && l.destaque_em ? l.destaque_em : null,
    created_at: typeof l.created_at === "string" ? l.created_at : "",
  };
}

export function rotuloDoTipo(tipo: TipoCartao): string {
  return TIPOS_DE_CARTAO.find((t) => t.id === tipo)?.rotulo ?? "Outro";
}
export function emojiDoTipo(tipo: TipoCartao): string {
  return TIPOS_DE_CARTAO.find((t) => t.id === tipo)?.emoji ?? "📌";
}

// ── Quem enxerga o quê ───────────────────────────────────────────────────

/** `completo` = tudo que a mesa pode ler; `silhueta` = foto escura e "???";
 *  `null` = o cartão nem aparece. */
export type Visao = "completo" | "silhueta" | null;

/** Telão e quem ainda não escolheu personagem entram como `null`: veem só o
 *  que a mesa inteira vê. */
export function visaoDoCartao(c: Cartao, quem: Identidade | null): Visao {
  const souMestre = quem?.tipo === "mestre";
  const meuSlug = quem?.tipo === "jogador" ? quem.slug : null;

  if (c.dono === null) {
    if (souMestre) return "completo";
    if (c.revelacao === "revelado") return "completo";
    if (c.revelacao === "silhueta") return "silhueta";
    return null;
  }
  // Pessoal: o dono vê sempre; os outros (Mestre inclusive) só se compartilhado.
  if (meuSlug !== null && c.dono === meuSlug) return "completo";
  return c.revelacao === "revelado" ? "completo" : null;
}

/** O Mestre edita os cartões da mesa; o jogador, os próprios. */
export function podeEditarCartao(c: Cartao, quem: Identidade | null): boolean {
  if (quem?.tipo === "mestre") return c.dono === null;
  if (quem?.tipo === "jogador") return c.dono === quem.slug;
  return false;
}

/** O segredo só existe nos cartões da mesa, e só o Mestre o lê. */
export function podeVerSegredo(c: Cartao, quem: Identidade | null): boolean {
  return quem?.tipo === "mestre" && c.dono === null;
}

export type CartaoVisto = { cartao: Cartao; visao: Exclude<Visao, null> };

export function cartoesVisiveis(cartoes: Cartao[], quem: Identidade | null): CartaoVisto[] {
  const lista: CartaoVisto[] = [];
  for (const cartao of cartoes) {
    const visao = visaoDoCartao(cartao, quem);
    if (visao) lista.push({ cartao, visao });
  }
  return lista;
}

/** O que mostrar no lugar do título/subtítulo/texto de um cartão em silhueta. */
export const TITULO_DA_SILHUETA = "???";

// ── Colunas ─────────────────────────────────────────────────────────────

/** Sugestões do campo de coluna; também a ordem em que aparecem. */
export const COLUNAS_SUGERIDAS = ["Conhecidos", "Suspeitos", "Missões", "Locais", "Facções", "Itens"] as const;
export const SEM_COLUNA = "Sem coluna";

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Ordem das colunas: as sugeridas (na ordem delas), depois as do Mestre em
 *  ordem alfabética, e "Sem coluna" por último. */
export function ordenarColunas(nomes: string[]): string[] {
  const unicos = [...new Set(nomes.map((n) => n.trim()))];
  const posicao = (n: string) => COLUNAS_SUGERIDAS.findIndex((s) => semAcento(s) === semAcento(n));
  return unicos.sort((a, b) => {
    if (a === "") return 1;
    if (b === "") return -1;
    const pa = posicao(a);
    const pb = posicao(b);
    if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    return semAcento(a).localeCompare(semAcento(b));
  });
}

export type ColunaDoQuadro = { nome: string; cartoes: CartaoVisto[] };

export function agruparPorColuna(lista: CartaoVisto[]): ColunaDoQuadro[] {
  const mapa = new Map<string, CartaoVisto[]>();
  for (const v of lista) {
    const nome = v.cartao.coluna.trim();
    mapa.set(nome, [...(mapa.get(nome) ?? []), v]);
  }
  return ordenarColunas([...mapa.keys()]).map((nome) => ({ nome: nome || SEM_COLUNA, cartoes: mapa.get(nome) ?? [] }));
}

/** Filtro por tipo; `null` = todos. */
export function filtrarPorTipo(lista: CartaoVisto[], tipo: TipoCartao | null): CartaoVisto[] {
  return tipo ? lista.filter((v) => v.cartao.tipo === tipo) : lista;
}

// ── Destaque ("mostrar à mesa agora") ───────────────────────────────────

/** O cartão que acabou de ser mostrado à mesa? Compara com o que este aparelho
 *  já tinha: só conta se o `destaque_em` MUDOU (não depende do relógio do
 *  aparelho) e se a pessoa tem mesmo o que ver — silhueta não vira tela cheia. */
export function virouDestaque(antes: Cartao | undefined, depois: Cartao, quem: Identidade | null): boolean {
  if (!depois.destaque_em) return false;
  // O banco devolve o horário em outro formato que o do aparelho que escreveu:
  // compara o instante, não o texto.
  if (antes?.destaque_em && Date.parse(antes.destaque_em) === Date.parse(depois.destaque_em)) return false;
  return visaoDoCartao(depois, quem) === "completo";
}

// ── Foto ────────────────────────────────────────────────────────────────

/** Cada foto tem caminho próprio (com um sufixo): trocar a foto muda o endereço,
 *  então o cache de um ano do Storage nunca mostra a antiga. */
export function caminhoDaFoto(codigoSala: string, idCartao: string, sufixo: string): string {
  return `${codigoSala}/quadro/${idCartao}-${sufixo}.jpg`;
}
