"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { ehTabelaAusente } from "@/lib/cenas";
import {
  DIA_MAXIMO,
  DURACAO_MAXIMA,
  MAX_EFEITOS,
  normalizarEfeito,
  normalizarTempo,
  type EfeitoDeTempo,
  type NovoEfeito,
  type TempoCampanha,
} from "@/lib/tempoCampanha";

const TENTATIVAS = 6;

export type Tempo = {
  /** null = a sala ainda não começou a contar os dias. */
  tempo: TempoCampanha | null;
  efeitos: EfeitoDeTempo[];
  carregando: boolean;
  /** As tabelas ainda não existem (migration 0028 não rodada): o resto do app funciona. */
  indisponivel: boolean;
  /** Começa a contar (Dia 1). false se falhou. */
  iniciar: () => Promise<boolean>;
  /** Anda `delta` dias (negativo volta), sem passar de 1 nem do máximo. Devolve o tempo de antes e o de
   *  depois, ou null se não coube ou falhou. Dois aparelhos avançando juntos não somam duas vezes:
   *  o segundo lê de novo e tenta outra vez. */
  mudarDia: (delta: number) => Promise<{ antes: TempoCampanha; depois: TempoCampanha } | null>;
  /** Muda o calendário e/ou a âncora da data (não mexe no contador de dias). */
  configurar: (mudanca: Partial<Pick<TempoCampanha, "calendario" | "inicio_dia_do_ano" | "inicio_ano">>) => Promise<boolean>;
  criarEfeito: (novo: NovoEfeito) => Promise<EfeitoDeTempo | null>;
  removerEfeito: (id: string) => Promise<boolean>;
};

function juntar(atual: EfeitoDeTempo[], nova: EfeitoDeTempo): EfeitoDeTempo[] {
  return atual.some((e) => e.id === nova.id) ? atual.map((e) => (e.id === nova.id ? nova : e)) : [...atual, nova];
}

/**
 * O tempo da campanha (dia, calendário e efeitos que duram dias), ao vivo. Canal próprio, fora do
 * `useSala`, e tolera as tabelas não existirem — o código vai ao ar antes do SQL (mesmo desenho do
 * `useBau`).
 */
export function useTempo(codigo: string): Tempo {
  const [tempo, setTempo] = useState<TempoCampanha | null>(null);
  const [efeitos, setEfeitos] = useState<EfeitoDeTempo[]>([]);
  const [carregando, setCarregando] = useState(supabaseConfigurado);
  const [indisponivel, setIndisponivel] = useState(false);
  const tempoRef = useRef<TempoCampanha | null>(null);
  const efeitosRef = useRef<EfeitoDeTempo[]>([]);
  useEffect(() => {
    tempoRef.current = tempo;
    efeitosRef.current = efeitos;
  }, [tempo, efeitos]);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let vivo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;

    async function carregar(): Promise<boolean> {
      const [t, e] = await Promise.all([
        supabase.from("campanha_tempo").select("*").eq("room_code", codigo).maybeSingle(),
        supabase.from("campanha_efeitos").select("*").eq("room_code", codigo).order("created_at", { ascending: true }),
      ]);
      if (!vivo) return false;
      const erro = t.error ?? e.error;
      if (erro) {
        if (ehTabelaAusente(erro)) setIndisponivel(true);
        else relatarErro("lerTempo", erro);
        setCarregando(false);
        return false;
      }
      setIndisponivel(false);
      setTempo(normalizarTempo(t.data));
      setEfeitos((e.data ?? []).map(normalizarEfeito).filter((x) => x.id !== ""));
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
        .channel(`tempo:${codigo}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "campanha_tempo", filter: `room_code=eq.${codigo}` },
          (msg) => {
            if (msg.eventType === "DELETE") setTempo(null);
            else setTempo(normalizarTempo(msg.new));
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "campanha_efeitos", filter: `room_code=eq.${codigo}` },
          (msg) => {
            if (msg.eventType === "DELETE") {
              const id = (msg.old as { id?: string }).id;
              setEfeitos((atual) => atual.filter((x) => x.id !== id));
              return;
            }
            const nova = normalizarEfeito(msg.new);
            if (nova.id) setEfeitos((atual) => juntar(atual, nova));
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

  const iniciar = useCallback<Tempo["iniciar"]>(async () => {
    const { data, error } = await supabase.from("campanha_tempo").insert({ room_code: codigo }).select().maybeSingle();
    // 23505 = outro aparelho começou a contar agora há pouco: a linha dele vale.
    if (error && error.code !== "23505") {
      relatarErro("iniciarTempo", error);
      return false;
    }
    if (data) setTempo(normalizarTempo(data));
    return true;
  }, [codigo]);

  const mudarDia = useCallback<Tempo["mudarDia"]>(
    async (delta) => {
      if (!Number.isFinite(delta) || delta === 0) return null;
      for (let t = 0; t < TENTATIVAS; t++) {
        const lida = await supabase.from("campanha_tempo").select("*").eq("room_code", codigo).maybeSingle();
        if (lida.error) {
          relatarErro("lerDiaDaCampanha", lida.error);
          return null;
        }
        const antes = normalizarTempo(lida.data);
        if (!antes) return null;
        const dia = antes.dia + Math.round(delta);
        if (dia < 1 || dia > DIA_MAXIMO) return null;
        const r = await supabase
          .from("campanha_tempo")
          .update({ dia, updated_at: new Date().toISOString() })
          .eq("room_code", codigo)
          .eq("dia", antes.dia)
          .select()
          .maybeSingle();
        if (r.error) {
          relatarErro("mudarDiaDaCampanha", r.error);
          return null;
        }
        const depois = normalizarTempo(r.data);
        if (depois) {
          setTempo(depois);
          return { antes, depois };
        }
        // Nenhuma linha voltou: alguém mexeu entre a leitura e a escrita. Lê de novo.
      }
      return null;
    },
    [codigo],
  );

  const configurar = useCallback<Tempo["configurar"]>(
    async (mudanca) => {
      const { data, error } = await supabase
        .from("campanha_tempo")
        .update({ ...mudanca, updated_at: new Date().toISOString() })
        .eq("room_code", codigo)
        .select()
        .maybeSingle();
      if (error) {
        relatarErro("configurarTempo", error);
        return false;
      }
      if (data) setTempo(normalizarTempo(data));
      return Boolean(data);
    },
    [codigo],
  );

  const criarEfeito = useCallback<Tempo["criarEfeito"]>(
    async (novo) => {
      const atual = tempoRef.current;
      const nome = novo.nome.trim();
      if (!atual || !nome || efeitosRef.current.length >= MAX_EFEITOS) return null;
      const duracao = Math.max(1, Math.min(DURACAO_MAXIMA, Math.round(novo.duracao)));
      const { data, error } = await supabase
        .from("campanha_efeitos")
        .insert({
          room_code: codigo,
          nome: nome.slice(0, 80),
          alvo: (novo.alvo ?? "").trim().slice(0, 60),
          inicio_dia: atual.dia,
          duracao,
          nota: (novo.nota ?? "").trim().slice(0, 300),
        })
        .select()
        .maybeSingle();
      if (error || !data) {
        if (error) relatarErro("criarEfeitoDeTempo", error);
        return null;
      }
      const criado = normalizarEfeito(data);
      setEfeitos((lista) => juntar(lista, criado));
      return criado;
    },
    [codigo],
  );

  const removerEfeito = useCallback<Tempo["removerEfeito"]>(async (id) => {
    const { error } = await supabase.from("campanha_efeitos").delete().eq("id", id);
    if (error) {
      relatarErro("removerEfeitoDeTempo", error);
      return false;
    }
    setEfeitos((lista) => lista.filter((e) => e.id !== id));
    return true;
  }, []);

  return { tempo, efeitos, carregando, indisponivel, iniciar, mudarDia, configurar, criarEfeito, removerEfeito };
}
