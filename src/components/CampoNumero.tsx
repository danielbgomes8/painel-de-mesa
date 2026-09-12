"use client";

import { useEffect, useRef, useState } from "react";

/** Campo numérico que grava só ao perder o foco (evita disparar update a
 *  cada tecla digitada). Usado nas fichas e na biblioteca de NPCs.
 *
 *  Rascunho próprio + guarda de foco (mesmo esquema do CampoTextoAdiado):
 *  antes era `key={valor}` com `defaultValue`, que remontava o input do zero
 *  a cada mudança externa — se chegasse uma atualização de outro aparelho
 *  (Realtime) enquanto alguém digitava aqui, o remonte apagava a digitação
 *  em andamento sem aviso nenhum. */
export function CampoNumero({
  valor,
  onCommit,
  className = "",
}: {
  valor: number;
  onCommit: (n: number) => void;
  className?: string;
}) {
  const [rascunho, setRascunho] = useState(String(valor));
  const focado = useRef(false);

  useEffect(() => {
    if (!focado.current) setRascunho(String(valor));
  }, [valor]);

  function commit() {
    const n = Number.parseInt(rascunho, 10);
    if (Number.isNaN(n)) {
      setRascunho(String(valor));
      return;
    }
    if (n !== valor) onCommit(n);
  }

  return (
    <input
      className={className}
      type="number"
      inputMode="numeric"
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
