"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { ehTabelaAusente } from "@/lib/cenas";
import { normalizarPeca, type NovaPeca, type Peca } from "@/lib/pecas";
import { colunasDaLuz, type Luz } from "@/lib/luzes";

const AVISO_NAO_SALVOU = "Não salvou o peão. Confira a conexão e tente de novo.";
const SEM_PECAS: Peca[] = [];

export type Pecas = {
  pecas: Peca[];
  carregando: boolean;
  /** A tabela de peões ainda não existe (migration 0019 não rodada): o mapa funciona sem eles. */
  indisponivel: boolean;
  aviso: string | null;
  adicionar: (novas: NovaPeca[]) => Promise<boolean>;
  /** Só as colunas que mudaram (nunca a linha inteira: ver AGENTS.md). */
  atualizar: (id: string, mudanca: Partial<Pick<Peca, "x" | "y" | "tamanho" | "oculto" | "nome" | "cor" | "aura">>) => Promise<boolean>;
  /** Põe, troca ou tira (null) a luz de vários peões numa tacada só: as três colunas da luz, nada mais. */
  definirLuzes: (mudancas: { id: string; luz: Luz | null }[]) => Promise<boolean>;
  remover: (id: string) => Promise<boolean>;
  removerTodas: () => Promise<boolean>;
};

/**
 * Os peões de UMA cena, ao vivo: arrastar um peão aparece na hora nos outros
 * aparelhos. Mesma forma do `useNevoa` (estado preso à cena a que pertence,
 * canal próprio, releitura a cada reconexão) — e, como ele, tolera a tabela
 * ainda não existir.
 */
export function usePecas(cenaId: string | null, codigo: string, canalExtra = ""): Pecas {
  const [dados, setDados] = useState<{ cenaId: string | null; pecas: Peca[]; carregou: boolean; indisponivel: boolean }>({
    cenaId: null,
    pecas: [],
    carregou: false,
    indisponivel: false,
  });
  const [aviso, setAviso] = useState<string | null>(null);
  const daCena = dados.cenaId === cenaId ? dados : null;
  const pecas = daCena?.pecas ?? SEM_PECAS;
  const carregando = Boolean(cenaId) && supabaseConfigurado && !daCena?.carregou;
  const ref = useRef<Peca[]>([]);
  useEffect(() => {
    ref.current = pecas;
  }, [pecas]);

  const mexer = useCallback(
    (fn: (atual: Peca[]) => Peca[], extra: { carregou?: boolean; indisponivel?: boolean } = {}) => {
      setDados((d) => {
        const base = d.cenaId === cenaId ? d : { cenaId, pecas: [], carregou: false, indisponivel: false };
        return {
          cenaId,
          pecas: fn(base.pecas),
          carregou: extra.carregou ?? base.carregou,
          indisponivel: extra.indisponivel ?? base.indisponivel,
        };
      });
    },
    [cenaId],
  );

  useEffect(() => {
    if (!cenaId || !supabaseConfigurado) return;
    let vivo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;

    async function carregar(): Promise<boolean> {
      const { data, error } = await supabase
        .from("cena_pecas")
        .select("*")
        .eq("cena_id", cenaId)
        .order("created_at", { ascending: true });
      if (!vivo) return false;
      if (error) {
        if (ehTabelaAusente(error)) mexer((a) => a, { carregou: true, indisponivel: true });
        else {
          relatarErro("lerPecas", error);
          mexer((a) => a, { carregou: true });
        }
        return false;
      }
      const lidas = (data ?? []).map(normalizarPeca).filter((p): p is Peca => p !== null);
      mexer(
        (atual) => {
          // Peão criado agora há pouco, ainda não devolvido pelo banco, fica.
          const ids = new Set(lidas.map((p) => p.id));
          return [...lidas, ...atual.filter((p) => !ids.has(p.id) && p.created_at === "")];
        },
        { carregou: true, indisponivel: false },
      );
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
        .channel(`pecas:${cenaId}${canalExtra}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "cena_pecas", filter: `cena_id=eq.${cenaId}` }, (msg) => {
          if (msg.eventType === "DELETE") {
            const id = (msg.old as { id?: string }).id;
            mexer((atual) => atual.filter((p) => p.id !== id));
            return;
          }
          const nova = normalizarPeca(msg.new);
          if (!nova) return;
          mexer((atual) => (atual.some((p) => p.id === nova.id) ? atual.map((p) => (p.id === nova.id ? nova : p)) : [...atual, nova]));
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
  }, [cenaId, mexer, canalExtra]);

  const adicionar = useCallback<Pecas["adicionar"]>(
    async (novas) => {
      if (!cenaId || novas.length === 0) return false;
      const linhas = novas.map((n) => ({
        id: crypto.randomUUID(),
        cena_id: cenaId,
        room_code: codigo,
        slug: n.slug,
        nome: n.nome,
        x: n.x,
        y: n.y,
        tamanho: n.tamanho ?? 1,
        cor: n.cor ?? null,
        oculto: n.oculto ?? false,
      }));
      // Aparece na hora (created_at vazio marca "ainda não confirmado").
      const provisorias = linhas.map((l) => normalizarPeca({ ...l, created_at: "" })).filter((p): p is Peca => p !== null);
      mexer((atual) => [...atual, ...provisorias]);
      const { data, error } = await supabase.from("cena_pecas").insert(linhas).select();
      if (error) {
        relatarErro("adicionarPecas", error);
        const ids = new Set(linhas.map((l) => l.id));
        mexer((atual) => atual.filter((p) => !ids.has(p.id)));
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
      const confirmadas = (data ?? []).map(normalizarPeca).filter((p): p is Peca => p !== null);
      mexer((atual) => atual.map((p) => confirmadas.find((c) => c.id === p.id) ?? p));
      setAviso(null);
      return true;
    },
    [cenaId, codigo, mexer],
  );

  const atualizar = useCallback<Pecas["atualizar"]>(
    async (id, mudanca) => {
      const antes = ref.current;
      mexer((atual) => atual.map((p) => (p.id === id ? { ...p, ...mudanca } : p)));
      const { error } = await supabase.from("cena_pecas").update(mudanca).eq("id", id);
      if (error) {
        relatarErro("atualizarPeca", error);
        mexer(() => antes);
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
      setAviso(null);
      return true;
    },
    [mexer],
  );

  const definirLuzes = useCallback<Pecas["definirLuzes"]>(
    async (mudancas) => {
      if (mudancas.length === 0) return true;
      const antes = ref.current;
      const porId = new Map(mudancas.map((m) => [m.id, m.luz]));
      mexer((atual) => atual.map((p) => (porId.has(p.id) ? { ...p, luz: porId.get(p.id) ?? null } : p)));
      const respostas = await Promise.all(mudancas.map((m) => supabase.from("cena_pecas").update(colunasDaLuz(m.luz)).eq("id", m.id)));
      const erro = respostas.find((r) => r.error)?.error;
      if (erro) {
        relatarErro("definirLuzes", erro);
        mexer(() => antes);
        setAviso("Não salvou a luz. Confira a conexão (e se a migration 0036 foi rodada) e tente de novo.");
        return false;
      }
      setAviso(null);
      return true;
    },
    [mexer],
  );

  const remover = useCallback<Pecas["remover"]>(
    async (id) => {
      const antes = ref.current;
      mexer((atual) => atual.filter((p) => p.id !== id));
      const { error } = await supabase.from("cena_pecas").delete().eq("id", id);
      if (error) {
        relatarErro("removerPeca", error);
        mexer(() => antes);
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
      setAviso(null);
      return true;
    },
    [mexer],
  );

  const removerTodas = useCallback<Pecas["removerTodas"]>(async () => {
    if (!cenaId) return false;
    const antes = ref.current;
    mexer(() => []);
    const { error } = await supabase.from("cena_pecas").delete().eq("cena_id", cenaId);
    if (error) {
      relatarErro("removerPecas", error);
      mexer(() => antes);
      setAviso(AVISO_NAO_SALVOU);
      return false;
    }
    setAviso(null);
    return true;
  }, [cenaId, mexer]);

  return { pecas, carregando, indisponivel: daCena?.indisponivel ?? false, aviso, adicionar, atualizar, definirLuzes, remover, removerTodas };
}
