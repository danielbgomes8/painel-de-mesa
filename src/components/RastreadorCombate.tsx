"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { ItemIniciativa, ModeloNpc, Personagem } from "@/lib/tipos";
import { d20 } from "@/lib/dados";
import {
  nomeExibidoIniciativa,
  numerarNpcsNaOrdem,
  ordenarPorIniciativa,
  proximoTurno,
  pvExibidoIniciativa,
  reduzirPrazosCondicao,
  turnoAposRemover,
  turnoAposTrocar,
} from "@/lib/regras";

const NOVO_NPC = "__novo__";

export function RastreadorCombate({
  sala,
  souMestre,
  meuPersonagem,
}: {
  sala: Sala;
  souMestre: boolean;
  meuPersonagem: Personagem | null;
}) {
  const { combate, personagens } = sala;

  const [quem, setQuem] = useState(NOVO_NPC);
  const [nomeNpc, setNomeNpc] = useState("");
  const [pvNpc, setPvNpc] = useState("");
  const [caNpc, setCaNpc] = useState("");
  const [extrasModelo, setExtrasModelo] = useState<{
    cls?: string;
    speed?: number;
    init_mod?: number;
    ataque?: string;
  }>({});
  const [ini, setIni] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const naOrdem = new Set(combate.order.map((o) => o.slug));
  const disponiveis = personagens.filter((p) => !naOrdem.has(p.slug));

  function pvDe(slug: string) {
    return personagens.find((p) => p.slug === slug) ?? null;
  }

  const contagensNpc = numerarNpcsNaOrdem(combate.order, (slug) => Boolean(pvDe(slug)?.is_npc));

  function usarModelo(m: ModeloNpc) {
    setNomeNpc(m.name);
    setPvNpc(String(m.hp_max));
    setCaNpc(String(m.ac));
    setExtrasModelo({ cls: m.cls, speed: m.speed, init_mod: m.init_mod, ataque: m.ataque });
  }

  function rolarIniciativa() {
    const mod = quem !== NOVO_NPC ? personagens.find((x) => x.slug === quem)?.init_mod ?? 0 : extrasModelo.init_mod ?? 0;
    setIni(String(d20() + mod));
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
        ...extrasModelo,
      });
      setOcupado(false);
      if (!criado) return;
      item = { slug: criado.slug, name: criado.name, init: iniciativa };
      setNomeNpc("");
      setPvNpc("");
      setCaNpc("");
      setExtrasModelo({});
    } else {
      const p = personagens.find((x) => x.slug === quem);
      if (!p) return;
      item = { slug: p.slug, name: p.name, init: iniciativa };
    }

    const ordem = ordenarPorIniciativa([...combate.order, item]);
    await sala.definirCombate({ order: ordem });
    sala.registrarLog(`${item.name} entrou no combate (iniciativa ${item.init})`);
    setIni("");
  }

  function avancarTurno() {
    const proximo = proximoTurno(combate);
    if (proximo.round !== combate.round) {
      sala.registrarLog(`Rodada ${proximo.round} começou`);
      for (const p of personagens) {
        if (Object.keys(p.cond_prazo).length === 0) continue;
        const resultado = reduzirPrazosCondicao(p.cond, p.cond_prazo);
        sala.atualizarPersonagem(p.id, { cond: resultado.cond, cond_prazo: resultado.cond_prazo });
        for (const nome of resultado.expiraram) {
          sala.registrarLog(`${p.name} não está mais ${nome} (prazo esgotado)`);
        }
      }
    }
    sala.definirCombate(proximo);
  }

  function reiniciar() {
    sala.definirCombate({ round: 1, turn: 0, order: [] });
    sala.registrarLog("Combate reiniciado");
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
            const pvVisivel = pv ? pvExibidoIniciativa(pv, souMestre) : null;
            const critico = pvVisivel ? pvVisivel.hp <= 0 : false;
            const nomeExibido = pv
              ? nomeExibidoIniciativa(pv, contagensNpc[i], souMestre)
              : c.name;
          return (
            <div key={`${c.slug}-${i}`} className={`initrow${i === combate.turn ? " turn" : ""}`}>
              <div className="n">{c.init}</div>
              <div className="who">
                <span className="nm">{nomeExibido}</span>
                {pvVisivel && (
                  <span className={`hpmini${critico ? " crit" : ""}`}>
                    {pvVisivel.hp}/{pvVisivel.hp_max} PV
                  </span>
                )}
              </div>
              {souMestre && pv?.is_npc ? (
                <button
                  type="button"
                  className="minilink"
                  onClick={() => sala.atualizarPersonagem(pv.id, { revealed: !pv.revealed })}
                >
                  {pv.revealed ? "revelado" : "revelar"}
                </button>
              ) : (
                <span />
              )}
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

      {!souMestre && meuPersonagem && !naOrdem.has(meuPersonagem.slug) && (
        <MinhaIniciativa sala={sala} personagem={meuPersonagem} />
      )}

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
            <button type="button" className="btn" aria-label="Rolar iniciativa" onClick={rolarIniciativa}>
              🎲
            </button>
            <button type="button" className="btn" onClick={adicionar} disabled={ocupado}>
              Adicionar à ordem
            </button>
          </div>

          {quem === NOVO_NPC && sala.modelosNpc.length > 0 && (
            <div className="chips" style={{ marginTop: 8 }}>
              <span className="empty-note" style={{ padding: 0 }}>
                da biblioteca:
              </span>
              {sala.modelosNpc.map((m) => (
                <button key={m.id} type="button" className="chip" onClick={() => usarModelo(m)}>
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Deixa o próprio jogador rolar/digitar a iniciativa do seu personagem, em
 *  vez do Mestre ter que fazer isso manualmente por cada um. */
function MinhaIniciativa({ sala, personagem }: { sala: Sala; personagem: Personagem }) {
  const [ini, setIni] = useState("");

  function rolar() {
    setIni(String(d20() + personagem.init_mod));
  }

  async function entrar() {
    const init = Number.parseInt(ini, 10);
    const iniciativa = Number.isNaN(init) ? 0 : init;
    const item: ItemIniciativa = { slug: personagem.slug, name: personagem.name, init: iniciativa };
    await sala.definirCombate({ order: ordenarPorIniciativa([...sala.combate.order, item]) });
    sala.registrarLog(`${personagem.name} entrou no combate (iniciativa ${iniciativa})`);
    setIni("");
  }

  return (
    <div className="addcombatant" style={{ marginTop: 12 }}>
      <input
        className="num"
        type="number"
        inputMode="numeric"
        placeholder="sua iniciativa"
        value={ini}
        onChange={(e) => setIni(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") entrar();
        }}
      />
      <button type="button" className="btn" aria-label="Rolar iniciativa" onClick={rolar}>
        🎲
      </button>
      <button type="button" className="btn" onClick={entrar} disabled={!ini}>
        Entrar no combate
      </button>
    </div>
  );
}
