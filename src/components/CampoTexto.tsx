"use client";

/** Campo de texto de uma linha, grava ao perder o foco (mesmo espírito do
 *  CampoNumero). Usado nas fichas e na biblioteca de NPCs. */
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
  function commit(el: HTMLInputElement) {
    if (el.value !== valor) onCommit(el.value);
  }
  return (
    <input
      key={valor}
      type="text"
      className="campotexto"
      maxLength={maxLength}
      placeholder={placeholder}
      defaultValue={valor}
      onBlur={(e) => commit(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
