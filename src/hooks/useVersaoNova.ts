"use client";

import { useEffect, useState } from "react";
import { VERSAO_DESTE_APP, lerVersaoRemota, podeRecarregarSozinho, temVersaoNova } from "@/lib/versao";

const CADA_MS = 5 * 60 * 1000;
const CHAVE_RECARREGOU = "mesa-recarregou-para";

/**
 * Pergunta a `/versao` qual versão está no ar: ao abrir, a cada 5 minutos, quando o app volta a
 * ficar visível e quando a internet volta. Devolve `true` quando saiu uma versão diferente da
 * que este aparelho carregou — quem usa mostra o aviso. Falha de rede nunca avisa nada.
 *
 * `recarregarSozinho` é pro telão (ninguém toca nele): recarrega na hora, uma vez por versão.
 * No celular quem decide é a pessoa — recarregar no meio do combate seria pior que a versão velha.
 */
export function useVersaoNova(recarregarSozinho = false): boolean {
  const [nova, setNova] = useState(false);

  useEffect(() => {
    // Em desenvolvimento não há versão publicada: não há o que comparar.
    if (process.env.NODE_ENV !== "production" && !window.__versaoDeTeste) return;
    let vivo = true;

    async function conferir() {
      try {
        const r = await fetch("/versao", { cache: "no-store" });
        if (!r.ok || !vivo) return;
        const remota = lerVersaoRemota(await r.json());
        if (!remota || !temVersaoNova(VERSAO_DESTE_APP, remota) || !vivo) return;
        setNova(true);
        if (recarregarSozinho) {
          let jaFoi: string | null = null;
          try {
            jaFoi = sessionStorage.getItem(CHAVE_RECARREGOU);
          } catch {
            // sem armazenamento: recarrega mesmo assim, mas só desta vez (a página nova refaz a conta)
          }
          if (podeRecarregarSozinho(remota, jaFoi)) {
            try {
              sessionStorage.setItem(CHAVE_RECARREGOU, remota);
            } catch {
              // idem
            }
            window.location.reload();
          }
        }
      } catch {
        // sem internet ou servidor fora: tenta de novo na próxima
      }
    }

    const aoVoltar = () => {
      if (document.visibilityState === "visible") void conferir();
    };
    const inicio = setTimeout(() => void conferir(), 4000);
    const ciclo = setInterval(() => void conferir(), CADA_MS);
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("online", aoVoltar);
    return () => {
      vivo = false;
      clearTimeout(inicio);
      clearInterval(ciclo);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", aoVoltar);
    };
  }, [recarregarSozinho]);

  return nova;
}

declare global {
  interface Window {
    /** Só o robô de tela liga isto: faz o aviso funcionar também no `next dev`. */
    __versaoDeTeste?: boolean;
  }
}
