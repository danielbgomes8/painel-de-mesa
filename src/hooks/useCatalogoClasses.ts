"use client";

import { useCallback, useEffect, useState } from "react";

type Catalogo = typeof import("@/lib/classesSrd");

/**
 * As habilidades de classe por nível (~40 KB de texto) não vêm na abertura do
 * app: baixam quando a ficha que mostra elas aparece — e, no tempo livre logo
 * depois de abrir, pra todo mundo (ver `preCarregarNoTempoLivre` no Painel),
 * porque a ficha tem de abrir sem internet e o service worker só guarda o que
 * já foi baixado. Mesma forma do `useCatalogoMonstros`.
 *
 * Sem internet e sem ter baixado antes, `falhou` fica true e a tela oferece
 * tentar de novo.
 */
export function useCatalogoClasses(): { catalogo: Catalogo | null; falhou: boolean; tentarDeNovo: () => void } {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    import("@/lib/classesSrd").then(
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
