"use client";

export type Aba = "diario" | "bastiao" | "combate" | "fichas" | "mestre";

/** Interruptor do Bastião. Desligado (false), a aba some pra todo mundo, mas
 *  NADA é apagado: o código, as tabelas e os dados da campanha ficam como estão,
 *  e o backup continua levando o Bastião. Pra religar, troque por true. */
export const BASTIAO_ATIVO: boolean = false;

const ABAS_BASE: { id: Aba; rotulo: string }[] = [
  { id: "diario", rotulo: "Diário" },
  ...(BASTIAO_ATIVO ? [{ id: "bastiao" as const, rotulo: "Bastião" }] : []),
  { id: "combate", rotulo: "Combate" },
  { id: "fichas", rotulo: "Fichas" },
];

/** Menu de navegação do painel — troca qual seção fica visível. */
export function BarraAbas({
  aba,
  onMudar,
  souMestre,
}: {
  aba: Aba;
  onMudar: (a: Aba) => void;
  souMestre: boolean;
}) {
  const abas = souMestre ? [...ABAS_BASE, { id: "mestre" as const, rotulo: "Mestre" }] : ABAS_BASE;
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
