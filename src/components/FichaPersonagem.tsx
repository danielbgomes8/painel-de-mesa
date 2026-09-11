"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Personagem, Recurso } from "@/lib/tipos";
import { CONDICOES } from "@/lib/condicoes";
import {
  ajustarPV,
  aplicarCura,
  aplicarDano,
  aplicarDescansoCurto,
  aplicarDescansoLongo,
  alternarPips,
  deslocamentoEfetivo,
  efeitoExaustao,
  EXAUSTAO_MAX,
  faixaPV,
  formatarMetros,
  gastarDadoDeVida,
  limitarExaustao,
  limitarPV,
  limitarTesteMorte,
  mensagemAjustePV,
  mensagemDanoAbsorvido,
  situacaoMorte,
  TESTES_MORTE_MAX,
} from "@/lib/regras";
import { CampoTextoAdiado } from "@/components/CampoTextoAdiado";
import { CampoNumero } from "@/components/CampoNumero";
import { CampoTexto } from "@/components/CampoTexto";

const TIPOS_DADO = ["d6", "d8", "d10", "d12"];

export function FichaPersonagem({
  personagem: p,
  editavel,
  souMestre,
  ehMinha,
  sala,
}: {
  personagem: Personagem;
  editavel: boolean;
  souMestre: boolean;
  ehMinha: boolean;
  sala: Sala;
}) {
  const patch = (mudanca: Partial<Personagem>) => sala.atualizarPersonagem(p.id, mudanca);

  /** Dano/cura "de verdade" (descontam do PV temporário primeiro) + linha no log. */
  function mudarPV(delta: number) {
    if (delta >= 0) {
      const resultado = aplicarCura(p, delta);
      patch(resultado);
      if (resultado.hp !== p.hp) sala.registrarLog(mensagemAjustePV(p.name, resultado.hp - p.hp, resultado.hp, p.hp_max));
      return;
    }
    const resultado = aplicarDano(p, -delta);
    patch(resultado);
    const deltaReal = resultado.hp - p.hp;
    if (deltaReal !== 0) {
      sala.registrarLog(mensagemAjustePV(p.name, deltaReal, resultado.hp, p.hp_max));
    } else if (resultado.hp_temp < p.hp_temp) {
      sala.registrarLog(mensagemDanoAbsorvido(p.name, p.hp_temp - resultado.hp_temp));
    }
  }

  function descansoLongoCompleto() {
    if (!confirm(`Aplicar descanso longo em ${p.name}? Cura tudo, tira 1 nível de exaustão, recupera dados de vida e zera os recursos.`)) return;
    patch(aplicarDescansoLongo(p));
  }

  const faixa = faixaPV(p.hp, p.hp_max);
  const largura = p.hp_max > 0 ? Math.max(0, Math.min(1, p.hp / p.hp_max)) : 0;
  const caido = p.hp <= 0;
  const morte = situacaoMorte(p.dss, p.dsf);

  return (
    <div className={`card${ehMinha ? " mine" : ""}`}>
      <div className="chead">
        <div>
          <h3>
            {p.name}
            {p.is_npc && <span className="npctag"> · NPC</span>}
          </h3>
          {p.cls && <div className="cls">{p.cls}</div>}
        </div>
        {souMestre && p.is_npc && (
          <button
            type="button"
            className="chip"
            aria-pressed={p.revealed}
            onClick={() => patch({ revealed: !p.revealed })}
          >
            {p.revealed ? "revelado" : "oculto pro jogador"}
          </button>
        )}
      </div>

      <div className="body">
        {caido && (
          <div className="downbanner">
            ⚠ Caído — inconsciente, faça os testes de morte
          </div>
        )}

        <div className="hprow">
          <span className="lbl">PV</span>
          <div className={`hpbar ${faixa}`}>
            <i style={{ transform: `scaleX(${largura})` }} />
          </div>
          <span className="hpnum">
            {p.hp} / {p.hp_max}
          </span>
          {p.hp_temp > 0 && <span className="hptemp">+{p.hp_temp} temp</span>}
          {editavel && (
            <div className="hpbtns">
              <button type="button" className="pbtn" aria-label="Tirar 1 PV" onClick={() => mudarPV(-1)}>
                −
              </button>
              <button type="button" className="pbtn" aria-label="Somar 1 PV" onClick={() => mudarPV(1)}>
                +
              </button>
            </div>
          )}
        </div>

        {editavel && (
          <div className="hpsetrow">
            <span>máx</span>
            <CampoNumero
              valor={p.hp_max}
              onCommit={(n) => patch({ hp_max: Math.max(0, n), hp: limitarPV(p.hp, n) })}
            />
            <span>atual</span>
            <CampoNumero valor={p.hp} onCommit={(n) => patch(ajustarPV(p, n))} />
            <span>temp</span>
            <CampoNumero valor={p.hp_temp} onCommit={(n) => patch({ hp_temp: Math.max(0, n) })} />
          </div>
        )}

        {editavel && (
          <div className="combatctrls">
            <button type="button" className="btn" onClick={() => patch(aplicarDescansoCurto(p))}>
              Descanso curto
            </button>
            <button type="button" className="btn" onClick={descansoLongoCompleto}>
              Descanso longo
            </button>
          </div>
        )}

        <div className="chips">
          <button
            type="button"
            className="chip flag"
            aria-pressed={p.inspiration}
            disabled={!editavel}
            onClick={() => patch({ inspiration: !p.inspiration })}
          >
            ⭐ Inspiração
          </button>
          <button
            type="button"
            className="chip flag"
            aria-pressed={p.concentration}
            disabled={!editavel}
            onClick={() =>
              patch({
                concentration: !p.concentration,
                concentration_on: p.concentration ? "" : p.concentration_on,
              })
            }
          >
            🔮 Concentração
          </button>
          {p.concentration &&
            (editavel ? (
              <CampoTexto
                valor={p.concentration_on}
                placeholder="em quê?"
                onCommit={(texto) => patch({ concentration_on: texto })}
              />
            ) : (
              p.concentration_on && <span className="concnota">em {p.concentration_on}</span>
            ))}
        </div>

        <div className="stats3">
          <div className="stat">
            <div className="lbl">CA</div>
            {editavel ? (
              <CampoNumero valor={p.ac} onCommit={(n) => patch({ ac: n })} />
            ) : (
              <div className="val">{p.ac}</div>
            )}
          </div>
          <div className="stat">
            <div className="lbl">Iniciativa</div>
            {editavel ? (
              <CampoNumero valor={p.init_mod} onCommit={(n) => patch({ init_mod: n })} />
            ) : (
              <div className="val">{sinal(p.init_mod)}</div>
            )}
          </div>
          <div className="stat">
            <div className="lbl">Desl. (m)</div>
            {editavel ? (
              <CampoNumero valor={p.speed} onCommit={(n) => patch({ speed: Math.max(0, n) })} />
            ) : (
              <div className="val">{p.speed}</div>
            )}
          </div>
        </div>

        <div>
          <div className="subrow">
            <span className="lbl">Exaustão</span>
            <span className="lbl mono">
              {p.exh}/{EXAUSTAO_MAX}
            </span>
          </div>
          <div className="pips">
            {Array.from({ length: EXAUSTAO_MAX }, (_, i) => (
              <button
                key={i}
                type="button"
                className="pip"
                aria-label={`Exaustão nível ${i + 1}`}
                aria-pressed={i < p.exh}
                disabled={!editavel}
                onClick={() => patch({ exh: limitarExaustao(alternarPips(i, p.exh)) })}
              />
            ))}
          </div>
          <div className={`exhnote${p.exh >= EXAUSTAO_MAX ? " crit" : ""}`}>
            {efeitoExaustao(p.exh)}
            {p.exh > 0 && p.exh < EXAUSTAO_MAX && (
              <>
                <br />
                Deslocamento efetivo: {formatarMetros(deslocamentoEfetivo(p.speed, p.exh))}
              </>
            )}
          </div>
        </div>

        <div>
          <div className="subrow">
            <span className="lbl">Dados de vida</span>
            <span className="lbl mono">
              {p.hd_cur}/{p.hd_max}
              {p.hd_max > 0 ? ` ${p.hd_die}` : ""}
            </span>
          </div>
          {editavel && (
            <div className="hpsetrow">
              <span>máx</span>
              <CampoNumero
                valor={p.hd_max}
                onCommit={(n) => {
                  const max = Math.max(0, n);
                  patch({ hd_max: max, hd_cur: Math.min(p.hd_cur, max) });
                }}
              />
              <select value={p.hd_die} onChange={(e) => patch({ hd_die: e.target.value })}>
                {TIPOS_DADO.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="minilink"
                disabled={p.hd_cur <= 0}
                onClick={() => patch({ hd_cur: gastarDadoDeVida(p.hd_cur) })}
              >
                gastar 1 dado
              </button>
            </div>
          )}
        </div>

        <div>
          <span className="sectitle">Testes de resistência contra a morte</span>
          <div className="deathsaves">
            <div className="dsblock">
              <span className="lbl">Sucessos</span>
              <div className="pips">
                {Array.from({ length: TESTES_MORTE_MAX }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className="pip death"
                    aria-label={`Sucesso ${i + 1}`}
                    aria-pressed={i < p.dss}
                    disabled={!editavel}
                    onClick={() => patch({ dss: limitarTesteMorte(alternarPips(i, p.dss)) })}
                  />
                ))}
              </div>
            </div>
            <div className="dsblock">
              <span className="lbl">Falhas</span>
              <div className="pips">
                {Array.from({ length: TESTES_MORTE_MAX }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className="pip fail"
                    aria-label={`Falha ${i + 1}`}
                    aria-pressed={i < p.dsf}
                    disabled={!editavel}
                    onClick={() => patch({ dsf: limitarTesteMorte(alternarPips(i, p.dsf)) })}
                  />
                ))}
              </div>
            </div>
          </div>
          {morte !== "em-jogo" && (
            <div className={`dsnote ${morte}`}>
              {morte === "estavel" ? "Estável (3 sucessos)" : "Morto (3 falhas)"}
            </div>
          )}
        </div>

        <div>
          <span className="sectitle">Condições</span>
          <div className="chips">
            {CONDICOES.map((nome) => {
              const ativa = Boolean(p.cond?.[nome]);
              return (
                <button
                  key={nome}
                  type="button"
                  className="chip"
                  aria-pressed={ativa}
                  disabled={!editavel}
                  onClick={() => patch({ cond: { ...p.cond, [nome]: !ativa } })}
                >
                  {nome}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="sectitle">Recursos (Fúria, Ki, espaços de magia…)</span>
          {p.resources.length === 0 && (
            <p className="empty-note">
              {editavel ? "Nenhum ainda — cadastre o que a sua classe usa." : "Nenhum cadastrado."}
            </p>
          )}
          <div className="reslist">
            {p.resources.map((r, i) => (
              <div key={i} className="resrow">
                <span className="resnome">
                  {r.name}
                  {r.short_rest && " · desc. curto"}
                </span>
                <div className="pips">
                  {Array.from({ length: r.max }, (_, k) => (
                    <button
                      key={k}
                      type="button"
                      className="pip"
                      aria-label={`${r.name} uso ${k + 1}`}
                      aria-pressed={k < r.cur}
                      disabled={!editavel}
                      onClick={() => {
                        const cur = limitarPV(alternarPips(k, r.cur), r.max);
                        patch({
                          resources: p.resources.map((x, idx) => (idx === i ? { ...x, cur } : x)),
                        });
                      }}
                    />
                  ))}
                </div>
                {editavel && (
                  <button
                    type="button"
                    className="rm"
                    aria-label={`remover recurso ${r.name}`}
                    onClick={() =>
                      patch({ resources: p.resources.filter((_, idx) => idx !== i) })
                    }
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {editavel && (
            <FormRecurso onAdicionar={(novo) => patch({ resources: [...p.resources, novo] })} />
          )}
        </div>

        {editavel ? (
          <div className="notesbox">
            <span className="sectitle">Notas rápidas</span>
            <CampoTextoAdiado
              valor={p.notes}
              maxLength={600}
              onSalvar={(texto) => patch({ notes: texto })}
              placeholder="itens em jogo, concentração, lembretes…"
            />
          </div>
        ) : (
          p.notes && (
            <div className="notesbox">
              <span className="sectitle">Notas</span>
              <p>{p.notes}</p>
            </div>
          )
        )}
      </div>

      {souMestre && (
        <div className="cardfoot">
          <button
            type="button"
            className="removechar"
            onClick={() => {
              if (confirm(`Remover ${p.name} do painel?`)) sala.removerPersonagem(p.id);
            }}
          >
            remover {p.is_npc ? "NPC" : "personagem"}
          </button>
        </div>
      )}
    </div>
  );
}

function sinal(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Formulário pra cadastrar um recurso novo (nome livre + quantidade de usos). */
function FormRecurso({ onAdicionar }: { onAdicionar: (r: Recurso) => void }) {
  const [nome, setNome] = useState("");
  const [max, setMax] = useState("");
  const [curto, setCurto] = useState(false);

  function adicionar() {
    const nomeLimpo = nome.trim();
    const maximo = Number.parseInt(max, 10);
    if (!nomeLimpo || Number.isNaN(maximo) || maximo <= 0) return;
    onAdicionar({ name: nomeLimpo, max: maximo, cur: maximo, short_rest: curto });
    setNome("");
    setMax("");
    setCurto(false);
  }

  return (
    <div className="addcombatant" style={{ marginTop: 8 }}>
      <input
        type="text"
        placeholder="nome (ex.: Fúria, Pontos de Foco, Espaços Nv.1)"
        maxLength={40}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <input
        className="num"
        type="number"
        inputMode="numeric"
        placeholder="usos"
        value={max}
        onChange={(e) => setMax(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") adicionar();
        }}
      />
      <label className="checklabel">
        <input type="checkbox" checked={curto} onChange={(e) => setCurto(e.target.checked)} />
        recupera no descanso curto
      </label>
      <button type="button" className="btn" onClick={adicionar}>
        + recurso
      </button>
    </div>
  );
}
