"use client";

import { useState } from "react";
import type { PecaNaTela } from "@/lib/pecas";
import type { Personagem } from "@/lib/tipos";
import { pvExibidoIniciativa } from "@/lib/regras";
import { BarraDePv } from "@/components/BarraDePv";

/** Um peão de jogador no HUD, com a ficha dele (pro PV do cartão), se houver. */
export type ItemDoFoco = { peca: PecaNaTela; ficha: Personagem | null };

/** Os peões que entram no HUD: só jogadores (e companheiros) visíveis. Peão de
 *  inimigo, revelado ou não, fica de fora — o telão nunca aponta o que o Mestre esconde. */
export function itensDoFoco(pecas: readonly PecaNaTela[], fichaDaPeca: (id: string) => Personagem | null): ItemDoFoco[] {
  return pecas.filter((p) => p.observa && !p.oculto).map((peca) => ({ peca, ficha: fichaDaPeca(peca.id) }));
}

/** O peão em miniatura, igual ao do mapa: bolinha na cor, borda branca, letras. */
function IconeDoPeao({ peca, grande = false }: { peca: PecaNaTela; grande?: boolean }) {
  return (
    <span
      className={`foco-icone${grande ? " foco-icone--grande" : ""}${peca.vez ? " foco-icone--vez" : ""}`}
      style={{ background: peca.cor }}
      aria-hidden="true"
    >
      {peca.rotulo}
    </span>
  );
}

/**
 * HUD discreto: uma coluna só com os ícones dos peões dos jogadores. Tocar foca
 * o peão (desliza com zoom moderado) e abre o cartão dele do outro lado.
 * Embaixo, "mesa" (volta à visão da mesa) e, quando há, o botão da Vista Mestre.
 */
export function FocoDoTelao({
  itens,
  focado,
  aoFocar,
  aoVoltar,
  vistaMestre,
  lado = "esquerda",
}: {
  itens: readonly ItemDoFoco[];
  focado: string | null;
  aoFocar: (peca: PecaNaTela) => void;
  aoVoltar?: () => void;
  vistaMestre?: { ligada: boolean; aoAlternar: () => void };
  lado?: "esquerda" | "direita";
}) {
  // Recolhido, sobra só o botão de abrir (e a Vista Mestre, que muda o que a tela mostra).
  const [aberto, setAberto] = useState(true);
  if (itens.length === 0 && !vistaMestre) return null;
  return (
    <nav className={`telao-foco telao-foco--${lado}`} aria-label="Focar num jogador">
      {itens.length > 0 && (
        <button
          type="button"
          className="telao-foco-item telao-foco-recolher"
          aria-expanded={aberto}
          aria-label={aberto ? "Recolher os jogadores" : "Mostrar os jogadores"}
          title={aberto ? "Recolher" : "Jogadores"}
          onClick={() => setAberto((a) => !a)}
        >
          {aberto ? "▴" : `👥 ${itens.length}`}
        </button>
      )}
      {aberto && itens.map(({ peca }) => (
        <button
          key={peca.id}
          type="button"
          className="telao-foco-peao"
          aria-pressed={focado === peca.id}
          onClick={() => aoFocar(peca)}
          title={peca.nome}
          aria-label={`Focar em ${peca.nome}`}
        >
          <IconeDoPeao peca={peca} />
        </button>
      ))}
      {aberto && aoVoltar && (
        <button type="button" className="telao-foco-item" onClick={aoVoltar} title="Voltar à visão da mesa" aria-label="Voltar à visão da mesa">
          ⤢
        </button>
      )}
      {vistaMestre && (
        <button
          type="button"
          className="telao-foco-item telao-foco-vista"
          aria-pressed={vistaMestre.ligada}
          onClick={vistaMestre.aoAlternar}
          title={vistaMestre.ligada ? "Vista Mestre ligada: a tela segue o Mestre" : "Ligar a Vista Mestre: a tela segue o Mestre"}
        >
          👁<span className="telao-foco-vista-texto"> Mestre</span>
        </button>
      )}
    </nav>
  );
}

/** O cartão do peão em foco: ícone, nome e PV (só o que a mesa já pode ver). */
export function CartaoDoFoco({
  item,
  aoFechar,
  lado = "direita",
}: {
  item: ItemDoFoco;
  aoFechar?: () => void;
  lado?: "esquerda" | "direita";
}) {
  const { peca, ficha } = item;
  const pv = ficha ? pvExibidoIniciativa(ficha, false) : null;
  const nome = ficha?.name || peca.nome;
  return (
    <aside className={`foco-cartao foco-cartao--${lado}`} aria-live="polite" aria-label={`Em foco: ${nome}`}>
      <IconeDoPeao peca={peca} grande />
      <div className="foco-cartao-texto">
        <b>{nome}</b>
        {ficha?.cls && <span className="foco-cartao-classe">{ficha.cls}</span>}
        {pv && <BarraDePv hp={pv.hp} hpMax={pv.hp_max} />}
        {peca.vez && <span className="foco-cartao-vez">na vez</span>}
      </div>
      {aoFechar && (
        <button type="button" className="foco-cartao-fechar" onClick={aoFechar} aria-label="Fechar o cartão">
          ✕
        </button>
      )}
    </aside>
  );
}
