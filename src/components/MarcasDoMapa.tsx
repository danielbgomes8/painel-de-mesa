"use client";

import { useState } from "react";
import type { Ponto } from "@/lib/cenas";
import { CORES_MARCA, MARCAS_MAXIMAS, TEXTO_MAXIMO_DA_NOTA, textoDaNota, notasNumeradas, type Marca, type ModoMarca } from "@/lib/marcas";
import type { Marcas } from "@/hooks/useMarcas";

const MODOS: [ModoMarca, string][] = [
  ["livre", "✏️ livre"],
  ["linha", "╱ linha"],
  ["circulo", "◯ círculo"],
  ["retangulo", "▭ retângulo"],
  ["nota", "📌 nota"],
  ["apagar", "apagar"],
];

/** Opções da ferramenta de marcas (Mestre): o que fazer, a cor e se a mesa vê. */
export function ControlesDeMarca({
  modo,
  aoMudarModo,
  cor,
  aoMudarCor,
  paraMesa,
  aoMudarParaMesa,
}: {
  modo: ModoMarca;
  aoMudarModo: (m: ModoMarca) => void;
  cor: string;
  aoMudarCor: (c: string) => void;
  paraMesa: boolean;
  aoMudarParaMesa: (v: boolean) => void;
}) {
  return (
    <>
      <div className="mapa-ferr" role="group" aria-label="O que marcar">
        {MODOS.map(([m, rotulo]) => (
          <button key={m} type="button" className="chip alvo" aria-pressed={modo === m} onClick={() => aoMudarModo(m)}>
            {rotulo}
          </button>
        ))}
      </div>
      {modo !== "apagar" && (
        <div className="mapa-ferr" role="group" aria-label="Cor e quem vê">
          {CORES_MARCA.map((c) => (
            <button
              key={c}
              type="button"
              className="mapa-cor-botao"
              style={{ background: c }}
              aria-pressed={cor === c}
              aria-label={`Cor ${c}`}
              onClick={() => aoMudarCor(c)}
            />
          ))}
          <button type="button" className="chip alvo" aria-pressed={paraMesa} onClick={() => aoMudarParaMesa(!paraMesa)}>
            {paraMesa ? "👁 a mesa vê" : "🔒 só eu vejo"}
          </button>
        </div>
      )}
    </>
  );
}

/** Depois de tocar num ponto com o modo nota: o campo do texto. */
export function NovaNota({
  ponto,
  aoPor,
  aoCancelar,
}: {
  ponto: Ponto;
  aoPor: (texto: string) => Promise<boolean>;
  aoCancelar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function por() {
    const limpo = textoDaNota(texto);
    if (!limpo || salvando) return;
    setSalvando(true);
    const ok = await aoPor(limpo);
    setSalvando(false);
    // Se não salvou, o campo fica com o texto pra tentar de novo (o aviso do mapa diz o porquê).
    if (ok) aoCancelar();
  }

  return (
    <div className="mapa-nota-nova" data-ponto={`${Math.round(ponto[0])},${Math.round(ponto[1])}`}>
      <input
        type="text"
        autoFocus
        aria-label="Texto da nota"
        placeholder="o que está aqui?"
        maxLength={TEXTO_MAXIMO_DA_NOTA}
        value={texto}
        autoComplete="off"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void por();
          if (e.key === "Escape") aoCancelar();
        }}
      />
      <button type="button" className="btn primary" disabled={!textoDaNota(texto) || salvando} onClick={() => void por()}>
        {salvando ? "pondo…" : "pôr nota"}
      </button>
      <button type="button" className="btn" onClick={aoCancelar}>
        cancelar
      </button>
    </div>
  );
}

/** As notas numeradas, como na bolinha do mapa. Sem `marcas` de edição, só lê (jogador e telão);
 *  com ele, o Mestre liga/desliga se a mesa vê e apaga. */
export function ListaDeNotas({ marcas, edicao, telao = false }: { marcas: readonly Marca[]; edicao?: Marcas; telao?: boolean }) {
  const notas = notasNumeradas(marcas);
  if (notas.length === 0) return null;
  return (
    <ol className={telao ? "mapa-notas mapa-notas--telao" : "mapa-notas"} aria-label="Notas do mapa">
      {notas.map(({ numero, marca: m }) => (
        <li key={m.id} className={m.visivel ? "mapa-nota" : "mapa-nota mapa-nota--oculta"}>
          <span className="mapa-nota-num" style={{ background: m.cor }} aria-hidden="true">
            {numero}
          </span>
          <span className="mapa-nota-texto">{m.texto}</span>
          {edicao && (
            <span className="mapa-nota-acoes">
              <button
                type="button"
                className="minilink"
                aria-label={`${m.visivel ? "Esconder da mesa" : "Mostrar pra mesa"} a nota ${numero}`}
                onClick={() => void edicao.atualizar(m.id, { visivel: !m.visivel })}
              >
                {m.visivel ? "👁 mesa vê" : "🔒 só eu"}
              </button>
              <button type="button" className="minilink" aria-label={`Apagar a nota ${numero}`} onClick={() => void edicao.remover(m.id)}>
                apagar
              </button>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export function resumoDasMarcas(marcas: readonly Marca[]): string {
  const tracos = marcas.filter((m) => m.tipo === "traco").length;
  const notas = marcas.length - tracos;
  return `${tracos} ${tracos === 1 ? "desenho" : "desenhos"} · ${notas} ${notas === 1 ? "nota" : "notas"} (cabem ${MARCAS_MAXIMAS} por mapa)`;
}
