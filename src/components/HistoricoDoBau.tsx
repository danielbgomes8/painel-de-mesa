"use client";

import { useEffect, useMemo, useState } from "react";
import { LIMITE_DO_HISTORICO, lerHistoricoDoBau } from "@/hooks/lerHistoricoDoBau";
import {
  agruparPorDia,
  eventosDoBau,
  filtrarEventos,
  horaDoEvento,
  type EventoDoBau,
  type FiltroDoHistorico,
} from "@/lib/historicoBau";

const DE_CADA_VEZ = 30;

const FILTROS: { id: FiltroDoHistorico; rotulo: string }[] = [
  { id: "tudo", rotulo: "Tudo" },
  { id: "item", rotulo: "🎒 Itens" },
  { id: "dinheiro", rotulo: "💰 Dinheiro" },
];

/**
 * O histórico do baú: quem guardou, pegou ou jogou fora o quê, e quando. Vem das linhas 🎒/💰 que
 * cada troca já deixa no log do combate (regras em `lib/historicoBau.ts`). Abre fechado e só lê o
 * banco quando a pessoa abre; enquanto está aberto, relê sozinho a cada linha nova do log.
 * `gatilho` é o id da linha mais nova do log da tela: mudou, tem coisa nova.
 */
export function HistoricoDoBau({ codigo, gatilho }: { codigo: string; gatilho: string | undefined }) {
  const [aberto, setAberto] = useState(false);
  const [eventos, setEventos] = useState<EventoDoBau[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [filtro, setFiltro] = useState<FiltroDoHistorico>("tudo");
  const [quantos, setQuantos] = useState(DE_CADA_VEZ);

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    lerHistoricoDoBau(codigo).then((log) => {
      if (!vivo) return;
      if (log === null) {
        setFalhou(true);
        return;
      }
      setFalhou(false);
      setEventos(eventosDoBau(log));
    });
    return () => {
      vivo = false;
    };
  }, [aberto, codigo, gatilho]);

  const filtrados = useMemo(() => (eventos ? filtrarEventos(eventos, filtro) : []), [eventos, filtro]);
  // `agora` junto com a lista: o rótulo "Hoje" não pode mudar no meio da leitura.
  const grupos = useMemo(() => agruparPorDia(filtrados.slice(0, quantos), new Date()), [filtrados, quantos]);

  return (
    <section className="bau-bloco" aria-label="Histórico do baú">
      <button type="button" className="bau-hist-cab" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        <span className="sectitle">📜 Histórico do baú</span>
        <span aria-hidden="true">{aberto ? "▾" : "▸"}</span>
      </button>

      {aberto && (
        <>
          <div className="bau-quem" role="group" aria-label="Filtrar o histórico">
            {FILTROS.map((f) => (
              <button key={f.id} type="button" className="chip alvo" aria-pressed={filtro === f.id} onClick={() => { setFiltro(f.id); setQuantos(DE_CADA_VEZ); }}>
                {f.rotulo}
              </button>
            ))}
          </div>

          {falhou && <p className="inv-alerta">Não consegui ler o histórico. Confira a conexão e abra de novo.</p>}
          {!falhou && eventos === null && <p className="empty-note">Lendo o histórico…</p>}
          {eventos !== null && filtrados.length === 0 && (
            <p className="empty-note">
              {eventos.length === 0
                ? "Ainda não há nada no histórico. Ele guarda o que for mexido no baú daqui pra frente."
                : "Nada desse tipo no histórico."}
            </p>
          )}

          {grupos.map((g) => (
            <div key={g.rotulo + g.eventos[0].quando} className="bau-hist-dia">
              <span className="qd-rotulo">{g.rotulo}</span>
              <ul className="bau-hist-lista">
                {g.eventos.map((e, i) => (
                  <li key={e.quando + i}>
                    <span className="bau-hist-hora">{horaDoEvento(e.quando)}</span> {e.texto}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {filtrados.length > quantos && (
            <button type="button" className="minilink" onClick={() => setQuantos((q) => q + DE_CADA_VEZ)}>
              ver mais ({filtrados.length - quantos})
            </button>
          )}
          {eventos !== null && eventos.length >= LIMITE_DO_HISTORICO && (
            <p className="empty-note">Mostrando as {LIMITE_DO_HISTORICO} trocas mais recentes.</p>
          )}
        </>
      )}
    </section>
  );
}
