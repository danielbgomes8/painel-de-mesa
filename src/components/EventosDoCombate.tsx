"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import { useEventosDoCombate } from "@/hooks/useEventos";
import type { Encontro, EventoPreparado } from "@/lib/tipos";
import {
  EVENTOS_NO_COMBATE,
  EVENTOS_POR_ENCONTRO,
  TEXTO_MAXIMO,
  RODADA_MAXIMA,
  linhaPublicaDoEvento,
  pendentes,
  rotuloDoGatilho,
  validarNovoEvento,
  type EventoDoCombate,
  type SituacaoDoCombate,
} from "@/lib/eventosCombate";
import { limitarQuantidade } from "@/lib/regras";
import { registrarUso } from "@/lib/registrarUso";
import { BotaoRemover } from "@/components/BotaoRemover";

/**
 * Eventos do combate (migration 0034; regras em `lib/eventosCombate.ts`): avisos
 * que o Mestre programa e que aparecem sozinhos — "rodada 3: o teto desaba",
 * "a 50% de PV o dragão levanta voo". Só o Mestre vê. Três peças:
 *  - `AvisosDoCombate`: os que dispararam e ainda não foram tratados (no topo do combate);
 *  - `GavetaDeEventos`: todos os avisos do combate de agora + criar um avulso;
 *  - `EventosDoEncontro`: os avisos preparados junto de um encontro (viram avisos do combate ao começar).
 */

function useSituacao(sala: Sala): SituacaoDoCombate {
  const { order, round } = sala.combate;
  return useMemo(
    () => ({
      combateAtivo: order.length > 0,
      round,
      fichas: sala.personagens.map((p) => ({ slug: p.slug, hp: p.hp, hp_max: p.hp_max })),
    }),
    [order.length, round, sala.personagens],
  );
}

/** O que está pedindo atenção agora. Vibra uma vez quando aparece um aviso novo (o celular do Mestre está no bolso). */
export function AvisosDoCombate({ sala }: { sala: Sala }) {
  const { eventos, marcarFeito } = useEventosDoCombate();
  const situacao = useSituacao(sala);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const lista = useMemo(() => pendentes(eventos, situacao), [eventos, situacao]);
  const vistos = useRef<Set<string>>(new Set());

  useEffect(() => {
    const novos = lista.filter((e) => !vistos.current.has(e.id));
    if (novos.length === 0) return;
    novos.forEach((e) => vistos.current.add(e.id));
    try {
      navigator.vibrate?.([120, 60, 120]);
    } catch {
      // aparelho sem vibração: o aviso na tela basta
    }
  }, [lista]);

  if (lista.length === 0) return null;

  async function feito(e: EventoDoCombate) {
    if (ocupado) return;
    setOcupado(e.id);
    registrarUso("acao:evento-combate");
    const ok = await marcarFeito(e.id);
    // Só conta à mesa depois que o banco aceitou (e uma vez só: o `feito` é por UPDATE condicional).
    if (ok && e.publico) await sala.registrarLog(linhaPublicaDoEvento(e.texto));
    setOcupado(null);
  }

  const nomeDe = (slug: string) => sala.personagens.find((p) => p.slug === slug)?.name ?? null;
  return (
    <div className="evavisos" role="status" aria-live="polite">
      {lista.map((e) => (
        <div key={e.id} className="evaviso">
          <p className="evgatilho">
            {e.tipo === "rodada" ? "⏱" : "💔"} {rotuloDoGatilho(e, nomeDe)}
          </p>
          <p className="evtexto">{e.texto}</p>
          <button type="button" className="btn primary" disabled={ocupado === e.id} onClick={() => void feito(e)}>
            {e.publico ? "Feito · contar à mesa" : "Feito"}
          </button>
        </div>
      ))}
    </div>
  );
}

type DadosDoForm = { tipo: "rodada" | "pv"; rodada: number | null; pct: number | null; alvo: string; texto: string; publico: boolean };

/** O formulário de um aviso: rodada ou PV de um alvo, o texto e se vai pro log público. Serve pro combate e pro encontro. */
function FormEvento({
  alvos,
  rotuloDoAlvo,
  aoCriar,
  desligado,
}: {
  alvos: { valor: string; rotulo: string }[];
  rotuloDoAlvo: string;
  aoCriar: (d: DadosDoForm) => Promise<boolean>;
  desligado?: string;
}) {
  const [tipo, setTipo] = useState<"rodada" | "pv">("rodada");
  const [rodada, setRodada] = useState("");
  const [pct, setPct] = useState("");
  const [alvo, setAlvo] = useState("");
  const [texto, setTexto] = useState("");
  const [publico, setPublico] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const alvoValido = alvos.some((a) => a.valor === alvo) ? alvo : (alvos[0]?.valor ?? "");

  async function criar() {
    if (enviando) return;
    setAviso(null);
    const v = validarNovoEvento({ tipo, rodada, pct, texto });
    if (!v.ok) {
      setAviso(v.motivo);
      return;
    }
    if (tipo === "pv" && alvoValido === "") {
      setAviso(`Não há ${rotuloDoAlvo} pra vigiar.`);
      return;
    }
    setEnviando(true);
    const ok = await aoCriar({ tipo, rodada: v.rodada, pct: v.pct, alvo: alvoValido, texto: v.texto, publico });
    setEnviando(false);
    if (!ok) {
      setAviso("Não deu pra guardar o aviso.");
      return;
    }
    setTexto("");
    setRodada("");
    setPct("");
  }

  return (
    <div className="evform">
      <div className="addcombatant">
        <select aria-label="Quando o aviso aparece" value={tipo} onChange={(e) => setTipo(e.target.value as "rodada" | "pv")}>
          <option value="rodada">na rodada…</option>
          <option value="pv">quando o PV chegar a…</option>
        </select>
        {tipo === "rodada" ? (
          <input
            className="num"
            type="number"
            inputMode="numeric"
            placeholder="rodada"
            aria-label="Número da rodada"
            min={1}
            max={RODADA_MAXIMA}
            value={rodada}
            onChange={(e) => setRodada(e.target.value)}
          />
        ) : (
          <>
            <input
              className="num"
              type="number"
              inputMode="numeric"
              placeholder="% de PV"
              aria-label="Porcentagem de PV (0 = a 0 PV)"
              min={0}
              max={100}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
            />
            <select aria-label={`De qual ${rotuloDoAlvo}`} value={alvoValido} onChange={(e) => setAlvo(e.target.value)}>
              {alvos.length === 0 && <option value="">(nenhum {rotuloDoAlvo})</option>}
              {alvos.map((a) => (
                <option key={a.valor} value={a.valor}>
                  {a.rotulo}
                </option>
              ))}
            </select>
          </>
        )}
        <input
          type="text"
          placeholder="o que acontece"
          aria-label="O que acontece (texto do aviso)"
          maxLength={TEXTO_MAXIMO}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void criar();
          }}
        />
        <label className="inv-mag">
          <input type="checkbox" checked={publico} onChange={(e) => setPublico(e.target.checked)} />
          contar à mesa (vai pro log)
        </label>
        <button type="button" className="btn" disabled={enviando || Boolean(desligado)} onClick={() => void criar()}>
          + aviso
        </button>
      </div>
      {(aviso || desligado) && (
        <p className="inv-alerta" role="status" aria-live="polite">
          {aviso ?? desligado}
        </p>
      )}
    </div>
  );
}

/** Todos os avisos do combate de agora (pendente, esperando, feito) e um formulário pra criar um avulso. */
export function GavetaDeEventos({ sala }: { sala: Sala }) {
  const { eventos, indisponivel, criar, remover } = useEventosDoCombate();
  const situacao = useSituacao(sala);
  const nomeDe = (slug: string) => sala.personagens.find((p) => p.slug === slug)?.name ?? null;
  const inimigos = sala.personagens.filter((p) => p.is_npc);
  const faltam = EVENTOS_NO_COMBATE - eventos.length;

  const situacaoDe = (e: EventoDoCombate): string => {
    if (e.feito) return "feito";
    return pendentes([e], situacao).length > 0 ? "agora" : "esperando";
  };

  return (
    <details className="gavetacombate gavetacartao">
      <summary>
        Eventos do combate
        <span className="dica">{eventos.length === 0 ? "avisos programados" : `${eventos.filter((e) => !e.feito).length} de ${eventos.length} esperando`}</span>
      </summary>
      <div className="gavetacorpo">
        {indisponivel ? (
          <p className="inv-alerta">Falta rodar a migration 0034 (eventos do combate) no Supabase.</p>
        ) : (
          <>
            {eventos.length === 0 && (
              <p className="empty-note">
                Nenhum aviso. Programe um (ex.: &quot;rodada 3 — o teto desaba&quot;) ou ponha avisos no encontro preparado, que entram sozinhos quando ele começa.
              </p>
            )}
            <ul className="evlista">
              {eventos.map((e) => (
                <li key={e.id} className={`evitem evitem--${situacaoDe(e)}`}>
                  <span className="evgatilho">{rotuloDoGatilho(e, nomeDe)}</span>
                  <span className="evestado">{situacaoDe(e)}</span>
                  <span className="evtexto">{e.texto}{e.publico ? " 📣" : ""}</span>
                  <BotaoRemover aria={`tirar o aviso: ${e.texto}`} onConfirmar={() => void remover(e.id)} />
                </li>
              ))}
            </ul>
            <FormEvento
              alvos={inimigos.map((p) => ({ valor: p.slug, rotulo: p.name }))}
              rotuloDoAlvo="inimigo"
              desligado={faltam <= 0 ? `Limite de ${EVENTOS_NO_COMBATE} avisos no combate.` : undefined}
              aoCriar={(d) =>
                criar([{ tipo: d.tipo, rodada: d.rodada, pct: d.pct, slugs: d.tipo === "pv" ? [d.alvo] : [], texto: d.texto, publico: d.publico }])
              }
            />
          </>
        )}
      </div>
    </details>
  );
}

/** Dentro do cartão do encontro: avisos preparados (rodada, ou PV de um grupo do encontro). */
export function EventosDoEncontro({ encontro, sala }: { encontro: Encontro; sala: Sala }) {
  const eventos = encontro.eventos ?? [];
  const [aberto, setAberto] = useState(eventos.length > 0);

  function salvar(lista: EventoPreparado[]) {
    return sala.atualizarEncontro(encontro.id, { eventos: lista });
  }
  const rotulo = (e: EventoPreparado) =>
    e.tipo === "rodada"
      ? `Rodada ${e.rodada}`
      : `${e.pct === 0 ? "0 PV" : `${e.pct}% de PV`} · ${encontro.grupos[e.grupo ?? -1]?.name ?? "grupo que saiu"}`;

  if (!aberto) {
    return (
      <button type="button" className="minilink" onClick={() => setAberto(true)}>
        + avisos do encontro (rodada, PV)
      </button>
    );
  }
  return (
    <div className="evencontro">
      <p className="bkpexplica">
        ⏱ Avisos deste encontro — aparecem pra você sozinhos durante a luta. Entram no combate quando o encontro começa.
      </p>
      <ul className="evlista">
        {eventos.map((e) => (
          <li key={e.id} className="evitem">
            <span className="evgatilho">{rotulo(e)}</span>
            <span className="evtexto">{e.texto}{e.publico ? " 📣" : ""}</span>
            <BotaoRemover aria={`tirar o aviso: ${e.texto}`} onConfirmar={() => void salvar(eventos.filter((x) => x.id !== e.id))} />
          </li>
        ))}
      </ul>
      <FormEvento
        alvos={encontro.grupos.map((g, i) => ({ valor: String(i), rotulo: `${g.name} (${limitarQuantidade(g.quantidade)}×)` }))}
        rotuloDoAlvo="grupo"
        desligado={eventos.length >= EVENTOS_POR_ENCONTRO ? `Limite de ${EVENTOS_POR_ENCONTRO} avisos por encontro.` : undefined}
        aoCriar={async (d) => {
          const novo: EventoPreparado = {
            id: crypto.randomUUID(),
            tipo: d.tipo,
            rodada: d.rodada,
            grupo: d.tipo === "pv" ? Number(d.alvo) : null,
            pct: d.pct,
            texto: d.texto,
            publico: d.publico,
          };
          await salvar([...eventos, novo]);
          return true;
        }}
      />
    </div>
  );
}

