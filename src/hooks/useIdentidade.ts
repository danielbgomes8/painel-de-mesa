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

/** Outras salas em que este aparelho já entrou — o atalho "outra mesa" do
 *  topo, que é o único jeito de trocar de campanha no app instalado. */
export function useOutrasSalas(salaAtual: string): string[] {
  const todas = useSyncExternalStore(assinarIdentidade, salasComIdentidade, () => "");
  return todas.split(",").filter((s) => s && s !== salaAtual);
}
