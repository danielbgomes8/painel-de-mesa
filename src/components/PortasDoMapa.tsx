"use client";

import { useState } from "react";
import type { Paredes } from "@/hooks/useParedes";
import type { Parede } from "@/lib/paredes";
import { CD_DE_ACHAR_MAXIMA, cdDeAcharValida } from "@/lib/percepcao";

/**
 * As propriedades de UMA porta, pro Mestre (aparece abaixo do mapa quando ele toca numa porta com o modo "🔒 portas"):
 * - **trancada**: ele vê o cadeado e a CD pra arrombar/destrancar no mapa, e a porta não abre com um toque sem destrancar;
 * - **secreta**: ninguém sabe dela. Com uma **CD pra achar**, quem tiver Percepção passiva igual ou maior chegando
 *   perto faz o Mestre receber o aviso (ver `lib/percepcao.ts`). Ela continua fechada até o Mestre abrir.
 * Os jogadores nunca veem portas: isto é só do Mestre.
 */
export function EditorDePorta({ porta, muros, aoFechar }: { porta: Parede | null; muros: Paredes; aoFechar: () => void }) {
  if (!porta || porta.tipo !== "porta") return null;
  return <Corpo key={porta.id} porta={porta} muros={muros} aoFechar={aoFechar} />;
}

function Corpo({ porta, muros, aoFechar }: { porta: Parede; muros: Paredes; aoFechar: () => void }) {
  const [cd, setCd] = useState(porta.cd === null ? "" : String(porta.cd));
  const [cdAchar, setCdAchar] = useState(porta.cd_achar === null ? "" : String(porta.cd_achar));
  const cdOk = cd.trim() === "" || cdDeAcharValida(cd) !== null;
  const cdAcharOk = cdAchar.trim() === "" || cdDeAcharValida(cdAchar) !== null;

  return (
    <div className="porta-editor" role="group" aria-label="Propriedades da porta">
      <p className="fol-form-titulo">🚪 Porta selecionada</p>
      <label className="checklabel">
        <input type="checkbox" checked={porta.trancada} onChange={(e) => void muros.atualizarPorta(porta.id, { trancada: e.target.checked })} />
        🔒 trancada
      </label>
      {porta.trancada && (
        <label className="fol-rotulo">
          CD pra arrombar ou abrir a fechadura
          <input
            type="number"
            inputMode="numeric"
            className="mapa-aura-campo loja-qtd"
            aria-label="CD pra destrancar"
            placeholder="sem"
            min={1}
            max={CD_DE_ACHAR_MAXIMA}
            value={cd}
            onChange={(e) => setCd(e.target.value)}
            onBlur={() => cdOk && void muros.atualizarPorta(porta.id, { cd: cdDeAcharValida(cd) })}
          />
        </label>
      )}
      <label className="checklabel">
        <input type="checkbox" checked={porta.secreta} onChange={(e) => void muros.atualizarPorta(porta.id, { secreta: e.target.checked })} />
        🕵️ secreta (ninguém sabe dela até alguém achar)
      </label>
      {porta.secreta && (
        <label className="fol-rotulo">
          CD pra achar sozinho (Percepção passiva)
          <input
            type="number"
            inputMode="numeric"
            className="mapa-aura-campo loja-qtd"
            aria-label="CD pra achar a porta secreta"
            placeholder="sem"
            min={1}
            max={CD_DE_ACHAR_MAXIMA}
            value={cdAchar}
            onChange={(e) => setCdAchar(e.target.value)}
            onBlur={() => cdAcharOk && void muros.atualizarPorta(porta.id, { cd_achar: cdDeAcharValida(cdAchar) })}
          />
        </label>
      )}
      {(!cdOk || !cdAcharOk) && <p className="mapa-aura-aviso erro">Use uma CD de 1 a {CD_DE_ACHAR_MAXIMA}.</p>}
      <div className="mapa-ferr">
        <button type="button" className="btn" onClick={aoFechar}>
          pronto
        </button>
      </div>
    </div>
  );
}

/**
 * O Mestre tocou numa porta trancada e fechada: em vez de abrir, o app mostra a CD e pergunta. "Destrancar e abrir" tira
 * o cadeado e abre; "deixar trancada" só fecha o aviso.
 */
export function AvisoDePortaTrancada({ porta, muros, aoFechar, registrar }: { porta: Parede | null; muros: Paredes; aoFechar: () => void; registrar: (texto: string) => void }) {
  if (!porta || !porta.trancada || porta.aberta) return null;
  return (
    <div className="arm-aviso" role="alert">
      <p className="arm-aviso-titulo">
        <span aria-hidden="true">🔒</span> <b>Porta trancada</b>
        {porta.cd !== null ? ` — CD ${porta.cd}` : ""}
      </p>
      <p className="fc-sub">Ela não abre com um toque. Se o grupo conseguiu, destranque.</p>
      <div className="mapa-ferr">
        <button
          type="button"
          className="btn primary"
          onClick={async () => {
            if (!(await muros.atualizarPorta(porta.id, { trancada: false, aberta: true }))) return;
            registrar("🔓 Uma porta foi destrancada e aberta.");
            aoFechar();
          }}
        >
          destrancar e abrir
        </button>
        <button type="button" className="btn" onClick={aoFechar}>
          deixar trancada
        </button>
      </div>
    </div>
  );
}
