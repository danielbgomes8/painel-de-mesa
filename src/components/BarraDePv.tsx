import { faixaPV } from "@/lib/regras";

/**
 * Barrinha de PV do telão (card da vez e cartão do foco): moldura dourada,
 * trilho escuro com marcas a cada 10% e o enchimento na cor da faixa
 * (`faixaPV`, a mesma da ficha: verde, âmbar, vermelho). O número vem ao lado,
 * porque cor sozinha não basta pra quem lê de longe.
 */
export function BarraDePv({ hp, hpMax }: { hp: number; hpMax: number }) {
  const faixa = faixaPV(hp, hpMax);
  const fracao = hpMax > 0 ? Math.min(1, Math.max(0, hp / hpMax)) : 0;
  return (
    <span
      className={`barra-pv barra-pv--${faixa}`}
      role="meter"
      aria-label="Pontos de vida"
      aria-valuemin={0}
      aria-valuemax={hpMax}
      aria-valuenow={Math.max(0, hp)}
      aria-valuetext={`${hp} de ${hpMax} PV`}
    >
      <span className="barra-pv-trilho" aria-hidden="true">
        <i style={{ transform: `scaleX(${fracao})` }} />
      </span>
      <span className="barra-pv-num">
        {hp}
        <small> / {hpMax}</small>
      </span>
    </span>
  );
}
