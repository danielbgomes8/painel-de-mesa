"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import {
  PING_DURACAO_MS,
  adicionarPing,
  pingsAtivos,
  podePingar,
  validarPing,
  type PingNaTela,
  type PingRecebido,
} from "@/lib/ping";
import {
  REGUA_DURACAO_MS,
  adicionarRegua,
  reguasAtivas,
  validarRegua,
  type ModoRegua,
  type ReguaNaTela,
  type ReguaRecebida,
} from "@/lib/regua";
import {
  AREA_DURACAO_MS,
  adicionarArea,
  areasAtivas,
  validarArea,
  type AreaNaTela,
  type AreaRecebida,
  type ModeloArea,
} from "@/lib/area";
import type { Ponto } from "@/lib/cenas";

/** Quem está pingando neste aparelho: o nome que aparece no mapa e a cor. */
export type QuemPinga = { nome: string; cor: string };

export type Pings = {
  /** Pings que ainda estão na tela (os de agora e os que chegaram há pouco). */
  pings: PingNaTela[];
  /** Pinga no ponto (px da imagem da cena). Sem `quem` (telão), não faz nada. */
  enviar: (x: number, y: number) => void;
  /** Réguas que ainda estão na tela (a medida some depois de uns segundos). */
  reguas: ReguaNaTela[];
  /** Mostra pra mesa a régua de `a` até `b`; `desloc` = deslocamento (m) de quem foi medido. */
  enviarRegua: (a: Ponto, b: Ponto, modo: ModoRegua, desloc: number | null) => void;
  /** Modelos de magia que ainda estão na tela. */
  areas: AreaNaTela[];
  /** Mostra pra mesa a área do `modelo` com origem `o`, apontando pra `d`. */
  enviarArea: (modelo: ModeloArea, o: Ponto, d: Ponto) => void;
};

/**
 * Ping no mapa, ao vivo e sem banco: cada cena tem um canal de transmissão
 * ("broadcast" do Supabase Realtime) por onde os aparelhos se avisam. Nada é
 * gravado; o ping some sozinho depois de alguns segundos. O telão só recebe
 * (`quem` null); Mestre e jogadores recebem e mandam.
 *
 * Tudo que chega passa por `validarPing`: o canal é aberto, então qualquer
 * aparelho poderia mandar lixo.
 */
export function usePing(
  cena: { id: string; largura: number; altura: number } | null,
  quem: QuemPinga | null,
): Pings {
  const [pings, setPings] = useState<PingNaTela[]>([]);
  const [reguas, setReguas] = useState<ReguaNaTela[]>([]);
  const [areas, setAreas] = useState<AreaNaTela[]>([]);
  const ultimaReguaRef = useRef<number | null>(null);
  const ultimaAreaRef = useRef<number | null>(null);
  const canalRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const ultimoRef = useRef<number | null>(null);
  const cenaId = cena?.id ?? null;
  const largura = cena?.largura ?? 0;
  const altura = cena?.altura ?? 0;

  useEffect(() => {
    if (!cenaId || !supabaseConfigurado) return;
    const canal = supabase.channel(`ping:${cenaId}`, { config: { broadcast: { self: false } } });
    canal
      .on("broadcast", { event: "ping" }, ({ payload }) => {
        const ping = validarPing(payload, { largura, altura });
        if (!ping) return;
        setPings((atual) => adicionarPing(atual, { ...ping, chegouEm: performance.now() }));
      })
      .on("broadcast", { event: "regua" }, ({ payload }) => {
        const regua = validarRegua(payload, { largura, altura });
        if (!regua) return;
        setReguas((atual) => adicionarRegua(atual, { ...regua, chegouEm: performance.now() }));
      })
      .on("broadcast", { event: "area" }, ({ payload }) => {
        const area = validarArea(payload, { largura, altura });
        if (!area) return;
        setAreas((atual) => adicionarArea(atual, { ...area, chegouEm: performance.now() }));
      })
      .subscribe();
    canalRef.current = canal;
    return () => {
      canalRef.current = null;
      supabase.removeChannel(canal);
      setPings([]);
      setReguas([]);
      setAreas([]);
    };
  }, [cenaId, largura, altura]);

  // Limpa o que já passou, pra a lista não crescer numa sessão longa (o
  // adicionarPing também limpa, mas só quando chega ping novo).
  useEffect(() => {
    if (pings.length === 0) return;
    const t = window.setTimeout(() => setPings((atual) => pingsAtivos(atual, performance.now())), PING_DURACAO_MS + 200);
    return () => window.clearTimeout(t);
  }, [pings]);

  useEffect(() => {
    if (reguas.length === 0) return;
    const t = window.setTimeout(() => setReguas((atual) => reguasAtivas(atual, performance.now())), REGUA_DURACAO_MS + 200);
    return () => window.clearTimeout(t);
  }, [reguas]);

  useEffect(() => {
    if (areas.length === 0) return;
    const t = window.setTimeout(() => setAreas((atual) => areasAtivas(atual, performance.now())), AREA_DURACAO_MS + 200);
    return () => window.clearTimeout(t);
  }, [areas]);

  const enviarArea = useCallback<Pings["enviarArea"]>(
    (modelo, o, d) => {
      const canal = canalRef.current;
      if (!quem || !canal) return;
      const agora = performance.now();
      if (!podePingar(ultimaAreaRef.current, agora)) return;
      ultimaAreaRef.current = agora;
      const arredondar = (n: number) => Math.round(n * 10) / 10;
      const area: AreaRecebida = {
        id: crypto.randomUUID(),
        forma: modelo.forma,
        o: [arredondar(o[0]), arredondar(o[1])],
        d: [arredondar(d[0]), arredondar(d[1])],
        metros: modelo.metros,
        largura: modelo.largura,
        de: quem.nome,
        cor: quem.cor,
      };
      // Aparece na hora pra quem mandou; o canal não devolve a própria mensagem.
      setAreas((atual) => adicionarArea(atual, { ...area, chegouEm: agora }));
      canal.send({ type: "broadcast", event: "area", payload: area }).catch((e: unknown) => relatarErro("enviarArea", e));
    },
    [quem],
  );

  const enviarRegua = useCallback<Pings["enviarRegua"]>(
    (a, b, modo, desloc) => {
      const canal = canalRef.current;
      if (!quem || !canal) return;
      const agora = performance.now();
      if (!podePingar(ultimaReguaRef.current, agora)) return;
      ultimaReguaRef.current = agora;
      const regua: ReguaRecebida = {
        id: crypto.randomUUID(),
        a: [Math.round(a[0] * 10) / 10, Math.round(a[1] * 10) / 10],
        b: [Math.round(b[0] * 10) / 10, Math.round(b[1] * 10) / 10],
        modo,
        de: quem.nome,
        cor: quem.cor,
        desloc,
      };
      // Aparece na hora pra quem mediu; o canal não devolve a própria mensagem.
      setReguas((atual) => adicionarRegua(atual, { ...regua, chegouEm: agora }));
      canal.send({ type: "broadcast", event: "regua", payload: regua }).catch((e: unknown) => relatarErro("enviarRegua", e));
    },
    [quem],
  );

  const enviar = useCallback<Pings["enviar"]>(
    (x, y) => {
      const canal = canalRef.current;
      if (!quem || !canal) return;
      const agora = performance.now();
      if (!podePingar(ultimoRef.current, agora)) return;
      ultimoRef.current = agora;
      const ping: PingRecebido = {
        id: crypto.randomUUID(),
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        de: quem.nome,
        cor: quem.cor,
      };
      // Aparece na hora pra quem pingou; o canal não devolve a própria mensagem.
      setPings((atual) => adicionarPing(atual, { ...ping, chegouEm: agora }));
      canal.send({ type: "broadcast", event: "ping", payload: ping }).catch((e: unknown) => relatarErro("enviarPing", e));
    },
    [quem],
  );

  return { pings, enviar, reguas, enviarRegua, areas, enviarArea };
}
