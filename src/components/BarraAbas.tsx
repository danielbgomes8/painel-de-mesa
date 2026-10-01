"use client";

export type Aba = "diario" | "bastiao" | "combate" | "mapa" | "fichas" | "mestre";

/** Interruptor do Bastião. Desligado (false), a aba some pra todo mundo, mas
 *  NADA é apagado: o código, as tabelas e os dados da campanha ficam como estão,
 *  e o backup continua levando o Bastião. Pra religar, troque por true. */
export const BASTIAO_ATIVO: boolean = false;

/** As abas na ordem da tela. "Mapa" só entra quando `temMapa` (Mestre sempre;
 *  jogador quando há um mapa na mesa) e "Mestre" só pro Mestre. */
function montarAbas(souMestre: boolean, temMapa: boolean): { id: Aba; rotulo: string }[] {
  return [
    { id: "diario", rotulo: "Diário" },
    ...(BASTIAO_ATIVO ? [{ id: "bastiao" as const, rotulo: "Bastião" }] : []),
    { id: "combate", rotulo: "Combate" },
    ...(temMapa ? [{ id: "mapa" as const, rotulo: "Mapa" }] : []),
    { id: "fichas", rotulo: "Fichas" },
    ...(souMestre ? [{ id: "mestre" as const, rotulo: "Mestre" }] : []),
  ];
}

/** Menu de navegação do painel — troca qual seção fica visível. */
export function BarraAbas({
  aba,
  onMudar,
  souMestre,
  temMapa,
}: {
  aba: Aba;
  onMudar: (a: Aba) => void;
  souMestre: boolean;
  temMapa: boolean;
}) {
  const abas = montarAbas(souMestre, temMapa);
  return (
    <div className="abas">
      {abas.map((a) => (
        <button
          key={a.id}
          type="button"
          className="aba"
          aria-pressed={aba === a.id}
          onClick={() => onMudar(a.id)}
        >
          {a.rotulo}
        </button>
      ))}
    </div>
  );
}
