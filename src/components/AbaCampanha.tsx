"use client";

import { useMemo, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Quadro } from "@/hooks/useQuadro";
import type { Identidade } from "@/lib/identidade";
import { DiarioCampanha } from "@/components/DiarioCampanha";
import { QuadroCampanha } from "@/components/QuadroCampanha";
import { AUTOR_MESTRE, cartoesVisiveis } from "@/lib/quadro";

type Parte = "quadro" | "sessoes";

/** A aba da campanha: o Quadro (cartões com foto, o que a mesa vê e o que não)
 *  e, ao lado, o diário de sessões de sempre. */
export function AbaCampanha({ sala, quadro, identidade }: { sala: Sala; quadro: Quadro; identidade: Identidade | null }) {
  const [parte, setParte] = useState<Parte>("quadro");
  // O cartão aberto mora aqui: a lista de sessões também abre cartões.
  const [aberto, setAberto] = useState<string | null>(null);
  const vistos = useMemo(() => cartoesVisiveis(quadro.cartoes, identidade), [quadro.cartoes, identidade]);
  const nomeDoAutor = (autor: string) =>
    autor === AUTOR_MESTRE ? "Mestre" : (sala.personagens.find((p) => p.slug === autor)?.name ?? "Alguém");
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
        <QuadroCampanha
          quadro={quadro}
          quem={identidade}
          sessoes={sala.diario}
          nomeDoAutor={nomeDoAutor}
          aberto={aberto}
          setAberto={setAberto}
        />
      ) : (
        <DiarioCampanha
          sala={sala}
          souMestre={identidade?.tipo === "mestre"}
          semCabecalho
          cartoes={vistos}
          aoAbrirCartao={(id) => {
            setAberto(id);
            setParte("quadro");
          }}
        />
      )}
    </div>
  );
}
