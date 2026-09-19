"use client";

import { useSyncExternalStore } from "react";
import { assinarIdentidade, lerIdentidade, salasComIdentidade, type Identidade } from "@/lib/identidade";

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

/** Salas em que este aparelho já entrou — o seletor de campanha mostra as que
 *  estão fora do catálogo (abertas por código). */
export function useSalasDoAparelho(): string[] {
  const todas = useSyncExternalStore(assinarIdentidade, salasComIdentidade, () => "");
  return todas.split(",").filter(Boolean);
}
