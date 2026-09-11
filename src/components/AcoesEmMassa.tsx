"use client";

import { useMemo, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import { CONDICOES } from "@/lib/condicoes";
import { ajustarPV } from "@/lib/regras";

/** Área de efeito: seleciona vários personagens/NPCs e aplica dano, cura ou
 *  uma condição em todos de uma vez. Só o Mestre vê. */
export function AcoesEmMassa({ sala }: { sala: Sala }) {
  const [alvos, setAlvos] = useState<Record<string, boolean>>({});
  const [valor, setValor] = useState("");
  const [cond, setCond] = useState<string>(CONDICOES[0]);

  const selecionados = useMemo(
    () => sala.personagens.filter((p) => alvos[p.id]),
    [sala.personagens, alvos],
  );

  function alternar(id: string) {
    setAlvos((a) => ({ ...a, [id]: !a[id] }));
  }

  function aplicarPV(sinal: 1 | -1) {
    const n = Number.parseInt(valor, 10);
    if (Number.isNaN(n)) return;
    for (const p of selecionados) {
      sala.atualizarPersonagem(p.id, ajustarPV(p, p.hp + sinal * n));
    }
  }

  function aplicarCondicao(ligar: boolean) {
    for (const p of selecionados) {
      sala.atualizarPersonagem(p.id, { cond: { ...p.cond, [cond]: ligar } });
    }
  }

  const n = selecionados.length;

  return (
    <div className="combat">
      <div className="combat-head">
        <h2>Ações em massa</h2>
      </div>

      <div className="chips" style={{ marginBottom: 12 }}>
        {sala.personagens.length === 0 && (
          <span className="empty-note">Nenhum personagem na sala ainda.</span>
        )}
        {sala.personagens.map((p) => (
          <button
            key={p.id}
            type="button"
            className="chip alvo"
            aria-pressed={Boolean(alvos[p.id])}
            onClick={() => alternar(p.id)}
          >
            {p.name}
            {p.is_npc ? " · NPC" : ""}
          </button>
        ))}
      </div>

      <div className="masstools">
        <input
          className="num"
          type="number"
          inputMode="numeric"
          placeholder="valor"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
        <button type="button" className="btn" disabled={n === 0} onClick={() => aplicarPV(-1)}>
          Aplicar dano
        </button>
        <button type="button" className="btn" disabled={n === 0} onClick={() => aplicarPV(1)}>
          Aplicar cura
        </button>
        <select value={cond} onChange={(e) => setCond(e.target.value)}>
          {CONDICOES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="button" className="btn" disabled={n === 0} onClick={() => aplicarCondicao(true)}>
          Adicionar condição
        </button>
        <button type="button" className="btn" disabled={n === 0} onClick={() => aplicarCondicao(false)}>
          Remover condição
        </button>
      </div>

      <p className="empty-note">
        {n === 0
          ? "Selecione um ou mais alvos acima."
          : `${n} alvo${n > 1 ? "s" : ""} selecionado${n > 1 ? "s" : ""}.`}
      </p>
    </div>
  );
}
