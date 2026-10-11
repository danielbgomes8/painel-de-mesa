"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { ehTabelaAusente } from "@/lib/cenas";
import { ARMADILHAS_MAXIMAS, RAIO_PADRAO_M, normalizarArmadilha, type Armadilha, type NovaArmadilha } from "@/lib/armadilhas";

const AVISO_NAO_SALVOU = "Não salvou a armadilha. Confira a conexão e tente de novo.";
const AVISO_LIMITE = `Esta cena já tem ${ARMADILHAS_MAXIMAS} armadilhas, que é o máximo.`;
const SEM_ARMADILHAS: Armadilha[] = [];

export type Armadilhas = {
  armadilhas: Armadilha[];
  carregando: boolean;
  /** A tabela ainda não existe (migration 0036 não rodada): o mapa funciona sem armadilhas. */
  indisponivel: boolean;
  aviso: string | null;
  adicionar: (nova: NovaArmadilha) => Promise<boolean>;
  /** Muda só o que foi pedido (estado, texto, lugar...): nunca a linha inteira. */
  atualizar: (id: string, patch: Partial<Pick<Armadilha, "nome" | "x" | "y" | "raio" | "salvaguarda" | "cd" | "dano" | "nota" | "estado">>) => Promise<boolean>;
  remover: (id: string) => Promise<boolean>;
};

/**
 * As armadilhas de UMA cena, ao vivo. Mesma forma do `useMarcas` (estado preso à cena, canal próprio,
 * releitura a cada reconexão) e, como ele, tolera a tabela ainda não existir. Quem decide o que cada um
 * enxerga é `armadilhasVisiveis` (lib/armadilhas.ts): este hook entrega todas.
 */
export function useArmadilhas(cenaId: string | null, codigo: string, canalExtra = ""): Armadilhas {
  const [dados, setDados] = useState<{ cenaId: string | null; lista: Armadilha[]; carregou: boolean; indisponivel: boolean }>({
    cenaId: null,
    lista: [],
    carregou: false,
    indisponivel: false,
  });
  const [aviso, setAviso] = useState<string | null>(null);
  const daCena = dados.cenaId === cenaId ? dados : null;
  const armadilhas = daCena?.lista ?? SEM_ARMADILHAS;
  const carregando = Boolean(cenaId) && supabaseConfigurado && !daCena?.carregou;
  const ref = useRef<Armadilha[]>([]);
  useEffect(() => {
    ref.current = armadilhas;
  }, [armadilhas]);

  const mexer = useCallback(
    (fn: (atual: Armadilha[]) => Armadilha[], extra: { carregou?: boolean; indisponivel?: boolean } = {}) => {
      setDados((d) => {
        const base = d.cenaId === cenaId ? d : { cenaId, lista: [], carregou: false, indisponivel: false };
        return {
          cenaId,
          lista: fn(base.lista),
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
        .from("cena_armadilhas")
        .select("*")
        .eq("cena_id", cenaId)
        .order("created_at", { ascending: true });
      if (!vivo) return false;
      if (error) {
        if (ehTabelaAusente(error)) mexer((a) => a, { carregou: true, indisponivel: true });
        else {
          relatarErro("lerArmadilhas", error);
          mexer((a) => a, { carregou: true });
        }
        return false;
      }
      const lidas = (data ?? []).map(normalizarArmadilha).filter((a): a is Armadilha => a !== null);
      mexer(
        (atual) => {
          // Armadilha criada agora há pouco, ainda não devolvida pelo banco, fica.
          const ids = new Set(lidas.map((a) => a.id));
          return [...lidas, ...atual.filter((a) => !ids.has(a.id) && a.created_at === "")];
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
        .channel(`armadilhas:${cenaId}${canalExtra}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "cena_armadilhas", filter: `cena_id=eq.${cenaId}` }, (msg) => {
          if (msg.eventType === "DELETE") {
            const id = (msg.old as { id?: string }).id;
            mexer((atual) => atual.filter((a) => a.id !== id));
            return;
          }
          const nova = normalizarArmadilha(msg.new);
          if (!nova) return;
          mexer((atual) => (atual.some((a) => a.id === nova.id) ? atual.map((a) => (a.id === nova.id ? nova : a)) : [...atual, nova]));
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

  const adicionar = useCallback<Armadilhas["adicionar"]>(
    async (nova) => {
      if (!cenaId) return false;
      if (ref.current.length >= ARMADILHAS_MAXIMAS) {
        setAviso(AVISO_LIMITE);
        return false;
      }
      const linha = {
        id: crypto.randomUUID(),
        cena_id: cenaId,
        room_code: codigo,
        nome: nova.nome,
        x: nova.x,
        y: nova.y,
        raio: nova.raio ?? RAIO_PADRAO_M,
        salvaguarda: nova.salvaguarda ?? "",
        cd: nova.cd ?? null,
        dano: nova.dano ?? "",
        nota: nova.nota ?? "",
        estado: "armada",
      };
      // Aparece na hora (created_at vazio marca "ainda não confirmado").
      const provisoria = normalizarArmadilha({ ...linha, created_at: "" });
      if (!provisoria) return false;
      mexer((atual) => [...atual, provisoria]);
      const { data, error } = await supabase.from("cena_armadilhas").insert(linha).select();
      if (error) {
        relatarErro("adicionarArmadilha", error);
        mexer((atual) => atual.filter((a) => a.id !== linha.id));
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
      const confirmada = (data ?? []).map(normalizarArmadilha).find((a): a is Armadilha => a !== null);
      if (confirmada) mexer((atual) => atual.map((a) => (a.id === confirmada.id ? confirmada : a)));
      setAviso(null);
      return true;
    },
    [cenaId, codigo, mexer],
  );

  const atualizar = useCallback<Armadilhas["atualizar"]>(
    async (id, patch) => {
      const antes = ref.current;
      mexer((atual) => atual.map((a) => (a.id === id ? { ...a, ...patch } : a)));
      const { error } = await supabase.from("cena_armadilhas").update(patch).eq("id", id);
      if (error) {
        relatarErro("atualizarArmadilha", error);
        mexer(() => antes);
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
      setAviso(null);
      return true;
    },
    [mexer],
  );

  const remover = useCallback<Armadilhas["remover"]>(
    async (id) => {
      const antes = ref.current;
      mexer((atual) => atual.filter((a) => a.id !== id));
      const { error } = await supabase.from("cena_armadilhas").delete().eq("id", id);
      if (error) {
        relatarErro("removerArmadilha", error);
        mexer(() => antes);
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
      setAviso(null);
      return true;
    },
    [mexer],
  );

  return { armadilhas, carregando, indisponivel: daCena?.indisponivel ?? false, aviso, adicionar, atualizar, remover };
}
