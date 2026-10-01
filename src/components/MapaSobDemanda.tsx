"use client";

import dynamic from "next/dynamic";
import type { ComponentProps, ComponentType } from "react";
import type { PainelMapa as PainelMapaReal, VisorDaMesa as VisorDaMesaReal } from "@/components/PainelMapa";

/**
 * O código do mapa (canvas, névoa, peões, paredes, visão, régua, áreas) fica
 * fora da abertura do app, que é o que todo celular da mesa baixa: só vem
 * quando alguém abre a aba Mapa ou o telão mostra um mapa — e, no tempo livre,
 * pra quem tem mapa (ver `preCarregarNoTempoLivre` no Painel). Depois de
 * baixado, o service worker guarda.
 *
 * Sem internet e sem ter baixado antes, mostra um aviso em vez de derrubar a
 * tela inteira (o erro do `import()` subiria até o topo do app).
 */

function FalhouAoCarregar() {
  return (
    <section className="combat" aria-label="Mapa">
      <p className="mapa-erro" role="alert">
        Não deu pra carregar o mapa — este aparelho está sem internet e ainda não tinha baixado essa parte do app.
      </p>
      <button type="button" className="btn" onClick={() => window.location.reload()}>
        tentar de novo
      </button>
    </section>
  );
}

function AbrindoOMapa() {
  return (
    <section className="combat" aria-label="Mapa">
      <p className="empty-note">Abrindo o mapa…</p>
    </section>
  );
}

function AbrindoOMapaNoTelao() {
  return (
    <div className="mapa-visor mapa-visor--telao">
      <div className="cena-caixa">
        <div className="cena-aviso">Abrindo o mapa…</div>
      </div>
    </div>
  );
}

export const PainelMapa = dynamic(
  () =>
    import("@/components/PainelMapa")
      .then((m) => m.PainelMapa)
      .catch((): ComponentType<ComponentProps<typeof PainelMapaReal>> => FalhouAoCarregar),
  { ssr: false, loading: AbrindoOMapa },
);

export const VisorDaMesa = dynamic(
  () =>
    import("@/components/PainelMapa")
      .then((m) => m.VisorDaMesa)
      .catch((): ComponentType<ComponentProps<typeof VisorDaMesaReal>> => FalhouAoCarregar),
  { ssr: false, loading: AbrindoOMapaNoTelao },
);
