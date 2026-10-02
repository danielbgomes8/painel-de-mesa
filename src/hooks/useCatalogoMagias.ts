"use client";

import { useCallback, useEffect, useState } from "react";

type Catalogo = typeof import("@/lib/magiasSrd");

/**
 * O catálogo de magias (339, ~340 KB) só é baixado quando a lista de magias de
 * um personagem abre — não na abertura do app, que é o que todo celular da
 * mesa faz. Depois de baixado fica no aparelho (o service worker guarda
 * `/_next/static/`). Mesmo desenho do catálogo de monstros.
 */
export function useCatalogoMagias(ativo: boolean): { catalogo: Catalogo | null; falhou: boolean; tentarDeNovo: () => void } {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    import("@/lib/magiasSrd").then(
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
  }, [ativo, tentativa]);

  const tentarDeNovo = useCallback(() => setTentativa((n) => n + 1), []);
  return { catalogo, falhou, tentarDeNovo };
}
