"use client";

import { useEffect, useRef, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Personagem } from "@/lib/tipos";
import { estaCaido } from "@/lib/regras";
import { mudarPVComLog } from "@/components/FichaPersonagem";
import { AcoesNaLinha, avancarTurno } from "@/components/RastreadorCombate";

/**
 * Tocar num peão (sem arrastar) abre isto embaixo do mapa: as mesmas ações da
 * linha da iniciativa — dano, metade, cura, ataques, condições, testes de
 * morte — e, se é a vez de quem o peão representa, "passar a vez". Tudo passa
 * pelas mesmas funções da iniciativa (log, desfazer, anti-spoiler), então o
 * dano dado aqui é o mesmo dado lá.
 *
 * O Mestre abre o de qualquer ficha; o jogador, só o do próprio peão (é o
 * único que o toque dele pega — ver CenaMapa). Marcador avulso não tem ficha,
 * então não abre nada.
 */
export function CartaoDoPeao({
  sala,
  personagem: p,
  souMestre,
  vez,
  naOrdem,
  oculto,
  aoAlternarOculto,
  aoFechar,
}: {
  sala: Sala;
  personagem: Personagem;
  souMestre: boolean;
  /** É a vez de quem o peão representa. */
  vez: boolean;
  /** Está na ordem de iniciativa. */
  naOrdem: boolean;
  /** O peão está escondido da mesa (só o Mestre vê). */
  oculto?: boolean;
  /** Só pro Mestre: mostra/esconde o peão pra mesa. */
  aoAlternarOculto?: () => void;
  aoFechar: () => void;
}) {
  const [retorno, setRetorno] = useState<string | null>(null);
  // O painel de dano se trava depois de aplicar (quem o abriu fecha); aqui ele
  // continua aberto pro próximo golpe, então remonta a cada aplicação.
  const [aplicacoes, setAplicacoes] = useState(0);
  const [passando, setPassando] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);

  // Abriu embaixo do mapa: no celular costuma cair fora da tela. Rola só o
  // necessário pra ele aparecer (o cartão só nasce de um toque, nunca de um arrasto).
  useEffect(() => {
    caixaRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, []);

  async function aplicar(delta: number) {
    const texto = await mudarPVComLog(sala, p, delta);
    setRetorno(texto);
    setAplicacoes((n) => n + 1);
  }

  async function passarAVez() {
    if (passando) return;
    setPassando(true);
    setRetorno(null);
    await avancarTurno(sala);
    setPassando(false);
  }

  const npc = p.is_npc;
  return (
    <div ref={caixaRef} className="mapa-cartao" role="group" aria-label={`Ações de ${p.name}`}>
      <div className="mapa-cartao-topo">
        <b className="mapa-cartao-nome">{p.name}</b>
        <span className={`hpmini${estaCaido(p.hp) ? " crit" : ""}`}>
          {p.hp}/{p.hp_max} PV
        </span>
        {p.hp_temp > 0 && <span className="hptemp">+{p.hp_temp}</span>}
        <span className="mapa-cartao-ca">CA {p.ac}</span>
        {vez ? <span className="mapa-cartao-vez">é a vez</span> : !naOrdem && <span className="fc-sub">fora da iniciativa</span>}
      </div>
      {(vez || (souMestre && (aoAlternarOculto || npc))) && (
        <div className="mapa-ferr">
          {vez && (
            <button type="button" className="btn primary" disabled={passando} onClick={() => void passarAVez()}>
              Passar a vez →
            </button>
          )}
          {souMestre && aoAlternarOculto && (
            <button
              type="button"
              className="chip alvo"
              aria-pressed={!oculto}
              aria-label={oculto ? `Mostrar o peão de ${p.name} pra mesa` : `Esconder o peão de ${p.name} da mesa`}
              onClick={aoAlternarOculto}
            >
              {oculto ? "peão oculto" : "a mesa vê o peão"}
            </button>
          )}
          {souMestre && npc && (
            <button
              type="button"
              className="chip alvo"
              aria-pressed={p.revealed}
              aria-label={p.revealed ? `Esconder o nome de ${p.name} da mesa` : `Revelar o nome de ${p.name} pra mesa`}
              onClick={() => void sala.atualizarPersonagem(p.id, { revealed: !p.revealed })}
            >
              {p.revealed ? "nome revelado" : "nome escondido"}
            </button>
          )}
        </div>
      )}
      <AcoesNaLinha
        key={aplicacoes}
        sala={sala}
        personagem={p}
        naVez={vez}
        focarAoAbrir={false}
        onAplicar={aplicar}
        onFechar={aoFechar}
      />
      {retorno && (
        <div className="initretorno" role="status">
          <span>{retorno}</span>
          <button type="button" className="rm" aria-label="Dispensar" onClick={() => setRetorno(null)}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
