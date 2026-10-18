"use client";

import type { PecaNaTela } from "@/lib/pecas";

/** Só o primeiro nome cabe na pílula; o completo vai no `title` e no leitor de tela. */
function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

/**
 * HUD discreto no canto do telão: um botão por jogador com peão no mapa. Tocar
 * desliza a vista até ele com um zoom moderado (`focar` do CenaMapa); "mesa"
 * volta pra visão que o Mestre definiu. Só jogadores: peão de inimigo (revelado
 * ou não) fica de fora, pra o telão não apontar quem o Mestre ainda esconde.
 */
export function FocoDoTelao({
  pecas,
  aoFocar,
  aoVoltar,
}: {
  pecas: readonly PecaNaTela[];
  aoFocar: (peca: PecaNaTela) => void;
  aoVoltar: () => void;
}) {
  const jogadores = pecas.filter((p) => p.observa && !p.oculto);
  if (jogadores.length === 0) return null;
  return (
    <nav className="telao-foco" aria-label="Focar num jogador">
      {jogadores.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`telao-foco-item${p.vez ? " telao-foco-item--vez" : ""}`}
          onClick={() => aoFocar(p)}
          title={`Focar em ${p.nome}`}
          aria-label={`Focar em ${p.nome}`}
        >
          <span className="telao-foco-cor" style={{ background: p.cor }} aria-hidden="true" />
          {primeiroNome(p.nome)}
        </button>
      ))}
      <button type="button" className="telao-foco-item telao-foco-mesa" onClick={aoVoltar} aria-label="Voltar à visão da mesa">
        ⤢ mesa
      </button>
    </nav>
  );
}
