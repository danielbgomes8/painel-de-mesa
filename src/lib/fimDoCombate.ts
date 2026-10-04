/**
 * Encerrar o combate — as regras puras: quem foi derrotado, quanto XP isso vale, quem recebe e o que
 * entra no log. A tela só chama estas funções (ver `EncerrarCombate.tsx`).
 *
 * O app NÃO sabe quem morreu "de verdade" (um inimigo a 0 PV pode ter fugido, se rendido ou ser poupado),
 * então a lista de derrotados é uma SUGESTÃO que o Mestre confirma: inimigo (NPC) na ordem com 0 PV ou
 * menos. O XP de cada um é achado pelo nome no catálogo de monstros; sem achar, o Mestre digita.
 */
import { dividirXp, formatarXp } from "./experiencia";
import { plural } from "./tempoCampanha";

export type QuemNaOrdem = { slug: string; hp: number; is_npc: boolean; name: string };

/** O nome sem acento, em minúsculas e sem o número de cópia no fim ("Goblin 2", "goblin #3" → "goblin"). */
export function chaveDoNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/(?:\s+n[ºo°.]\s*|\s*#\s*|\s+)\d+$/, "")
    .trim();
}

/** O XP de um inimigo pelo nome, pelo catálogo (nome em português ou em inglês). null = não achou. */
export function xpDoInimigo(nome: string, catalogo: { name: string; en: string; xp: number }[]): number | null {
  const chave = chaveDoNome(nome);
  if (!chave) return null;
  const achado = catalogo.find((m) => chaveDoNome(m.name) === chave || chaveDoNome(m.en) === chave);
  return achado ? achado.xp : null;
}

/** Inimigos (NPC) que estão na ordem com 0 PV ou menos. */
export function inimigosDerrotados<T extends QuemNaOrdem>(ordem: { slug: string }[], personagens: T[]): T[] {
  const naOrdem = new Set(ordem.map((o) => o.slug));
  return personagens.filter((p) => p.is_npc && naOrdem.has(p.slug) && p.hp <= 0);
}

/** Jogadores que estavam no combate (os que recebem o XP). */
export function jogadoresDoCombate<T extends QuemNaOrdem>(ordem: { slug: string }[], personagens: T[]): T[] {
  const naOrdem = new Set(ordem.map((o) => o.slug));
  return personagens.filter((p) => !p.is_npc && naOrdem.has(p.slug));
}

/** Jogadores caídos (0 PV) na hora de encerrar, só pra o Mestre ver no resumo. */
export function jogadoresCaidos<T extends QuemNaOrdem>(ordem: { slug: string }[], personagens: T[]): T[] {
  return jogadoresDoCombate(ordem, personagens).filter((p) => p.hp <= 0);
}

/** Lê o XP digitado (inteiro, 0 ou mais); vazio ou lixo = 0. */
export function lerXpDigitado(texto: string): number {
  const n = Number.parseInt(texto, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export type PartilhaDeXp = { total: number; cada: number; sobra: number };

/** Soma o XP dos derrotados marcados e divide entre quem vai receber. */
export function partilharXp(xps: number[], quantosRecebem: number): PartilhaDeXp {
  const total = xps.reduce((s, x) => s + Math.max(0, x), 0);
  const { cada, sobra } = dividirXp(total, quantosRecebem);
  return { total, cada, sobra };
}

/** Tira as condições que têm prazo (as que o app contava em rodadas) e zera os prazos. */
export function semCondicoesComPrazo(
  cond: Record<string, boolean>,
  prazo: Record<string, number>,
): { cond: Record<string, boolean>; cond_prazo: Record<string, number>; tiradas: string[] } {
  const tiradas = Object.keys(prazo).filter((k) => cond[k]);
  const novas = { ...cond };
  for (const k of Object.keys(prazo)) delete novas[k];
  return { cond: novas, cond_prazo: {}, tiradas };
}

/** Toda linha de fim de combate começa com esta marca. */
export const MARCA_DE_FIM = "🏁";

/** "🏁 Combate encerrado: 4 rodadas, 3 inimigos derrotados, 900 XP (225 pra cada um)". */
export function linhaDeFimDoCombate(rodadas: number, derrotados: number, partilha: PartilhaDeXp, quantosRecebem: number): string {
  const partes = [plural(rodadas, "rodada", "rodadas")];
  if (derrotados > 0) partes.push(`${plural(derrotados, "inimigo derrotado", "inimigos derrotados")}`);
  if (partilha.total > 0 && quantosRecebem > 0) {
    partes.push(`${formatarXp(partilha.total)} XP (${formatarXp(partilha.cada)} pra ${quantosRecebem === 1 ? "o jogador" : "cada um"})`);
  }
  return `${MARCA_DE_FIM} Combate encerrado: ${partes.join(", ")}`;
}
