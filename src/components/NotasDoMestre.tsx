"use client";

import { CampoTextoAdiado } from "@/components/CampoTextoAdiado";

/** Texto que só quem entrou como Mestre enxerga. */
export function NotasDoMestre({
  valor,
  onSalvar,
}: {
  valor: string;
  onSalvar: (texto: string) => void;
}) {
  return (
    <div className="combat">
      <div className="combat-head">
        <h2>Notas do Mestre</h2>
      </div>
      <div className="notesbox">
        <CampoTextoAdiado
          valor={valor}
          onSalvar={onSalvar}
          maxLength={4000}
          placeholder="Anotações privadas da sessão — só quem entrou como Mestre vê isto."
        />
      </div>
    </div>
  );
}
