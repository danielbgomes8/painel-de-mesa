"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { ItemIniciativa } from "@/lib/tipos";
import {
  ordenarPorIniciativa,
  proximoTurno,
  turnoAposRemover,
  turnoAposTrocar,
} from "@/lib/regras";

const NOVO_NPC = "__novo__";

export function RastreadorCombate({
  sala,
  souMestre,
}: {
  sala: Sala;
  souMestre: boolean;
}) {
  const { combate, personagens } = sala;

  const [quem, setQuem] = useState(NOVO_NPC);
  const [nomeNpc, setNomeNpc] = useState("");
  const [pvNpc, setPvNpc] = useState("");
  const [caNpc, setCaNpc] = useState("");
  const [ini, setIni] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const naOrdem = new Set(combate.order.map((o) => o.slug));
  const disponiveis = personagens.filter((p) => !naOrdem.has(p.slug));

  function pvDe(slug: string) {
    return personagens.find((p) => p.slug === slug) ?? null;
  }

  async function adicionar() {
    if (ocupado) return;
    const init = Number.parseInt(ini, 10);
    const iniciativa = Number.isNaN(init) ? 0 : init;

    let item: ItemIniciativa | null = null;

    if (quem === NOVO_NPC) {
      const nome = nomeNpc.trim();
      if (!nome) return;
      const pvMax = Number.parseInt(pvNpc, 10);
      const ca = Number.parseInt(caNpc, 10);
      setOcupado(true);
      const criado = await sala.criarPersonagem({
        name: nome,
        is_npc: true,
        hp: Number.isNaN(pvMax) ? 10 : pvMax,
        hp_max: Number.isNaN(pvMax) ? 10 : pvMax,
        ac: Number.isNaN(ca) ? 12 : ca,
      });
      setOcupado(false);
      if (!criado) return;
      item = { slug: criado.slug, name: criado.name, init: iniciativa };
      setNomeNpc("");
      setPvNpc("");
      setCaNpc("");
    } else {
      const p = personagens.find((x) => x.slug === quem);
      if (!p) return;
      item = { slug: p.slug, name: p.name, init: iniciativa };
    }

    const ordem = ordenarPorIniciativa([...combate.order, item]);
    await sala.definirCombate({ order: ordem });
    setIni("");
  }

  function avancarTurno() {
    sala.definirCombate(proximoTurno(combate));
  }

  function reiniciar() {
    sala.definirCombate({ round: 1, turn: 0, order: [] });
  }

  function remover(i: number) {
    const ordem = combate.order.filter((_, idx) => idx !== i);
    sala.definirCombate({
      order: ordem,
      turn: turnoAposRemover(combate.turn, i, ordem.length),
    });
  }

  function trocar(i: number, j: number) {
    if (j < 0 || j >= combate.order.length) return;
    const ordem = [...combate.order];
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    sala.definirCombate({ order: ordem, turn: turnoAposTrocar(combate.turn, i, j) });
  }

  return (
    <div className="combat">
      <div className="combat-head">
        <h2>Iniciativa &amp; combate</h2>
        <div className="round">
          Rodada <b>{combate.round}</b>
        </div>
      </div>

      <div className="initlist">
        {combate.order.length === 0 && (
          <p className="empty-note">
            {souMestre
              ? "Ninguém na ordem ainda. Adicione combatentes abaixo."
              : "O Mestre monta a ordem quando o combate começar."}
          </p>
        )}

        {combate.order.map((c, i) => {
          const pv = pvDe(c.slug);
          const critico = pv ? pv.hp <= 0 : false;
          return (
            <div key={`${c.slug}-${i}`} className={`initrow${i === combate.turn ? " turn" : ""}`}>
              <div className="n">{c.init}</div>
              <div className="who">
                <span className="nm">{c.name}</span>
                {pv && (
                  <span className={`hpmini${critico ? " crit" : ""}`}>
                    {pv.hp}/{pv.hp_max} PV
                  </span>
                )}
              </div>
              {souMestre ? (
                <div className="reorder">
                  <button
                    type="button"
                    aria-label="Subir na ordem"
                    disabled={i === 0}
                    onClick={() => trocar(i, i - 1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="Descer na ordem"
                    disabled={i === combate.order.length - 1}
                    onClick={() => trocar(i, i + 1)}
                  >
                    ▼
                  </button>
                </div>
              ) : (
                <div />
              )}
              {souMestre ? (
                <button
                  type="button"
                  className="rm"
                  aria-label="Remover da ordem"
                  onClick={() => remover(i)}
                >
                  ✕
                </button>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>

      {souMestre && (
        <>
          <div className="combatctrls" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn primary"
              onClick={avancarTurno}
              disabled={combate.order.length === 0}
            >
              Próximo turno →
            </button>
            <button type="button" className="btn" onClick={reiniciar}>
              Reiniciar combate
            </button>
          </div>

          <div className="addcombatant">
            <select value={quem} onChange={(e) => setQuem(e.target.value)}>
              <option value={NOVO_NPC}>Novo NPC / monstro…</option>
              {disponiveis.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name}
                  {p.is_npc ? " (NPC)" : ""}
                </option>
              ))}
            </select>

            {quem === NOVO_NPC && (
              <>
                <input
                  type="text"
                  placeholder="nome do NPC/monstro"
                  maxLength={40}
                  value={nomeNpc}
                  onChange={(e) => setNomeNpc(e.target.value)}
                />
                <input
                  className="num"
                  type="number"
                  inputMode="numeric"
                  placeholder="PV máx"
                  value={pvNpc}
                  onChange={(e) => setPvNpc(e.target.value)}
                />
                <input
                  className="num"
                  type="number"
                  inputMode="numeric"
                  placeholder="CA"
                  value={caNpc}
                  onChange={(e) => setCaNpc(e.target.value)}
                />
              </>
            )}

            <input
              className="num"
              type="number"
              inputMode="numeric"
              placeholder="iniciativa"
              value={ini}
              onChange={(e) => setIni(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") adicionar();
              }}
            />
            <button type="button" className="btn" onClick={adicionar} disabled={ocupado}>
              Adicionar à ordem
            </button>
          </div>
        </>
      )}
    </div>
  );
}
