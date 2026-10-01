"use client";

import { useEffect, useRef } from "react";
import type { Cena } from "@/lib/cenas";

/** "Tem um mapa na mesa" — aparece pro jogador quando o Mestre põe um mapa na
 *  tela da mesa e ele não está olhando a aba Mapa. Sem isso a aba só aparece no
 *  menu, e quem está na ficha pode passar a sessão sem notar. Some quando a
 *  pessoa abre o mapa ou toca no ✕; volta a aparecer se o Mestre trocar de mapa
 *  (quem decide se já viu é `visto`, o id do último mapa que a pessoa viu).
 *  Uma vibração curta, sem som: é um aviso, não um alarme. */
export function BannerMapaNaMesa({
  cena,
  visto,
  aoAbrir,
  aoDispensar,
}: {
  cena: Cena | null;
  visto: string | null;
  aoAbrir: () => void;
  aoDispensar: () => void;
}) {
  const aparecendo = Boolean(cena && cena.id !== visto);
  const avisadoRef = useRef<string | null>(null);
  const id = cena?.id ?? null;
  useEffect(() => {
    if (!aparecendo || !id || avisadoRef.current === id) return;
    avisadoRef.current = id;
    try {
      navigator.vibrate?.(60);
    } catch {
      // sem vibração: o banner na tela já avisa
    }
  }, [aparecendo, id]);

  if (!cena || !aparecendo) return null;
  return (
    <div className="mapabanner" role="status">
      <span className="mapabanner-texto">
        🗺 <b>Tem um mapa na mesa</b>
        {cena.nome ? ` · ${cena.nome}` : ""}
      </span>
      <button type="button" className="mapabanner-abrir" onClick={aoAbrir}>
        ver o mapa
      </button>
      <button type="button" className="mapabanner-fechar" onClick={aoDispensar} aria-label="Dispensar o aviso do mapa">
        ✕
      </button>
    </div>
  );
}
