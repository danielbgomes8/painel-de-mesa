"use client";

import type { LinhaLog } from "@/lib/tipos";

/** O que aconteceu até agora — dano, cura, rodadas, entradas no combate.
 *  Todo mundo vê; ninguém edita. Mais recente primeiro. */
export function LogCombate({ log }: { log: LinhaLog[] }) {
  if (log.length === 0) return null;

  return (
    <div className="combat">
      <div className="combat-head">
        <h2>O que aconteceu</h2>
      </div>
      <div className="loglist">
        {log.map((l) => (
          <div key={l.id} className="logrow">
            <span className="hora">
              {new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span>{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
