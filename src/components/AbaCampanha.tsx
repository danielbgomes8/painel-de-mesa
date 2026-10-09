"use client";

import { useMemo, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Quadro } from "@/hooks/useQuadro";
import type { Bau } from "@/hooks/useBau";
import type { Tempo } from "@/hooks/useTempo";
import type { Identidade } from "@/lib/identidade";
import { DiarioCampanha } from "@/components/DiarioCampanha";
import { QuadroCampanha } from "@/components/QuadroCampanha";
import { BauDoGrupo } from "@/components/BauDoGrupo";
import { TempoDaCampanha } from "@/components/TempoDaCampanha";
import { AUTOR_MESTRE, cartoesVisiveis } from "@/lib/quadro";

type Parte = "quadro" | "bau" | "tempo" | "sessoes";

/** A aba da campanha: o Quadro (cartões com foto, o que a mesa vê e o que não),
 *  o baú do grupo e, ao lado, o diário de sessões de sempre. */
export function AbaCampanha({
  sala,
  codigo,
  quadro,
  bau,
  tempo,
  identidade,
}: {
  sala: Sala;
  codigo: string;
  quadro: Quadro;
  bau: Bau;
  tempo: Tempo;
  identidade: Identidade | null;
}) {
  const [parte, setParte] = useState<Parte>("quadro");
  // O cartão aberto mora aqui: a lista de sessões também abre cartões.
  const [aberto, setAberto] = useState<string | null>(null);
  const vistos = useMemo(() => cartoesVisiveis(quadro.cartoes, identidade), [quadro.cartoes, identidade]);
  const nomeDoAutor = (autor: string) =>
    autor === AUTOR_MESTRE ? "Mestre" : (sala.personagens.find((p) => p.slug === autor)?.name ?? "Alguém");
  return (
    <div className="combat">
      <div className="segmentos segmentos-campanha" role="group" aria-label="Parte da campanha">
        <button type="button" aria-pressed={parte === "quadro"} onClick={() => setParte("quadro")}>
          🗂 Quadro
        </button>
        <button type="button" aria-pressed={parte === "bau"} onClick={() => setParte("bau")}>
          🎒 Baú
        </button>
        <button type="button" aria-pressed={parte === "tempo"} onClick={() => setParte("tempo")}>
          🗓 {tempo.tempo ? `Dia ${tempo.tempo.dia}` : "Tempo"}
        </button>
        <button type="button" aria-pressed={parte === "sessoes"} onClick={() => setParte("sessoes")}>
          📖 Sessões
        </button>
      </div>
      {parte === "tempo" ? (
        <TempoDaCampanha tempo={tempo} sala={sala} souMestre={identidade?.tipo === "mestre"} />
      ) : parte === "bau" ? (
        <BauDoGrupo bau={bau} sala={sala} codigo={codigo} identidade={identidade} />
      ) : parte === "quadro" ? (
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
          codigo={codigo}
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
