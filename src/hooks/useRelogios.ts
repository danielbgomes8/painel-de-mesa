"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { ehTabelaAusente } from "@/lib/cenas";
import { RELOGIOS_MAXIMOS, avancar, normalizarRelogio, type Relogio } from "@/lib/relogios";

const AVISO_NAO_SALVOU = "Não salvou o relógio. Confira a conexão e tente de novo.";
const AVISO_LIMITE = `Já existem ${RELOGIOS_MAXIMOS} relógios, que é o máximo. Apague algum antigo.`;

export type NovoRelogio = Pick<Relogio, "nome" | "fatias"> & Partial<Pick<Relogio, "visivel" | "consequencia">>;

export type Relogios = {
  relogios: Relogio[];
  carregando: boolean;
  /** A tabela ainda não existe (migration 0038 não rodada): o resto do app funciona. */
  indisponivel: boolean;
  aviso: string | null;
  criar: (novo: NovoRelogio) => Promise<boolean>;
  /** Muda só o que foi pedido (nome, fatias, consequência, se a mesa vê). */
  atualizar: (id: string, mudanca: Partial<Pick<Relogio, "nome" | "fatias" | "visivel" | "consequencia" | "cheias">>) => Promise<boolean>;
  /** Enche (ou esvazia) fatias; devolve o relógio como ficou, ou null se não salvou. */
  mexer: (id: string, delta: number) => Promise<{ antes: Relogio; depois: Relogio } | null>;
  remover: (id: string) => Promise<boolean>;
};

function juntar(atual: Relogio[], nova: Relogio): Relogio[] {
  return atual.some((r) => r.id === nova.id) ? atual.map((r) => (r.id === nova.id ? nova : r)) : [...atual, nova];
}

/**
 * Os relógios de tensão da sala, ao vivo. Canal próprio, fora do `useSala`, e tolera a tabela não existir (o código
 * vai ao ar antes do SQL; mesmo desenho do `useBau` e do `useFolhas`). Entrega TODAS as linhas: quem vê o quê é
 * `relogiosVisiveis` (lib/relogios.ts), porque o banco é aberto.
 */
export function useRelogios(codigo: string): Relogios {
  const [relogios, setRelogios] = useState<Relogio[]>([]);
  const [carregando, setCarregando] = useState(supabaseConfigurado);
  const [indisponivel, setIndisponivel] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const ref = useRef<Relogio[]>([]);
  useEffect(() => {
    ref.current = relogios;
  }, [relogios]);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let vivo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;

    async function carregar(): Promise<boolean> {
      const { data, error } = await supabase.from("relogios").select("*").eq("room_code", codigo).order("created_at", { ascending: true });
      if (!vivo) return false;
      if (error) {
        if (ehTabelaAusente(error)) setIndisponivel(true);
        else relatarErro("lerRelogios", error);
        setCarregando(false);
        return false;
      }
      setIndisponivel(false);
      setRelogios((data ?? []).map(normalizarRelogio).filter((r): r is Relogio => r !== null));
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
        .channel(`relogios:${codigo}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "relogios", filter: `room_code=eq.${codigo}` }, (msg) => {
          if (msg.eventType === "DELETE") {
            const id = (msg.old as { id?: string }).id;
            setRelogios((atual) => atual.filter((r) => r.id !== id));
            return;
          }
          const nova = normalizarRelogio(msg.new);
          if (nova) setRelogios((atual) => juntar(atual, nova));
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

  const criar = useCallback<Relogios["criar"]>(
    async (novo) => {
      if (ref.current.length >= RELOGIOS_MAXIMOS) {
        setAviso(AVISO_LIMITE);
        return false;
      }
      const linha = { id: crypto.randomUUID(), room_code: codigo, nome: novo.nome, fatias: novo.fatias, cheias: 0, visivel: novo.visivel ?? true, consequencia: novo.consequencia ?? "" };
      const { data, error } = await supabase.from("relogios").insert(linha).select();
      if (error) {
        relatarErro("criarRelogio", error);
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
      const criado = (data ?? []).map(normalizarRelogio).find((r): r is Relogio => r !== null);
      if (criado) setRelogios((atual) => juntar(atual, criado));
      setAviso(null);
      return true;
    },
    [codigo],
  );

  const atualizar = useCallback<Relogios["atualizar"]>(async (id, mudanca) => {
    const antes = ref.current;
    setRelogios((atual) => atual.map((r) => (r.id === id ? { ...r, ...mudanca } : r)));
    const { error } = await supabase.from("relogios").update(mudanca).eq("id", id);
    if (error) {
      relatarErro("atualizarRelogio", error);
      setRelogios(antes);
      setAviso(AVISO_NAO_SALVOU);
      return false;
    }
    setAviso(null);
    return true;
  }, []);

  const mexer = useCallback<Relogios["mexer"]>(
    async (id, delta) => {
      const antes = ref.current.find((r) => r.id === id);
      if (!antes) return null;
      const depois = avancar(antes, delta);
      if (depois.cheias === antes.cheias) return { antes, depois };
      const ok = await atualizar(id, { cheias: depois.cheias });
      return ok ? { antes, depois } : null;
    },
    [atualizar],
  );

  const remover = useCallback<Relogios["remover"]>(async (id) => {
    const antes = ref.current;
    setRelogios((atual) => atual.filter((r) => r.id !== id));
    const { error } = await supabase.from("relogios").delete().eq("id", id);
    if (error) {
      relatarErro("removerRelogio", error);
      setRelogios(antes);
      setAviso(AVISO_NAO_SALVOU);
      return false;
    }
    setAviso(null);
    return true;
  }, []);

  return { relogios, carregando, indisponivel, aviso, criar, atualizar, mexer, remover };
}
