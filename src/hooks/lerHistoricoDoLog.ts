import { supabase } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import type { LinhaDoLog } from "@/lib/recap";

const PAGINA = 1000;
/** O suficiente pra várias sessões (uma noite de jogo tem algumas centenas de linhas). */
const PAGINAS_MAXIMAS = 3;

/**
 * O histórico do log de combate direto do banco, das linhas mais novas pras
 * mais velhas. O `sala.log` do app guarda só as últimas 40 linhas (é o que a
 * tela de combate mostra) — pouco demais pra contar uma sessão —, então o
 * recap lê daqui, na hora em que o Mestre pede. `null` = falhou (a tela avisa).
 */
export async function lerHistoricoDoLog(codigo: string): Promise<LinhaDoLog[] | null> {
  const tudo: LinhaDoLog[] = [];
  for (let p = 0; p < PAGINAS_MAXIMAS; p++) {
    const { data, error } = await supabase
      .from("combat_log")
      .select("text, created_at")
      .eq("room_code", codigo)
      .order("created_at", { ascending: false })
      .range(p * PAGINA, (p + 1) * PAGINA - 1);
    if (error) {
      relatarErro("lerHistoricoDoLog", error);
      return null;
    }
    const pagina = (data ?? []) as LinhaDoLog[];
    tudo.push(...pagina);
    if (pagina.length < PAGINA) break;
  }
  return tudo;
}
