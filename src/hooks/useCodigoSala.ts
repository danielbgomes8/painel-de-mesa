"use client";

import { useSyncExternalStore } from "react";
import { codigoDaSala, SALA_PADRAO } from "@/lib/sala";

// A URL não muda sem recarregar a página, então não há o que assinar.
const semAssinatura = () => () => {};

/** Código da sala desta aba (`?sala=...` ou o padrão), lido sem susto de
 *  hidratação: no servidor devolve o padrão, no cliente o valor real. */
export function useCodigoSala(): string {
  return useSyncExternalStore(semAssinatura, codigoDaSala, () => SALA_PADRAO);
}

/** false no servidor e durante a hidratação, true depois — antes disso a sala
 *  de verdade (URL ou última sala do aparelho) ainda não foi lida. */
export function useNoNavegador(): boolean {
  return useSyncExternalStore(
    semAssinatura,
    () => true,
    () => false,
  );
}
