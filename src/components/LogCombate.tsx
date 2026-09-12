"use client";

import type { LinhaLog } from "@/lib/tipos";
import { ListaLog } from "@/components/ListaLog";

/** O que aconteceu até agora — dano, cura, rodadas, entradas no combate.
 *  Todo mundo vê; ninguém edita. Mais recente primeiro. */
export function LogCombate({ log }: { log: LinhaLog[] }) {
  if (log.length === 0) return null;

  return (
    <div className="combat">
      <div className="combat-head">
        <h2>O que aconteceu</h2>
      </div>
      <ListaLog log={log} />
    </div>
  );
}
