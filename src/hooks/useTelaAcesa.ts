"use client";

import { useEffect, useState } from "react";
import { manterTelaAcesa, type PedirTrava, type SituacaoTela } from "@/lib/telaAcesa";

/** Segura a tela acesa enquanto o componente estiver na tela (ver
 *  `manterTelaAcesa`). `null` = ainda não sabe (antes do primeiro pedido). */
export function useTelaAcesa(): SituacaoTela | null {
  const [situacao, setSituacao] = useState<SituacaoTela | null>(null);
  useEffect(() => {
    // Só existe em página segura (HTTPS ou localhost) e navegador recente.
    const pedir: PedirTrava | undefined = "wakeLock" in navigator ? navigator.wakeLock : undefined;
    return manterTelaAcesa(pedir, document, setSituacao);
  }, []);
  return situacao;
}
