"use client";

import type { LinhaLog, LinhaLogBastiao } from "@/lib/tipos";

/** Lista "hora + texto" usada tanto no log de combate quanto no do Bastião —
 *  mais recente primeiro, ninguém edita. */
export function ListaLog({
  log,
  style,
}: {
  log: (LinhaLog | LinhaLogBastiao)[];
  style?: React.CSSProperties;
}) {
  if (log.length === 0) return null;

  return (
    <div className="loglist" style={style}>
      {log.map((l) => (
        <div key={l.id} className="logrow">
          <span className="hora">
            {new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span>{l.text}</span>
        </div>
      ))}
    </div>
  );
}
