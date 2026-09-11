"use client";

import type { Sala } from "@/hooks/useSala";
import { nomeExibidoIniciativa, numerarNpcsNaOrdem } from "@/lib/regras";

/** Tela grande só com "de quem é a vez" — pensada pra um televisor/notebook
 *  central da mesa, não pro celular de ninguém. Sempre trata quem olha como
 *  jogador (nunca entrega nome de NPC ainda não revelado). */
export function Telao({ sala, rotulo }: { sala: Sala; rotulo: string }) {
  const { combate, personagens } = sala;
  const atual = combate.order[combate.turn];
  const pv = atual ? personagens.find((p) => p.slug === atual.slug) ?? null : null;
  const contagensNpc = numerarNpcsNaOrdem(
    combate.order,
    (slug) => Boolean(personagens.find((p) => p.slug === slug)?.is_npc),
  );
  const nomeExibido = atual
    ? pv
      ? nomeExibidoIniciativa(pv, contagensNpc[combate.turn], false)
      : atual.name
    : null;

  return (
    <div className="telao">
      <div className="telao-eyebrow">
        {rotulo} · Rodada {combate.round}
      </div>
      {atual ? (
        <>
          <div className="telao-label">é a vez de</div>
          <div className="telao-nome">{nomeExibido}</div>
          {pv && (
            <div className="telao-pv">
              {pv.hp} / {pv.hp_max} PV
            </div>
          )}
        </>
      ) : (
        <div className="telao-nome">Sem combate no momento</div>
      )}
    </div>
  );
}
