/** Qual versão do painel está no ar agora. Os aparelhos com o app aberto perguntam aqui de
 *  tempos em tempos e, se a resposta for diferente da versão que carregaram, avisam que tem
 *  versão nova (ver `hooks/useVersaoNova.ts`). Sem segredo: é só o início do código do commit. */
export const dynamic = "force-dynamic";

export function GET() {
  const versao = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || null;
  // `no-store` pra nenhum cache (do navegador ou do Vercel) devolver uma resposta velha.
  return Response.json({ versao }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
