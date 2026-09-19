"use client";

import { useSyncExternalStore } from "react";
import { assinarTrocaDeSala, codigoDaSala, SALA_PADRAO } from "@/lib/sala";

/** Código da sala desta aba (`?sala=...`, a última sala do aparelho ou o
 *  padrão), lido sem susto de hidratação: no servidor devolve o padrão, no
 *  cliente o valor real. Muda sem recarregar quando a pessoa troca de
 *  campanha pelo botão (`irParaSala`) ou volta com o botão de voltar. */
export function useCodigoSala(): string {
  return useSyncExternalStore(assinarTrocaDeSala, codigoDaSala, () => SALA_PADRAO);
}

// "Estou no navegador" não muda depois de virar true, não há o que assinar.
const semAssinatura = () => () => {};

/** false no servidor e durante a hidratação, true depois — antes disso a sala
 *  de verdade (URL ou última sala do aparelho) ainda não foi lida. */
export function useNoNavegador(): boolean {
  return useSyncExternalStore(
    semAssinatura,
    () => true,
    () => false,
  );
}
