/**
 * Ping no mapa — "olhem aqui". Qualquer pessoa segura o dedo num ponto e a mesa
 * inteira (telão e celulares) vê um pulso ali por alguns segundos, com o nome de
 * quem apontou. Não grava nada no banco: viaja por um canal de transmissão
 * ao vivo (Supabase Realtime "broadcast") e some sozinho.
 *
 * Como vem de outro aparelho, o conteúdo de um ping NUNCA é confiado: passa por
 * `validarPing` antes de ir pra tela.
 */

export const PING_DURACAO_MS = 3600;
/** Um aparelho não pinga mais que isso (cada ping vai pra todo mundo). */
export const PING_INTERVALO_MIN_MS = 700;
/** Quantos pings ficam na tela ao mesmo tempo. */
export const PINGS_MAXIMOS = 12;
/** Tempo com o dedo parado pra virar ping (toque longo). */
export const PING_TOQUE_LONGO_MS = 450;
/** Quanto o dedo pode se mexer (px da tela) e ainda contar como "parado". */
export const PING_TOLERANCIA_PX = 10;

/** Dourado é do Mestre; as outras cores são dos jogadores. Nove cores bem
 *  distintas entre si e legíveis sobre mapa escuro e claro. */
export const COR_PING_MESTRE = "#f0c24b";
export const CORES_JOGADORES = [
  "#e36d5e", // vermelho-coral
  "#5fb0e8", // azul
  "#7ac26f", // verde
  "#c78be0", // roxo
  "#f0955a", // laranja
  "#4fd1c5", // turquesa
  "#e8a0c0", // rosa
  "#b8d94a", // lima
  "#9aa5ff", // lilás-azulado
] as const;
const CORES_VALIDAS: ReadonlySet<string> = new Set([COR_PING_MESTRE, ...CORES_JOGADORES]);

/** Um ping como viaja entre aparelhos (coordenadas em px da imagem da cena). */
export type PingRecebido = { id: string; x: number; y: number; de: string; cor: string };
/** Um ping na tela: quando chegou, pra animar. */
export type PingNaTela = PingRecebido & { chegouEm: number };

/** Cada jogador com a sua cor, pela posição da ficha entre as dos jogadores da
 *  sala: assim dois jogadores nunca repetem cor (até nove), coisa que sortear
 *  pelo nome não garante. Quem não está na lista (ficha removida) cai no
 *  sorteio pelo nome. */
export function corDoJogador(slug: string, slugsDosJogadores: readonly string[], nome = slug): string {
  const i = slugsDosJogadores.indexOf(slug);
  return i === -1 ? corDoPing(nome, false) : CORES_JOGADORES[i % CORES_JOGADORES.length];
}

/** A mesma pessoa sempre pinga com a mesma cor (sorteio pelo nome; o que vale é
 *  `corDoJogador`, e este é o plano B). */
export function corDoPing(nome: string, mestre: boolean): string {
  if (mestre) return COR_PING_MESTRE;
  let h = 5381;
  for (let i = 0; i < nome.length; i++) h = ((h << 5) + h + nome.charCodeAt(i)) >>> 0;
  return CORES_JOGADORES[h % CORES_JOGADORES.length];
}

/** Lê o que chegou pelo canal; devolve null se não for um ping de verdade. */
export function validarPing(bruto: unknown, cena: { largura: number; altura: number }): PingRecebido | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;
  if (typeof o.id !== "string" || o.id.length === 0 || o.id.length > 64) return null;
  const { x, y } = o;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || y < 0 || x > cena.largura || y > cena.altura) return null;
  const nome = typeof o.de === "string" ? o.de.trim().slice(0, 30) : "";
  const de = nome || "alguém";
  const cor = typeof o.cor === "string" && CORES_VALIDAS.has(o.cor) ? o.cor : corDoPing(de, false);
  return { id: o.id, x, y, de, cor };
}

export function pingsAtivos<T extends { chegouEm: number }>(lista: readonly T[], agora: number): T[] {
  return lista.filter((p) => agora - p.chegouEm < PING_DURACAO_MS);
}

/** Põe um ping na lista: tira os já vencidos, ignora o repetido (mesmo id) e
 *  guarda só os mais novos se passar do limite. */
export function adicionarPing(lista: readonly PingNaTela[], novo: PingNaTela): PingNaTela[] {
  if (lista.some((p) => p.id === novo.id)) return [...lista];
  const vivos = pingsAtivos(lista, novo.chegouEm);
  return [...vivos, novo].slice(-PINGS_MAXIMOS);
}

/** Freio: este aparelho já pingou há pouco? */
export function podePingar(ultimoEm: number | null, agora: number): boolean {
  return ultimoEm === null || agora - ultimoEm >= PING_INTERVALO_MIN_MS;
}

export type AnimacaoDoPing = {
  /** Anéis em expansão: `raio` de 0 a 1 (do ponto até o tamanho máximo), `alfa` de 1 a 0. */
  aneis: { raio: number; alfa: number }[];
  /** Opacidade do ponto central e do nome (1 na maior parte do tempo, some no fim). */
  ponto: number;
};

const ANEIS = 3;
const ANEL_ATRASO_MS = 900;
const ANEL_DURACAO_MS = 1300;

/** O que desenhar a `idadeMs` do começo do ping; null = já passou (ou ainda não começou). */
export function animacaoDoPing(idadeMs: number): AnimacaoDoPing | null {
  if (idadeMs < 0 || idadeMs >= PING_DURACAO_MS) return null;
  const aneis: AnimacaoDoPing["aneis"] = [];
  for (let i = 0; i < ANEIS; i++) {
    const p = (idadeMs - i * ANEL_ATRASO_MS) / ANEL_DURACAO_MS;
    if (p < 0 || p > 1) continue;
    // Sai rápido e desacelera (easeOut), sumindo conforme cresce.
    aneis.push({ raio: 1 - (1 - p) * (1 - p), alfa: 1 - p });
  }
  const inicioDoFim = PING_DURACAO_MS * 0.75;
  const ponto = idadeMs < inicioDoFim ? 1 : 1 - (idadeMs - inicioDoFim) / (PING_DURACAO_MS - inicioDoFim);
  return { aneis, ponto };
}

/** Pra ping fora da tela: a posição na borda (com `margem`) e o ângulo da seta
 *  apontando pra ele. null = o ponto está dentro da tela. */
export function pontoNaBorda(
  x: number,
  y: number,
  larguraTela: number,
  alturaTela: number,
  margem = 20,
): { x: number; y: number; angulo: number } | null {
  if (x >= 0 && x <= larguraTela && y >= 0 && y <= alturaTela) return null;
  const cx = larguraTela / 2;
  const cy = alturaTela / 2;
  return {
    x: Math.min(larguraTela - margem, Math.max(margem, x)),
    y: Math.min(alturaTela - margem, Math.max(margem, y)),
    angulo: Math.atan2(y - cy, x - cx),
  };
}
