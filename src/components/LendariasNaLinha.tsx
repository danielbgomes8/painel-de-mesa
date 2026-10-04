"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Personagem } from "@/lib/tipos";
import { nomeNoLog } from "@/lib/regras";
import {
  NOME_ACOES_LENDARIAS,
  NOME_RESISTENCIA_LENDARIA,
  acharRecurso,
  comAcoesLendarias,
  comCovil,
  comResistenciaLendaria,
  devolverAcaoLendaria,
  ehChefe,
  gastarAcoesLendarias,
  linhaDeAcaoLendaria,
  linhaDeResistenciaLendaria,
  semChefe,
  temCovil,
  usarResistenciaLendaria,
} from "@/lib/lendarias";

/** Ações lendárias, resistência lendária e ações de covil de um monstro, no painel da linha da iniciativa
 *  (só o Mestre vê: aparece no painel de NPC). Moram nos recursos do monstro; as contas estão em
 *  `lib/lendarias.ts`. As ações lendárias voltam sozinhas no início do turno dele (ver `avancarTurno`). */
export function LendariasNaLinha({ sala, personagem: p }: { sala: Sala; personagem: Personagem }) {
  const [ocupado, setOcupado] = useState(false);
  const recursos = p.resources ?? [];
  const lendarias = acharRecurso(recursos, NOME_ACOES_LENDARIAS);
  const resistencia = acharRecurso(recursos, NOME_RESISTENCIA_LENDARIA);
  const covil = temCovil(recursos);

  async function gravar(novos: typeof recursos, log?: string) {
    if (ocupado) return;
    setOcupado(true);
    await sala.atualizarPersonagem(p.id, { resources: novos });
    if (log) void sala.registrarLog(log);
    setOcupado(false);
  }

  if (!ehChefe(recursos)) {
    return (
      <div className="lend">
        <span className="sectitle">Chefe</span>
        <div className="lend-linha">
          <button type="button" className="btn" disabled={ocupado} onClick={() => gravar(comResistenciaLendaria(comAcoesLendarias(recursos)))}>
            👑 Ações lendárias
          </button>
          <button type="button" className="btn" disabled={ocupado} onClick={() => gravar(comCovil(recursos))}>
            🏰 Ações de covil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lend">
      <span className="sectitle">Chefe</span>

      {lendarias && (
        <div className="lend-linha">
          <b>
            👑 Ações lendárias {lendarias.cur}/{lendarias.max}
          </b>
          {[1, 2, 3].map((custo) => (
            <button
              key={custo}
              type="button"
              className="chip alvo"
              disabled={ocupado || lendarias.cur < custo}
              onClick={() => {
                const g = gastarAcoesLendarias(recursos, custo);
                if (g) void gravar(g.recursos, linhaDeAcaoLendaria(nomeNoLog(p), custo, g.restam, g.max));
              }}
            >
              gastar {custo}
            </button>
          ))}
          <button
            type="button"
            className="minilink"
            disabled={ocupado || lendarias.cur >= lendarias.max}
            title="Devolve 1 (corrigir um gasto errado). No início do turno do monstro, voltam todas sozinhas."
            onClick={() => {
              const r = devolverAcaoLendaria(recursos);
              if (r) void gravar(r);
            }}
          >
            devolver 1
          </button>
        </div>
      )}

      {resistencia && (
        <div className="lend-linha">
          <b>
            Resistência lendária {resistencia.cur}/{resistencia.max}
          </b>
          <button
            type="button"
            className="chip alvo"
            disabled={ocupado || resistencia.cur < 1}
            onClick={() => {
              const g = usarResistenciaLendaria(recursos);
              if (g) void gravar(g.recursos, linhaDeResistenciaLendaria(nomeNoLog(p), g.restam, g.max));
            }}
          >
            usar
          </button>
        </div>
      )}

      <div className="lend-linha">
        {covil ? <span>🏰 Age na contagem 20 (covil)</span> : (
          <button type="button" className="minilink" disabled={ocupado} onClick={() => gravar(comCovil(recursos))}>
            + ações de covil
          </button>
        )}
        <button
          type="button"
          className="minilink"
          disabled={ocupado}
          onClick={() => confirm("Tirar as ações lendárias e de covil deste monstro?") && gravar(semChefe(recursos))}
        >
          tirar tudo
        </button>
      </div>
    </div>
  );
}
