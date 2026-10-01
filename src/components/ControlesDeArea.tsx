"use client";

import { useState } from "react";
import {
  FORMAS_AREA,
  LARGURAS_DA_LINHA,
  MEDIDA_DA_FORMA,
  NOME_DA_FORMA,
  TAMANHOS_PRONTOS,
  metrosValidos,
  quadradosDoTamanho,
  trocarForma,
  type ModeloArea,
} from "@/lib/area";
import { formatarMetros } from "@/lib/regras";

/** Escolha da forma e do tamanho de um modelo de magia (a mesma pro Mestre e
 *  pros jogadores). Tamanhos prontos são os que as magias mais usam (em metros:
 *  5 pés = 1,5 m); "outro" aceita qualquer valor. */
export function ControlesDeArea({
  modelo,
  aoMudar,
  metrosPorQuadrado,
}: {
  modelo: ModeloArea;
  aoMudar: (m: ModeloArea) => void;
  /** Quantos metros vale o quadradinho da cena (pra dizer "= 4 quadrados"). */
  metrosPorQuadrado: number;
}) {
  const [outro, setOutro] = useState("");
  const quadrados = quadradosDoTamanho({ metros: metrosPorQuadrado }, modelo.metros);
  const medida = MEDIDA_DA_FORMA[modelo.forma];

  function digitou(texto: string) {
    setOutro(texto);
    const valor = metrosValidos(Number(texto.replace(",", ".")));
    if (valor !== null) aoMudar({ ...modelo, metros: valor });
  }

  return (
    <>
      <div className="mapa-ferr" role="group" aria-label="Forma da magia">
        {FORMAS_AREA.map((f) => (
          <button
            key={f}
            type="button"
            className="chip alvo"
            aria-pressed={modelo.forma === f}
            onClick={() => {
              setOutro("");
              aoMudar(trocarForma(modelo, f));
            }}
          >
            {NOME_DA_FORMA[f]}
          </button>
        ))}
      </div>
      <div className="mapa-ferr" role="group" aria-label={`Tamanho (${medida}), em metros`}>
        {TAMANHOS_PRONTOS[modelo.forma].map((m) => (
          <button
            key={m}
            type="button"
            className="chip alvo"
            aria-pressed={modelo.metros === m}
            onClick={() => {
              setOutro("");
              aoMudar({ ...modelo, metros: m });
            }}
          >
            {formatarMetros(m)}
          </button>
        ))}
        <input
          className="area-outro"
          type="text"
          inputMode="decimal"
          placeholder="outro"
          aria-label={`Outro tamanho (${medida}), em metros`}
          value={outro}
          onChange={(e) => digitou(e.target.value)}
        />
      </div>
      {modelo.forma === "linha" && (
        <div className="mapa-ferr" role="group" aria-label="Largura da linha, em metros">
          <span className="fc-sub">largura</span>
          {LARGURAS_DA_LINHA.map((m) => (
            <button key={m} type="button" className="chip alvo" aria-pressed={modelo.largura === m} onClick={() => aoMudar({ ...modelo, largura: m })}>
              {formatarMetros(m)}
            </button>
          ))}
        </div>
      )}
      <p className="fc-sub">
        {NOME_DA_FORMA[modelo.forma]}: {medida} de {formatarMetros(modelo.metros)}
        {quadrados > 0 ? ` (${quadrados.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} quadrados)` : ""}.
      </p>
    </>
  );
}
