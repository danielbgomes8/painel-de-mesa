"use client";

import type { Sala } from "@/hooks/useSala";
import type { Personagem } from "@/lib/tipos";
import { CONDICOES } from "@/lib/condicoes";
import {
  ajustarPV,
  alternarPips,
  descansoLongo,
  deslocamentoEfetivo,
  efeitoExaustao,
  EXAUSTAO_MAX,
  faixaPV,
  formatarMetros,
  limitarExaustao,
  limitarPV,
  limitarTesteMorte,
  situacaoMorte,
  TESTES_MORTE_MAX,
} from "@/lib/regras";
import { CampoTextoAdiado } from "@/components/CampoTextoAdiado";

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
          {editavel && (
            <div className="hpbtns">
              <button
                type="button"
                className="pbtn"
                aria-label="Tirar 1 PV"
                onClick={() => patch(ajustarPV(p, p.hp - 1))}
              >
                −
              </button>
              <button
                type="button"
                className="pbtn"
                aria-label="Somar 1 PV"
                onClick={() => patch(ajustarPV(p, p.hp + 1))}
              >
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
          </div>
        )}

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
          {editavel && p.exh > 0 && (
            <div className="linha-descanso">
              <button
                type="button"
                className="minilink"
                onClick={() => patch({ exh: descansoLongo(p.exh) })}
              >
                descanso longo (−1 nível)
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

function CampoNumero({
  valor,
  onCommit,
  className = "",
}: {
  valor: number;
  onCommit: (n: number) => void;
  className?: string;
}) {
  function commit(el: HTMLInputElement) {
    const n = Number.parseInt(el.value, 10);
    if (Number.isNaN(n)) {
      el.value = String(valor);
      return;
    }
    if (n !== valor) onCommit(n);
  }
  return (
    <input
      key={valor}
      className={className}
      type="number"
      inputMode="numeric"
      defaultValue={valor}
      onBlur={(e) => commit(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
