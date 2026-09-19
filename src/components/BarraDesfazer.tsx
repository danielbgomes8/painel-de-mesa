"use client";

import { useEffect, useState } from "react";
import type { Sala } from "@/hooks/useSala";

/**
 * Desfazer a última ação deste aparelho (ver lib/desfazer.ts). Fica presa no
 * rodapé da tela nas abas Combate e Fichas, onde as ações acontecem, e diz o
 * que vai desfazer antes do toque — toques seguidos voltam uma ação de cada
 * vez, da mais nova pra mais velha.
 */
export function BarraDesfazer({ sala }: { sala: Sala }) {
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<{ texto: string; falhou: boolean } | null>(null);

  // O aviso do que aconteceu some sozinho; o botão da próxima fica.
  useEffect(() => {
    if (!resultado) return;
    const t = setTimeout(() => setResultado(null), 6000);
    return () => clearTimeout(t);
  }, [resultado]);

  const acao = sala.desfazivel;
  if (!acao && !resultado) return null;

  async function desfazer() {
    if (ocupado) return;
    setOcupado(true);
    const r = await sala.desfazer();
    setOcupado(false);
    setResultado(
      r.ok
        ? { texto: `✓ Desfeito: ${r.rotulo}`, falhou: false }
        : { texto: `Não deu pra desfazer: ${r.motivo}`, falhou: true },
    );
  }

  return (
    <div className="desfazerbarra" role="status" aria-live="polite">
      {resultado && <span className={`desfazerresultado${resultado.falhou ? " falhou" : ""}`}>{resultado.texto}</span>}
      {acao && (
        <>
          <button type="button" className="btn" onClick={desfazer} disabled={ocupado}>
            {ocupado ? "desfazendo…" : "↩ Desfazer"}
          </button>
          <span className="desfazertexto" title={acao.rotulo}>
            {acao.rotulo}
          </span>
        </>
      )}
    </div>
  );
}
