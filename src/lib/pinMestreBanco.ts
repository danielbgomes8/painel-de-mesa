"use client";

import { supabase } from "@/lib/supabase";
import { ehFalhaDeRede } from "@/lib/offline";
import { hashDoPin } from "@/lib/pinMestre";

/** O que a sala diz sobre o PIN do Mestre.
 *  - `guardado`: texto = tem PIN; null = não tem.
 *  - `semRede`: não deu pra perguntar — o portão não adivinha.
 *  Coluna ausente (migration 0041 por rodar) volta como "sem PIN". */
export type LeituraDoPin = { ok: true; guardado: string | null } | { ok: false; semRede: boolean };

export async function lerPinDaSala(codigo: string): Promise<LeituraDoPin> {
  const { data, error } = await supabase.from("rooms").select("mestre_pin_hash").eq("code", codigo).maybeSingle();
  if (error) {
    if (ehFalhaDeRede(error)) return { ok: false, semRede: true };
    // Migration ainda não rodada: a coluna não existe, então não há PIN.
    if (/mestre_pin_hash/.test(error.message) || error.code === "42703") return { ok: true, guardado: null };
    return { ok: false, semRede: false };
  }
  const hash = (data as { mestre_pin_hash?: string | null } | null)?.mestre_pin_hash;
  return { ok: true, guardado: hash ? hash : null };
}

/** Liga, troca (`pin` com texto) ou tira (`pin` null) o PIN. true só depois de o banco aceitar. */
export async function gravarPinDaSala(codigo: string, pin: string | null): Promise<boolean> {
  const hash = pin === null ? null : await hashDoPin(codigo, pin);
  const { error } = await supabase.from("rooms").update({ mestre_pin_hash: hash }).eq("code", codigo);
  return !error;
}
