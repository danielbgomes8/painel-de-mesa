"use client";

import { CampoNumero } from "@/components/CampoNumero";
import { formatarXp, normalizarXp, progressoDeXp } from "@/lib/experiencia";

/** O XP do personagem e quanto falta pro próximo nível, na ficha. Todo mundo vê o placar; só o Mestre
 *  acerta o número (o prêmio normal vem das Ações em massa). As contas moram em `lib/experiencia.ts`. */
export function XpDoPersonagem({
  xp,
  nivel,
  mestreEdita,
  onSalvar,
}: {
  xp: unknown;
  nivel: number;
  mestreEdita: boolean;
  onSalvar: (xp: number) => void;
}) {
  const total = normalizarXp(xp);
  const p = progressoDeXp(total, nivel);
  if (!p) return null;
  return (
    <div className="xp">
      <div className="xp-linha">
        <span className="sectitle">XP</span>
        <b className="xp-total">{formatarXp(total)}</b>
        {p.ate !== null && <span className="xp-ate">/ {formatarXp(p.ate)}</span>}
        {mestreEdita && (
          <span className="xp-editar">
            <CampoNumero valor={total} onCommit={(n) => onSalvar(normalizarXp(n))} />
          </span>
        )}
      </div>
      <div
        className="xp-barra"
        role="progressbar"
        aria-label="Progresso até o próximo nível"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p.fracao * 100)}
      >
        <div className="xp-cheio" style={{ width: `${Math.round(p.fracao * 100)}%` }} />
      </div>
      <p className="xp-texto" data-pronto={p.podeSubir || undefined}>
        {p.maximo
          ? "Nível máximo."
          : p.podeSubir
            ? `XP suficiente pro nível ${nivel + 1}.`
            : `Faltam ${formatarXp(p.faltam)} XP pro nível ${nivel + 1}.`}
      </p>
    </div>
  );
}
