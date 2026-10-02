"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { ehTabelaAusente } from "@/lib/cenas";
import { MARCAS_MAXIMAS, normalizarMarca, type Marca, type NovaMarca } from "@/lib/marcas";

const AVISO_NAO_SALVOU = "Não salvou a marca. Confira a conexão e tente de novo.";
const AVISO_LIMITE = `Esta cena já tem ${MARCAS_MAXIMAS} desenhos e notas, que é o máximo.`;
const SEM_MARCAS: Marca[] = [];

export type Marcas = {
  marcas: Marca[];
  carregando: boolean;
  /** A tabela ainda não existe (migration 0022 não rodada): o mapa funciona sem marcas. */
  indisponivel: boolean;
  aviso: string | null;
  adicionar: (nova: NovaMarca) => Promise<boolean>;
  /** Muda só o que foi pedido (texto da nota, se a mesa vê): nunca a linha inteira. */
  atualizar: (id: string, patch: Partial<Pick<Marca, "texto" | "visivel" | "cor">>) => Promise<boolean>;
  remover: (id: string) => Promise<boolean>;
  removerTodas: () => Promise<boolean>;
};

/**
 * Os desenhos e notas de UMA cena, ao vivo: o que o Mestre risca aparece no
 * telão e nos celulares na hora. Mesma forma do `useParedes` (estado preso à
 * cena, canal próprio, releitura a cada reconexão) e, como ele, tolera a
 * tabela ainda não existir.
 */
export function useMarcas(cenaId: string | null, codigo: string): Marcas {
  const [dados, setDados] = useState<{ cenaId: string | null; marcas: Marca[]; carregou: boolean; indisponivel: boolean }>({
    cenaId: null,
    marcas: [],
    carregou: false,
    indisponivel: false,
  });
  const [aviso, setAviso] = useState<string | null>(null);
  const daCena = dados.cenaId === cenaId ? dados : null;
  const marcas = daCena?.marcas ?? SEM_MARCAS;
  const carregando = Boolean(cenaId) && supabaseConfigurado && !daCena?.carregou;
  const ref = useRef<Marca[]>([]);
  useEffect(() => {
    ref.current = marcas;
  }, [marcas]);

  const mexer = useCallback(
    (fn: (atual: Marca[]) => Marca[], extra: { carregou?: boolean; indisponivel?: boolean } = {}) => {
      setDados((d) => {
        const base = d.cenaId === cenaId ? d : { cenaId, marcas: [], carregou: false, indisponivel: false };
        return {
          cenaId,
          marcas: fn(base.marcas),
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
        .from("cena_marcas")
        .select("*")
        .eq("cena_id", cenaId)
        .order("created_at", { ascending: true });
      if (!vivo) return false;
      if (error) {
        if (ehTabelaAusente(error)) mexer((a) => a, { carregou: true, indisponivel: true });
        else {
          relatarErro("lerMarcas", error);
          mexer((a) => a, { carregou: true });
        }
        return false;
      }
      const lidas = (data ?? []).map(normalizarMarca).filter((m): m is Marca => m !== null);
      mexer(
        (atual) => {
          // Marca criada agora há pouco, ainda não devolvida pelo banco, fica.
          const ids = new Set(lidas.map((m) => m.id));
          return [...lidas, ...atual.filter((m) => !ids.has(m.id) && m.created_at === "")];
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
        .channel(`marcas:${cenaId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "cena_marcas", filter: `cena_id=eq.${cenaId}` }, (msg) => {
          if (msg.eventType === "DELETE") {
            const id = (msg.old as { id?: string }).id;
            mexer((atual) => atual.filter((m) => m.id !== id));
            return;
          }
          const nova = normalizarMarca(msg.new);
          if (!nova) return;
          mexer((atual) => (atual.some((m) => m.id === nova.id) ? atual.map((m) => (m.id === nova.id ? nova : m)) : [...atual, nova]));
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
  }, [cenaId, mexer]);

  const adicionar = useCallback<Marcas["adicionar"]>(
    async (nova) => {
      if (!cenaId) return false;
      if (ref.current.length >= MARCAS_MAXIMAS) {
        setAviso(AVISO_LIMITE);
        return false;
      }
      const linha: Record<string, unknown> & { id: string } = {
        id: crypto.randomUUID(),
        cena_id: cenaId,
        room_code: codigo,
        tipo: nova.tipo,
        cor: nova.cor,
        visivel: nova.visivel,
        ...(nova.tipo === "traco" ? { pontos: nova.pontos } : { x: nova.x, y: nova.y, texto: nova.texto }),
      };
      // Aparece na hora (created_at vazio marca "ainda não confirmado").
      const provisoria = normalizarMarca({ ...linha, created_at: "" });
      if (!provisoria) return false;
      mexer((atual) => [...atual, provisoria]);
      const { data, error } = await supabase.from("cena_marcas").insert(linha).select();
      if (error) {
        relatarErro("adicionarMarca", error);
        mexer((atual) => atual.filter((m) => m.id !== linha.id));
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
      const confirmada = (data ?? []).map(normalizarMarca).find((m): m is Marca => m !== null);
      if (confirmada) mexer((atual) => atual.map((m) => (m.id === confirmada.id ? confirmada : m)));
      setAviso(null);
      return true;
    },
    [cenaId, codigo, mexer],
  );

  const atualizar = useCallback<Marcas["atualizar"]>(
    async (id, patch) => {
      const antes = ref.current;
      mexer((atual) => atual.map((m) => (m.id === id ? { ...m, ...patch } : m)));
      const { error } = await supabase.from("cena_marcas").update(patch).eq("id", id);
      if (error) {
        relatarErro("atualizarMarca", error);
        mexer(() => antes);
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
      setAviso(null);
      return true;
    },
    [mexer],
  );

  const remover = useCallback<Marcas["remover"]>(
    async (id) => {
      const antes = ref.current;
      mexer((atual) => atual.filter((m) => m.id !== id));
      const { error } = await supabase.from("cena_marcas").delete().eq("id", id);
      if (error) {
        relatarErro("removerMarca", error);
        mexer(() => antes);
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
      setAviso(null);
      return true;
    },
    [mexer],
  );

  const removerTodas = useCallback<Marcas["removerTodas"]>(async () => {
    if (!cenaId) return false;
    const antes = ref.current;
    mexer(() => []);
    const { error } = await supabase.from("cena_marcas").delete().eq("cena_id", cenaId);
    if (error) {
      relatarErro("removerMarcas", error);
      mexer(() => antes);
      setAviso(AVISO_NAO_SALVOU);
      return false;
    }
    setAviso(null);
    return true;
  }, [cenaId, mexer]);

  return { marcas, carregando, indisponivel: daCena?.indisponivel ?? false, aviso, adicionar, atualizar, remover, removerTodas };
}
