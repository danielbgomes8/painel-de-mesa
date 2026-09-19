"use client";

import { useMemo, useState } from "react";
import { rolarDado } from "@/lib/dados";
import {
  descreverAtaque,
  lerAtaquesRolaveis,
  resolverAtaque,
  type AtaqueRolavel,
  type ModoRolagem,
  type ResultadoAtaque,
} from "@/lib/regras";

const MODOS: ModoRolagem[] = ["normal", "vantagem", "desvantagem"];

/**
 * Os ataques do campo `ataque` como botões de rolar, no painel da linha da
 * iniciativa: um toque rola acerto e dano (ver `resolverAtaque`). O
 * resultado fica só na tela de quem rolou — não vai pro log, como o Mestre
 * rolando atrás do escudo; quem anuncia o acerto é ele.
 */
export function RolarAtaques({ texto }: { texto: string }) {
  const { ataques, multiataque } = useMemo(() => lerAtaquesRolaveis(texto), [texto]);
  const [modo, setModo] = useState<ModoRolagem>("normal");
  const [resultados, setResultados] = useState<{ ataque: AtaqueRolavel; r: ResultadoAtaque }[]>([]);

  if (ataques.length === 0) return null;

  function rolar(ataque: AtaqueRolavel) {
    // "2x Dilacerar" rola os dois de uma vez.
    setResultados(Array.from({ length: ataque.vezes }, () => ({ ataque, r: resolverAtaque(ataque, modo, rolarDado) })));
  }

  return (
    <div className="initataques">
      <div className="initataquestopo">
        <span className="sectitle">Ataques{multiataque ? ` · ${multiataque} por turno` : ""}</span>
        <div className="chips" role="group" aria-label="Como rolar o d20">
          {MODOS.map((m) => (
            <button key={m} type="button" className="chip flag" aria-pressed={modo === m} onClick={() => setModo(m)}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="initataquesbotoes">
        {ataques.map((a, i) => (
          <button key={i} type="button" className="btn" onClick={() => rolar(a)}>
            🎲 {a.vezes > 1 ? `${a.vezes}× ` : ""}
            {a.nome}
            {a.bonus !== null && (
              // "Malho +1 +7" confunde a arma mágica com o bônus: aí separa.
              <>
                {/[+-]\d+$/.test(a.nome) ? " · " : " "}
                {a.bonus >= 0 ? "+" : "−"}
                {Math.abs(a.bonus)}
              </>
            )}
          </button>
        ))}
      </div>
      {resultados.length > 0 && (
        <ul className="ataqueresultados" role="status" aria-live="polite">
          {resultados.map(({ ataque, r }, i) => {
            const d = descreverAtaque(r, ataque.bonus);
            return (
              <li key={i} className={r.critico ? "critico" : r.erroCritico ? "errou" : ""}>
                <b>{r.nome}</b>
                {d.acerto && <span>{d.acerto}</span>}
                <span>{r.erroCritico ? `(${d.dano}, se tivesse acertado)` : d.dano}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
