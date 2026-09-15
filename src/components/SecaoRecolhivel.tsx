"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/** Seção que abre/fecha com um clique — usada por FichaCompleta e
 *  FichaClasse pra não empilhar tudo aberto de uma vez na tela (ficha do
 *  Tibério tem 13 seções + calculadora, isso vira uma rolagem enorme sem
 *  poder fechar nada). Estado só local (não salva no banco): reabre do
 *  jeito padrão da próxima vez que a ficha completa for aberta, igual o
 *  próprio "+ ver ficha completa" já reseta hoje. */
export function SecaoRecolhivel({
  titulo,
  cabecalhoExtra,
  abertoInicial = true,
  children,
}: {
  titulo: ReactNode;
  cabecalhoExtra?: ReactNode;
  abertoInicial?: boolean;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
  return (
    <div className="fc-secao">
      <div className="fc-sechead">
        <button
          type="button"
          className="fc-chev"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-label={aberto ? "recolher seção" : "expandir seção"}
        >
          {aberto ? "▾" : "▸"}
        </button>
        {titulo}
        {cabecalhoExtra}
      </div>
      {aberto && children}
    </div>
  );
}
