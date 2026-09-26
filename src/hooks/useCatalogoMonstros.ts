"use client";

import { useCallback, useEffect, useState } from "react";

type Catalogo = typeof import("@/lib/monstrosSrd");

/**
 * O catálogo de monstros (331, ~90 KB) só é baixado quando a tela que usa ele
 * aparece — biblioteca do Mestre ou montagem de encontro —, não na abertura
 * do app, que é o que todo celular da mesa faz. Depois de baixado fica no
 * aparelho (o service worker guarda `/_next/static/`).
 *
 * Sem internet e sem ter baixado antes, `falhou` fica true e a tela oferece
 * tentar de novo.
 */
export function useCatalogoMonstros(): { catalogo: Catalogo | null; falhou: boolean; tentarDeNovo: () => void } {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    import("@/lib/monstrosSrd").then(
      (modulo) => {
        if (!vivo) return;
        setCatalogo(modulo);
        setFalhou(false);
      },
      () => {
        if (vivo) setFalhou(true);
      },
    );
    return () => {
      vivo = false;
    };
  }, [tentativa]);

  const tentarDeNovo = useCallback(() => setTentativa((n) => n + 1), []);
  return { catalogo, falhou, tentarDeNovo };
}
