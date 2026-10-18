"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import type { Regiao } from "@/lib/cenas";
import { VISTA_INTERVALO_MS, VISTA_LEMBRETE_MS, pacoteDaVista, validarVista, type VistaMestre } from "@/lib/vistaMestre";

/** "controle": o Mestre conduzindo. "espectador": aparelho com Vista Mestre ligada. null: nem um nem outro (sem canal). */
export type PapelNaVista = "controle" | "espectador" | null;

export type CanalDaVista = {
  /** A última vista que chegou do Mestre (só pro espectador). */
  recebida: VistaMestre | null;
  /** Controle: o pedaço que a tela mostra agora. */
  enviarRegiao: (r: Regiao) => void;
  /** Controle: o peão em foco (o cartão dele abre no telão), ou null. */
  enviarFoco: (id: string | null) => void;
};

/**
 * O canal da Vista Mestre: transmissão ("broadcast") do Supabase Realtime, um
 * canal por cena, como o ping — nada é gravado. Ver `lib/vistaMestre.ts`.
 *
 * - Controle: manda a vista com freio (`VISTA_INTERVALO_MS`, sempre a mais
 *   recente), repete a última a cada `VISTA_LEMBRETE_MS` e responde na hora a
 *   quem pede ("pedir", mandado por quem acabou de entrar).
 * - Espectador: guarda a última que chega, depois de `validarVista`.
 */
export function useVistaMestre(cena: { id: string; largura: number; altura: number } | null, papel: PapelNaVista): CanalDaVista {
  const [recebida, setRecebida] = useState<VistaMestre | null>(null);
  const canalRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const ultimaRef = useRef<VistaMestre | null>(null);
  const freioRef = useRef<{ timer: number; pendente: boolean }>({ timer: 0, pendente: false });
  const cenaId = cena?.id ?? null;
  const largura = cena?.largura ?? 0;
  const altura = cena?.altura ?? 0;

  const mandarAgora = useCallback(() => {
    const v = ultimaRef.current;
    if (!v || !canalRef.current) return;
    void canalRef.current.send({ type: "broadcast", event: "vista", payload: pacoteDaVista(v) });
  }, []);

  useEffect(() => {
    if (!cenaId || !papel || !supabaseConfigurado) return;
    const canal = supabase.channel(`vista:${cenaId}`, { config: { broadcast: { self: false } } });
    let lembrete = 0;
    if (papel === "espectador") {
      canal.on("broadcast", { event: "vista" }, ({ payload }) => {
        const v = validarVista(payload, { largura, altura });
        if (v) setRecebida(v);
      });
    } else {
      canal.on("broadcast", { event: "pedir" }, () => mandarAgora());
      lembrete = window.setInterval(mandarAgora, VISTA_LEMBRETE_MS);
    }
    canal.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      if (papel === "espectador") void canal.send({ type: "broadcast", event: "pedir", payload: {} });
      else mandarAgora();
    });
    canalRef.current = canal;
    const freio = freioRef.current;
    return () => {
      window.clearInterval(lembrete);
      window.clearTimeout(freio.timer);
      freio.timer = 0;
      freio.pendente = false;
      canalRef.current = null;
      supabase.removeChannel(canal);
      setRecebida(null);
    };
  }, [cenaId, largura, altura, papel, mandarAgora]);

  // Manda já e segura as próximas por VISTA_INTERVALO_MS; o que chegar nesse
  // meio-tempo sai no fim (só a mais recente, que é a que importa).
  const agendar = useCallback(() => {
    const freio = freioRef.current;
    if (freio.timer) {
      freio.pendente = true;
      return;
    }
    mandarAgora();
    const soltar = () => {
      if (freio.pendente) {
        freio.pendente = false;
        mandarAgora();
        freio.timer = window.setTimeout(soltar, VISTA_INTERVALO_MS);
      } else freio.timer = 0;
    };
    freio.timer = window.setTimeout(soltar, VISTA_INTERVALO_MS);
  }, [mandarAgora]);

  const enviarRegiao = useCallback(
    (r: Regiao) => {
      ultimaRef.current = { regiao: r, foco: ultimaRef.current?.foco ?? null };
      agendar();
    },
    [agendar],
  );

  const enviarFoco = useCallback(
    (id: string | null) => {
      const atual = ultimaRef.current;
      if (!atual || atual.foco === id) return;
      ultimaRef.current = { ...atual, foco: id };
      agendar();
    },
    [agendar],
  );

  return { recebida, enviarRegiao, enviarFoco };
}
