"use client";

import { useEffect, useRef, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Personagem } from "@/lib/tipos";
import { AURA_MAXIMA_M, AURAS_PRONTAS_M, auraValida } from "@/lib/pecas";
import { estaCaido, formatarMetros } from "@/lib/regras";
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
  aura = null,
  aoMudarAura,
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
  /** Aura (emanação) do peão em metros (null = sem) e como ligar, mudar ou desligar. */
  aura?: number | null;
  aoMudarAura?: (metros: number | null) => void;
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
      {aoMudarAura && <ControleDeAura nome={p.name} aura={aura} aoMudar={aoMudarAura} />}
      <AcoesNaLinha
        key={aplicacoes}
        sala={sala}
        personagem={p}
        naVez={vez}
        souMestre={souMestre}
        focarAoAbrir={false}
        condicoesRecolhiveis
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

/** Aura (emanação): a área em volta do peão que anda junto com ele e fica ligada até
 *  alguém desligar (Aura de Proteção, Guardiões Espirituais...). Raios prontos em
 *  metros e um campo pro resto; a mesa inteira vê o halo. */
function ControleDeAura({ nome, aura, aoMudar }: { nome: string; aura: number | null; aoMudar: (metros: number | null) => void }) {
  const [outro, setOutro] = useState("");
  const [recusou, setRecusou] = useState(false);

  function aplicarOutro() {
    // "4,5" e "4.5" valem igual (teclado do celular em português).
    const valor = auraValida(outro.replace(",", "."));
    if (valor === null) {
      setRecusou(true);
      return;
    }
    setRecusou(false);
    setOutro("");
    aoMudar(valor);
  }

  return (
    <div className="mapa-aura" role="group" aria-label={`Aura de ${nome}`}>
      <span className="mapa-aura-titulo">Aura</span>
      {AURAS_PRONTAS_M.map((m) => (
        <button
          key={m}
          type="button"
          className="chip alvo"
          aria-pressed={aura === m}
          aria-label={`Aura de ${formatarMetros(m)}`}
          onClick={() => aoMudar(aura === m ? null : m)}
        >
          {m.toLocaleString("pt-BR")}
        </button>
      ))}
      <input
        type="text"
        inputMode="decimal"
        className="mapa-aura-campo"
        aria-label="Outro raio da aura, em metros"
        placeholder="outro (m)"
        maxLength={5}
        value={outro}
        autoComplete="off"
        onChange={(e) => {
          setOutro(e.target.value);
          setRecusou(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") aplicarOutro();
        }}
      />
      <button type="button" className="chip alvo" disabled={!outro.trim()} onClick={aplicarOutro}>
        ligar
      </button>
      {aura !== null && (
        <button type="button" className="chip alvo" aria-label={`Desligar a aura de ${nome}`} onClick={() => aoMudar(null)}>
          desligar
        </button>
      )}
      <span className={recusou ? "mapa-aura-aviso erro" : "mapa-aura-aviso"} role="status">
        {recusou ? `Use um raio de 0,1 a ${AURA_MAXIMA_M} m.` : aura !== null ? `Aura de ${formatarMetros(aura)} ligada: a mesa vê e ela anda com o peão.` : ""}
      </span>
    </div>
  );
}
