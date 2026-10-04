"use client";

import type { Personagem } from "@/lib/tipos";

/** A chave de "os inimigos que vão entrar agora" (monstro novo ainda não tem slug). */
export const CHAVE_INIMIGOS = "@inimigos";

/** Emboscada: o Mestre marca quem está surpreso antes de rolar a iniciativa. Pela regra de 2024, o surpreso
 *  NÃO perde o turno: rola a iniciativa com desvantagem (dois d20, vale o menor). A marca vale pras rolagens
 *  que o Mestre faz nesta tela (um por um, "pôr os jogadores na ordem", encontro preparado) e não fica
 *  guardada: some ao recarregar. O jogador que rola a própria iniciativa tem a caixinha dele. */
export function EmboscadaDaIniciativa({
  jogadoresFora,
  surpresos,
  onAlternar,
}: {
  /** Jogadores que ainda vão rolar (os que já estão na ordem não têm mais o que rolar). */
  jogadoresFora: Personagem[];
  surpresos: Record<string, boolean>;
  onAlternar: (chave: string) => void;
}) {
  const marcados = Object.values(surpresos).filter(Boolean).length;
  return (
    <details className="emb">
      <summary>💥 Emboscada{marcados > 0 ? ` · ${marcados} ${marcados === 1 ? "surpreso" : "surpresos"}` : ""}</summary>
      <p className="empty-note">Quem está surpreso rola a iniciativa com desvantagem: dois d20, vale o menor. Não perde o turno (regra de 2024).</p>
      <div className="chips">
        {jogadoresFora.map((p) => (
          <button key={p.slug} type="button" className="chip alvo" aria-pressed={Boolean(surpresos[p.slug])} onClick={() => onAlternar(p.slug)}>
            {p.name}
          </button>
        ))}
        <button type="button" className="chip alvo" aria-pressed={Boolean(surpresos[CHAVE_INIMIGOS])} onClick={() => onAlternar(CHAVE_INIMIGOS)}>
          Inimigos que vão entrar
        </button>
      </div>
    </details>
  );
}
