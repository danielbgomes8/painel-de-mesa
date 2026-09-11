"use client";

import { useEffect, useRef } from "react";
import type { EstadoCombate } from "@/lib/tipos";
import { alertarSuaVez } from "@/lib/alerta";

/** "É a sua vez!" — aparece pro jogador quando o turno atual do rastreador
 *  de combate é o do personagem dele, com vibração + bipe (só funciona com a
 *  aba aberta em primeiro plano). */
export function BannerSuaVez({
  combate,
  meuSlug,
}: {
  combate: EstadoCombate;
  meuSlug: string;
}) {
  const atual = combate.order[combate.turn];
  const minhaVez = Boolean(atual && atual.slug === meuSlug);

  const eraMinhaVez = useRef(false);
  useEffect(() => {
    if (minhaVez && !eraMinhaVez.current) alertarSuaVez();
    eraMinhaVez.current = minhaVez;
  }, [minhaVez]);

  if (!minhaVez) return null;
  return (
    <div className="turnbanner" role="status">
      É a sua vez! · Rodada {combate.round}
    </div>
  );
}
