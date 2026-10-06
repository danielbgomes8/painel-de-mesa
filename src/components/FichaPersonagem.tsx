"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { AlterarListas, Personagem } from "@/lib/tipos";
import { mudancaDe, textoDesfeito } from "@/lib/desfazer";
import {
  ajustarPV,
  ajustePVComLog,
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
  podeEditarPersonagem,
  nivelTotal,
} from "@/lib/regras";
import { CampoTextoAdiado } from "@/components/CampoTextoAdiado";
import { CampoNumero } from "@/components/CampoNumero";
import { CampoTexto } from "@/components/CampoTexto";
import { BotaoRemover } from "@/components/BotaoRemover";
import { AtaquesPersonagem } from "@/components/AtaquesPersonagem";
import { CompanheirosDaFicha } from "@/components/CompanheirosDaFicha";
import { normalizarAtaques, textoEfetivoDeAtaques } from "@/lib/ataquesFicha";
import { FichaCompleta } from "@/components/FichaCompleta";
import { FichaClasse } from "@/components/FichaClasse";
import { MagiasPersonagem } from "@/components/MagiasPersonagem";
import { InventarioPersonagem } from "@/components/InventarioPersonagem";
import type { Bau } from "@/hooks/useBau";
import { FichaClassicaJogador } from "@/components/FichaClassicaJogador";
import { CondicoesDaFicha } from "@/components/ExplicacaoCondicao";
import { ChipsCondicao, PrazosCondicao } from "@/components/CondicoesEditaveis";
import { TestesDeMorte } from "@/components/TestesDeMorte";

const TIPOS_DADO = ["d6", "d8", "d10", "d12"];

/**
 * Dano (`delta` < 0) ou cura "de verdade" num personagem (dano desconta do PV
 * temporário primeiro) + linha no log — só loga depois que a escrita da ficha
 * confirmar, senão o log jura um dano que não aconteceu. Mesma sequência das
 * Ações em Massa. Devolve o retorno pra quem aplicou (ver `ajustePVComLog`),
 * ou null se a escrita falhou (o aviso de falha já aparece no topo). Serve o
 * −/+ da ficha e o dano direto na linha da iniciativa, e fica guardado pro
 * botão de desfazer.
 */
export async function mudarPVComLog(sala: Sala, p: Personagem, delta: number): Promise<string | null> {
  const { patch, texto, retorno } = ajustePVComLog(p, delta);
  const deuCerto = await sala.atualizarVariosPersonagens([{ id: p.id, patch }]);
  if (!deuCerto) return null;
  if (texto) sala.registrarVariosLogs([texto]);
  sala.lembrarDesfazer({
    rotulo: retorno,
    textoLog: textoDesfeito(texto ? [texto] : [], ""),
    personagens: [mudancaDe(p, patch)],
    combate: null,
    criados: [],
  });
  return retorno;
}

export function FichaPersonagem({
  personagem: p,
  souMestre,
  ehMinha,
  sala,
  bau,
}: {
  personagem: Personagem;
  souMestre: boolean;
  ehMinha: boolean;
  sala: Sala;
  /** O baú do grupo, pra "guardar no baú" a partir do inventário. */
  bau?: Bau;
}) {
  const patch = (mudanca: Partial<Personagem>) => sala.atualizarPersonagem(p.id, mudanca);
  const alterarListas: AlterarListas = (fazer) => sala.alterarListasDoPersonagem(p.id, fazer);
  // Permissão é da própria ficha, não de quem manda renderizar — ver
  // podeEditarPersonagem em regras.ts.
  const editavel = podeEditarPersonagem(souMestre, ehMinha);
  const [mostrarExtras, setMostrarExtras] = useState(false);
  const [mostrarFichaCompleta, setMostrarFichaCompleta] = useState(false);

  function mudarPV(delta: number) {
    mudarPVComLog(sala, p, delta);
  }

  function descansoLongoCompleto() {
    if (!confirm(`Aplicar descanso longo em ${p.name}? Cura tudo, tira 1 nível de exaustão, recupera dados de vida e zera os recursos.`)) return;
    patch(aplicarDescansoLongo(p));
  }

  const faixa = faixaPV(p.hp, p.hp_max);
  const largura = p.hp_max > 0 ? Math.max(0, Math.min(1, p.hp / p.hp_max)) : 0;
  const caido = estaCaido(p.hp);
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

  // Quem joga vê a folha; o resumo de combate completo é só do Mestre.
  const modoJogador = !souMestre && !p.is_npc;

  const blocoAtaquesEDescansos = (
    <>
        {p.is_npc ? null : (
          <AtaquesPersonagem
            textoEfetivo={textoEfetivoDeAtaques(p)}
            textoLivre={p.ataque ?? ""}
            ataques={normalizarAtaques(p.ataques)}
            atributos={p.atributos}
            nivel={nivelTotal(p.classes ?? [])}
            editavel={editavel}
            onSalvarTexto={(texto) => patch({ ataque: texto })}
            onSalvarAtaques={(ataques) => patch({ ataques })}
          />
        )}

        {editavel && !p.is_npc ? (
          <div className="combatctrls">
            <button type="button" className="btn" onClick={() => patch(aplicarDescansoCurto(p))}>
              Descanso curto
            </button>
            {/* O descanso longo é do Mestre: ele decide quem descansa e quando o dia passa (ver "Tempo da campanha"). */}
            {souMestre && (
              <button type="button" className="btn" onClick={descansoLongoCompleto}>
                Descanso longo
              </button>
            )}
          </div>
        ) : null}

        {editavel && !p.is_npc ? <CompanheirosDaFicha sala={sala} personagem={p} souMestre={souMestre} /> : null}
    </>
  );

  const blocoChipsEStats = (
    <>
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
    </>
  );

  const blocoTestesDeMorte = (
    <>
        {p.is_npc ? null : (
          <TestesDeMorte
            sala={sala}
            personagem={p}
            editavel={editavel}
            titulo="Testes de resistência contra a morte"
          />
        )}
    </>
  );

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
            {/* "Inconsciente", não "Caído": Caído é a condição de estar
             *  derrubado no chão (Prone), com explicação própria na ficha. */}
            {p.is_npc ? "⚠ A 0 PV — fora de combate" : "⚠ Inconsciente — a 0 PV, faça os testes de morte"}
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

        {/* O jogador abre a PRÓPRIA ficha já na folha: vida e testes de morte no
            topo, depois os números da folha e a ficha de atributos. O resumo
            (cartão de combate completo + "ver ficha completa") é do Mestre. */}
        {modoJogador && caido && blocoTestesDeMorte}
        {modoJogador && blocoChipsEStats}
        {modoJogador && <AtalhosDaFicha idBase={p.id} />}
        {modoJogador && (
          <FichaClassicaJogador personagem={p} editavel={editavel} patch={patch} sala={sala} modo="jogador" souMestre={souMestre} />
        )}
        {modoJogador && <div id={idAtalho(p.id, "ataques")} className="alvo-atalho">{blocoAtaquesEDescansos}</div>}

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

        {!modoJogador && blocoAtaquesEDescansos}

        {!modoJogador && blocoChipsEStats}

        {escondeExtras && editavel ? (
          <button type="button" className="minilink" onClick={() => setMostrarExtras(true)}>
            + saves e CD de magia
          </button>
        ) : null}

        {escondeExtras || modoJogador ? null : (
        <div>
          <span className="sectitle">Bônus de resistência (saves)</span>
          <div className="statsrow">
            {/* Sigla, não o nome: o quadrinho tem ~51px úteis no celular e
             *  "CONSTITUIÇÃO" em maiúscula espaçada ocupa 90px — cortava. */}
            {(
              [
                ["FOR", "Força", "save_str"],
                ["DES", "Destreza", "save_dex"],
                ["CON", "Constituição", "save_con"],
                ["INT", "Inteligência", "save_int"],
                ["SAB", "Sabedoria", "save_wis"],
                ["CAR", "Carisma", "save_cha"],
              ] as const
            ).map(([sigla, nome, campo]) => (
              <div key={campo} className="stat">
                <div className="lbl" title={nome}>
                  {sigla}
                </div>
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

        {!(modoJogador && caido) && blocoTestesDeMorte}

        <div id={idAtalho(p.id, "condicoes")} className="alvo-atalho">
          <span className="sectitle">Condições</span>
          <ChipsCondicao sala={sala} personagem={p} editavel={editavel} />
          {editavel && <PrazosCondicao sala={sala} personagem={p} />}
          <CondicoesDaFicha personagem={p} />
        </div>

        {p.is_npc ? null : (
        <div id={idAtalho(p.id, "recursos")} className="alvo-atalho">
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

        {modoJogador && (
          <>
            <FichaClasse personagem={p} editavel={editavel} patch={patch} />
            <div id={idAtalho(p.id, "magias")} className="alvo-atalho">
              <MagiasPersonagem personagem={p} editavel={editavel} patch={patch} alterarListas={alterarListas} registrar={(t) => void sala.registrarLog(t)} />
            </div>
            <div id={idAtalho(p.id, "inventario")} className="alvo-atalho">
              <InventarioPersonagem personagem={p} editavel={editavel} alterarListas={alterarListas} bau={bau} registrar={(t) => void sala.registrarLog(t)} />
            </div>
            <FichaCompleta personagem={p} editavel={editavel} patch={patch} />
          </>
        )}

        {!modoJogador && !p.is_npc && (
          <div>
            <button
              type="button"
              className="minilink"
              onClick={() => setMostrarFichaCompleta((v) => !v)}
            >
              {mostrarFichaCompleta ? "− ficha completa" : "+ ver ficha completa"}
            </button>
            {mostrarFichaCompleta && (
              <>
                <FichaClassicaJogador personagem={p} editavel={editavel} patch={patch} sala={sala} souMestre={souMestre} />
                <FichaClasse personagem={p} editavel={editavel} patch={patch} />
                <MagiasPersonagem personagem={p} editavel={editavel} patch={patch} alterarListas={alterarListas} registrar={(t) => void sala.registrarLog(t)} />
                <InventarioPersonagem personagem={p} editavel={editavel} alterarListas={alterarListas} bau={bau} registrar={(t) => void sala.registrarLog(t)} />
                <FichaCompleta personagem={p} editavel={editavel} patch={patch} />
              </>
            )}
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
        placeholder={comDescansoCurto ? "usos" : "quantidade"}
        aria-label={comDescansoCurto ? "usos por descanso" : "quantidade ou estados (ex.: 3 de desgaste)"}
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

const ATALHOS_DA_FICHA = [
  { chave: "ataques", rotulo: "⚔ Ataques e descanso" },
  { chave: "condicoes", rotulo: "⏳ Condições" },
  { chave: "recursos", rotulo: "✨ Recursos" },
  { chave: "magias", rotulo: "🔮 Magias" },
  { chave: "inventario", rotulo: "🎒 Inventário" },
] as const;

function idAtalho(idBase: string, chave: string): string {
  return `ficha-${idBase}-${chave}`;
}

/** A folha de atributos ocupa mais de 1.200px no celular e empurra pra baixo o
 *  que se usa no combate. Em vez de recolhê-la (o jogador abre a ficha já na
 *  folha, de propósito), uma fileira de atalhos leva direto a cada parte. */
function AtalhosDaFicha({ idBase }: { idBase: string }) {
  function ir(chave: string) {
    const alvo = document.getElementById(idAtalho(idBase, chave));
    if (!alvo) return;
    const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    alvo.scrollIntoView({ behavior: reduzido ? "auto" : "smooth", block: "start" });
  }
  return (
    <nav className="fichaatalhos" aria-label="Ir para uma parte da ficha">
      {ATALHOS_DA_FICHA.map((a) => (
        <button key={a.chave} type="button" onClick={() => ir(a.chave)}>
          {a.rotulo}
        </button>
      ))}
    </nav>
  );
}
