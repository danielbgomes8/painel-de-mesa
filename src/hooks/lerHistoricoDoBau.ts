import { supabase } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { MARCA_DE_DINHEIRO, MARCA_DE_ITEM } from "@/lib/historicoBau";
import type { LinhaDoLog } from "@/lib/recap";

/** Quantas trocas o histórico baixa de uma vez (a tela mostra menos e abre mais sob pedido). */
export const LIMITE_DO_HISTORICO = 200;

/**
 * As trocas do baú, direto do log do combate no banco, das mais novas pras mais velhas. O
 * `sala.log` da tela guarda só as últimas 40 linhas (misturadas com o combate), pouco demais pra um
 * histórico — então o filtro (linhas que começam com 🎒 ou 💰) é feito pelo banco. `null` = falhou.
 */
export async function lerHistoricoDoBau(codigo: string): Promise<LinhaDoLog[] | null> {
  const { data, error } = await supabase
    .from("combat_log")
    .select("text, created_at")
    .eq("room_code", codigo)
    .or(`text.like.${MARCA_DE_ITEM}*,text.like.${MARCA_DE_DINHEIRO}*`)
    .order("created_at", { ascending: false })
    .limit(LIMITE_DO_HISTORICO);
  if (error) {
    relatarErro("lerHistoricoDoBau", error);
    return null;
  }
  return (data ?? []) as LinhaDoLog[];
}
