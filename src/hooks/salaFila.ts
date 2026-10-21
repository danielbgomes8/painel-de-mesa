import { supabase } from "@/lib/supabase";
import {
  combateSemConflito,
  conflitosDePersonagens,
  ehFalhaDeRede,
  type OpOffline,
} from "@/lib/offline";
import { camposConferiveis } from "@/lib/desfazer";
import type { Personagem } from "@/lib/tipos";
import { MAX_TENTATIVAS_VERSAO, comoCombate, gravarSeVersaoBater } from "./salaBanco";
import type { LinhaCombate } from "./salaTipos";

/** O que aconteceu ao mandar UMA operação da fila pro banco. */
export type ResultadoDaFila = "ok" | "sem-internet" | { naoForam: string[] };

/** Manda uma operação da fila pro banco (ver `sincronizar` no useSala). */
export async function gravarOperacaoDaFila(
  op: OpOffline,
  codigo: string,
  mudarFila: (mudar: (atual: OpOffline[]) => OpOffline[]) => void,
): Promise<ResultadoDaFila> {
  if (op.tipo === "personagens") {
    if (op.mudancas.length === 0) return "ok";
    const lidos = await supabase
      .from("characters")
      .select("*")
      .in(
        "id",
        op.mudancas.map((m) => m.id),
      );
    if (lidos.error) return ehFalhaDeRede(lidos.error) ? "sem-internet" : { naoForam: op.mudancas.map((m) => m.nome) };
    const conflitos = conflitosDePersonagens(op.mudancas, (lidos.data ?? []) as Personagem[]);
    if (conflitos.length > 0) return { naoForam: conflitos };
    for (const m of op.mudancas) {
      let consulta = supabase.from("characters").update(m.depois).eq("id", m.id);
      for (const [coluna, valor] of camposConferiveis(m.antes)) consulta = consulta.eq(coluna, valor);
      const { data, error } = await consulta.select("id");
      if (error) return ehFalhaDeRede(error) ? "sem-internet" : { naoForam: [m.nome] };
      if (!data || data.length === 0) return { naoForam: [m.nome] };
      // Já foi: sai da operação, pra uma queda logo depois não fazer ela
      // parecer conflito na próxima tentativa.
      mudarFila((atual) =>
        atual.map((o) =>
          o.id === op.id && o.tipo === "personagens"
            ? { ...o, mudancas: o.mudancas.filter((x) => x.id !== m.id) }
            : o,
        ),
      );
    }
    return "ok";
  }

  if (op.tipo === "combate") {
    const ordem = "a ordem de iniciativa";
    for (let tentativa = 0; tentativa < MAX_TENTATIVAS_VERSAO; tentativa++) {
      const lida = await supabase.from("combat_state").select("*").eq("room_code", codigo).maybeSingle();
      if (lida.error) return ehFalhaDeRede(lida.error) ? "sem-internet" : { naoForam: [ordem] };
      const linha = lida.data as LinhaCombate | null;
      if (!linha || !combateSemConflito(op, comoCombate(linha))) return { naoForam: [ordem] };
      const r = await gravarSeVersaoBater<LinhaCombate>("combat_state", codigo, linha.version, {
        round: op.depois.round,
        turn: op.depois.turn,
        order_json: op.depois.order,
      });
      if (r.tipo === "gravou") return "ok";
      if (r.tipo === "erro") return r.rede ? "sem-internet" : { naoForam: [ordem] };
      // conflito: alguém gravou entre a leitura e a escrita — confere de novo
    }
    return { naoForam: [ordem] };
  }

  // Log: uma linha por vez, na ordem — linhas da mesma escrita sairiam
  // com o mesmo horário e o log não saberia qual veio antes.
  for (const text of op.textos) {
    const { error } = await supabase.from("combat_log").insert({ room_code: codigo, text });
    if (error) return ehFalhaDeRede(error) ? "sem-internet" : "ok"; // log recusado: segue sem ele
    mudarFila((atual) =>
      atual.map((o) => (o.id === op.id && o.tipo === "log" ? { ...o, textos: o.textos.slice(1) } : o)),
    );
  }
  return "ok";
}
