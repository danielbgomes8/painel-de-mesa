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

/** Quem arrasta o cartão entre colunas: quem edita, e também o Mestre nos cartões
 *  pessoais que o dono compartilhou (organizar o quadro é dele). Só a coluna: o resto do
 *  cartão continua sendo do dono. A coluna é uma só por cartão, então o dono vê a mudança. */
export function podeMoverCartao(c: Cartao, quem: Identidade | null): boolean {
  if (podeEditarCartao(c, quem)) return true;
  return quem?.tipo === "mestre" && c.dono !== null && c.revelacao === "revelado";
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

/** `nome` é o que aparece na tela; `valor` é o que está gravado nos cartões ("" = sem coluna). */
export type ColunaDoQuadro = { nome: string; valor: string; cartoes: CartaoVisto[] };

export function agruparPorColuna(lista: CartaoVisto[]): ColunaDoQuadro[] {
  const mapa = new Map<string, CartaoVisto[]>();
  for (const v of lista) {
    const nome = v.cartao.coluna.trim();
    mapa.set(nome, [...(mapa.get(nome) ?? []), v]);
  }
  return ordenarColunas([...mapa.keys()]).map((valor) => ({ nome: valor || SEM_COLUNA, valor, cartoes: mapa.get(valor) ?? [] }));
}

/** Colunas que a pessoa criou e ainda não têm cartão: ficam na tela (só neste aparelho,
 *  até um cartão ser solto nelas) junto das que vêm dos cartões. */
export function comColunasVazias(colunas: ColunaDoQuadro[], vazias: string[]): ColunaDoQuadro[] {
  const existentes = new Set(colunas.map((c) => c.valor.trim().toLowerCase()));
  const novas = [...new Set(vazias.map((v) => v.trim()).filter(Boolean))].filter((v) => !existentes.has(v.toLowerCase()));
  if (novas.length === 0) return colunas;
  const todas = [...colunas.filter((c) => c.valor !== ""), ...novas.map((valor) => ({ nome: valor, valor, cartoes: [] as CartaoVisto[] }))];
  const ordem = ordenarColunas([...todas.map((c) => c.valor), ...(colunas.some((c) => c.valor === "") ? [""] : [])]);
  const porValor = new Map([...colunas, ...todas].map((c) => [c.valor, c]));
  return ordem.map((v) => porValor.get(v)!).filter(Boolean);
}

/** Nomes de coluna já usados nos cartões (sem repetir, sem vazio). */
export function colunasEmUso(vistos: CartaoVisto[]): string[] {
  return ordenarColunas([...new Set(vistos.map((v) => v.cartao.coluna.trim()).filter(Boolean))]);
}

/** Filtro por tipo; `null` = todos. */
export function filtrarPorTipo(lista: CartaoVisto[], tipo: TipoCartao | null): CartaoVisto[] {
  return tipo ? lista.filter((v) => v.cartao.tipo === tipo) : lista;
}

// ── Destaque ("mostrar à mesa agora") ───────────────────────────────────

/** O cartão que acabou de ser mostrado à mesa? Compara com o que este aparelho
 *  já tinha: só conta se o `destaque_em` MUDOU (não depende do relógio do
 *  aparelho) e se a pessoa enxerga o cartão. Em silhueta vira tela cheia também,
 *  mas só a foto escura e "???" (ver `destaqueEmSilhueta`). */
export function virouDestaque(antes: Cartao | undefined, depois: Cartao, quem: Identidade | null): boolean {
  if (!depois.destaque_em) return false;
  // O banco devolve o horário em outro formato que o do aparelho que escreveu:
  // compara o instante, não o texto.
  if (antes?.destaque_em && Date.parse(antes.destaque_em) === Date.parse(depois.destaque_em)) return false;
  return visaoDoCartao(depois, quem) !== null;
}

/** O destaque de um cartão da mesa que está em silhueta: a tela cheia mostra a
 *  foto escura e "???", sem nome, tipo nem texto. Cartão pessoal nunca é silhueta. */
export function destaqueEmSilhueta(c: Cartao): boolean {
  return c.dono === null && c.revelacao === "silhueta";
}

// ── Foto ────────────────────────────────────────────────────────────────

/** Cada foto tem caminho próprio (com um sufixo): trocar a foto muda o endereço,
 *  então o cache de um ano do Storage nunca mostra a antiga. */
export function caminhoDaFoto(codigoSala: string, idCartao: string, sufixo: string): string {
  return `${codigoSala}/quadro/${idCartao}-${sufixo}.jpg`;
}

// ── Ligações entre cartões ──────────────────────────────────────────────

export type Ligacao = { id: string; room_code: string; de: string; para: string; rotulo: string; created_at: string };

export const LIMITE_ROTULO_LIGACAO = 40;
/** Sugestões do campo de ligação ("Barão Vael → serve a → Culto"). */
export const ROTULOS_SUGERIDOS = ["serve a", "mora em", "aliado de", "inimigo de", "dono de", "parente de"] as const;

export function normalizarLigacao(linha: unknown): Ligacao | null {
  if (!linha || typeof linha !== "object") return null;
  const l = linha as Record<string, unknown>;
  if (typeof l.id !== "string" || typeof l.de !== "string" || typeof l.para !== "string" || l.de === l.para) return null;
  return {
    id: l.id,
    room_code: typeof l.room_code === "string" ? l.room_code : "",
    de: l.de,
    para: l.para,
    rotulo: texto(l.rotulo, LIMITE_ROTULO_LIGACAO),
    created_at: typeof l.created_at === "string" ? l.created_at : "",
  };
}

export type LigacaoVista = {
  ligacao: Ligacao;
  /** O cartão do outro lado, do jeito que ESTA pessoa o enxerga. */
  outro: CartaoVisto;
  /** `saindo`: este cartão → outro ("serve a"); `chegando`: outro → este. */
  sentido: "saindo" | "chegando";
};

/** As ligações de um cartão que esta pessoa pode ver: só entram se o cartão do
 *  outro lado também aparece pra ela (senão a ligação entregaria que ele existe). */
export function ligacoesDoCartao(id: string, ligacoes: Ligacao[], vistos: CartaoVisto[]): LigacaoVista[] {
  const porId = new Map(vistos.map((v) => [v.cartao.id, v]));
  const lista: LigacaoVista[] = [];
  for (const ligacao of ligacoes) {
    if (ligacao.de === id) {
      const outro = porId.get(ligacao.para);
      if (outro) lista.push({ ligacao, outro, sentido: "saindo" });
    } else if (ligacao.para === id) {
      const outro = porId.get(ligacao.de);
      if (outro) lista.push({ ligacao, outro, sentido: "chegando" });
    }
  }
  return lista;
}

/** Já existe essa ligação (mesmo sentido e mesmo rótulo)? Evita duplicar com toque duplo. */
export function ligacaoJaExiste(ligacoes: Ligacao[], de: string, para: string, rotulo: string): boolean {
  const r = rotulo.trim().toLowerCase();
  return ligacoes.some((l) => l.de === de && l.para === para && l.rotulo.trim().toLowerCase() === r);
}

// ── Anotações nos cartões ───────────────────────────────────────────────

export type NotaDoCartao = { id: string; room_code: string; cartao_id: string; autor: string; texto: string; created_at: string };

export const LIMITE_NOTA = 300;
/** `autor` de quem é o Mestre (os jogadores usam o slug da ficha). */
export const AUTOR_MESTRE = "mestre";

export function normalizarNota(linha: unknown): NotaDoCartao | null {
  if (!linha || typeof linha !== "object") return null;
  const l = linha as Record<string, unknown>;
  if (typeof l.id !== "string" || typeof l.cartao_id !== "string" || typeof l.autor !== "string") return null;
  return {
    id: l.id,
    room_code: typeof l.room_code === "string" ? l.room_code : "",
    cartao_id: l.cartao_id,
    autor: l.autor,
    texto: texto(l.texto, LIMITE_NOTA),
    created_at: typeof l.created_at === "string" ? l.created_at : "",
  };
}

export function autorDaPessoa(quem: Identidade | null): string | null {
  if (quem?.tipo === "mestre") return AUTOR_MESTRE;
  if (quem?.tipo === "jogador") return quem.slug;
  return null;
}

/** Todo mundo anota num cartão que enxerga por inteiro (silhueta não: não há o que comentar). */
export function podeAnotar(visao: Visao, quem: Identidade | null): boolean {
  return visao === "completo" && quem !== null;
}

/** Cada um apaga a própria anotação; o Mestre apaga qualquer uma. */
export function podeApagarNota(n: NotaDoCartao, quem: Identidade | null): boolean {
  if (quem?.tipo === "mestre") return true;
  return autorDaPessoa(quem) === n.autor;
}

export function notasDoCartao(id: string, notas: NotaDoCartao[]): NotaDoCartao[] {
  return notas.filter((n) => n.cartao_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// ── Sessões ─────────────────────────────────────────────────────────────

/** Só o que o diário precisa saber de uma sessão. */
export type SessaoComCartoes = { id: string; title: string; created_at: string; cartoes?: string[] | null };

/** Os cartões de uma sessão que esta pessoa vê (cartão apagado ou escondido não aparece). */
export function cartoesDaSessao(sessao: SessaoComCartoes, vistos: CartaoVisto[]): CartaoVisto[] {
  const ids = Array.isArray(sessao.cartoes) ? sessao.cartoes : [];
  const porId = new Map(vistos.map((v) => [v.cartao.id, v]));
  return ids.map((id) => porId.get(id)).filter((v): v is CartaoVisto => Boolean(v));
}

/** As sessões em que um cartão apareceu, da mais recente pra mais antiga. */
export function sessoesDoCartao(id: string, sessoes: SessaoComCartoes[]): SessaoComCartoes[] {
  return sessoes
    .filter((s) => Array.isArray(s.cartoes) && s.cartoes.includes(id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Liga ou desliga um cartão numa sessão (a lista nova, sem repetir). */
export function alternarCartaoNaSessao(atuais: string[] | null | undefined, id: string): string[] {
  const lista = Array.isArray(atuais) ? atuais : [];
  return lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id];
}
