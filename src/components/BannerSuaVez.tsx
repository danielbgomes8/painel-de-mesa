"use client";

import type { EstadoCombate } from "@/lib/tipos";

/** "É a sua vez!" — aparece pro jogador quando o turno atual do rastreador
 *  de combate é o do personagem dele. */
export function BannerSuaVez({
  combate,
  meuSlug,
}: {
  combate: EstadoCombate;
  meuSlug: string;
}) {
  const atual = combate.order[combate.turn];
  if (!atual || atual.slug !== meuSlug) return null;
  return (
    <div className="turnbanner" role="status">
      É a sua vez! · Rodada {combate.round}
    </div>
  );
}
