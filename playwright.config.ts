import { defineConfig } from "@playwright/test";

/**
 * Robô que abre o app de verdade num navegador e usa — o que os testes de
 * `src/lib/` (só regras puras) não alcançam: CSP, tela, tempo real, banco.
 * Roda numa sala de teste fixa (`ci-teste`) que ele mesmo limpa antes e depois.
 *
 *   Local:  npm run e2e            (sobe o `next dev` na porta 3100)
 *           E2E_URL=http://localhost:3000 npm run e2e   (usa um servidor já rodando)
 *   CI:     .github/workflows/e2e.yml (build de produção + este mesmo comando)
 *
 * Usa o Google Chrome já instalado (`channel: "chrome"`): nenhum navegador é
 * baixado. Os arquivos de teste são `e2e/*.e2e.ts` (e não `.test.ts`, que é do
 * Vitest) pra os dois não pisarem um no outro.
 */
const PORTA = 3100;
const usarServidorDeFora = Boolean(process.env.E2E_URL);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: process.env.E2E_URL ?? `http://localhost:${PORTA}`,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: usarServidorDeFora
    ? undefined
    : {
        command: process.env.CI ? `npm run start -- -p ${PORTA}` : `npm run dev -- -p ${PORTA}`,
        url: `http://localhost:${PORTA}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
