"use client";

import { useState } from "react";
// Só tipo: o catálogo de monstros é um pedaço que baixa sob demanda
// (useCatalogoMonstros) — importar valor dele aqui o traria pra abertura do app.
import type { MonstroCompleto } from "@/lib/monstrosSrd";
import type { Atributo } from "@/lib/tipos";
import { formatarMetros, modificador } from "@/lib/regras";

const ATRIBUTOS: [Atributo, string][] = [
  ["for", "FOR"],
  ["des", "DES"],
  ["con", "CON"],
  ["int", "INT"],
  ["sab", "SAB"],
  ["car", "CAR"],
];

function comSinal(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** A ficha de monstro no desenho clássico do livro (nome, tipo, CA/PV/
 *  deslocamento, os seis atributos, perícias/sentidos/idiomas/ND, ataques),
 *  na paleta do app. Tudo vem pronto do catálogo; o texto corrido das ações
 *  não existe aqui (ver AGENTS.md): `ataque` e `notes` são o resumo. */
export function FichaClassicaMonstro({
  monstro: m,
  nd,
  onCopiar,
}: {
  monstro: MonstroCompleto;
  /** Nível de desafio como se escreve (1/4, 3...) — vem do catálogo carregado. */
  nd: string;
  onCopiar: () => Promise<boolean>;
}) {
  const [estado, setEstado] = useState<"parado" | "copiando" | "ok" | "falhou">("parado");

  async function copiar() {
    if (estado === "copiando") return;
    setEstado("copiando");
    // Só diz "copiado" depois que o banco confirmar.
    setEstado((await onCopiar()) ? "ok" : "falhou");
  }

  const sentidos = [m.sentidos, `percepção passiva ${m.pp}`].filter(Boolean).join(", ");
  const ataques = m.ataque ? m.ataque.split(" · ") : [];

  return (
    <article className="sbficha" aria-label={`Ficha de ${m.en}`}>
      <h4 className="sbnome">
        {m.en}
        {m.en !== m.name && <span className="sbnomept">{m.name}</span>}
      </h4>
      <p className="sbtipo">{m.cls}</p>
      <div className="sbregra" />
      <p className="sblinha">
        <b>CA</b> {m.ac}
      </p>
      <p className="sblinha">
        <b>PV</b> {m.hp_max}
      </p>
      <p className="sblinha">
        <b>Deslocamento</b> {formatarMetros(m.speed)}
      </p>
      <div className="sbregra" />
      <div className="sbatrib">
        {ATRIBUTOS.map(([chave, rotulo]) => (
          <div key={chave}>
            <span className="k">{rotulo}</span>
            <span className="v">
              {m.atributos[chave]} ({comSinal(modificador(m.atributos[chave]))})
            </span>
          </div>
        ))}
      </div>
      <div className="sbregra" />
      <p className="sblinha">
        <b>Iniciativa</b> {comSinal(m.init_mod)}
      </p>
      {m.pericias && (
        <p className="sblinha">
          <b>Perícias</b> {m.pericias}
        </p>
      )}
      <p className="sblinha">
        <b>Sentidos</b> {sentidos}
      </p>
      <p className="sblinha">
        <b>Idiomas</b> {m.idiomas}
      </p>
      <p className="sblinha">
        <b>ND</b> {nd} ({m.xp.toLocaleString("pt-BR")} XP)
      </p>
      {ataques.length > 0 && (
        <>
          <div className="sbregra" />
          <h5 className="sbsec">Ataques</h5>
          {ataques.map((a, i) => (
            <p key={i} className="sbacao">
              {a}
            </p>
          ))}
        </>
      )}
      <div className="sbregra" />
      <h5 className="sbsec">Notas</h5>
      <p className="sbacao">{m.notes}</p>
      <p className="sbfine">Texto completo das ações e características: no livro (SRD 5.2).</p>
      <button type="button" className="btn" disabled={estado === "copiando"} onClick={copiar}>
        {estado === "copiando" ? "copiando…" : "copiar pra minha biblioteca"}
      </button>
      <p className={estado === "falhou" ? "catcopiado falhou" : "catcopiado"} aria-live="polite">
        {estado === "ok" ? `✓ ${m.en} copiado pra sua biblioteca, lá em cima.` : ""}
        {estado === "falhou" ? "Não deu pra copiar. Confira a conexão e toque de novo." : ""}
      </p>
    </article>
  );
}
