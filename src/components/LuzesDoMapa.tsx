"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Pecas } from "@/hooks/usePecas";
import type { Cenas } from "@/hooks/useCenas";
import type { Cena } from "@/lib/cenas";
import type { Peca } from "@/lib/pecas";
import {
  LUZES_PRONTAS,
  MINUTOS_MAXIMOS,
  acabandoLogo,
  apagouAgora,
  gastarLuz,
  linhaDaLuz,
  linhaDeLuzApagada,
  linhaDeTempoPassado,
  luzAcesa,
  luzDaPronta,
  rotuloDeMinutos,
  rotuloDoAlcance,
  type Luz,
} from "@/lib/luzes";

/** Quem carrega a luz: o nome da ficha, ou o do marcador. */
function quemCarrega(peca: Pick<Peca, "slug" | "nome">, sala: Sala): string {
  const ficha = peca.slug ? sala.personagens.find((f) => f.slug === peca.slug) : undefined;
  return ficha?.name || peca.nome || "alguém";
}

/** Peões de jogador e marcadores avulsos: os inimigos enxergam como a cena manda, então não ganham luz aqui. */
function podeCarregarLuz(peca: Pick<Peca, "slug">, sala: Sala): boolean {
  if (!peca.slug) return true;
  const ficha = sala.personagens.find((f) => f.slug === peca.slug);
  return Boolean(ficha) && !ficha?.is_npc;
}

const PASSOS = [
  { rotulo: "10 min", minutos: 10 },
  { rotulo: "30 min", minutos: 30 },
  { rotulo: "1 hora", minutos: 60 },
] as const;

/**
 * O Mestre liga o "mapa escuro", dá luz a quem carrega e passa o tempo: cada luz vai gastando e, quando acaba,
 * a visão automática do portador encolhe (ver lib/luzes.ts). Só o Mestre mexe; a mesa vê o que falta no mapa.
 */
export function PainelDeLuzes({ cena, banco, sala, cenas }: { cena: Cena; banco: Pecas; sala: Sala; cenas: Cenas }) {
  const [alvo, setAlvo] = useState("");
  const [outro, setOutro] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  /** O último tempo passado, pra desfazer o clique errado: quanto, e a luz de cada peão antes e depois (a que gasta pode ter parado em 0, então desfazer devolve a de ANTES, não soma de volta). */
  const [ultimo, setUltimo] = useState<{ minutos: number; itens: { id: string; antes: Luz; depois: Luz }[] } | null>(null);

  const candidatos = banco.pecas.filter((p) => podeCarregarLuz(p, sala));
  const comLuz = banco.pecas.filter((p) => p.luz !== null);
  const alvoValido = candidatos.some((p) => p.id === alvo) ? alvo : (candidatos[0]?.id ?? "");
  const gastaveis = comLuz.filter((p) => p.luz && p.luz.minutos !== null && p.luz.minutos > 0);

  async function darLuz(luz: Luz) {
    if (!alvoValido || ocupado) return;
    setOcupado(true);
    const ok = await banco.definirLuzes([{ id: alvoValido, luz }]);
    setOcupado(false);
    setAviso(ok ? null : "Não salvou a luz. Falta rodar a migration 0036_luzes_e_armadilhas.sql no SQL Editor do Supabase?");
  }

  async function passar(minutos: number) {
    const m = Math.round(minutos);
    if (ocupado || !Number.isFinite(m) || m < 1 || m > MINUTOS_MAXIMOS || gastaveis.length === 0) return;
    setOcupado(true);
    const mudancas = gastaveis.map((p) => ({ id: p.id, antes: p.luz as Luz, depois: gastarLuz(p.luz as Luz, m) }));
    const ok = await banco.definirLuzes(mudancas.map((x) => ({ id: x.id, luz: x.depois })));
    setOcupado(false);
    if (!ok) {
      setAviso("Não deu pra passar o tempo. Confira a conexão e tente de novo.");
      return;
    }
    setUltimo({ minutos: m, itens: mudancas });
    const apagaram = mudancas.filter((x) => apagouAgora(x.antes, x.depois));
    void sala.registrarLog(linhaDeTempoPassado(m));
    for (const x of apagaram) {
      const peca = banco.pecas.find((p) => p.id === x.id);
      if (peca) void sala.registrarLog(linhaDeLuzApagada(quemCarrega(peca, sala), x.antes));
    }
    const acabando = mudancas.filter((x) => acabandoLogo(x.depois));
    setAviso(
      apagaram.length > 0
        ? `Apagou: ${apagaram.map((x) => `${x.antes.nome} de ${quemCarrega(banco.pecas.find((p) => p.id === x.id) ?? { slug: null, nome: "" }, sala)}`).join(", ")}.`
        : acabando.length > 0
          ? `Falta pouco: ${acabando.length === 1 ? "uma luz está" : `${acabando.length} luzes estão`} pra apagar (10 min ou menos).`
          : null,
    );
  }

  async function desfazer() {
    if (!ultimo || ocupado) return;
    setOcupado(true);
    // Só devolve o que ainda está como o clique deixou (se o Mestre mexeu na luz nesse meio-tempo, fica como está).
    const mudancas = ultimo.itens.flatMap((i) => {
      const peca = banco.pecas.find((p) => p.id === i.id);
      return peca?.luz && peca.luz.nome === i.depois.nome && peca.luz.minutos === i.depois.minutos ? [{ id: i.id, luz: i.antes }] : [];
    });
    const ok = await banco.definirLuzes(mudancas);
    setOcupado(false);
    if (ok) {
      void sala.registrarLog(`⏳ Voltaram ${rotuloDeMinutos(ultimo.minutos)} (erro de clique corrigido).`);
      setUltimo(null);
      setAviso(null);
    } else setAviso("Não deu pra desfazer. Confira a conexão e tente de novo.");
  }

  return (
    <>
      <p className="fc-sub">
        Num mapa <b>escuro</b>, cada jogador só enxerga até onde a luz dele alcança (sem luz acesa, só o quadradinho em volta). A luz gasta
        quando você passa o tempo; quando apaga, a visão dele encolhe. Os inimigos enxergam como o mapa manda.
      </p>
      <label className="checklabel">
        <input type="checkbox" checked={cena.escura} onChange={(e) => void cenas.atualizarCena(cena.id, { escura: e.target.checked })} />
        <span>Mapa escuro (masmorra, caverna, noite)</span>
      </label>
      {cena.escura && !cena.visao_ligada && (
        <p className="inv-alerta">
          A visão automática está desligada, então a luz só conta o tempo: o mapa escuro vale depois que você ligar a visão em “Paredes e visão”.
        </p>
      )}

      <h5 className="luz-subtitulo">Dar luz</h5>
      {candidatos.length === 0 ? (
        <p className="fc-sub">Ponha os peões do grupo no mapa primeiro.</p>
      ) : (
        <>
          <div className="mapa-ferr">
            <select aria-label="Quem carrega a luz" className="mapa-aura-campo luz-select" value={alvoValido} onChange={(e) => setAlvo(e.target.value)}>
              {candidatos.map((p) => (
                <option key={p.id} value={p.id}>
                  {quemCarrega(p, sala)}
                </option>
              ))}
            </select>
          </div>
          <div className="mapa-ferr" role="group" aria-label="Luzes prontas">
            {LUZES_PRONTAS.map((l) => (
              <button key={l.nome} type="button" className="chip alvo" disabled={ocupado} title={l.dica} onClick={() => void darLuz(luzDaPronta(l))}>
                {l.nome}
              </button>
            ))}
          </div>
        </>
      )}

      <h5 className="luz-subtitulo">Quem tem luz</h5>
      {comLuz.length === 0 ? (
        <p className="fc-sub">Ninguém carrega luz neste mapa.</p>
      ) : (
        <ul className="luz-lista">
          {comLuz.map((p) => {
            const luz = p.luz as Luz;
            const acesa = luzAcesa(luz);
            return (
              <li key={p.id} className={acesa ? "luz-item" : "luz-item luz-item--apagada"}>
                <span className="luz-texto">
                  <span aria-hidden="true">{acesa ? "🔥" : "💨"}</span> {linhaDaLuz(quemCarrega(p, sala), luz)} · {rotuloDoAlcance(luz.alcance)}
                  {acabandoLogo(luz) && <b className="luz-alerta"> · quase apagando</b>}
                </span>
                <span className="luz-acoes">
                  {luz.minutos !== null && (
                    <button
                      type="button"
                      className="minilink"
                      disabled={ocupado}
                      aria-label={acesa ? `Apagar ${luz.nome} de ${quemCarrega(p, sala)}` : `Acender de novo ${luz.nome} de ${quemCarrega(p, sala)}`}
                      onClick={() =>
                        void banco.definirLuzes([
                          {
                            id: p.id,
                            luz: acesa ? { ...luz, minutos: 0 } : { ...luz, minutos: LUZES_PRONTAS.find((l) => l.nome === luz.nome)?.minutos ?? 60 },
                          },
                        ])
                      }
                    >
                      {acesa ? "apagar" : "acender"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="minilink"
                    disabled={ocupado}
                    aria-label={`Tirar a luz de ${quemCarrega(p, sala)}`}
                    onClick={() => void banco.definirLuzes([{ id: p.id, luz: null }])}
                  >
                    tirar
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <h5 className="luz-subtitulo">Passar o tempo</h5>
      <div className="mapa-ferr" role="group" aria-label="Passar o tempo">
        {PASSOS.map((s) => (
          <button key={s.minutos} type="button" className="btn" disabled={ocupado || gastaveis.length === 0} onClick={() => void passar(s.minutos)}>
            ⏳ {s.rotulo}
          </button>
        ))}
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={MINUTOS_MAXIMOS}
          className="mapa-aura-campo"
          aria-label="Outro tempo, em minutos"
          placeholder="outro (min)"
          value={outro}
          onChange={(e) => setOutro(e.target.value)}
        />
        <button
          type="button"
          className="btn"
          disabled={ocupado || gastaveis.length === 0 || !outro}
          onClick={() => {
            void passar(Number(outro));
            setOutro("");
          }}
        >
          passar
        </button>
        {ultimo && (
          <button type="button" className="btn" disabled={ocupado} onClick={() => void desfazer()}>
            ↩ desfazer {rotuloDeMinutos(ultimo.minutos)}
          </button>
        )}
      </div>
      {gastaveis.length === 0 && comLuz.length > 0 && <p className="fc-sub">Nenhuma luz acesa que gaste (as apagadas e a visão no escuro não contam).</p>}
      {aviso && (
        <p className="inv-alerta" role="status">
          {aviso}
        </p>
      )}
    </>
  );
}

/** O que a mesa vê do tempo das luzes: quem carrega e quanto falta. Só luz de quem a mesa enxerga. */
export function LuzesNaMesa({ itens, telao = false }: { itens: readonly { id: string; quem: string; luz: Luz }[]; telao?: boolean }) {
  const visiveis = itens.filter((i) => i.luz.minutos !== null);
  if (visiveis.length === 0) return null;
  return (
    <ul className={telao ? "mapa-luzes mapa-luzes--telao" : "mapa-luzes"} aria-label="Luzes acesas">
      {visiveis.map((i) => (
        <li key={i.id} className={luzAcesa(i.luz) ? (acabandoLogo(i.luz) ? "mapa-luz mapa-luz--acabando" : "mapa-luz") : "mapa-luz mapa-luz--apagada"}>
          <span aria-hidden="true">{luzAcesa(i.luz) ? "🔥" : "💨"}</span> {linhaDaLuz(i.quem, i.luz)}
        </li>
      ))}
    </ul>
  );
}
