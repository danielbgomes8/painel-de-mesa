"use client";

import { useEffect, useState } from "react";
import { LIMITE_ROTULO_LIGACAO, ROTULOS_SUGERIDOS, type CartaoVisto } from "@/lib/quadro";
import { tituloVisto } from "@/components/apoioDoQuadro";

/** "Barão Vael → ? → Culto": escolhe (ou digita) o tipo da ligação. */
export function FolhaDeLigacao({
  de,
  para,
  aoConfirmar,
  aoCancelar,
}: {
  de: CartaoVisto | null;
  para: CartaoVisto | null;
  aoConfirmar: (rotulo: string) => void;
  aoCancelar: () => void;
}) {
  const [rotulo, setRotulo] = useState("");
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") aoCancelar();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aoCancelar]);
  if (!de || !para) return null;
  return (
    <div className="qd-fundo" role="presentation" onClick={aoCancelar}>
      <div className="qd-folha qd-folhaligacao" role="dialog" aria-modal="true" aria-label="Ligar cartões" onClick={(e) => e.stopPropagation()}>
        <h3 className="qd-titulo">
          {tituloVisto(de)} <span className="qd-seta">→</span> {tituloVisto(para)}
        </h3>
        <p className="qd-formdica">Que ligação é essa?</p>
        <div className="qd-sugestoes">
          {ROTULOS_SUGERIDOS.map((r) => (
            <button key={r} type="button" className="chip" aria-pressed={rotulo === r} onClick={() => setRotulo(r)}>
              {r}
            </button>
          ))}
        </div>
        <input
          type="text"
          aria-label="Tipo da ligação"
          placeholder="ou escreva: traiu, deve a…"
          maxLength={LIMITE_ROTULO_LIGACAO}
          value={rotulo}
          onChange={(e) => setRotulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") aoConfirmar(rotulo);
          }}
        />
        <div className="qd-linha">
          <button type="button" className="btn primary" onClick={() => aoConfirmar(rotulo)}>
            Ligar
          </button>
          <button type="button" className="btn ghost" onClick={aoCancelar}>
            cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
