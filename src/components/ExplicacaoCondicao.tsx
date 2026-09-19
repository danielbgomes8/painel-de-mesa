"use client";

import {
  CONDICOES,
  EFEITOS_CONDICAO,
  EFEITOS_EXAUSTAO,
  condicoesAtivas,
  textoPrazo,
  type Condicao,
} from "@/lib/condicoes";
import { efeitoExaustao } from "@/lib/regras";
import type { Personagem } from "@/lib/tipos";

/** O que uma condição faz, em tópicos curtos (textos em lib/condicoes.ts). */
export function ExplicacaoCondicao({
  nome,
  prazo,
  onFechar,
}: {
  nome: Condicao;
  /** Rodadas que faltam pra ela acabar sozinha (sem prazo: não mostra). */
  prazo?: number;
  onFechar?: () => void;
}) {
  return (
    <Explicacao
      titulo={nome}
      detalhe={prazo ? `acaba sozinha em ${textoPrazo(prazo)}` : undefined}
      efeitos={EFEITOS_CONDICAO[nome]}
      onFechar={onFechar}
    />
  );
}

/** Exaustão: as regras dela e a penalidade do nível atual, já calculada. */
export function ExplicacaoExaustao({ nivel, onFechar }: { nivel: number; onFechar?: () => void }) {
  return (
    <Explicacao
      titulo={`Exaustão ${nivel}`}
      detalhe={efeitoExaustao(nivel)}
      efeitos={EFEITOS_EXAUSTAO}
      onFechar={onFechar}
    />
  );
}

function Explicacao({
  titulo,
  detalhe,
  efeitos,
  onFechar,
}: {
  titulo: string;
  detalhe?: string;
  efeitos: readonly { titulo: string; texto: string }[];
  onFechar?: () => void;
}) {
  return (
    <div className="condexplica">
      <div className="condexplicatopo">
        <b>{titulo}</b>
        {detalhe && <span className="condexplicadetalhe">{detalhe}</span>}
        {onFechar && (
          <button type="button" className="rm" aria-label={`Fechar explicação de ${titulo}`} onClick={onFechar}>
            ✕
          </button>
        )}
      </div>
      <ul>
        {efeitos.map((e, i) => (
          <li key={i}>
            <b>{e.titulo}:</b> {e.texto}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Na ficha: o que cada condição ATIVA faz, sempre à vista, e o guia das 14
 *  recolhido — pra consultar antes de aplicar (tocar no chip liga/desliga,
 *  não explica). */
export function CondicoesDaFicha({ personagem: p }: { personagem: Personagem }) {
  const ativas = condicoesAtivas(p.cond);
  return (
    <>
      {ativas.length > 0 && (
        <div className="condativas">
          {ativas.map((nome) => (
            <ExplicacaoCondicao key={nome} nome={nome} prazo={p.cond_prazo[nome]} />
          ))}
        </div>
      )}
      <details className="condguia">
        <summary>O que cada condição faz (regras 2024)</summary>
        {CONDICOES.map((nome) => (
          <ExplicacaoCondicao key={nome} nome={nome} />
        ))}
      </details>
    </>
  );
}
