"use client";

import { useEffect, useRef, useState } from "react";

/** Campo de texto de uma linha, grava ao perder o foco (mesmo espírito do
 *  CampoNumero, mesma guarda de foco do CampoTextoAdiado). Usado nas fichas
 *  e na biblioteca de NPCs. */
export function CampoTexto({
  valor,
  onCommit,
  placeholder,
  maxLength = 60,
}: {
  valor: string;
  onCommit: (texto: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const [rascunho, setRascunho] = useState(valor);
  const focado = useRef(false);

  useEffect(() => {
    if (!focado.current) setRascunho(valor);
  }, [valor]);

  function commit() {
    if (rascunho !== valor) onCommit(rascunho);
  }

  return (
    <input
      type="text"
      className="campotexto"
      maxLength={maxLength}
      placeholder={placeholder}
      value={rascunho}
      onFocus={() => {
        focado.current = true;
      }}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={() => {
        focado.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
