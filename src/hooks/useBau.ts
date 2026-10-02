"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { ehTabelaAusente } from "@/lib/cenas";
import {
  MOEDAS,
  QTD_MAXIMA,
  normalizarItemBau,
  temMoeda,
  type ItemBau,
  type NovoItemBau,
} from "@/lib/inventario";
import type { MoedaId, Moedas } from "@/lib/tipos";

const TENTATIVAS = 6;

export type Bau = {
  itens: ItemBau[];
  carregando: boolean;
  /** A tabela ainda não existe (migration 0026 não rodada): o resto do app funciona. */
  indisponivel: boolean;
  /** Guarda um objeto. Objeto comum com o nome de um que já está no baú soma na mesma linha. */
  guardarItem: (novo: NovoItemBau) => Promise<boolean>;
  /** Soma moedas ao dinheiro do baú. */
  guardarMoedas: (moedas: Moedas) => Promise<boolean>;
  /** Tira moedas do baú; false (e não tira nada) se faltar de qualquer tipo. */
  tirarMoedas: (moedas: Moedas) => Promise<boolean>;
  /** Tira `qtd` unidades de um objeto; a linha some quando acaba. false se não tinha tudo isso. */
  tirarItem: (id: string, qtd: number) => Promise<boolean>;
  remover: (id: string) => Promise<boolean>;
};

function juntar(atual: ItemBau[], nova: ItemBau): ItemBau[] {
  return atual.some((i) => i.id === nova.id) ? atual.map((i) => (i.id === nova.id ? nova : i)) : [...atual, nova];
}

/**
 * O baú do grupo (itens e moedas ainda sem dono), ao vivo. Canal próprio,
 * fora do `useSala`, e tolera a tabela não existir — o código vai ao ar antes
 * do SQL (mesmo desenho do `useQuadro`).
 *
 * Mexer na quantidade é "troco só se ninguém mexeu antes": o `update` leva a
 * quantidade lida no filtro, então dois celulares tirando a mesma poção ao
 * mesmo tempo não tiram a mesma unidade duas vezes — o que perdeu a corrida
 * lê de novo e tenta outra vez.
 */
export function useBau(codigo: string): Bau {
  const [itens, setItens] = useState<ItemBau[]>([]);
  const [carregando, setCarregando] = useState(supabaseConfigurado);
  const [indisponivel, setIndisponivel] = useState(false);
  const ref = useRef<ItemBau[]>([]);
  useEffect(() => {
    ref.current = itens;
  }, [itens]);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let vivo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;

    async function carregar(): Promise<boolean> {
      const { data, error } = await supabase
        .from("bau_itens")
        .select("*")
        .eq("room_code", codigo)
        .order("created_at", { ascending: true });
      if (!vivo) return false;
      if (error) {
        if (ehTabelaAusente(error)) setIndisponivel(true);
        else relatarErro("lerBau", error);
        setCarregando(false);
        return false;
      }
      setIndisponivel(false);
      setItens((data ?? []).map(normalizarItemBau).filter((i) => i.id !== ""));
      setCarregando(false);
      return true;
    }

    const aoVoltar = () => {
      if (document.visibilityState === "visible") void carregar();
    };

    void carregar().then((ok) => {
      if (!vivo || !ok) return;
      document.addEventListener("visibilitychange", aoVoltar);
      window.addEventListener("online", aoVoltar);
      canal = supabase
        .channel(`bau:${codigo}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bau_itens", filter: `room_code=eq.${codigo}` },
          (msg) => {
            if (msg.eventType === "DELETE") {
              const id = (msg.old as { id?: string }).id;
              setItens((atual) => atual.filter((i) => i.id !== id));
              return;
            }
            const nova = normalizarItemBau(msg.new);
            if (nova.id) setItens((atual) => juntar(atual, nova));
          },
        )
        .subscribe((status) => {
          if (vivo && status === "SUBSCRIBED") void carregar();
        });
    });

    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", aoVoltar);
      if (canal) supabase.removeChannel(canal);
    };
  }, [codigo]);

  /** Muda a quantidade de uma linha por `delta`, só se ela ainda for a que li.
   *  null = não cabia (ficaria negativa ou passaria do máximo) ou falhou. */
  const ajustar = useCallback(async (id: string, delta: number, apagarNoZero: boolean): Promise<boolean> => {
    for (let t = 0; t < TENTATIVAS; t++) {
      const lida = await supabase.from("bau_itens").select("qtd").eq("id", id).maybeSingle();
      if (lida.error) {
        relatarErro("lerQtdDoBau", lida.error);
        return false;
      }
      if (!lida.data) return false; // alguém tirou a linha inteira
      const nova = (lida.data.qtd as number) + delta;
      if (nova < 0 || nova > QTD_MAXIMA) return false;
      if (nova === 0 && apagarNoZero) {
        const r = await supabase.from("bau_itens").delete().eq("id", id).eq("qtd", lida.data.qtd).select("id");
        if (r.error) {
          relatarErro("apagarDoBau", r.error);
          return false;
        }
        if (r.data && r.data.length > 0) {
          setItens((atual) => atual.filter((i) => i.id !== id));
          return true;
        }
        continue;
      }
      const r = await supabase.from("bau_itens").update({ qtd: nova }).eq("id", id).eq("qtd", lida.data.qtd).select().maybeSingle();
      if (r.error) {
        relatarErro("ajustarBau", r.error);
        return false;
      }
      if (r.data) {
        setItens((atual) => juntar(atual, normalizarItemBau(r.data)));
        return true;
      }
      // Ninguém voltou linha: alguém mexeu entre a leitura e a escrita. Lê de novo.
    }
    return false;
  }, []);

  /** Soma `qtd` na linha de moeda (cria a linha se for a primeira). */
  const somarMoeda = useCallback(
    async (moeda: MoedaId, qtd: number): Promise<boolean> => {
      for (let t = 0; t < TENTATIVAS; t++) {
        const existente = ref.current.find((i) => i.moeda === moeda);
        let id = existente?.id;
        if (!id) {
          const achada = await supabase.from("bau_itens").select("id").eq("room_code", codigo).eq("moeda", moeda).maybeSingle();
          if (achada.error) {
            relatarErro("lerMoedaDoBau", achada.error);
            return false;
          }
          id = achada.data?.id as string | undefined;
        }
        if (!id) {
          const nova = await supabase
            .from("bau_itens")
            .insert({ room_code: codigo, nome: "", qtd, moeda })
            .select()
            .maybeSingle();
          if (!nova.error && nova.data) {
            setItens((atual) => juntar(atual, normalizarItemBau(nova.data)));
            return true;
          }
          // 23505 = outro celular criou a linha de moeda agora há pouco: soma nela.
          if (nova.error && nova.error.code !== "23505") {
            relatarErro("guardarMoedaNoBau", nova.error);
            return false;
          }
          continue;
        }
        return ajustar(id, qtd, false);
      }
      return false;
    },
    [codigo, ajustar],
  );

  const guardarMoedas = useCallback<Bau["guardarMoedas"]>(
    async (moedas) => {
      let tudo = true;
      for (const { id } of MOEDAS) if (moedas[id] > 0 && !(await somarMoeda(id, moedas[id]))) tudo = false;
      return tudo;
    },
    [somarMoeda],
  );

  const tirarMoedas = useCallback<Bau["tirarMoedas"]>(
    async (pedido) => {
      if (!temMoeda(pedido)) return true;
      // Confere primeiro, no banco: tirar só de um tipo e falhar no outro deixaria o baú pela metade.
      const lidas = await supabase.from("bau_itens").select("id, moeda, qtd").eq("room_code", codigo).not("moeda", "is", null);
      if (lidas.error) {
        relatarErro("lerMoedasDoBau", lidas.error);
        return false;
      }
      const linhas = new Map((lidas.data ?? []).map((l) => [l.moeda as string, l as { id: string; qtd: number }]));
      for (const { id } of MOEDAS) if (pedido[id] > (linhas.get(id)?.qtd ?? 0)) return false;
      let tudo = true;
      for (const { id } of MOEDAS) {
        if (pedido[id] <= 0) continue;
        if (!(await ajustar(linhas.get(id)!.id, -pedido[id], false))) tudo = false;
      }
      return tudo;
    },
    [codigo, ajustar],
  );

  const guardarItem = useCallback<Bau["guardarItem"]>(
    async (novo) => {
      const nome = novo.nome.trim();
      const qtd = Math.max(1, Math.min(QTD_MAXIMA, Math.round(novo.qtd ?? 1)));
      if (!nome) return false;
      if (!novo.magico) {
        const mesmo = ref.current.find(
          (i) => i.moeda === null && !i.magico && i.nome.trim().toLowerCase() === nome.toLowerCase(),
        );
        if (mesmo && (await ajustar(mesmo.id, qtd, true))) return true;
      }
      const { data, error } = await supabase
        .from("bau_itens")
        .insert({
          room_code: codigo,
          nome: nome.slice(0, 80),
          qtd,
          peso: novo.peso ?? 0,
          descricao: (novo.descricao ?? "").slice(0, 500),
          magico: novo.magico ?? false,
          raridade: (novo.raridade ?? "").slice(0, 20),
        })
        .select()
        .maybeSingle();
      if (error || !data) {
        if (error) relatarErro("guardarNoBau", error);
        return false;
      }
      setItens((atual) => juntar(atual, normalizarItemBau(data)));
      return true;
    },
    [codigo, ajustar],
  );

  const tirarItem = useCallback<Bau["tirarItem"]>(
    async (id, qtd) => {
      if (qtd < 1) return false;
      return ajustar(id, -Math.round(qtd), true);
    },
    [ajustar],
  );

  const remover = useCallback<Bau["remover"]>(async (id) => {
    const { error } = await supabase.from("bau_itens").delete().eq("id", id);
    if (error) {
      relatarErro("removerDoBau", error);
      return false;
    }
    setItens((atual) => atual.filter((i) => i.id !== id));
    return true;
  }, []);

  return { itens, carregando, indisponivel, guardarItem, guardarMoedas, tirarMoedas, tirarItem, remover };
}
