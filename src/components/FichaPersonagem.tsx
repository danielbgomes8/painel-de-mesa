"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Personagem } from "@/lib/tipos";
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
  estaCaido,
  EXAUSTAO_MAX,
  faixaPV,
  formatarMetros,
  gastarDadoDeVida,
  limitarExaustao,
  limitarPV,
  limitarTesteMorte,
  mensagemAjustePV,
  mensagemCondicao,
  mensagemDanoAbsorvido,
  podeEditarPersonagem,
  situacaoMorte,
  TESTES_MORTE_MAX,
} from "@/lib/regras";
import { CampoTextoAdiado } from "@/components/CampoTextoAdiado";
import { CampoNumero } from "@/components/CampoNumero";
import { CampoTexto } from "@/components/CampoTexto";
import { BotaoRemover } from "@/components/BotaoRemover";
import { FichaCompleta } from "@/components/FichaCompleta";

const TIPOS_DADO = ["d6", "d8", "d10", "d12"];

export function FichaPersonagem({
  personagem: p,
  souMestre,
  ehMinha,
  sala,
}: {
  personagem: Personagem;
  souMestre: boolean;
  ehMinha: boolean;
  sala: Sala;
}) {
  const patch = (mudanca: Partial<Personagem>) => sala.atualizarPersonagem(p.id, mudanca);
  // Permissão é da própria ficha, não de quem manda renderizar — ver
  // podeEditarPersonagem em regras.ts.
  const editavel = podeEditarPersonagem(souMestre, ehMinha);
  const [mostrarExtras, setMostrarExtras] = useState(false);
  const [mostrarFichaCompleta, setMostrarFichaCompleta] = useState(false);

  /** Dano/cura "de verdade" (descontam do PV temporário primeiro) + linha no
   *  log — mesma sequência "escreve, só loga se confirmar" das Ações em
   *  Massa, reaproveitada aqui em vez de reimplementada. */
  async function mudarPV(delta: number) {
    let resultado: Partial<Personagem>;
    let texto: string | null = null;
    if (delta >= 0) {
      const r = aplicarCura(p, delta);
      resultado = r;
      if (r.hp !== p.hp) texto = mensagemAjustePV(p.name, r.hp - p.hp, r.hp, p.hp_max);
    } else {
      const r = aplicarDano(p, -delta);
      resultado = r;
      const deltaReal = r.hp - p.hp;
      if (deltaReal !== 0) {
        texto = mensagemAjustePV(p.name, deltaReal, r.hp, p.hp_max);
      } else if (r.hp_temp < p.hp_temp) {
        texto = mensagemDanoAbsorvido(p.name, p.hp_temp - r.hp_temp);
      }
    }
    const deuCerto = await sala.atualizarVariosPersonagens([{ id: p.id, patch: resultado }]);
    if (deuCerto && texto) sala.registrarVariosLogs([texto]);
  }

  function descansoLongoCompleto() {
    if (!confirm(`Aplicar descanso longo em ${p.name}? Cura tudo, tira 1 nível de exaustão, recupera dados de vida e zera os recursos.`)) return;
    patch(aplicarDescansoLongo(p));
  }

  const faixa = faixaPV(p.hp, p.hp_max);
  const largura = p.hp_max > 0 ? Math.max(0, Math.min(1, p.hp / p.hp_max)) : 0;
  const caido = estaCaido(p.hp);
  const morte = situacaoMorte(p.dss, p.dsf);
  // Monstro só mostra saves e CD de magia depois que alguém preenche: seis zeros
  // na tela atrapalham a leitura no meio do combate. O link abaixo traz de volta
  // quando o Mestre quiser cadastrar (senão o campo somia sem como reaparecer).
  const temSaves =
    p.save_str !== 0 || p.save_dex !== 0 || p.save_con !== 0 ||
    p.save_int !== 0 || p.save_wis !== 0 || p.save_cha !== 0;
  // spell_dc null é o sinal de "não preenchido" (migration 0009) — antes
  // era "=== 10", que escondia à toa um NPC cujo CD de magia é 10 de verdade.
  const extrasEmBranco = p.is_npc && !temSaves && p.spell_dc === null;
  const escondeExtras = extrasEmBranco && !mostrarExtras;

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
            {/* NPC não tem a seção de testes de morte abaixo (monstro não
             *  rola morte no 2024) — banner não pode mandar fazer um teste
             *  que não existe na própria ficha. */}
            {p.is_npc ? "⚠ Caído — a 0 PV" : "⚠ Caído — inconsciente, faça os testes de morte"}
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

        {p.is_npc && (editavel || p.ataque) ? (
          <div className="ataquebloco">
            <span className="sectitle">Ataque</span>
            {editavel ? (
              <div className="notesbox">
                <CampoTextoAdiado
                  valor={p.ataque}
                  maxLength={200}
                  placeholder="ex.: Cimitarra +4, 1d6+2 cortante"
                  onSalvar={(texto) => patch({ ataque: texto })}
                />
              </div>
            ) : (
              <p className="ataquetexto">{p.ataque}</p>
            )}
          </div>
        ) : null}

        {editavel && !p.is_npc ? (
          <div className="combatctrls">
            <button type="button" className="btn" onClick={() => patch(aplicarDescansoCurto(p))}>
              Descanso curto
            </button>
            <button type="button" className="btn" onClick={descansoLongoCompleto}>
              Descanso longo
            </button>
          </div>
        ) : null}

        <div className="chips">
          {p.is_npc ? null : (
            <button
              type="button"
              className="chip flag"
              aria-pressed={p.inspiration}
              disabled={!editavel}
              onClick={() => patch({ inspiration: !p.inspiration })}
            >
              ⭐ Inspiração
            </button>
          )}
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

        <div className="statsrow">
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
          <div className="stat">
            <div className="lbl">Perc. passiva</div>
            {editavel ? (
              <CampoNumero valor={p.pp} onCommit={(n) => patch({ pp: Math.max(0, n) })} />
            ) : (
              <div className="val">{p.pp}</div>
            )}
          </div>
          {escondeExtras ? null : (
            <div className="stat">
              <div className="lbl">CD de magia</div>
              {editavel ? (
                // Mostra 10 como ponto de partida se ainda não foi preenchido;
                // só grava de verdade (tirando do null) quando o Mestre mexer.
                <CampoNumero valor={p.spell_dc ?? 10} onCommit={(n) => patch({ spell_dc: Math.max(0, n) })} />
              ) : (
                <div className="val">{p.spell_dc ?? 10}</div>
              )}
            </div>
          )}
        </div>

        {escondeExtras && editavel ? (
          <button type="button" className="minilink" onClick={() => setMostrarExtras(true)}>
            + saves e CD de magia
          </button>
        ) : null}

        {escondeExtras ? null : (
        <div>
          <span className="sectitle">Bônus de resistência (saves)</span>
          <div className="statsrow">
            {(
              [
                ["Força", "save_str"],
                ["Destreza", "save_dex"],
                ["Constituição", "save_con"],
                ["Inteligência", "save_int"],
                ["Sabedoria", "save_wis"],
                ["Carisma", "save_cha"],
              ] as const
            ).map(([rotulo, campo]) => (
              <div key={campo} className="stat">
                <div className="lbl">{rotulo}</div>
                {editavel ? (
                  <CampoNumero valor={p[campo]} onCommit={(n) => patch({ [campo]: n })} />
                ) : (
                  <div className="val">{sinal(p[campo])}</div>
                )}
              </div>
            ))}
          </div>
        </div>
        )}

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

        {p.is_npc ? null : (
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
        )}

        {p.is_npc ? null : (
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
        )}

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
                  onClick={async () => {
                    const ligar = !ativa;
                    const cond_prazo = { ...p.cond_prazo };
                    if (!ligar) delete cond_prazo[nome];
                    const mudanca = { cond: { ...p.cond, [nome]: ligar }, cond_prazo };
                    const deuCerto = await sala.atualizarVariosPersonagens([{ id: p.id, patch: mudanca }]);
                    if (deuCerto) sala.registrarVariosLogs([mensagemCondicao(p.name, nome, ligar)]);
                  }}
                >
                  {nome}
                </button>
              );
            })}
          </div>
          {editavel && (
            <div className="condprazos">
              {CONDICOES.filter((nome) => p.cond?.[nome]).map((nome) => (
                <label key={nome} className="condprazo">
                  {nome} dura
                  <CampoNumero
                    className="campnum"
                    valor={p.cond_prazo[nome] ?? 0}
                    onCommit={(n) => {
                      const cond_prazo = { ...p.cond_prazo };
                      if (n <= 0) delete cond_prazo[nome];
                      else cond_prazo[nome] = n;
                      patch({ cond_prazo });
                    }}
                  />
                  rodada(s) — 0 = tira à mão
                </label>
              ))}
            </div>
          )}
        </div>

        {p.is_npc ? null : (
        <div>
          <span className="sectitle">Recursos (Fúria, Ki, espaços de magia…)</span>
          {p.resources.length === 0 && (
            <p className="empty-note">
              {editavel ? "Nenhum ainda — cadastre o que a sua classe usa." : "Nenhum cadastrado."}
            </p>
          )}
          <TrilhaDeUsos
            itens={p.resources}
            editavel={editavel}
            rotuloPip={(nome, k) => `${nome} uso ${k + 1}`}
            rotuloRemover={(nome) => `remover recurso ${nome}`}
            detalhe={(r) => r.short_rest && " · desc. curto"}
            onAlterarCur={(i, cur) => patch({ resources: p.resources.map((x, idx) => (idx === i ? { ...x, cur } : x)) })}
            onRemover={(i) => patch({ resources: p.resources.filter((_, idx) => idx !== i) })}
          />
          {editavel && (
            <FormContador
              placeholderNome="nome (ex.: Fúria, Pontos de Foco, Espaços Nv.1)"
              comDescansoCurto
              onAdicionar={(novo) => patch({ resources: [...p.resources, { ...novo, short_rest: novo.short_rest ?? false }] })}
            />
          )}
        </div>
        )}

        {p.is_npc ? null : (
        <div>
          <span className="sectitle">Munição e equipamento</span>
          {p.items.length === 0 && (
            <p className="empty-note">
              {editavel ? "Nada cadastrado — flechas, tochas, o estado de uma arma..." : "Nada cadastrado."}
            </p>
          )}
          <TrilhaDeUsos
            itens={p.items}
            editavel={editavel}
            onAlterarCur={(i, cur) => patch({ items: p.items.map((x, idx) => (idx === i ? { ...x, cur } : x)) })}
            onRemover={(i) => patch({ items: p.items.filter((_, idx) => idx !== i) })}
          />
          {editavel && (
            <FormContador
              placeholderNome="nome (ex.: Flechas, Tochas, Espada longa)"
              onAdicionar={(novo) => patch({ items: [...p.items, novo] })}
            />
          )}
        </div>
        )}

        {p.is_npc ? null : editavel ? (
          <div className="notesbox">
            <span className="sectitle">Vantagens &amp; resistências</span>
            <CampoTextoAdiado
              valor={p.vantagens_resistencias}
              maxLength={300}
              onSalvar={(texto) => patch({ vantagens_resistencias: texto })}
              placeholder="ex.: Vantagem em Testes de Destreza; Resistência a Fogo"
            />
          </div>
        ) : (
          p.vantagens_resistencias && (
            <div className="notesbox">
              <span className="sectitle">Vantagens &amp; resistências</span>
              <p>{p.vantagens_resistencias}</p>
            </div>
          )
        )}

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

        {!p.is_npc && (
          <div>
            <button
              type="button"
              className="minilink"
              onClick={() => setMostrarFichaCompleta((v) => !v)}
            >
              {mostrarFichaCompleta ? "− ficha completa" : "+ ver ficha completa"}
            </button>
            {mostrarFichaCompleta && <FichaCompleta personagem={p} editavel={editavel} patch={patch} />}
          </div>
        )}
      </div>

      {souMestre && (
        <div className="cardfoot">
          <BotaoRemover
            aria={`remover ${p.name}`}
            confirmar={`Remover ${p.name} do painel?`}
            onConfirmar={() => sala.removerPersonagem(p.id)}
            className="removechar"
          >
            remover {p.is_npc ? "NPC" : "personagem"}
          </BotaoRemover>
        </div>
      )}
    </div>
  );
}

function sinal(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

type ContadorUso = { name: string; max: number; cur: number };

/** Trilha de pips (usos restantes) com nome, contador clicável e remover —
 *  mesmo desenho pra Recursos (Fúria, Ki...) e Munição/equipamento. */
function TrilhaDeUsos<T extends ContadorUso>({
  itens,
  editavel,
  onAlterarCur,
  onRemover,
  rotuloPip = (nome, k) => `${nome} ${k + 1}`,
  rotuloRemover = (nome) => `remover ${nome}`,
  detalhe,
}: {
  itens: T[];
  editavel: boolean;
  onAlterarCur: (indice: number, cur: number) => void;
  onRemover: (indice: number) => void;
  rotuloPip?: (nome: string, k: number) => string;
  rotuloRemover?: (nome: string) => string;
  detalhe?: (item: T) => React.ReactNode;
}) {
  return (
    <div className="reslist">
      {itens.map((item, i) => (
        <div key={i} className="resrow">
          <span className="resnome">
            {item.name}
            {detalhe?.(item)}
          </span>
          <div className="pips">
            {Array.from({ length: item.max }, (_, k) => (
              <button
                key={k}
                type="button"
                className="pip"
                aria-label={rotuloPip(item.name, k)}
                aria-pressed={k < item.cur}
                disabled={!editavel}
                onClick={() => onAlterarCur(i, limitarPV(alternarPips(k, item.cur), item.max))}
              />
            ))}
          </div>
          {editavel && <BotaoRemover aria={rotuloRemover(item.name)} onConfirmar={() => onRemover(i)} />}
        </div>
      ))}
    </div>
  );
}

/** Formulário pra cadastrar um recurso ou item novo (nome livre + quantidade
 *  de usos); o checkbox de descanso curto só faz sentido pra recursos. */
function FormContador({
  placeholderNome,
  comDescansoCurto = false,
  onAdicionar,
}: {
  placeholderNome: string;
  comDescansoCurto?: boolean;
  onAdicionar: (dados: { name: string; max: number; cur: number; short_rest?: boolean }) => void;
}) {
  const [nome, setNome] = useState("");
  const [max, setMax] = useState("");
  const [curto, setCurto] = useState(false);

  function adicionar() {
    const nomeLimpo = nome.trim();
    const maximo = Number.parseInt(max, 10);
    if (!nomeLimpo || Number.isNaN(maximo) || maximo <= 0) return;
    onAdicionar({
      name: nomeLimpo,
      max: maximo,
      cur: maximo,
      ...(comDescansoCurto ? { short_rest: curto } : {}),
    });
    setNome("");
    setMax("");
    setCurto(false);
  }

  return (
    <div className="addcombatant" style={{ marginTop: 8 }}>
      <input
        type="text"
        placeholder={placeholderNome}
        maxLength={40}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <input
        className="num"
        type="number"
        inputMode="numeric"
        placeholder={comDescansoCurto ? "usos" : "quantidade/estados"}
        value={max}
        onChange={(e) => setMax(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") adicionar();
        }}
      />
      {comDescansoCurto && (
        <label className="checklabel">
          <input type="checkbox" checked={curto} onChange={(e) => setCurto(e.target.checked)} />
          recupera no descanso curto
        </label>
      )}
      <button type="button" className="btn" onClick={adicionar}>
        + {comDescansoCurto ? "recurso" : "item"}
      </button>
    </div>
  );
}
