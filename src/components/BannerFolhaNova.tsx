"use client";

import { useEffect, useRef } from "react";

/** "Chegou uma folha" — aparece pro jogador quando o Mestre entrega uma carta ou pergaminho e ele não está olhando
 *  as Folhas. Some quando a pessoa abre a lista (as folhas passam a contar como vistas) ou toca no ✕. Uma vibração
 *  curta, sem som, como o aviso do mapa na mesa. */
export function BannerFolhaNova({ quantas, aoAbrir, aoDispensar }: { quantas: number; aoAbrir: () => void; aoDispensar: () => void }) {
  const avisadoRef = useRef(0);
  useEffect(() => {
    if (quantas <= avisadoRef.current) return;
    avisadoRef.current = quantas;
    try {
      navigator.vibrate?.(60);
    } catch {
      // sem vibração: o banner na tela já avisa
    }
  }, [quantas]);

  if (quantas <= 0) return null;
  return (
    <div className="mapabanner" role="status">
      <span className="mapabanner-texto">
        📜 <b>{quantas === 1 ? "Chegou uma folha pra você" : `Chegaram ${quantas} folhas pra você`}</b>
      </span>
      <button type="button" className="mapabanner-abrir" onClick={aoAbrir}>
        ler
      </button>
      <button type="button" className="mapabanner-fechar" onClick={aoDispensar} aria-label="Dispensar o aviso das folhas">
        ✕
      </button>
    </div>
  );
}
