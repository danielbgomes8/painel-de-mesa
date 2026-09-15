"use client";

import { useState } from "react";
import type { ItemSecaoFicha, Personagem, SecaoFicha } from "@/lib/tipos";
import { CampoTexto } from "@/components/CampoTexto";
import { CampoTextoAdiado } from "@/components/CampoTextoAdiado";
import { BotaoRemover } from "@/components/BotaoRemover";
import { SecaoRecolhivel } from "@/components/SecaoRecolhivel";

function atualizarSecao(secoes: SecaoFicha[], i: number, mudanca: Partial<SecaoFicha>): SecaoFicha[] {
  return secoes.map((s, idx) => (idx === i ? { ...s, ...mudanca } : s));
}

function removerSecao(secoes: SecaoFicha[], i: number): SecaoFicha[] {
  return secoes.filter((_, idx) => idx !== i);
}

function atualizarItem(
  secoes: SecaoFicha[],
  secaoIdx: number,
  itemIdx: number,
  mudanca: Partial<ItemSecaoFicha>,
): SecaoFicha[] {
  return secoes.map((s, idx) => {
    if (idx !== secaoIdx) return s;
    return { ...s, itens: (s.itens ?? []).map((it, j) => (j === itemIdx ? { ...it, ...mudanca } : it)) };
  });
}

function removerItem(secoes: SecaoFicha[], secaoIdx: number, itemIdx: number): SecaoFicha[] {
  return secoes.map((s, idx) =>
    idx === secaoIdx ? { ...s, itens: (s.itens ?? []).filter((_, j) => j !== itemIdx) } : s,
  );
}

function adicionarItem(secoes: SecaoFicha[], secaoIdx: number): SecaoFicha[] {
  return secoes.map((s, idx) =>
    idx === secaoIdx ? { ...s, itens: [...(s.itens ?? []), { titulo: "", tag: "", descricao: "" }] } : s,
  );
}

/** Ficha completa do personagem — história, características, magias, itens
 *  mágicos, trejeitos... em seções genéricas (ver migration 0012). Lê e
 *  escreve na mesma linha que o resumo de combate, então qualquer edição
 *  aqui aparece pra todo mundo igual PV e condição já aparecem hoje.
 *  Sem regra de D&D embutida: cada seção é só um texto corrido ou uma lista
 *  de título+tag+descrição, do jeito que o jogador quiser preencher. */
export function FichaCompleta({
  personagem: p,
  editavel,
  patch,
}: {
  personagem: Personagem;
  editavel: boolean;
  patch: (mudanca: Partial<Personagem>) => void;
}) {
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoTipo, setNovoTipo] = useState<"lista" | "texto">("lista");

  // `?? []`/`?? ""`: só entram em jogo na janela entre publicar este código e
  // rodar a migration 0012 — sem isso, uma linha ainda sem a coluna nova
  // quebraria a aba Fichas inteira (diferente de vantagens_resistencias, que
  // por ser string tolera vir undefined).
  const secoes = p.ficha_secoes ?? [];
  const epiteto = p.ficha_epiteto ?? "";

  function adicionarSecao() {
    const titulo = novoTitulo.trim();
    if (!titulo) return;
    const nova: SecaoFicha =
      novoTipo === "texto" ? { titulo, tipo: "texto", texto: "" } : { titulo, tipo: "lista", itens: [] };
    patch({ ficha_secoes: [...secoes, nova] });
    setNovoTitulo("");
  }

  const vazia = secoes.length === 0 && !epiteto;

  return (
    <div className="fichacompleta">
      {editavel ? (
        <div className="notesbox">
          <span className="sectitle">Epígrafe</span>
          <CampoTextoAdiado
            valor={epiteto}
            maxLength={200}
            placeholder="uma frase curta sob o nome, se quiser"
            onSalvar={(texto) => patch({ ficha_epiteto: texto })}
          />
        </div>
      ) : (
        epiteto && <p className="fc-epiteto">{epiteto}</p>
      )}

      {vazia && !editavel && <p className="empty-note">Nada cadastrado ainda.</p>}

      {secoes.map((secao, i) => (
        <SecaoRecolhivel
          key={i}
          titulo={
            editavel ? (
              <>
                <CampoTexto
                  valor={secao.titulo}
                  maxLength={60}
                  placeholder="título da seção"
                  onCommit={(t) => patch({ ficha_secoes: atualizarSecao(secoes, i, { titulo: t }) })}
                />
                <CampoTexto
                  valor={secao.subtitulo ?? ""}
                  maxLength={60}
                  placeholder="subtítulo (opcional)"
                  onCommit={(t) => patch({ ficha_secoes: atualizarSecao(secoes, i, { subtitulo: t }) })}
                />
              </>
            ) : (
              <>
                <h4>{secao.titulo}</h4>
                {secao.subtitulo && <span className="fc-sub">{secao.subtitulo}</span>}
              </>
            )
          }
          cabecalhoExtra={
            editavel && (
              <BotaoRemover
                aria={`remover seção ${secao.titulo}`}
                confirmar={`Remover a seção "${secao.titulo}"?`}
                onConfirmar={() => patch({ ficha_secoes: removerSecao(secoes, i) })}
              />
            )
          }
        >
          {secao.tipo === "texto" ? (
            editavel ? (
              <CampoTextoAdiado
                valor={secao.texto ?? ""}
                maxLength={4000}
                atrasoMs={700}
                placeholder="texto corrido..."
                onSalvar={(t) => patch({ ficha_secoes: atualizarSecao(secoes, i, { texto: t }) })}
              />
            ) : (
              (secao.texto ?? "").split(/\n{2,}/).map((paragrafo, k) => <p key={k}>{paragrafo}</p>)
            )
          ) : (
            <div className="fc-itens">
              {(secao.itens ?? []).map((item, j) => (
                <div key={j} className="fc-item">
                  {editavel ? (
                    <>
                      <div className="fc-itemhead">
                        <CampoTexto
                          valor={item.titulo}
                          maxLength={60}
                          placeholder="título"
                          onCommit={(t) => patch({ ficha_secoes: atualizarItem(secoes, i, j, { titulo: t }) })}
                        />
                        <CampoTexto
                          valor={item.tag ?? ""}
                          maxLength={30}
                          placeholder="tag (opcional)"
                          onCommit={(t) => patch({ ficha_secoes: atualizarItem(secoes, i, j, { tag: t }) })}
                        />
                        <BotaoRemover
                          aria={`remover ${item.titulo || "item"}`}
                          onConfirmar={() => patch({ ficha_secoes: removerItem(secoes, i, j) })}
                        />
                      </div>
                      <CampoTextoAdiado
                        valor={item.descricao}
                        maxLength={1200}
                        atrasoMs={700}
                        placeholder="descrição"
                        onSalvar={(t) =>
                          patch({ ficha_secoes: atualizarItem(secoes, i, j, { descricao: t }) })
                        }
                      />
                    </>
                  ) : (
                    <>
                      <div className="fc-itemhead">
                        <h5>{item.titulo}</h5>
                        {item.tag && <span className="fc-tag">{item.tag}</span>}
                      </div>
                      {item.descricao && <p>{item.descricao}</p>}
                    </>
                  )}
                </div>
              ))}
              {editavel && (
                <button
                  type="button"
                  className="minilink"
                  onClick={() => patch({ ficha_secoes: adicionarItem(secoes, i) })}
                >
                  + item
                </button>
              )}
            </div>
          )}
        </SecaoRecolhivel>
      ))}

      {editavel && (
        <div className="addcombatant" style={{ marginTop: 12 }}>
          <input
            type="text"
            placeholder="nome da seção (ex.: Características, Quem ele é)"
            maxLength={60}
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
          />
          <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as "lista" | "texto")}>
            <option value="lista">Lista (características, magias, itens...)</option>
            <option value="texto">Texto corrido (história...)</option>
          </select>
          <button type="button" className="btn" onClick={adicionarSecao}>
            + seção
          </button>
        </div>
      )}
    </div>
  );
}
