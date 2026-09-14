"use client";

import { useEffect, useRef, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import { alertarSuaVez } from "@/lib/alerta";
import { avancarTurno } from "@/components/RastreadorCombate";

/** "É a sua vez!" — aparece pro jogador quando o turno atual do rastreador
 *  de combate é o do personagem dele, com vibração + bipe (só funciona com a
 *  aba aberta em primeiro plano) — e um botão pra passar a própria vez sem
 *  precisar pedir pro Mestre. Só existe quando `minhaVez` é verdadeiro, então
 *  ninguém passa a vez de outro personagem por aqui. */
export function BannerSuaVez({
  sala,
  meuSlug,
}: {
  sala: Sala;
  meuSlug: string;
}) {
  const { combate } = sala;
  const atual = combate.order[combate.turn];
  const minhaVez = Boolean(atual && atual.slug === meuSlug);
  const [ocupado, setOcupado] = useState(false);

  const eraMinhaVez = useRef(false);
  useEffect(() => {
    if (minhaVez && !eraMinhaVez.current) alertarSuaVez();
    eraMinhaVez.current = minhaVez;
  }, [minhaVez]);

  if (!minhaVez) return null;

  async function passar() {
    if (ocupado) return;
    setOcupado(true);
    await avancarTurno(sala);
    setOcupado(false);
  }

  return (
    <div className="turnbanner" role="status">
      <span>É a sua vez! · Rodada {combate.round}</span>
      <button type="button" className="turnbanner-pass" onClick={passar} disabled={ocupado}>
        Passar a vez →
      </button>
    </div>
  );
}
