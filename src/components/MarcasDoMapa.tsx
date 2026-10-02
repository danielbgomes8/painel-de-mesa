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

/** As notas numeradas, como na bolinha do mapa. Sem `edicao`, só lê (jogador e telão);
 *  com ela, o Mestre edita o texto, move o alfinete, liga/desliga se a mesa vê e apaga.
 *  `movendoId` marca a nota que espera um toque no mapa (ver `aoMover`). */
export function ListaDeNotas({
  marcas,
  edicao,
  telao = false,
  movendoId = null,
  aoMover,
}: {
  marcas: readonly Marca[];
  edicao?: Marcas;
  telao?: boolean;
  movendoId?: string | null;
  aoMover?: (id: string | null) => void;
}) {
  const notas = notasNumeradas(marcas);
  if (notas.length === 0) return null;
  return (
    <ol className={telao ? "mapa-notas mapa-notas--telao" : "mapa-notas"} aria-label="Notas do mapa">
      {notas.map(({ numero, marca: m }) => (
        <LinhaDaNota key={m.id} numero={numero} marca={m} edicao={edicao} movendo={movendoId === m.id} aoMover={aoMover} />
      ))}
    </ol>
  );
}

function LinhaDaNota({
  numero,
  marca: m,
  edicao,
  movendo,
  aoMover,
}: {
  numero: number;
  marca: Marca;
  edicao?: Marcas;
  movendo: boolean;
  aoMover?: (id: string | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(m.texto);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const limpo = textoDaNota(texto);
    if (!edicao || !limpo || salvando) return;
    if (limpo === m.texto) {
      setEditando(false);
      return;
    }
    setSalvando(true);
    const ok = await edicao.atualizar(m.id, { texto: limpo });
    setSalvando(false);
    // Se não salvou, o campo fica aberto com o que foi digitado (o aviso do mapa diz o porquê).
    if (ok) setEditando(false);
  }

  return (
    <li className={m.visivel ? "mapa-nota" : "mapa-nota mapa-nota--oculta"}>
      <span className="mapa-nota-num" style={{ background: m.cor }} aria-hidden="true">
        {numero}
      </span>
      {editando ? (
        <span className="mapa-nota-edicao">
          <input
            type="text"
            autoFocus
            aria-label={`Texto da nota ${numero}`}
            maxLength={TEXTO_MAXIMO_DA_NOTA}
            value={texto}
            autoComplete="off"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void salvar();
              if (e.key === "Escape") setEditando(false);
            }}
          />
          <button type="button" className="btn primary" disabled={!textoDaNota(texto) || salvando} onClick={() => void salvar()}>
            {salvando ? "salvando…" : "salvar"}
          </button>
          <button type="button" className="btn" onClick={() => setEditando(false)}>
            cancelar
          </button>
        </span>
      ) : (
        <span className="mapa-nota-texto">{m.texto}</span>
      )}
      {edicao && !editando && (
        <span className="mapa-nota-acoes">
          <button
            type="button"
            className="minilink"
            aria-label={`Editar o texto da nota ${numero}`}
            onClick={() => {
              setTexto(m.texto);
              setEditando(true);
            }}
          >
            editar
          </button>
          {aoMover && (
            <button
              type="button"
              className="minilink"
              aria-pressed={movendo}
              aria-label={`${movendo ? "Cancelar mover" : "Mover"} a nota ${numero}`}
              onClick={() => aoMover(movendo ? null : m.id)}
            >
              {movendo ? "cancelar mover" : "mover"}
            </button>
          )}
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
  );
}

export function resumoDasMarcas(marcas: readonly Marca[]): string {
  const tracos = marcas.filter((m) => m.tipo === "traco").length;
  const notas = marcas.length - tracos;
  return `${tracos} ${tracos === 1 ? "desenho" : "desenhos"} · ${notas} ${notas === 1 ? "nota" : "notas"} (cabem ${MARCAS_MAXIMAS} por mapa)`;
}
