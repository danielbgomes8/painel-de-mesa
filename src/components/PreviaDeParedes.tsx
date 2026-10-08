"use client";

import type { ResultadoDaDeteccao, Segmento } from "@/lib/detectarParedes";

/** Chave estável de um segmento ("p3" = parede 3, "d1" = porta 1). */
export const chaveDaParede = (i: number) => `p${i}`;
export const chaveDaPorta = (i: number) => `d${i}`;

/**
 * A imagem do mapa com as paredes e portas achadas por cima. Tocar numa linha a
 * tira do que vai ser importado (fica cinza e tracejada); tocar de novo traz de
 * volta. É o jeito rápido de limpar o que o detector errou — tapete, mesa,
 * quadriculado — antes de importar, sem desenhar nada à mão.
 */
export function PreviaDeParedes({
  url,
  deteccao,
  tiradas,
  aoAlternar,
}: {
  url: string;
  deteccao: ResultadoDaDeteccao;
  tiradas: ReadonlySet<string>;
  aoAlternar: (chave: string) => void;
}) {
  const { largura, altura } = deteccao;
  const linhas: { chave: string; s: Segmento; porta: boolean }[] = [
    ...deteccao.paredes.map((s, i) => ({ chave: chaveDaParede(i), s, porta: false })),
    ...deteccao.portas.map((s, i) => ({ chave: chaveDaPorta(i), s, porta: true })),
  ];
  return (
    <div className="previa-paredes" style={{ aspectRatio: `${largura} / ${altura}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" draggable={false} />
      <svg viewBox={`0 0 ${largura} ${altura}`} role="group" aria-label="Paredes e portas achadas. Toque numa linha pra tirar ou pôr de volta.">
        {linhas.map(({ chave, s, porta }) => {
          const fora = tiradas.has(chave);
          return (
            <g key={chave}>
              <line
                className={`previa-linha ${porta ? "porta" : "parede"}${fora ? " fora" : ""}`}
                x1={s[0]}
                y1={s[1]}
                x2={s[2]}
                y2={s[3]}
              />
              {/* A área de toque é bem mais grossa que o traço: o dedo não acerta uma linha de 3 px. */}
              <line
                className="previa-toque"
                x1={s[0]}
                y1={s[1]}
                x2={s[2]}
                y2={s[3]}
                role="button"
                tabIndex={0}
                aria-pressed={!fora}
                aria-label={`${porta ? "Porta" : "Parede"} ${chave.slice(1)}, ${fora ? "fora" : "dentro"}`}
                onClick={() => aoAlternar(chave)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    aoAlternar(chave);
                  }
                }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
