"use client";

import { useState } from "react";
// Só tipo: o catálogo de monstros é um pedaço que baixa sob demanda
// (useCatalogoMonstros) — importar valor dele aqui o traria pra abertura do app.
import type { EstatisticasMonstro, MonstroCompleto } from "@/lib/monstrosSrd";
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

/** O que a ficha precisa: o que todo monstro tem (do catálogo ou cadastrado à
 *  mão) e, quando se sabe de qual do SRD ele vem, as estatísticas extras. */
export type DadosFichaMonstro = {
  /** Nome grande — o do livro (inglês). */
  nome: string;
  /** Nome em português, pequeno ao lado; some quando é igual ao grande. */
  nomePt?: string;
  cls: string;
  ac: number;
  hp_max: number;
  speed: number;
  init_mod: number;
  ataque: string;
  notes: string;
  /** Sem isto a ficha mostra só CA/PV/deslocamento/iniciativa/ataques/notas. */
  estatisticas?: EstatisticasMonstro;
  /** Nível de desafio como se escreve (1/4, 3...); só junto de `estatisticas`. */
  nd?: string;
};

/** Ficha de um monstro do catálogo, com os números do catálogo. */
export function dadosDoMonstro(m: MonstroCompleto, nd: string): DadosFichaMonstro {
  return {
    nome: m.en,
    nomePt: m.name !== m.en ? m.name : undefined,
    cls: m.cls,
    ac: m.ac,
    hp_max: m.hp_max,
    speed: m.speed,
    init_mod: m.init_mod,
    ataque: m.ataque,
    notes: m.notes,
    estatisticas: m,
    nd,
  };
}

/** A ficha de monstro no desenho clássico do livro (nome, tipo, CA/PV/
 *  deslocamento, os seis atributos, perícias/sentidos/idiomas/ND, ataques),
 *  na paleta do app. O texto corrido das ações não existe aqui (ver
 *  AGENTS.md): `ataque` e `notes` são o resumo. `onCopiar` (só no catálogo)
 *  liga o botão de copiar; `embutida` tira a moldura, pra ficha morar dentro
 *  de outro cartão (a biblioteca do Mestre). */
export function FichaClassicaMonstro({
  dados: d,
  onCopiar,
  embutida = false,
  semNome = false,
}: {
  dados: DadosFichaMonstro;
  onCopiar?: () => Promise<boolean>;
  embutida?: boolean;
  /** O nome já está logo acima (cabeçalho da linha da biblioteca): não repete. */
  semNome?: boolean;
}) {
  const [estado, setEstado] = useState<"parado" | "copiando" | "ok" | "falhou">("parado");

  async function copiar() {
    if (!onCopiar || estado === "copiando") return;
    setEstado("copiando");
    // Só diz "copiado" depois que o banco confirmar.
    setEstado((await onCopiar()) ? "ok" : "falhou");
  }

  const e = d.estatisticas;
  const sentidos = e ? [e.sentidos, `percepção passiva ${e.pp}`].filter(Boolean).join(", ") : "";
  const ataques = d.ataque ? d.ataque.split(" · ") : [];

  return (
    <article className={`sbficha${embutida ? " embutida" : ""}`} aria-label={`Ficha de ${d.nome}`}>
      {!semNome && (
        <h4 className="sbnome">
          {d.nome}
          {d.nomePt && d.nomePt !== d.nome && <span className="sbnomept">{d.nomePt}</span>}
        </h4>
      )}
      {d.cls && <p className="sbtipo">{d.cls}</p>}
      <div className="sbregra" />
      <p className="sblinha">
        <b>CA</b> {d.ac}
      </p>
      <p className="sblinha">
        <b>PV</b> {d.hp_max}
      </p>
      <p className="sblinha">
        <b>Deslocamento</b> {formatarMetros(d.speed)}
      </p>
      {e && (
        <>
          <div className="sbregra" />
          <div className="sbatrib">
            {ATRIBUTOS.map(([chave, rotulo]) => (
              <div key={chave}>
                <span className="k">{rotulo}</span>
                <span className="v">
                  {e.atributos[chave]} ({comSinal(modificador(e.atributos[chave]))})
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="sbregra" />
      <p className="sblinha">
        <b>Iniciativa</b> {comSinal(d.init_mod)}
      </p>
      {e?.pericias && (
        <p className="sblinha">
          <b>Perícias</b> {e.pericias}
        </p>
      )}
      {e && (
        <>
          <p className="sblinha">
            <b>Sentidos</b> {sentidos}
          </p>
          <p className="sblinha">
            <b>Idiomas</b> {e.idiomas}
          </p>
          {d.nd && (
            <p className="sblinha">
              <b>ND</b> {d.nd} ({e.xp.toLocaleString("pt-BR")} XP)
            </p>
          )}
        </>
      )}
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
      {d.notes && (
        <>
          <div className="sbregra" />
          <h5 className="sbsec">Notas</h5>
          <p className="sbacao">{d.notes}</p>
        </>
      )}
      {e && <p className="sbfine">Texto completo das ações e características: no livro (SRD 5.2).</p>}
      {onCopiar && (
        <>
          <button type="button" className="btn" disabled={estado === "copiando"} onClick={copiar}>
            {estado === "copiando" ? "copiando…" : "copiar pra minha biblioteca"}
          </button>
          <p className={estado === "falhou" ? "catcopiado falhou" : "catcopiado"} aria-live="polite">
            {estado === "ok" ? `✓ ${d.nome} copiado pra sua biblioteca, lá em cima.` : ""}
            {estado === "falhou" ? "Não deu pra copiar. Confira a conexão e toque de novo." : ""}
          </p>
        </>
      )}
    </article>
  );
}
