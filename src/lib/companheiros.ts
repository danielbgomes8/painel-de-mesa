/**
 * Companheiros e invocações ligados ao dono — as regras puras. Um companheiro (familiar, montaria, animal
 * companheiro, criatura invocada) é uma ficha de NPC já revelada com `dono` = o slug do personagem de quem
 * ele é. Pela regra de 2024 ele age na iniciativa do dono, logo depois dele, então entra na ordem com a
 * MESMA iniciativa, junto, e sai junto. A tela só chama estas funções (ver `CompanheirosDaFicha.tsx` e o
 * `RastreadorCombate.tsx`).
 */
import type { ItemIniciativa } from "./tipos";

export type QuemTemDono = { slug: string; name: string; is_npc: boolean; dono?: string | null };

/** As fichas que são companheiras desse personagem. */
export function companheirosDe<T extends QuemTemDono>(personagens: T[], donoSlug: string): T[] {
  return personagens.filter((p) => p.is_npc && p.dono === donoSlug);
}

/** O dono é quem controla o companheiro: o Mestre controla todos, e o jogador controla o dele e os
 *  companheiros dele (pra mexer no PV do familiar sem chamar o Mestre). */
export function ehDoJogador(p: Pick<QuemTemDono, "slug" | "dono">, meuSlug: string | null | undefined): boolean {
  if (!meuSlug) return false;
  return p.slug === meuSlug || p.dono === meuSlug;
}

/** Acrescenta, logo depois de cada dono que está entrando, os companheiros dele que ainda não estão na ordem —
 *  com a mesma iniciativa do dono. Devolve a lista completa pra entrar e só os companheiros acrescentados
 *  (pra o log dizer). Companheiro que já está na ordem, ou que já vem na lista, não se repete. */
export function comCompanheiros<T extends QuemTemDono>(
  entrando: ItemIniciativa[],
  personagens: T[],
  ordemAtual: { slug: string }[],
): { itens: ItemIniciativa[]; acrescentados: { item: ItemIniciativa; dono: string; donoSlug: string }[] } {
  const jaNaOrdem = new Set(ordemAtual.map((o) => o.slug));
  const jaVem = new Set(entrando.map((e) => e.slug));
  const itens: ItemIniciativa[] = [];
  const acrescentados: { item: ItemIniciativa; dono: string; donoSlug: string }[] = [];
  for (const e of entrando) {
    itens.push(e);
    const dono = personagens.find((p) => p.slug === e.slug);
    if (!dono || dono.is_npc) continue;
    for (const c of companheirosDe(personagens, e.slug)) {
      if (jaNaOrdem.has(c.slug) || jaVem.has(c.slug)) continue;
      jaVem.add(c.slug);
      const item = { slug: c.slug, name: c.name, init: e.init };
      itens.push(item);
      acrescentados.push({ item, dono: dono.name, donoSlug: dono.slug });
    }
  }
  return { itens, acrescentados };
}

/** Os slugs que saem da ordem junto com um dono: os companheiros dele. */
export function companheirosQueSaemJunto<T extends QuemTemDono>(personagens: T[], donoSlug: string): string[] {
  return companheirosDe(personagens, donoSlug).map((c) => c.slug);
}

/** A linha do log de um companheiro que entra com o dono (não usa "entrou no combate": o recap contaria como inimigo). */
export function linhaDeCompanheiro(nomeDoCompanheiro: string, nomeDoDono: string): string {
  return `${nomeDoCompanheiro} acompanha ${nomeDoDono} na iniciativa`;
}
