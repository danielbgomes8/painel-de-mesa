"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { normalizarRegra, ordenarRegras, type NovaRegra, type RegraNevoa } from "@/lib/cenas";

const AVISO_NAO_SALVOU = "Não salvou a névoa. Confira a conexão e tente de novo.";
/** O Supabase devolve no máximo 1000 linhas por pedido. */
const TAMANHO_PAGINA = 1000;
/** Mesma lista vazia sempre: o React não vê "mudança" a cada render. */
const SEM_REGRAS: RegraNevoa[] = [];

export type Nevoa = {
  /** As pinceladas da cena, da mais antiga pra mais nova. */
  regras: RegraNevoa[];
  carregando: boolean;
  aviso: string | null;
  adicionar: (nova: NovaRegra) => Promise<boolean>;
  /** Apaga a pincelada mais nova. */
  desfazerUltima: () => Promise<boolean>;
  /** Apaga todas as pinceladas (a cena volta ao ponto de partida). */
  limpar: () => Promise<boolean>;
};

/**
 * A névoa de UMA cena, ao vivo: o que o Mestre pinta chega na hora no telão e
 * nos celulares. As pinceladas são linhas de `cena_nevoa`; apagar uma delas
 * (desfazer) também chega nos outros aparelhos, porque a tabela usa
 * `replica identity full` (migration 0018).
 *
 * A tela mostra a pincelada antes de o banco confirmar (o id é gerado aqui, e
 * o evento que volta pelo tempo real, com o mesmo id, não duplica nada). Se o
 * banco recusar, a pincelada some e o aviso diz que não salvou.
 */
export function useNevoa(cenaId: string | null, codigo: string): Nevoa {
  // O estado guarda a cena a que as pinceladas pertencem: ao trocar de cena,
  // as da anterior simplesmente deixam de valer (derivado, sem setState no efeito).
  const [dados, setDados] = useState<{ cenaId: string | null; regras: RegraNevoa[]; carregou: boolean }>({
    cenaId: null,
    regras: [],
    carregou: false,
  });
  const [aviso, setAviso] = useState<string | null>(null);
  const daCena = dados.cenaId === cenaId ? dados : null;
  const regras = daCena?.regras ?? SEM_REGRAS;
  const carregando = Boolean(cenaId) && supabaseConfigurado && !daCena?.carregou;
  const ref = useRef<RegraNevoa[]>([]);
  useEffect(() => {
    ref.current = regras;
  }, [regras]);

  /** Muda as pinceladas DA cena atual (começa do zero se o estado era de outra). */
  const mexer = useCallback(
    (fn: (atual: RegraNevoa[]) => RegraNevoa[], carregou?: boolean) => {
      setDados((d) => {
        const base = d.cenaId === cenaId ? d : { cenaId, regras: [], carregou: false };
        return { cenaId, regras: fn(base.regras), carregou: carregou ?? base.carregou };
      });
    },
    [cenaId],
  );

  useEffect(() => {
    if (!cenaId || !supabaseConfigurado) return;
    let vivo = true;

    async function carregar() {
      const lidas: RegraNevoa[] = [];
      for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
        const { data, error } = await supabase
          .from("cena_nevoa")
          .select("*")
          .eq("cena_id", cenaId)
          .order("seq", { ascending: true })
          .range(inicio, inicio + TAMANHO_PAGINA - 1);
        if (!vivo) return;
        if (error) {
          relatarErro("lerNevoa", error);
          mexer((atual) => atual, true);
          return;
        }
        for (const linha of data ?? []) {
          const r = normalizarRegra(linha);
          if (r) lidas.push(r);
        }
        if ((data ?? []).length < TAMANHO_PAGINA) break;
      }
      // O que ainda não voltou do banco (pincelada feita agora há pouco) fica:
      // a leitura pode ter começado antes dela chegar.
      mexer((atual) => {
        const ids = new Set(lidas.map((r) => r.id));
        const pendentes = atual.filter((r) => !ids.has(r.id) && r.seq >= Number.MAX_SAFE_INTEGER / 2);
        return ordenarRegras([...lidas, ...pendentes]);
      }, true);
    }

    const aoVoltar = () => {
      if (document.visibilityState === "visible") void carregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("online", aoVoltar);

    const canal = supabase
      .channel(`nevoa:${cenaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cena_nevoa", filter: `cena_id=eq.${cenaId}` },
        (msg) => {
          if (msg.eventType === "DELETE") {
            const id = (msg.old as { id?: string }).id;
            mexer((atual) => atual.filter((r) => r.id !== id));
            return;
          }
          const nova = normalizarRegra(msg.new);
          if (!nova) return;
          mexer((atual) =>
            ordenarRegras(atual.some((r) => r.id === nova.id) ? atual.map((r) => (r.id === nova.id ? nova : r)) : [...atual, nova]),
          );
        },
      )
      .subscribe((status) => {
        if (vivo && status === "SUBSCRIBED") void carregar();
      });

    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", aoVoltar);
      supabase.removeChannel(canal);
    };
  }, [cenaId, mexer]);

  const adicionar = useCallback<Nevoa["adicionar"]>(
    async (nova) => {
      if (!cenaId) return false;
      const id = crypto.randomUUID();
      // Provisória: bem no fim da fila até o banco dizer a posição de verdade.
      const provisoria = { ...nova, id, seq: Number.MAX_SAFE_INTEGER / 2 + ref.current.length } as RegraNevoa;
      mexer((atual) => ordenarRegras([...atual, provisoria]));
      const { data, error } = await supabase
        .from("cena_nevoa")
        .insert({ id, cena_id: cenaId, room_code: codigo, modo: nova.modo, forma: nova.forma, dados: nova.dados })
        .select()
        .single();
      if (error) {
        relatarErro("adicionarNevoa", error);
        mexer((atual) => atual.filter((r) => r.id !== id));
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
      const confirmada = normalizarRegra(data);
      if (confirmada) {
        mexer((atual) => ordenarRegras(atual.map((r) => (r.id === id ? confirmada : r))));
      }
      setAviso(null);
      return true;
    },
    [cenaId, codigo, mexer],
  );

  const desfazerUltima = useCallback<Nevoa["desfazerUltima"]>(async () => {
    const antes = ref.current;
    const ultima = antes[antes.length - 1];
    if (!ultima) return false;
    mexer((atual) => atual.filter((r) => r.id !== ultima.id));
    const { error } = await supabase.from("cena_nevoa").delete().eq("id", ultima.id);
    if (error) {
      relatarErro("desfazerNevoa", error);
      mexer(() => antes);
      setAviso(AVISO_NAO_SALVOU);
      return false;
    }
    setAviso(null);
    return true;
  }, [mexer]);

  const limpar = useCallback<Nevoa["limpar"]>(async () => {
    if (!cenaId) return false;
    const antes = ref.current;
    mexer(() => []);
    const { error } = await supabase.from("cena_nevoa").delete().eq("cena_id", cenaId);
    if (error) {
      relatarErro("limparNevoa", error);
      mexer(() => antes);
      setAviso(AVISO_NAO_SALVOU);
      return false;
    }
    setAviso(null);
    return true;
  }, [cenaId, mexer]);

  return { regras, carregando, aviso, adicionar, desfazerUltima, limpar };
}
