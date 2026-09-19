"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { EstadoCombate, ItemIniciativa, ModeloNpc, Personagem } from "@/lib/tipos";
import { d20 } from "@/lib/dados";
import { ComecarEncontro } from "@/components/EncontrosPreparados";
import {
  entrarNaOrdem,
  estaCaido,
  nomeExibidoIniciativa,
  numerarNpcsNaOrdem,
  proximoTurno,
  pvExibidoIniciativa,
  reduzirPrazosCondicao,
  turnoAposRemover,
  turnoAposTrocar,
} from "@/lib/regras";

const NOVO_NPC = "__novo__";

/** Avança pro próximo combatente da ordem; se a rodada virar, reduz prazo das
 *  condições de todo mundo e loga quem parou de estar com o quê. Devolve
 *  `null` quando a escrita falha (o combate já voltou pro estado anterior) —
 *  quem chama não deve agir como se tivesse avançado de verdade. Usado tanto
 *  pelo botão do Mestre quanto pelo "passar a vez" do jogador na sua vez. */
export async function avancarTurno(sala: Sala): Promise<EstadoCombate | null> {
  const rodadaAntes = sala.combate.round;
  const personagens = sala.personagens;
  const proximo = await sala.definirCombate((atual) => proximoTurno(atual));
  if (!proximo) return null;
  if (proximo.round !== rodadaAntes) {
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
  return proximo;
}

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
    notes?: string;
  }>({});
  const [ini, setIni] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const naOrdem = new Set(combate.order.map((o) => o.slug));
  const disponiveis = personagens.filter((p) => !naOrdem.has(p.slug));
  const jogadoresDeFora = disponiveis.filter((p) => !p.is_npc);

  function pvDe(slug: string) {
    return personagens.find((p) => p.slug === slug) ?? null;
  }

  const contagensNpc = numerarNpcsNaOrdem(combate.order, (slug) => Boolean(pvDe(slug)?.is_npc));

  function usarModelo(m: ModeloNpc) {
    setNomeNpc(m.name);
    setPvNpc(String(m.hp_max));
    setCaNpc(String(m.ac));
    // notes junto: sem isso, a tática que o Mestre preparou na biblioteca
    // ("foge com menos de 10 PV"...) sumia ao puxar o NPC pro combate.
    setExtrasModelo({ cls: m.cls, speed: m.speed, init_mod: m.init_mod, ataque: m.ataque, notes: m.notes });
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

    // `entrou` é preenchido dentro do callback porque ele roda de novo a cada
    // tentativa do controle de concorrência — vale o da última, que é a que
    // gravou de verdade.
    let entrou = false;
    const feito = await sala.definirCombate((atual) => {
      const r = entrarNaOrdem(atual.order, [item]);
      entrou = r.entraram.length > 0;
      return { order: r.ordem };
    });
    if (feito && entrou) sala.registrarLog(`${item.name} entrou no combate (iniciativa ${item.init})`);
    setIni("");
  }

  /** Põe de uma vez todo jogador que ainda não está na ordem, cada um com a
   *  própria rolagem (d20 + modificador da ficha). Era o gargalo do começo de
   *  cada combate: o Mestre fazia isso um por um, no celular, com a mesa
   *  esperando. NPC continua entrando na mão — monstro em grupo costuma usar
   *  uma iniciativa só pro bando. */
  async function porTodosOsJogadores() {
    if (ocupado || jogadoresDeFora.length === 0) return;
    setOcupado(true);
    const novos: ItemIniciativa[] = jogadoresDeFora.map((p) => ({
      slug: p.slug,
      name: p.name,
      init: d20() + p.init_mod,
    }));
    let entraram: ItemIniciativa[] = [];
    const feito = await sala.definirCombate((atual) => {
      const r = entrarNaOrdem(atual.order, novos);
      entraram = r.entraram;
      return { order: r.ordem };
    });
    setOcupado(false);
    if (!feito) return;
    sala.registrarVariosLogs(
      entraram.map((n) => `${n.name} entrou no combate (iniciativa ${n.init})`),
    );
  }

  async function aoClicarProximoTurno() {
    if (ocupado) return;
    setOcupado(true);
    await avancarTurno(sala);
    setOcupado(false);
  }

  function reiniciar() {
    sala.definirCombate({ round: 1, turn: 0, order: [] });
    sala.registrarLog("Combate reiniciado");
  }

  function remover(i: number) {
    sala.definirCombate((atual) => {
      const ordem = atual.order.filter((_, idx) => idx !== i);
      return { order: ordem, turn: turnoAposRemover(atual.turn, i, ordem.length) };
    });
  }

  function trocar(i: number, j: number) {
    if (j < 0 || j >= combate.order.length) return;
    sala.definirCombate((atual) => {
      const ordem = [...atual.order];
      [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
      return { order: ordem, turn: turnoAposTrocar(atual.turn, i, j) };
    });
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
            const critico = pvVisivel ? estaCaido(pvVisivel.hp) : false;
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
              onClick={aoClicarProximoTurno}
              disabled={combate.order.length === 0 || ocupado}
            >
              Próximo turno →
            </button>
            <button type="button" className="btn" onClick={reiniciar}>
              Reiniciar combate
            </button>
          </div>

          {jogadoresDeFora.length > 0 && (
            <button
              type="button"
              className="btn"
              style={{ marginTop: 12 }}
              onClick={porTodosOsJogadores}
              disabled={ocupado}
            >
              🎲 Pôr {jogadoresDeFora.length === 1 ? "1 jogador" : `os ${jogadoresDeFora.length} jogadores`} na ordem
            </button>
          )}

          <ComecarEncontro sala={sala} />

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
    // Função, não objeto: se outro jogador entrar quase no mesmo instante, cada
    // escrita parte do estado mais recente conhecido em vez de um `sala.combate`
    // que pode já estar velho quando esta chega — reduz (não garante 100%, isso
    // pediria uma escrita atômica no banco) o risco de uma sobrescrever a outra.
    let entrou = false;
    const feito = await sala.definirCombate((atual) => {
      const r = entrarNaOrdem(atual.order, [item]);
      entrou = r.entraram.length > 0;
      return { order: r.ordem };
    });
    if (feito && entrou) sala.registrarLog(`${personagem.name} entrou no combate (iniciativa ${iniciativa})`);
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
