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

export const supabase = createClient(url ?? "https://sem-config.supabase.co", anon ?? "sem-config", {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } },
});
