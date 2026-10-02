/**
 * "Tem versão nova?" — as regras puras. O app sabe a versão que carregou (o commit que o Vercel
 * pôs no build) e pergunta a `/versao` qual está no ar.
 */

/** Versão deste app: o início do commit do build; "local" fora do Vercel. */
export const VERSAO_DESTE_APP = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "local";

/** Lê a resposta de `/versao`; qualquer coisa fora do formato vira `null` (nunca avisa por engano). */
export function lerVersaoRemota(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== "object") return null;
  const v = (corpo as { versao?: unknown }).versao;
  return typeof v === "string" && /^[0-9a-f]{7}$/i.test(v) ? v.toLowerCase() : null;
}

/** Saiu uma versão diferente da que este aparelho carregou? Sem resposta válida, não. */
export function temVersaoNova(minha: string, remota: string | null): boolean {
  return remota !== null && remota !== minha.toLowerCase();
}

/** Telão: recarrega sozinho, mas UMA vez por versão — se a versão do servidor e a do app nunca
 *  baterem por algum erro de configuração, recarregar em loop seria pior que não recarregar. */
export function podeRecarregarSozinho(remota: string, jaRecarregouPara: string | null): boolean {
  return remota !== jaRecarregouPara;
}
