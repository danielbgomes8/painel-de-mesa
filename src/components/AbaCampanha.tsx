"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Quadro } from "@/hooks/useQuadro";
import type { Identidade } from "@/lib/identidade";
import { DiarioCampanha } from "@/components/DiarioCampanha";
import { QuadroCampanha } from "@/components/QuadroCampanha";

type Parte = "quadro" | "sessoes";

/** A aba da campanha: o Quadro (cartões com foto, o que a mesa vê e o que não)
 *  e, ao lado, o diário de sessões de sempre. */
export function AbaCampanha({ sala, quadro, identidade }: { sala: Sala; quadro: Quadro; identidade: Identidade | null }) {
  const [parte, setParte] = useState<Parte>("quadro");
  return (
    <div className="combat">
      <div className="combat-head">
        <h2>Campanha</h2>
        <div className="qd-vistas" role="group" aria-label="Parte da campanha">
          <button type="button" className="chip" aria-pressed={parte === "quadro"} onClick={() => setParte("quadro")}>
            🗂 Quadro
          </button>
          <button type="button" className="chip" aria-pressed={parte === "sessoes"} onClick={() => setParte("sessoes")}>
            📖 Sessões
          </button>
        </div>
      </div>
      {parte === "quadro" ? (
        <QuadroCampanha quadro={quadro} quem={identidade} />
      ) : (
        <DiarioCampanha sala={sala} souMestre={identidade?.tipo === "mestre"} semCabecalho />
      )}
    </div>
  );
}
