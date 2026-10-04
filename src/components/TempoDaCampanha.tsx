"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Tempo } from "@/hooks/useTempo";
import { aplicarDescansoLongo } from "@/lib/regras";
import {
  ancorarHoje,
  dataHarptos,
  diasRestantes,
  FESTIVAIS,
  linhaDeAvanco,
  linhaDeEfeitoEncerrado,
  linhaDeEfeitoNovo,
  MESES_HARPTOS,
  ordenarEfeitos,
  plural,
  situacaoDoEfeito,
  textoDoRestante,
  type DiaHarptos,
  type TempoCampanha,
} from "@/lib/tempoCampanha";
import { BotaoRemover } from "@/components/BotaoRemover";

/** O valor do <select> de "hoje é...": "m7" (Flamerule) ou "f:Midsummer". */
function valorDoDia(d: DiaHarptos): string {
  return d.tipo === "festival" ? `f:${d.nome}` : `m${d.mes}`;
}

/** O tempo da campanha: o dia em que a mesa está, a data (se a campanha usa calendário de mundo) e os
 *  efeitos que duram dias. Todo mundo vê; só o Mestre mexe. As contas moram em `lib/tempoCampanha.ts`. */
export function TempoDaCampanha({ tempo: t, sala, souMestre }: { tempo: Tempo; sala: Sala; souMestre: boolean }) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [quantos, setQuantos] = useState("3");

  if (t.indisponivel) {
    return <p className="empty-note">Falta rodar a migration 0028 no Supabase pra contar os dias da campanha.</p>;
  }
  if (t.carregando) return <p className="empty-note">Carregando…</p>;

  if (!t.tempo) {
    return (
      <div className="tp">
        <p className="empty-note">A campanha ainda não começou a contar os dias.</p>
        {souMestre && (
          <button
            type="button"
            className="btn"
            disabled={ocupado}
            onClick={async () => {
              setOcupado(true);
              if (!(await t.iniciar())) setAviso("Não consegui começar a contar. Tente de novo.");
              setOcupado(false);
            }}
          >
            Começar a contar os dias
          </button>
        )}
        {aviso && <p className="inv-alerta">{aviso}</p>}
      </div>
    );
  }

  const tempo = t.tempo;
  const harptos = tempo.calendario === "harptos";
  const efeitos = ordenarEfeitos(t.efeitos, tempo.dia);
  const registrar = (texto: string) => void sala.registrarLog(texto);

  /** Avança (ou volta) `delta` dias, registra no log e avisa quais efeitos venceram com isso. */
  async function mudarDia(delta: number, descanso = false): Promise<TempoCampanha | null> {
    const r = await t.mudarDia(delta);
    if (!r) {
      setAviso("Não deu pra mudar o dia (outro aparelho mexeu junto, ou chegou no limite). Confira o dia e tente de novo.");
      return null;
    }
    registrar(linhaDeAvanco(r.antes, r.depois, descanso));
    const venceram = t.efeitos.filter((e) => diasRestantes(e, r.antes.dia) > 0 && diasRestantes(e, r.depois.dia) <= 0);
    for (const e of venceram) registrar(linhaDeEfeitoEncerrado(e, true));
    setAviso(venceram.length > 0 ? `Venceu: ${venceram.map((e) => e.nome).join(", ")}.` : null);
    return r.depois;
  }

  async function passar(delta: number) {
    if (ocupado || delta === 0) return;
    setOcupado(true);
    await mudarDia(delta);
    setOcupado(false);
  }

  async function descansoDoGrupo() {
    const jogadores = sala.personagens.filter((p) => !p.is_npc);
    if (
      !confirm(
        `Descanso longo do grupo? Aplica o descanso longo em ${plural(jogadores.length, "personagem", "personagens")} (cura tudo, tira 1 de exaustão, recupera dados de vida e recursos) e passa 1 dia.`,
      )
    )
      return;
    setOcupado(true);
    const ok = jogadores.length === 0 || (await sala.atualizarVariosPersonagens(jogadores.map((p) => ({ id: p.id, patch: aplicarDescansoLongo(p) }))));
    if (!ok) {
      setAviso("Não consegui aplicar o descanso nas fichas, então o dia não passou.");
    } else {
      await mudarDia(1, true);
    }
    setOcupado(false);
  }

  return (
    <div className="tp">
      <div className="tp-dia">
        <b className="tp-numero">Dia {tempo.dia}</b>
        {harptos && <span className="tp-data">{dataHarptos(tempo).texto}</span>}
      </div>

      {souMestre && (
        <div className="tp-acoes">
          <button type="button" className="btn" disabled={ocupado} onClick={() => passar(1)}>
            + 1 dia
          </button>
          <button type="button" className="btn" disabled={ocupado} onClick={descansoDoGrupo}>
            🌙 Descanso longo do grupo
          </button>
          <span className="tp-varios">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              aria-label="quantos dias passar"
              value={quantos}
              onChange={(e) => setQuantos(e.target.value)}
            />
            <button
              type="button"
              className="btn"
              disabled={ocupado}
              onClick={() => passar(Math.max(1, Number.parseInt(quantos, 10) || 0))}
            >
              passar dias
            </button>
          </span>
          {tempo.dia > 1 && (
            <button
              type="button"
              className="minilink"
              disabled={ocupado}
              onClick={() => confirm("Voltar 1 dia? Use só pra corrigir um clique errado.") && passar(-1)}
            >
              voltar 1 dia
            </button>
          )}
        </div>
      )}
      {aviso && (
        <p className="inv-alerta" role="status" aria-live="polite">
          {aviso}
        </p>
      )}

      <div className="tp-efeitos">
        <span className="sectitle">Efeitos que duram dias</span>
        {efeitos.length === 0 && <p className="empty-note">Nenhum efeito em andamento.</p>}
        <ul className="tp-lista">
          {efeitos.map((e) => {
            const restante = diasRestantes(e, tempo.dia);
            return (
              <li key={e.id} className="tp-efeito" data-situacao={situacaoDoEfeito(restante)}>
                <div className="tp-efeito-linha">
                  <span className="tp-efeito-nome">
                    <b>{e.nome}</b>
                    {e.alvo && <span className="tp-alvo"> · {e.alvo}</span>}
                  </span>
                  <span className="tp-restante">{textoDoRestante(restante)}</span>
                  {souMestre && (
                    <BotaoRemover
                      aria={`encerrar ${e.nome}`}
                      confirmar={`Encerrar "${e.nome}"?`}
                      onConfirmar={() =>
                        void t.removerEfeito(e.id).then((ok) => ok && registrar(linhaDeEfeitoEncerrado(e, false)))
                      }
                    />
                  )}
                </div>
                {e.nota && <p className="tp-nota">{e.nota}</p>}
              </li>
            );
          })}
        </ul>
        {souMestre && <NovoEfeito tempo={tempo} sala={sala} t={t} registrar={registrar} />}
      </div>

      {souMestre && <Calendario tempo={tempo} t={t} />}
    </div>
  );
}

function NovoEfeito({ tempo, sala, t, registrar }: { tempo: TempoCampanha; sala: Sala; t: Tempo; registrar: (texto: string) => void }) {
  const [nome, setNome] = useState("");
  const [alvo, setAlvo] = useState("");
  const [duracao, setDuracao] = useState("7");
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    const n = nome.trim();
    const d = Number.parseInt(duracao, 10);
    if (!n) return;
    if (!Number.isFinite(d) || d < 1) {
      setErro("A duração é em dias, no mínimo 1.");
      return;
    }
    const criado = await t.criarEfeito({ nome: n, alvo, duracao: d, nota });
    if (!criado) {
      setErro("Não consegui guardar o efeito. Tente de novo.");
      return;
    }
    setErro(null);
    registrar(linhaDeEfeitoNovo(criado));
    setNome("");
    setNota("");
  }

  return (
    <div className="tp-novo">
      <input type="text" placeholder="efeito (ex.: Maldição da múmia)" aria-label="nome do efeito" maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} />
      <div className="tp-novo-linha">
        <input
          type="text"
          list="tp-alvos"
          placeholder="quem (ou o grupo)"
          aria-label="quem é afetado"
          maxLength={60}
          value={alvo}
          onChange={(e) => setAlvo(e.target.value)}
        />
        <datalist id="tp-alvos">
          <option value="o grupo" />
          {sala.personagens
            .filter((p) => !p.is_npc)
            .map((p) => (
              <option key={p.id} value={p.name} />
            ))}
        </datalist>
        <input type="number" inputMode="numeric" min={1} aria-label="duração em dias" value={duracao} onChange={(e) => setDuracao(e.target.value)} />
        <span className="tp-dias">dias</span>
      </div>
      <input type="text" placeholder="nota (opcional)" aria-label="nota do efeito" maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
      <button type="button" className="btn" disabled={!nome.trim()} onClick={criar}>
        + efeito (começa no dia {tempo.dia})
      </button>
      {erro && <p className="inv-alerta">{erro}</p>}
    </div>
  );
}

/** Calendário da campanha: "Dia N" simples ou o de Harptos (Forgotten Realms), com a data de hoje
 *  ajustável sem mexer no contador de dias. */
function Calendario({ tempo, t }: { tempo: TempoCampanha; t: Tempo }) {
  return (
    <details className="tp-cal">
      <summary>Calendário</summary>
      <label className="atq-campo">
        tipo de calendário
        <select
          value={tempo.calendario}
          onChange={(e) => void t.configurar({ calendario: e.target.value === "harptos" ? "harptos" : "dias" })}
        >
          <option value="dias">só “Dia N”</option>
          <option value="harptos">Harptos (Forgotten Realms)</option>
        </select>
      </label>
      {tempo.calendario === "harptos" && (
        <DataDeHoje key={`${tempo.dia}-${tempo.inicio_ano}-${tempo.inicio_dia_do_ano}`} tempo={tempo} t={t} />
      )}
    </details>
  );
}

/** Os campos de "hoje é…". Recomeçam a cada dia que passa (a `key` do chamador) pra não mostrar a data velha. */
function DataDeHoje({ tempo, t }: { tempo: TempoCampanha; t: Tempo }) {
  const hoje = dataHarptos(tempo);
  const [dia, setDia] = useState(hoje.dia.tipo === "mes" ? String(hoje.dia.dia) : "1");
  const [mes, setMes] = useState(valorDoDia(hoje.dia));
  const [ano, setAno] = useState(String(hoje.ano));
  const [msg, setMsg] = useState<string | null>(null);

  async function ajustar() {
    const a = Number.parseInt(ano, 10);
    const d = Number.parseInt(dia, 10);
    if (!Number.isFinite(a)) return;
    let escolhido: DiaHarptos;
    if (mes.startsWith("f:")) escolhido = { tipo: "festival", nome: mes.slice(2) };
    else {
      if (!Number.isFinite(d) || d < 1 || d > 30) {
        setMsg("O dia do mês vai de 1 a 30.");
        return;
      }
      escolhido = { tipo: "mes", mes: Number(mes.slice(1)), dia: d };
    }
    const ok = await t.configurar(ancorarHoje(tempo.dia, escolhido, a));
    setMsg(ok ? "Data ajustada." : "Não consegui ajustar a data.");
  }

  return (
    <div className="tp-data-hoje">
      <span className="sectitle">Hoje é…</span>
      <div className="tp-novo-linha">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={30}
          aria-label="dia do mês"
          disabled={mes.startsWith("f:")}
          value={dia}
          onChange={(e) => setDia(e.target.value)}
        />
        <select aria-label="mês ou festival" value={mes} onChange={(e) => setMes(e.target.value)}>
          {MESES_HARPTOS.map((m, i) => (
            <option key={m} value={`m${i + 1}`}>
              {m}
            </option>
          ))}
          {FESTIVAIS.map((f) => (
            <option key={f} value={`f:${f}`}>
              {f} (festival)
            </option>
          ))}
        </select>
        <input type="number" inputMode="numeric" aria-label="ano (CV)" value={ano} onChange={(e) => setAno(e.target.value)} />
      </div>
      <button type="button" className="btn" onClick={ajustar}>
        ajustar a data de hoje
      </button>
      {msg && <p className="empty-note">{msg}</p>}
    </div>
  );
}
