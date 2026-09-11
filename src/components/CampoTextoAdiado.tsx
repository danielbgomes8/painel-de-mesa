"use client";

import { useEffect, useRef, useState } from "react";

/** <textarea> que grava com atraso (debounce) e não é sobrescrito pelo valor
 *  vindo do servidor enquanto está em foco. Usado nas notas rápidas do card e
 *  nas notas do Mestre. */
export function CampoTextoAdiado({
  valor,
  onSalvar,
  placeholder,
  maxLength = 2000,
  atrasoMs = 500,
}: {
  valor: string;
  onSalvar: (texto: string) => void;
  placeholder?: string;
  maxLength?: number;
  atrasoMs?: number;
}) {
  const [rascunho, setRascunho] = useState(valor);
  const focado = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!focado.current) setRascunho(valor);
  }, [valor]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function digitou(texto: string) {
    setRascunho(texto);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSalvar(texto), atrasoMs);
  }

  function gravarAgora() {
    focado.current = false;
    if (timer.current) clearTimeout(timer.current);
    if (rascunho !== valor) onSalvar(rascunho);
  }

  return (
    <textarea
      value={rascunho}
      maxLength={maxLength}
      placeholder={placeholder}
      onFocus={() => {
        focado.current = true;
      }}
      onBlur={gravarAgora}
      onChange={(e) => digitou(e.target.value)}
    />
  );
}
