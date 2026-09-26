import { relatarErro } from "@/lib/relatarErro";

/**
 * Roda no navegador antes do app ficar pronto (convenção do Next — ver
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md).
 *
 * Erro que ninguém pegou — num toque de botão, num temporizador, numa
 * promessa sem tratamento — ia só pro console. Agora vai também pra tabela
 * `erros` (ver lib/relatarErro.ts). Erro que quebra a tela é pego pelo
 * `app/error.tsx`, que relata por conta própria.
 */
try {
  window.addEventListener("error", (evento) => {
    relatarErro("erro de programa", evento.error ?? evento.message, { noConsole: false });
  });
  window.addEventListener("unhandledrejection", (evento) => {
    relatarErro("promessa sem tratamento", evento.reason, { noConsole: false });
  });
} catch {
  // Relatar erro nunca pode ser o que impede o app de abrir.
}
