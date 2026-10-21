"use client";

/* eslint-disable @next/next/no-img-element -- as fotos vêm do Storage do Supabase, já reduzidas no envio */

import { type Quadro } from "@/hooks/useQuadro";
import { type Identidade } from "@/lib/identidade";
import { TITULO_DA_SILHUETA, emojiDoTipo, rotuloDoTipo, type Cartao, type CartaoVisto } from "@/lib/quadro";
import { ROTULO_REVELACAO } from "@/components/apoioDoQuadro";

export function estadoDoCartao(c: Cartao, quem: Identidade | null): { emoji: string; texto: string } | null {
  if (c.dono === null) {
    // A mesa não precisa de selo: o que ela vê já está liberado.
    if (quem?.tipo !== "mestre") return null;
    const r = ROTULO_REVELACAO[c.revelacao];
    return { emoji: r.emoji, texto: r.curto };
  }
  if (c.revelacao === "revelado") return { emoji: "👁", texto: "Compartilhado" };
  return { emoji: "🔒", texto: "Só meu" };
}

export function MiniaturaDoCartao({
  visto,
  quadro,
  quem,
  aoAbrir,
  alca,
  arrastando,
  nomeDoAutor,
  alcaLigar,
  alvoDeLigacao,
  origemDeLigacao,
}: {
  visto: CartaoVisto;
  quadro: Quadro;
  quem: Identidade | null;
  nomeDoAutor: (autor: string) => string;
  aoAbrir: () => void;
  /** Só na vista em colunas e só pro Mestre: a alça de arrastar. */
  alca?: (e: React.PointerEvent<HTMLSpanElement>) => void;
  arrastando?: boolean;
  /** A alça 🔗: arrastar até outro cartão pra ligar os dois. */
  alcaLigar?: (e: React.PointerEvent<HTMLSpanElement>) => void;
  alvoDeLigacao?: boolean;
  origemDeLigacao?: boolean;
}) {
  const { cartao: c, visao } = visto;
  const silhueta = visao === "silhueta";
  const url = quadro.urlDaFoto(c);
  const estado = estadoDoCartao(c, quem);
  const titulo = silhueta ? TITULO_DA_SILHUETA : c.titulo || "Sem nome";
  return (
    <div
      className="qd-cartaobloco"
      data-cartao-id={c.id}
      data-arrastando={arrastando || origemDeLigacao || undefined}
      data-alvo-ligacao={alvoDeLigacao || undefined}
    >
      {alcaLigar && (
        <span
          className="qd-alca qd-alca--ligar"
          data-com-colunas={alca ? "" : undefined}
          onPointerDown={alcaLigar}
          role="button"
          aria-label={`Ligar ${titulo} a outro cartão`}
          title="Arrastar até outro cartão para ligar"
        >
          🔗
        </span>
      )}
      {alca && (
        <span className="qd-alca" onPointerDown={alca} role="button" aria-label={`Arrastar ${titulo} para outra coluna`} title="Arrastar para outra coluna">
          ⠿
        </span>
      )}
    <button type="button" className="qd-cartao" data-revelacao={c.revelacao} data-dono={c.dono ? "pessoal" : "mesa"} onClick={aoAbrir}>
      <span className="qd-foto" data-silhueta={silhueta || undefined}>
        {url ? <img src={url} alt="" loading="lazy" /> : <span className="qd-semfoto">{emojiDoTipo(c.tipo)}</span>}
        <span className="qd-tipo">
          {emojiDoTipo(c.tipo)} {rotuloDoTipo(c.tipo)}
        </span>
        {estado && (
          <span className="qd-estado">
            {estado.emoji} {estado.texto}
          </span>
        )}
      </span>
      <span className="qd-nome">{titulo}</span>
      {c.dono !== null && (
        <span className="qd-dono">🧑 {quem?.tipo === "jogador" && quem.slug === c.dono ? "seu cartão" : `de ${nomeDoAutor(c.dono)}`}</span>
      )}
      {!silhueta && c.subtitulo && <span className="qd-sub">{c.subtitulo}</span>}
    </button>
    </div>
  );
}
