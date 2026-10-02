"use client";

/** "Tem versão nova" — aparece quando saiu uma versão depois de o app ser aberto. O botão
 *  recarrega a página (o que estava guardado pra enviar sem internet fica no aparelho). */
export function AvisoVersaoNova({ aparecer, comFilaPendente }: { aparecer: boolean; comFilaPendente: boolean }) {
  if (!aparecer) return null;
  return (
    <div className="versaobanner" role="status" aria-live="polite">
      <span className="versaobanner-texto">
        🔄 <b>Tem versão nova do painel.</b>
        {comFilaPendente && " O que você fez sem internet continua guardado e vai quando a conexão voltar."}
      </span>
      <button type="button" className="versaobanner-atualizar" onClick={() => window.location.reload()}>
        atualizar
      </button>
    </div>
  );
}
