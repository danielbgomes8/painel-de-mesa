"use client";

import type { ReactNode } from "react";

/** Botão de remover — confirma antes quando `confirmar` é passado (perda
 *  permanente: personagem, entrada de diário...), age direto quando não é
 *  (um uso de recurso/item, reversível na hora). */
export function BotaoRemover({
  aria,
  confirmar,
  onConfirmar,
  className = "rm",
  children = "✕",
}: {
  aria: string;
  confirmar?: string;
  onConfirmar: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-label={aria}
      onClick={() => {
        if (!confirmar || confirm(confirmar)) onConfirmar();
      }}
    >
      {children}
    </button>
  );
}
