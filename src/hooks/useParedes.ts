"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { ehTabelaAusente } from "@/lib/cenas";
import { PAREDES_MAXIMAS, normalizarParede, type NovaParede, type Parede } from "@/lib/paredes";
import { criarEscudoDeEco } from "@/lib/escudoDeEco";

const AVISO_NAO_SALVOU = "Não salvou a parede. Confira a conexão e tente de novo.";
const AVISO_LIMITE = `Esta cena já tem ${PAREDES_MAXIMAS} paredes e portas, que é o máximo.`;
const SEM_PAREDES: Parede[] = [];

export type Paredes = {
  paredes: Parede[];
  carregando: boolean;
  /** A tabela ainda não existe (migration 0021 não rodada): o mapa funciona sem paredes. */
  indisponivel: boolean;
  aviso: string | null;
  adicionar: (novas: NovaParede[]) => Promise<boolean>;
  /** Abre ou fecha uma porta (só ela muda: nunca a linha inteira). */
  alternarPorta: (id: string) => Promise<boolean>;
  /** Muda só o que foi pedido numa porta (trancada, secreta, as CDs, aberta): nunca a linha inteira. */
  atualizarPorta: (id: string, mudanca: Partial<Pick<Parede, "aberta" | "trancada" | "secreta" | "cd" | "cd_achar">>) => Promise<boolean>;
  remover: (id: string) => Promise<boolean>;
  /** Várias numa escrita só (desfazer uma curva ou um cômodo inteiro). */
  removerVarias: (ids: string[]) => Promise<boolean>;
  removerTodas: () => Promise<boolean>;
};

/**
 * As paredes e portas de UMA cena, ao vivo: abrir uma porta no celular do Mestre
 * muda a névoa no telão na hora. Mesma forma do `usePecas` (estado preso à cena,
 * canal próprio, releitura a cada reconexão) e, como ele, tolera a tabela ainda
 * não existir.
 */
export function useParedes(cenaId: string | null, codigo: string, canalExtra = ""): Paredes {
  const [dados, setDados] = useState<{ cenaId: string | null; paredes: Parede[]; carregou: boolean; indisponivel: boolean }>({
    cenaId: null,
    paredes: [],
    carregou: false,
    indisponivel: false,
  });
  const [aviso, setAviso] = useState<string | null>(null);
  const daCena = dados.cenaId === cenaId ? dados : null;
  const paredes = daCena?.paredes ?? SEM_PAREDES;
  const carregando = Boolean(cenaId) && supabaseConfigurado && !daCena?.carregou;
  const ref = useRef<Parede[]>([]);
  useEffect(() => {
    ref.current = paredes;
  }, [paredes]);
  // O aviso de tempo real de uma gravação ANTERIOR não pode devolver a porta ao estado velho no meio de toques seguidos
  // (lib/escudoDeEco.ts); passada a janela, as paredes da cena são relidas uma vez.
  const [escudo] = useState(() => criarEscudoDeEco());

  const mexer = useCallback(
    (fn: (atual: Parede[]) => Parede[], extra: { carregou?: boolean; indisponivel?: boolean } = {}) => {
      setDados((d) => {
        const base = d.cenaId === cenaId ? d : { cenaId, paredes: [], carregou: false, indisponivel: false };
        return {
          cenaId,
          paredes: fn(base.paredes),
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
        .from("cena_paredes")
        .select("*")
        .eq("cena_id", cenaId)
        .order("created_at", { ascending: true });
      if (!vivo) return false;
      if (error) {
        if (ehTabelaAusente(error)) mexer((a) => a, { carregou: true, indisponivel: true });
        else {
          relatarErro("lerParedes", error);
          mexer((a) => a, { carregou: true });
        }
        return false;
      }
      const lidas = (data ?? []).map(normalizarParede).filter((p): p is Parede => p !== null);
      mexer(
        (atual) => {
          // Parede criada agora há pouco, ainda não devolvida pelo banco, fica.
          const ids = new Set(lidas.map((p) => p.id));
          return [...lidas, ...atual.filter((p) => !ids.has(p.id) && p.created_at === "")];
        },
        { carregou: true, indisponivel: false },
      );
      return true;
    }

    escudo.aoFechar(() => {
      void carregar();
    });

    const aoVoltar = () => {
      if (document.visibilityState === "visible") void carregar();
    };

    void carregar().then((ok) => {
      if (!vivo || !ok) return;
      document.addEventListener("visibilitychange", aoVoltar);
      window.addEventListener("online", aoVoltar);
      canal = supabase
        .channel(`paredes:${cenaId}${canalExtra}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "cena_paredes", filter: `cena_id=eq.${cenaId}` }, (msg) => {
          if (msg.eventType === "DELETE") {
            const id = (msg.old as { id?: string }).id;
            mexer((atual) => atual.filter((p) => p.id !== id));
            return;
          }
          const nova = normalizarParede(msg.new);
          if (!nova || escudo.protegido(nova.id)) return;
          mexer((atual) => (atual.some((p) => p.id === nova.id) ? atual.map((p) => (p.id === nova.id ? nova : p)) : [...atual, nova]));
        })
        .subscribe((status) => {
          if (vivo && status === "SUBSCRIBED") void carregar();
        });
    });

    return () => {
      vivo = false;
      escudo.encerrar();
      escudo.aoFechar(() => {});
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", aoVoltar);
      if (canal) supabase.removeChannel(canal);
    };
  }, [cenaId, mexer, canalExtra, escudo]);

  const adicionar = useCallback<Paredes["adicionar"]>(
    async (novas) => {
      if (!cenaId || novas.length === 0) return false;
      if (ref.current.length + novas.length > PAREDES_MAXIMAS) {
        setAviso(AVISO_LIMITE);
        return false;
      }
      const linhas = novas.map((n) => ({
        id: crypto.randomUUID(),
        cena_id: cenaId,
        room_code: codigo,
        tipo: n.tipo,
        x1: n.x1,
        y1: n.y1,
        x2: n.x2,
        y2: n.y2,
        aberta: n.tipo === "porta" ? (n.aberta ?? false) : false,
      }));
      // Aparece na hora (created_at vazio marca "ainda não confirmado").
      const provisorias = linhas.map((l) => normalizarParede({ ...l, created_at: "" })).filter((p): p is Parede => p !== null);
      mexer((atual) => [...atual, ...provisorias]);
      const { data, error } = await supabase.from("cena_paredes").insert(linhas).select();
      if (error) {
        relatarErro("adicionarParedes", error);
        const ids = new Set(linhas.map((l) => l.id));
        mexer((atual) => atual.filter((p) => !ids.has(p.id)));
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
      const confirmadas = (data ?? []).map(normalizarParede).filter((p): p is Parede => p !== null);
      mexer((atual) => atual.map((p) => confirmadas.find((c) => c.id === p.id) ?? p));
      setAviso(null);
      return true;
    },
    [cenaId, codigo, mexer],
  );

  const alternarPorta = useCallback<Paredes["alternarPorta"]>(
    async (id) => {
      const antes = ref.current;
      const porta = antes.find((p) => p.id === id && p.tipo === "porta");
      if (!porta) return false;
      const aberta = !porta.aberta;
      escudo.proteger(id);
      mexer((atual) => atual.map((p) => (p.id === id ? { ...p, aberta } : p)));
      const { error } = await supabase.from("cena_paredes").update({ aberta }).eq("id", id);
      if (error) {
        relatarErro("alternarPorta", error);
        mexer(() => antes);
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
      setAviso(null);
      return true;
    },
    [mexer, escudo],
  );

  const atualizarPorta = useCallback<Paredes["atualizarPorta"]>(
    async (id, mudanca) => {
      const antes = ref.current;
      if (!antes.some((p) => p.id === id && p.tipo === "porta")) return false;
      escudo.proteger(id);
      mexer((atual) => atual.map((p) => (p.id === id ? { ...p, ...mudanca } : p)));
      const { error } = await supabase.from("cena_paredes").update(mudanca).eq("id", id);
      if (error) {
        relatarErro("atualizarPorta", error);
        mexer(() => antes);
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
      setAviso(null);
      return true;
    },
    [mexer, escudo],
  );

  const remover = useCallback<Paredes["remover"]>(
    async (id) => {
      const antes = ref.current;
      mexer((atual) => atual.filter((p) => p.id !== id));
      const { error } = await supabase.from("cena_paredes").delete().eq("id", id);
      if (error) {
        relatarErro("removerParede", error);
        mexer(() => antes);
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
      setAviso(null);
      return true;
    },
    [mexer],
  );

  const removerVarias = useCallback<Paredes["removerVarias"]>(
    async (ids) => {
      if (ids.length === 0) return false;
      const antes = ref.current;
      const fora = new Set(ids);
      mexer((atual) => atual.filter((p) => !fora.has(p.id)));
      const { error } = await supabase.from("cena_paredes").delete().in("id", ids);
      if (error) {
        relatarErro("removerParedes (várias)", error);
        mexer(() => antes);
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
      setAviso(null);
      return true;
    },
    [mexer],
  );

  const removerTodas = useCallback<Paredes["removerTodas"]>(async () => {
    if (!cenaId) return false;
    const antes = ref.current;
    mexer(() => []);
    const { error } = await supabase.from("cena_paredes").delete().eq("cena_id", cenaId);
    if (error) {
      relatarErro("removerParedes", error);
      mexer(() => antes);
      setAviso(AVISO_NAO_SALVOU);
      return false;
    }
    setAviso(null);
    return true;
  }, [cenaId, mexer]);

  return { paredes, carregando, indisponivel: daCena?.indisponivel ?? false, aviso, adicionar, alternarPorta, atualizarPorta, remover, removerVarias, removerTodas };
}
