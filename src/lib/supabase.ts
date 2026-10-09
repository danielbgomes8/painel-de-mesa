"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente do Supabase pro navegador. A chave `anon` é pública de propósito
 * (vai pro bundle); quem protege os dados é o RLS do banco — ver README.
 *
 * Se as variáveis não estiverem definidas, `supabaseConfigurado` fica `false`
 * e o painel mostra um aviso em vez de quebrar.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(url && anon);

/** Pedido que não responde nisso é dado como sem internet (ver
 *  lib/offline.ts): wi-fi "conectado" mas sem internet deixa o pedido
 *  pendurado por dezenas de segundos, e até lá o app nem sabia que devia
 *  guardar as mudanças na fila. */
const PRAZO_REDE_MS = 10_000;
/** Envio de imagem (mapas, Storage) é bem mais pesado que uma ficha: no 4G um
 *  JPEG de 2 MB leva mais que os 10 s de cima e seria cortado no meio. */
const PRAZO_ARQUIVO_MS = 90_000;

function fetchComPrazo(entrada: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  const ms = url.includes("/storage/v1/") ? PRAZO_ARQUIVO_MS : PRAZO_REDE_MS;
  const prazo = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(ms) : null;
  // Quem chamou pode ter mandado o próprio sinal de cancelar: vale o que vier
  // primeiro. Navegador sem AbortSignal.any fica só com o de quem chamou.
  const sinal =
    prazo && init.signal
      ? typeof AbortSignal.any === "function"
        ? AbortSignal.any([init.signal, prazo])
        : init.signal
      : (init.signal ?? prazo ?? undefined);
  // `fetch` resolvido a cada chamada (a biblioteca guardaria o da hora em que
  // o cliente nasce): é o que deixa simular queda de internet no teste
  // manual trocando `window.fetch` no console — ver "Sem internet" em
  // docs/agentes/infra.md.
  return fetch(entrada, { ...init, signal: sinal });
}

export const supabase = createClient(url ?? "https://sem-config.supabase.co", anon ?? "sem-config", {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } },
  global: { fetch: fetchComPrazo },
});
