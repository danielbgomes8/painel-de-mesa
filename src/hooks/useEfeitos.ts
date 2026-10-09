"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { ehTabelaAusente } from "@/lib/cenas";
import { EFEITOS_NO_COMBATE, normalizarEfeito, type EfeitoDoCombate, type NovoEfeito } from "@/lib/efeitosCombate";

export type Efeitos = {
  efeitos: EfeitoDoCombate[];
  /** A tabela ainda não existe (migration 0035 não rodada): o resto do app funciona. */
  indisponivel: boolean;
  /** Devolve false se falhou ou se passaria do limite. */
  criar: (novo: NovoEfeito) => Promise<boolean>;
  /** true só pra quem de fato apagou a linha: dois toques (ou dois aparelhos) não contam duas vezes. */
  remover: (id: string) => Promise<boolean>;
  /** Fim do combate: tira todos os efeitos da sala. */
  limparTodos: () => Promise<boolean>;
};

const SEM_EFEITOS: Efeitos = {
  efeitos: [],
  indisponivel: true,
  criar: async () => false,
  remover: async () => false,
  limparTodos: async () => true,
};

/** Chega às telas do combate por contexto (Painel → linha da iniciativa e avisos), sem passar por cada componente no meio. */
export const EfeitosContext = createContext<Efeitos>(SEM_EFEITOS);
export function useEfeitosDoCombate(): Efeitos {
  return useContext(EfeitosContext);
}

function juntar(atual: EfeitoDoCombate[], novo: EfeitoDoCombate): EfeitoDoCombate[] {
  return atual.some((e) => e.id === novo.id) ? atual.map((e) => (e.id === novo.id ? novo : e)) : [...atual, novo];
}

/**
 * Os efeitos com duração do combate (ver lib/efeitosCombate.ts), ao vivo. Canal
 * próprio, fora do `useSala`, e tolera a tabela não existir — o código vai ao
 * ar antes do SQL (mesmo desenho do `useEventos`).
 */
export function useEfeitos(codigo: string): Efeitos {
  const [efeitos, setEfeitos] = useState<EfeitoDoCombate[]>([]);
  const [indisponivel, setIndisponivel] = useState(false);
  const ref = useRef<EfeitoDoCombate[]>([]);
  useEffect(() => {
    ref.current = efeitos;
  }, [efeitos]);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let vivo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;

    async function carregar(): Promise<boolean> {
      const r = await supabase.from("combate_efeitos").select("*").eq("room_code", codigo).order("created_at", { ascending: true });
      if (!vivo) return false;
      if (r.error) {
        if (ehTabelaAusente(r.error)) setIndisponivel(true);
        else relatarErro("lerEfeitosDoCombate", r.error);
        return false;
      }
      setIndisponivel(false);
      setEfeitos((r.data ?? []).map(normalizarEfeito).filter((e) => e.id !== ""));
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
        .channel(`efeitos:${codigo}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "combate_efeitos", filter: `room_code=eq.${codigo}` }, (msg) => {
          if (msg.eventType === "DELETE") {
            const id = (msg.old as { id?: string }).id;
            setEfeitos((atual) => atual.filter((e) => e.id !== id));
            return;
          }
          const novo = normalizarEfeito(msg.new);
          if (novo.id) setEfeitos((atual) => juntar(atual, novo));
        })
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

  const criar = useCallback<Efeitos["criar"]>(
    async (novo) => {
      if (ref.current.length + 1 > EFEITOS_NO_COMBATE) return false;
      const { data, error } = await supabase
        .from("combate_efeitos")
        .insert({
          room_code: codigo,
          nome: novo.nome,
          alvo_slug: novo.alvo_slug,
          lancador_slug: novo.lancador_slug,
          termina_rodada: novo.termina_rodada,
        })
        .select();
      if (error) {
        relatarErro("criarEfeitoDoCombate", error);
        return false;
      }
      const criados = (data ?? []).map(normalizarEfeito).filter((e) => e.id !== "");
      setEfeitos((atual) => criados.reduce(juntar, atual));
      return true;
    },
    [codigo],
  );

  const remover = useCallback<Efeitos["remover"]>(async (id) => {
    const { data, error } = await supabase.from("combate_efeitos").delete().eq("id", id).select();
    if (error) {
      relatarErro("removerEfeitoDoCombate", error);
      return false;
    }
    setEfeitos((atual) => atual.filter((e) => e.id !== id));
    return Boolean(data && data.length > 0);
  }, []);

  const limparTodos = useCallback<Efeitos["limparTodos"]>(async () => {
    if (ref.current.length === 0) return true;
    const { error } = await supabase.from("combate_efeitos").delete().eq("room_code", codigo);
    if (error) {
      relatarErro("limparEfeitosDoCombate", error);
      return false;
    }
    setEfeitos([]);
    return true;
  }, [codigo]);

  return { efeitos, indisponivel, criar, remover, limparTodos };
}
