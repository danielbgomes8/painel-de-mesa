"use client";

import { useEffect, useRef, useState } from "react";

/** Botão "⋯" do topo: guarda o que se usa pouco (telão, backup, trocar de
 *  campanha ou de pessoa) pra a primeira linha da tela ficar curta. */
export function MenuDoTopo({
  souMestre,
  quem,
  telaoAberto,
  trocandoCampanha,
  baixandoBackup,
  aoTelao,
  aoBackup,
  aoTrocarCampanha,
  aoTrocar,
}: {
  souMestre: boolean;
  quem: string;
  telaoAberto: boolean;
  trocandoCampanha: boolean;
  baixandoBackup: boolean;
  aoTelao: () => void;
  aoBackup: () => void;
  aoTrocarCampanha: () => void;
  aoTrocar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  // Toque fora ou Esc fecha.
  useEffect(() => {
    if (!aberto) return;
    function fora(e: PointerEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  function escolher(acao: () => void) {
    setAberto(false);
    acao();
  }

  return (
    <div className="menutopo" ref={raiz}>
      <button
        type="button"
        className="menutopo-botao"
        aria-label="Mais opções"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        ⋯
      </button>
      {aberto && (
        <div className="menutopo-lista" role="menu">
          <p className="menutopo-quem">
            Entrou como <b>{quem}</b>
          </p>
          {souMestre && (
            <>
              <button type="button" role="menuitem" aria-expanded={telaoAberto} onClick={() => escolher(aoTelao)}>
                📺 Modo telão
              </button>
              <button type="button" role="menuitem" disabled={baixandoBackup} onClick={() => escolher(aoBackup)}>
                {baixandoBackup ? "⬇ Juntando…" : "⬇ Backup"}
              </button>
            </>
          )}
          <button type="button" role="menuitem" aria-expanded={trocandoCampanha} onClick={() => escolher(aoTrocarCampanha)}>
            ⇄ Trocar campanha
          </button>
          <button type="button" role="menuitem" onClick={() => escolher(aoTrocar)}>
            Trocar de pessoa
          </button>
        </div>
      )}
    </div>
  );
}
