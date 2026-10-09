/**
 * Efeitos com duração no combate (migration 0035): "Bênção, 10 rodadas".
 * Não é condição (essas têm prazo próprio em `cond_prazo`) — é um relógio
 * preso a um personagem da ordem. As regras ficam aqui (puras); a leitura e a
 * escrita no banco são do `hooks/useEfeitos.ts` e a tela é `EfeitosDoCombate.tsx`.
 *
 * Guarda-se a rodada em que o efeito ACABA, não uma contagem: assim ele nunca
 * se perde se o turno pular ou dois celulares tocarem juntos. Acabar é no
 * início do turno de quem lançou (regra do D&D 2024 pra maioria das magias);
 * sem lançador na ordem, no início da rodada. Tudo decidido na tela.
 */

export const NOME_MAXIMO = 60;
export const DURACAO_MAXIMA = 600; // 1 hora em rodadas
export const EFEITOS_NO_COMBATE = 60;

export type EfeitoDoCombate = {
  id: string;
  room_code: string;
  nome: string;
  alvo_slug: string;
  lancador_slug: string | null;
  termina_rodada: number;
  created_at: string;
};

export type NovoEfeito = Pick<EfeitoDoCombate, "nome" | "alvo_slug" | "lancador_slug" | "termina_rodada">;

/** Atalhos de duração, em rodadas (1 minuto = 10 rodadas de 6 segundos). */
export const DURACOES_RAPIDAS: { rodadas: number; rotulo: string }[] = [
  { rodadas: 1, rotulo: "1 rodada" },
  { rodadas: 10, rotulo: "1 min" },
  { rodadas: 100, rotulo: "10 min" },
  { rodadas: 600, rotulo: "1 hora" },
];

export function limparNome(nome: string): string {
  return (nome ?? "").replace(/\s+/g, " ").trim().slice(0, NOME_MAXIMO);
}

function inteiro(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Linha do banco → efeito; o que vier torto vira valor seguro (id vazio = descartar). */
export function normalizarEfeito(bruto: unknown): EfeitoDoCombate {
  const o = (bruto ?? {}) as Record<string, unknown>;
  return {
    id: typeof o.id === "string" ? o.id : "",
    room_code: typeof o.room_code === "string" ? o.room_code : "",
    nome: limparNome(typeof o.nome === "string" ? o.nome : ""),
    alvo_slug: typeof o.alvo_slug === "string" ? o.alvo_slug : "",
    lancador_slug: typeof o.lancador_slug === "string" && o.lancador_slug !== "" ? o.lancador_slug : null,
    termina_rodada: inteiro(o.termina_rodada, 1, 2000) ?? 1,
    created_at: typeof o.created_at === "string" ? o.created_at : "",
  };
}

/** O que o formulário digitou, validado, já com a rodada em que acaba. */
export function validarNovoEfeito(
  e: { nome: string; duracao: string; alvo_slug: string; lancador_slug: string | null },
  rodadaAtual: number,
): { ok: true; efeito: NovoEfeito } | { ok: false; motivo: string } {
  const nome = limparNome(e.nome);
  if (nome === "") return { ok: false, motivo: "Escreva o nome do efeito." };
  const d = inteiro(e.duracao, 1, DURACAO_MAXIMA);
  if (d === null || e.duracao.trim() === "") return { ok: false, motivo: `Diga quantas rodadas dura (1 a ${DURACAO_MAXIMA}).` };
  if (e.alvo_slug === "") return { ok: false, motivo: "Escolha em quem o efeito está." };
  return { ok: true, efeito: { nome, alvo_slug: e.alvo_slug, lancador_slug: e.lancador_slug, termina_rodada: Math.min(2000, Math.max(1, rodadaAtual) + d) } };
}

export type SituacaoDosEfeitos = {
  round: number;
  turn: number;
  order: { slug: string }[];
};

/** Acabou? Depois da rodada final, ou nela mesma quando o turno de quem lançou já começou. Sem combate, nada acaba. */
export function acabou(e: Pick<EfeitoDoCombate, "termina_rodada" | "lancador_slug">, s: SituacaoDosEfeitos): boolean {
  if (s.order.length === 0) return false;
  if (s.round > e.termina_rodada) return true;
  if (s.round < e.termina_rodada) return false;
  const i = e.lancador_slug === null ? 0 : s.order.findIndex((o) => o.slug === e.lancador_slug);
  return s.turn >= Math.max(0, i);
}

/** "7 rod." ou "acaba na vez de quem lançou" — o texto do chip, depois do nome. */
export function textoRestante(e: Pick<EfeitoDoCombate, "termina_rodada">, round: number): string {
  const falta = e.termina_rodada - round;
  if (falta <= 0) return "acaba nesta rodada";
  return falta === 1 ? "1 rod." : `${falta} rod.`;
}

/** Os que acabaram e esperam alguém dizer "acabou", do mais antigo ao mais novo. */
export function efeitosQueAcabaram(efeitos: EfeitoDoCombate[], s: SituacaoDosEfeitos): EfeitoDoCombate[] {
  return efeitos.filter((e) => acabou(e, s)).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * O efeito aparece pra quem? O Mestre vê todos. Os outros não veem o de um
 * inimigo ainda não revelado: o nome do efeito ("Forma de Dragão") entregaria
 * quem ele é. Regra do dado secreto, igual à do nome na iniciativa.
 */
export function efeitoVisivel(souMestre: boolean, alvo: { is_npc: boolean; revealed: boolean } | undefined): boolean {
  if (souMestre) return true;
  if (!alvo) return false;
  return !(alvo.is_npc && !alvo.revealed);
}

/** A linha do log público quando o efeito acaba. `nomeAlvo` já vem por `nomeNoLog`. */
export function linhaDoEfeito(nome: string, nomeAlvo: string): string {
  return `⏳ ${limparNome(nome)} em ${nomeAlvo} acabou`;
}
