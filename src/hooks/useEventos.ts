"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { ehTabelaAusente } from "@/lib/cenas";
import { EVENTOS_NO_COMBATE, normalizarEvento, type EventoDoCombate, type NovoEventoDoCombate } from "@/lib/eventosCombate";

export type Eventos = {
  eventos: EventoDoCombate[];
  /** A tabela ainda não existe (migration 0034 não rodada): o resto do app funciona. */
  indisponivel: boolean;
  /** Cria vários de uma vez (todos ou nenhum). Devolve false se falhou ou se passaria do limite. */
  criar: (novos: NovoEventoDoCombate[]) => Promise<boolean>;
  /** "Já tratei": só vale uma vez, mesmo se dois aparelhos tocarem juntos. */
  marcarFeito: (id: string) => Promise<boolean>;
  remover: (id: string) => Promise<boolean>;
  /** Fim do combate: tira todos os avisos da sala. */
  limparTodos: () => Promise<boolean>;
};

const SEM_EVENTOS: Eventos = {
  eventos: [],
  indisponivel: true,
  criar: async () => false,
  marcarFeito: async () => false,
  remover: async () => false,
  limparTodos: async () => true,
};

/** Os eventos do combate chegam a quem precisa por contexto (Painel → telas do combate e do encontro), sem passar por cada componente no meio. */
export const EventosContext = createContext<Eventos>(SEM_EVENTOS);
export function useEventosDoCombate(): Eventos {
  return useContext(EventosContext);
}

function juntar(atual: EventoDoCombate[], novo: EventoDoCombate): EventoDoCombate[] {
  return atual.some((e) => e.id === novo.id) ? atual.map((e) => (e.id === novo.id ? novo : e)) : [...atual, novo];
}

/**
 * Os avisos programados do combate (ver lib/eventosCombate.ts), ao vivo. Canal
 * próprio, fora do `useSala`, e tolera a tabela não existir — o código vai ao
 * ar antes do SQL (mesmo desenho do `useTempo`).
 */
export function useEventos(codigo: string): Eventos {
  const [eventos, setEventos] = useState<EventoDoCombate[]>([]);
  const [indisponivel, setIndisponivel] = useState(false);
  const ref = useRef<EventoDoCombate[]>([]);
  useEffect(() => {
    ref.current = eventos;
  }, [eventos]);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let vivo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;

    async function carregar(): Promise<boolean> {
      const r = await supabase.from("combate_eventos").select("*").eq("room_code", codigo).order("created_at", { ascending: true });
      if (!vivo) return false;
      if (r.error) {
        if (ehTabelaAusente(r.error)) setIndisponivel(true);
        else relatarErro("lerEventosDoCombate", r.error);
        return false;
      }
      setIndisponivel(false);
      setEventos((r.data ?? []).map(normalizarEvento).filter((e) => e.id !== ""));
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
        .channel(`eventos:${codigo}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "combate_eventos", filter: `room_code=eq.${codigo}` }, (msg) => {
          if (msg.eventType === "DELETE") {
            const id = (msg.old as { id?: string }).id;
            setEventos((atual) => atual.filter((e) => e.id !== id));
            return;
          }
          const novo = normalizarEvento(msg.new);
          if (novo.id) setEventos((atual) => juntar(atual, novo));
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

  const criar = useCallback<Eventos["criar"]>(
    async (novos) => {
      if (novos.length === 0) return true;
      if (ref.current.length + novos.length > EVENTOS_NO_COMBATE) return false;
      const { data, error } = await supabase
        .from("combate_eventos")
        .insert(
          novos.map((n) => ({
            room_code: codigo,
            tipo: n.tipo,
            rodada: n.rodada,
            slugs: n.slugs,
            pct: n.pct,
            texto: n.texto,
            publico: n.publico,
          })),
        )
        .select();
      if (error) {
        relatarErro("criarEventosDoCombate", error);
        return false;
      }
      const criados = (data ?? []).map(normalizarEvento).filter((e) => e.id !== "");
      setEventos((atual) => criados.reduce(juntar, atual));
      return true;
    },
    [codigo],
  );

  const marcarFeito = useCallback<Eventos["marcarFeito"]>(async (id) => {
    // `feito = false` no próprio UPDATE: dois toques (ou dois aparelhos) não contam duas vezes.
    const { data, error } = await supabase.from("combate_eventos").update({ feito: true }).eq("id", id).eq("feito", false).select();
    if (error) {
      relatarErro("marcarEventoFeito", error);
      return false;
    }
    if (data && data.length > 0) setEventos((atual) => atual.map((e) => (e.id === id ? { ...e, feito: true } : e)));
    return Boolean(data && data.length > 0);
  }, []);

  const remover = useCallback<Eventos["remover"]>(async (id) => {
    const { error } = await supabase.from("combate_eventos").delete().eq("id", id);
    if (error) {
      relatarErro("removerEventoDoCombate", error);
      return false;
    }
    setEventos((atual) => atual.filter((e) => e.id !== id));
    return true;
  }, []);

  const limparTodos = useCallback<Eventos["limparTodos"]>(async () => {
    if (ref.current.length === 0) return true;
    const { error } = await supabase.from("combate_eventos").delete().eq("room_code", codigo);
    if (error) {
      relatarErro("limparEventosDoCombate", error);
      return false;
    }
    setEventos([]);
    return true;
  }, [codigo]);

  return { eventos, indisponivel, criar, marcarFeito, remover, limparTodos };
}
