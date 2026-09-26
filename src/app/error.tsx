"use client";

import { useEffect } from "react";
import { relatarErro } from "@/lib/relatarErro";

/**
 * Tela que aparece quando alguma parte do painel quebra (convenção do Next:
 * `error.tsx` é o "error boundary" da página). Sem ele, o celular ficava com
 * a página em branco no meio do combate. O erro vai pra tabela `erros`
 * (lib/relatarErro.ts), e recarregar não perde nada: o que foi gravado está
 * no banco, e o que estava esperando internet está na fila do aparelho.
 */
export default function ErroNaTela({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    relatarErro("tela quebrou", error);
  }, [error]);

  return (
    <div className="tela-centro">
      {/* O <title> da campanha morava na parte que quebrou. */}
      <title>Painel de Mesa</title>
      <h1>Painel de Mesa</h1>
      <p>Algo deu errado nesta tela. O combate está salvo — recarregar não perde nada.</p>
      <div className="erro-botoes">
        <button type="button" className="btn" onClick={() => retry()}>
          Tentar de novo
        </button>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          Recarregar a página
        </button>
      </div>
    </div>
  );
}
