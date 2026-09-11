"use client";

import { useSyncExternalStore } from "react";
import { assinarIdentidade, lerIdentidade, type Identidade } from "@/lib/identidade";

/** Identidade da pessoa nesta sala (Mestre / jogador), lida do localStorage
 *  como external store — sem setState em efeito, sem susto de hidratação
 *  (no servidor não há identidade nenhuma: `null`). */
export function useIdentidade(sala: string): Identidade | null {
  return useSyncExternalStore(
    assinarIdentidade,
    () => lerIdentidade(sala),
    () => null,
  );
}
