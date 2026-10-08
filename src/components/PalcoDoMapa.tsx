"use client";

import { useEffect, useState, type ReactNode } from "react";
import { IconeMapa, type NomeIcone } from "@/components/IconesMapa";

export type FerramentaDoPalco = { id: string; rotulo: string; icone: NomeIcone };

/** Dica curta que some sozinha: aparece quando a ferramenta muda e fecha em ~6 s (ou ao tocar). */
function useDicaTemporaria(chave: string) {
  const [dispensada, setDispensada] = useState<string | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setDispensada(chave), 6000);
    return () => window.clearTimeout(t);
  }, [chave]);
  return { visivel: dispensada !== chave, dispensar: () => setDispensada(chave) };
}

/**
 * O "palco" do mapa: o mapa ocupa tudo e os controles flutuam por cima — uma barra
 * fina de ícones à esquerda, um painel só com as opções da ferramenta ativa, o zoom
 * embaixo à esquerda e o ping como botão grande no canto. Não sabe nada de regra:
 * quem usa diz quais ferramentas existem e o que vai em cada painel.
 */
export function PalcoDoMapa({
  mapa,
  nome,
  estado,
  estadoLigado = true,
  canto,
  cantoAlto = false,
  ferramentas,
  ativa,
  aoEscolher,
  painel,
  painelAberto,
  aoFecharPainel,
  ping,
  zoom,
  extraEmbaixo,
  dica,
}: {
  /** O `CenaMapa` (ocupa o palco todo). */
  mapa: ReactNode;
  nome: string;
  estado: string;
  estadoLigado?: boolean;
  /** Topo direito: modo Preparar/Jogar, "levar a mesa", "pôr meu peão"... */
  canto?: ReactNode;
  /** O canto ocupa duas linhas: a barra de ícones desce pra não ficar embaixo dele. */
  cantoAlto?: boolean;
  ferramentas: FerramentaDoPalco[];
  ativa: string;
  aoEscolher: (id: string) => void;
  painel?: { titulo: string; larga?: boolean; conteudo: ReactNode } | null;
  painelAberto: boolean;
  aoFecharPainel: () => void;
  ping?: { ativo: boolean; aoAlternar: () => void };
  zoom: { aproximar: () => void; afastar: () => void; enquadrar: () => void; rotuloEnquadrar: string };
  /** Botões a mais ao lado do zoom (ex.: a visão da mesa, do Mestre). */
  extraEmbaixo?: ReactNode;
  dica?: string;
}) {
  const { visivel, dispensar } = useDicaTemporaria(`${ativa}|${dica ?? ""}`);
  return (
    <div
      className="palco"
      data-canto-alto={cantoAlto ? "sim" : undefined}
      onPointerDownCapture={(e) => {
        // No celular o painel cobre boa parte do mapa: tocar no mapa já o fecha (o ícone da ferramenta reabre).
        if (painelAberto && (e.target as HTMLElement).tagName === "CANVAS" && window.matchMedia("(max-width: 699px)").matches) aoFecharPainel();
      }}
    >
      {mapa}
      <div className="palco-nome palco-vidro">
        <b>{nome || "Mapa"}</b>
        <span>
          <i className={`palco-ponto${estadoLigado ? "" : " desligado"}`} aria-hidden="true" />
          {estado}
        </span>
      </div>
      {canto && <div className="palco-canto">{canto}</div>}

      <div className="palco-barra palco-vidro" role="toolbar" aria-label="Ferramentas do mapa">
        {ferramentas.map((f) => (
          <button
            key={f.id}
            type="button"
            className="palco-ferr"
            title={f.rotulo}
            aria-label={f.rotulo}
            aria-pressed={ativa === f.id}
            onClick={() => aoEscolher(f.id)}
          >
            <IconeMapa nome={f.icone} />
          </button>
        ))}
      </div>

      {painel && painelAberto && (
        <section className={`palco-painel palco-vidro${painel.larga ? " larga" : ""}`} aria-label={painel.titulo}>
          <header>
            <h4>{painel.titulo}</h4>
            <button type="button" className="palco-fechar" aria-label="Fechar o painel" onClick={aoFecharPainel}>
              <IconeMapa nome="fechar" />
            </button>
          </header>
          <div className="palco-painel-corpo">{painel.conteudo}</div>
        </section>
      )}

      <div className="palco-zoom palco-vidro" role="group" aria-label="Zoom">
        <button type="button" className="palco-ferr pequeno" title="Aproximar" aria-label="Aproximar" onClick={zoom.aproximar}>
          <IconeMapa nome="mais" />
        </button>
        <button type="button" className="palco-ferr pequeno" title="Afastar" aria-label="Afastar" onClick={zoom.afastar}>
          <IconeMapa nome="menos" />
        </button>
        <button type="button" className="palco-ferr pequeno" title={zoom.rotuloEnquadrar} aria-label={zoom.rotuloEnquadrar} onClick={zoom.enquadrar}>
          <IconeMapa nome="enquadrar" />
        </button>
        {extraEmbaixo}
      </div>

      {ping && (
        <button
          type="button"
          className="palco-ping"
          aria-pressed={ping.ativo}
          aria-label="Ping: mostrar um ponto pra mesa"
          title="Ping"
          onClick={ping.aoAlternar}
        >
          <IconeMapa nome="ping" />
        </button>
      )}

      {dica && visivel && (
        <div className="palco-dica palco-vidro" role="status" aria-live="polite" onClick={dispensar}>
          {dica}
        </div>
      )}
    </div>
  );
}
