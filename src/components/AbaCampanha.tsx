"use client";

import { useEffect, useMemo, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Quadro } from "@/hooks/useQuadro";
import type { Bau } from "@/hooks/useBau";
import type { Tempo } from "@/hooks/useTempo";
import type { Folhas } from "@/hooks/useFolhas";
import { FolhasDaCampanha } from "@/components/FolhasDaCampanha";
import type { Relogios } from "@/hooks/useRelogios";
import { RelogiosDaCampanha } from "@/components/RelogiosDaCampanha";
import type { LojaHook } from "@/hooks/useLoja";
import { LojaDaCampanha } from "@/components/LojaDaCampanha";
import type { Identidade } from "@/lib/identidade";
import { DiarioCampanha } from "@/components/DiarioCampanha";
import { QuadroCampanha } from "@/components/QuadroCampanha";
import { BauDoGrupo } from "@/components/BauDoGrupo";
import { TempoDaCampanha } from "@/components/TempoDaCampanha";
import { AUTOR_MESTRE, cartoesVisiveis } from "@/lib/quadro";
import { registrarUso } from "@/lib/registrarUso";

export type ParteDaCampanha = "quadro" | "bau" | "tempo" | "folhas" | "relogios" | "loja" | "sessoes";
type Parte = ParteDaCampanha;

/** A aba da campanha: o Quadro (cartões com foto, o que a mesa vê e o que não),
 *  o baú do grupo e, ao lado, o diário de sessões de sempre. */
export function AbaCampanha({
  sala,
  codigo,
  quadro,
  bau,
  tempo,
  folhas,
  relogios,
  loja,
  novasFolhas,
  aoVerFolhas,
  parteInicial = "quadro",
  identidade,
}: {
  sala: Sala;
  codigo: string;
  quadro: Quadro;
  bau: Bau;
  tempo: Tempo;
  folhas: Folhas;
  relogios: Relogios;
  loja: LojaHook;
  /** Quantas folhas entregues a este jogador ele ainda não abriu (o número no botão). */
  novasFolhas: number;
  aoVerFolhas: (ids: string[]) => void;
  /** A parte que abre primeiro (o aviso de "folha nova" leva direto às Folhas). */
  parteInicial?: Parte;
  identidade: Identidade | null;
}) {
  const [parte, setParte] = useState<Parte>(parteInicial);
  // O cartão aberto mora aqui: a lista de sessões também abre cartões.
  const [aberto, setAberto] = useState<string | null>(null);
  useEffect(() => {
    registrarUso(`campanha:${parte}`);
  }, [parte]);
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
        {!folhas.indisponivel || identidade?.tipo === "mestre" ? (
          <button type="button" aria-pressed={parte === "folhas"} onClick={() => setParte("folhas")}>
            📜 Folhas{novasFolhas > 0 ? ` (${novasFolhas})` : ""}
          </button>
        ) : null}
        {(!loja.indisponivel || identidade?.tipo === "mestre") && (
          <button type="button" aria-pressed={parte === "loja"} onClick={() => setParte("loja")}>
            🛒 Loja
          </button>
        )}
        {identidade?.tipo === "mestre" && (
          <button type="button" aria-pressed={parte === "relogios"} onClick={() => setParte("relogios")}>
            ⏳ Relógios
          </button>
        )}
        <button type="button" aria-pressed={parte === "sessoes"} onClick={() => setParte("sessoes")}>
          📖 Sessões
        </button>
      </div>
      {parte === "loja" ? (
        <LojaDaCampanha loja={loja} sala={sala} identidade={identidade} />
      ) : parte === "relogios" ? (
        <RelogiosDaCampanha relogios={relogios} sala={sala} />
      ) : parte === "folhas" ? (
        <FolhasDaCampanha folhas={folhas} sala={sala} identidade={identidade} aoVer={aoVerFolhas} />
      ) : parte === "tempo" ? (
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
