"use client";

/**
 * A iniciativa mexendo nos peões do mapa — por fora do `usePecas`, porque o
 * inimigo entra (e sai) na aba Combate, com a aba Mapa fechada. Os aparelhos
 * que estão com o mapa aberto veem a mudança pelo tempo real do `usePecas`.
 *
 * Tudo aqui é "melhor esforço": erro vai pro relato e a função devolve vazio,
 * sem aviso na tela e sem travar o combate — o mapa tem canal próprio
 * justamente pra um problema nele nunca derrubar a iniciativa. Sem a tabela
 * (migration 0019 não rodada), não faz nada.
 */
import { supabase, supabaseConfigurado } from "./supabase";
import { relatarErro } from "./relatarErro";
import { ehTabelaAusente, normalizarCena, type Cena } from "./cenas";
import { normalizarPeca, pecasDosCompanheiros, pecasDosQueEntram, type Peca } from "./pecas";
import type { PecasDaAcao } from "./desfazer";

function relatar(onde: string, erro: { code?: string | null; message?: string | null }) {
  if (!ehTabelaAusente(erro)) relatarErro(onde, erro);
}

/** Inimigos que acabaram de entrar na iniciativa ganham peão OCULTO no mapa que
 *  está na mesa (ver `pecasDosQueEntram`). Devolve o que o desfazer precisa pra
 *  tirar os peões junto com a ordem — ou nada, se nenhum peão nasceu. Sem mapa
 *  na mesa (`cena` null), não faz nada. */
export async function porPecasDosQueEntram(
  cena: Cena | null,
  fichas: readonly { slug: string; is_npc: boolean; cls?: string }[],
): Promise<PecasDaAcao | undefined> {
  if (!cena || !supabaseConfigurado || !fichas.some((f) => f.is_npc)) return undefined;
  const { data, error } = await supabase.from("cena_pecas").select("slug, x, y").eq("cena_id", cena.id);
  if (error) {
    relatar("lerPecas (iniciativa)", error);
    return undefined;
  }
  const existentes = (data ?? []).map((p) => ({ slug: p.slug as string | null, x: Number(p.x), y: Number(p.y) }));
  const novas = pecasDosQueEntram({ cena, fichas, existentes });
  if (novas.length === 0) return undefined;
  const linhas = novas.map((n) => ({
    id: crypto.randomUUID(),
    cena_id: cena.id,
    room_code: cena.room_code,
    slug: n.slug,
    nome: n.nome,
    x: n.x,
    y: n.y,
    tamanho: n.tamanho ?? 1,
    cor: null,
    oculto: n.oculto ?? true,
  }));
  const { error: erroAoPor } = await supabase.from("cena_pecas").insert(linhas);
  if (erroAoPor) {
    // 23505 = outro aparelho do Mestre pôs o mesmo peão no meio tempo.
    if (erroAoPor.code !== "23505") relatar("porPecas (iniciativa)", erroAoPor);
    return undefined;
  }
  return { criadas: linhas.map((l) => l.id), tiradas: [] };
}

/** Junta o que várias etapas criaram/tiraram, pra o desfazer devolver tudo de uma vez. */
export function juntarPecasDaAcao(...listas: (PecasDaAcao | undefined)[]): PecasDaAcao | undefined {
  const itens = listas.filter((l): l is PecasDaAcao => Boolean(l));
  if (itens.length === 0) return undefined;
  return { criadas: itens.flatMap((l) => l.criadas), tiradas: itens.flatMap((l) => l.tiradas) };
}

/** Companheiros que entraram na iniciativa com o dono ganham peão VISÍVEL, encostado no do dono, no mapa que está
 *  na mesa (ver `pecasDosCompanheiros`). Acha o mapa da mesa sozinho (quem chama não precisa ter o mapa à mão).
 *  Sem mapa na mesa, não faz nada. Devolve o que o desfazer precisa. */
export async function porPecasDosCompanheiros(
  codigo: string,
  companheiros: readonly { slug: string; cls?: string; dono: string }[],
): Promise<PecasDaAcao | undefined> {
  if (companheiros.length === 0 || !supabaseConfigurado) return undefined;
  const mesa = await supabase.from("cenas").select("*").eq("room_code", codigo).eq("na_mesa", true).limit(1).maybeSingle();
  if (mesa.error) {
    relatar("lerCenaDaMesa (companheiros)", mesa.error);
    return undefined;
  }
  const cena = normalizarCena(mesa.data);
  if (!cena) return undefined;
  const { data, error } = await supabase.from("cena_pecas").select("slug, x, y, tamanho").eq("cena_id", cena.id);
  if (error) {
    relatar("lerPecas (companheiros)", error);
    return undefined;
  }
  const existentes = (data ?? []).map((p) => ({
    slug: p.slug as string | null,
    x: Number(p.x),
    y: Number(p.y),
    tamanho: ([1, 2, 3, 4].includes(Number(p.tamanho)) ? Number(p.tamanho) : 1) as 1 | 2 | 3 | 4,
  }));
  const novas = pecasDosCompanheiros({ cena, companheiros, existentes });
  if (novas.length === 0) return undefined;
  const linhas = novas.map((n) => ({
    id: crypto.randomUUID(),
    cena_id: cena.id,
    room_code: cena.room_code,
    slug: n.slug,
    nome: n.nome,
    x: n.x,
    y: n.y,
    tamanho: n.tamanho ?? 1,
    cor: null,
    oculto: false,
  }));
  const { error: erroAoPor } = await supabase.from("cena_pecas").insert(linhas);
  if (erroAoPor) {
    if (erroAoPor.code !== "23505") relatar("porPecas (companheiros)", erroAoPor);
    return undefined;
  }
  return { criadas: linhas.map((l) => l.id), tiradas: [] };
}

/** Tira do mapa os peões dessas fichas: de uma cena (o inimigo saiu da ordem —
 *  só do mapa que está na mesa) ou de todas as cenas da sala (`cenaId` null: a
 *  ficha foi apagada, e o peão viraria um "?" cinza sem dono). Devolve o que
 *  tirou, pra desfazer poder devolver. */
export async function tirarPecasDasFichas(codigo: string, slugs: readonly string[], cenaId: string | null): Promise<Peca[]> {
  if (slugs.length === 0 || !supabaseConfigurado) return [];
  let consulta = supabase.from("cena_pecas").delete().eq("room_code", codigo).in("slug", [...slugs]);
  if (cenaId) consulta = consulta.eq("cena_id", cenaId);
  const { data, error } = await consulta.select();
  if (error) {
    relatar("tirarPecas (iniciativa)", error);
    return [];
  }
  return (data ?? []).map(normalizarPeca).filter((p): p is Peca => p !== null);
}

/** Desfazer: apaga os peões que a ação criou e devolve os que ela tirou (mesmo
 *  id, mesmo lugar). Devolve false se algo não voltou. */
export async function desfazerPecas(pecas: PecasDaAcao): Promise<boolean> {
  if (!supabaseConfigurado) return true;
  let ok = true;
  if (pecas.criadas.length > 0) {
    const { error } = await supabase.from("cena_pecas").delete().in("id", pecas.criadas);
    if (error) {
      relatar("desfazer (peões criados)", error);
      ok = false;
    }
  }
  if (pecas.tiradas.length > 0) {
    const linhas = pecas.tiradas.map(({ id, cena_id, room_code, slug, nome, x, y, tamanho, cor, oculto }) => ({
      id,
      cena_id,
      room_code,
      slug,
      nome,
      x,
      y,
      tamanho,
      cor,
      oculto,
    }));
    const { error } = await supabase.from("cena_pecas").upsert(linhas, { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      relatar("desfazer (peões tirados)", error);
      ok = false;
    }
  }
  return ok;
}
