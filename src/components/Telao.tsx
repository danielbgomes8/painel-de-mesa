"use client";

import type { Sala } from "@/hooks/useSala";
import {
  nomeExibidoIniciativa,
  numerarNpcsNaOrdem,
  proximosDaOrdem,
  pvExibidoIniciativa,
} from "@/lib/regras";

/** Quantos "a seguir" cabem sem competir com o nome de quem está jogando. */
const QUANTOS_PROXIMOS = 3;

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
  const pvVisivel = pv ? pvExibidoIniciativa(pv, false) : null;
  // Só os nomes: PV de NPC é informação do Mestre, e no telão a mesa inteira
  // está vendo (ver pvExibidoIniciativa).
  const proximos = proximosDaOrdem(combate.order.length, combate.turn, QUANTOS_PROXIMOS).map((i) => {
    const item = combate.order[i];
    const dele = personagens.find((p) => p.slug === item.slug) ?? null;
    return {
      chave: `${item.slug}-${i}`,
      nome: dele ? nomeExibidoIniciativa(dele, contagensNpc[i], false) : item.name,
    };
  });

  return (
    <div className="telao">
      <div className="telao-eyebrow">
        {rotulo} · Rodada {combate.round}
      </div>
      {atual ? (
        <>
          <div className="telao-label">é a vez de</div>
          <div className="telao-nome">{nomeExibido}</div>
          {pvVisivel && (
            <div className="telao-pv">
              {pvVisivel.hp} / {pvVisivel.hp_max} PV
            </div>
          )}
          {proximos.length > 0 && (
            <div className="telao-proximos">
              <span className="telao-proximos-rotulo">a seguir</span>
              <ol>
                {proximos.map((p) => (
                  <li key={p.chave}>{p.nome}</li>
                ))}
              </ol>
            </div>
          )}
        </>
      ) : (
        <div className="telao-nome">Sem combate no momento</div>
      )}
    </div>
  );
}
