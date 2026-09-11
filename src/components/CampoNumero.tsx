"use client";

/** Campo numérico que grava só ao perder o foco (evita disparar update a
 *  cada tecla digitada). Usado nas fichas e na biblioteca de NPCs. */
export function CampoNumero({
  valor,
  onCommit,
  className = "",
}: {
  valor: number;
  onCommit: (n: number) => void;
  className?: string;
}) {
  function commit(el: HTMLInputElement) {
    const n = Number.parseInt(el.value, 10);
    if (Number.isNaN(n)) {
      el.value = String(valor);
      return;
    }
    if (n !== valor) onCommit(n);
  }
  return (
    <input
      key={valor}
      className={className}
      type="number"
      inputMode="numeric"
      defaultValue={valor}
      onBlur={(e) => commit(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
