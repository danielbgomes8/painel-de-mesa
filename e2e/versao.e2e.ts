import { expect, test } from "@playwright/test";
import { SALA, bancoConfigurado, coletarErros, entrarComoMestre, limparSala } from "./apoio";

/**
 * Aviso de versão nova. No `next dev` o app não tem versão publicada, então o robô liga a
 * checagem (`__versaoDeTeste`) e responde a `/versao` com uma versão diferente. Mesma sala
 * `ci-teste`, limpa antes e depois (o app abre a sala e cria o que precisa).
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });
test.beforeAll(limparSala);
test.afterAll(limparSala);

test("versão nova: o celular mostra o aviso, só quem toca recarrega; sem versão nova, nada aparece", async ({ browser }) => {
  test.setTimeout(60_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const erros = coletarErros(page);
  let versao: string | null = null; // o que o servidor "diz"
  await page.route("**/versao", (rota) => rota.fulfill({ json: { versao }, headers: { "cache-control": "no-store" } }));
  await page.addInitScript(() => ((window as unknown as { __versaoDeTeste: boolean }).__versaoDeTeste = true));
  await entrarComoMestre(page);
  await expect(page.getByRole("button", { name: "Campanha", exact: true })).toBeVisible();

  // Servidor sem versão (ou resposta estranha): nunca avisa.
  await page.waitForTimeout(6000);
  await expect(page.locator(".versaobanner")).toHaveCount(0);

  // Saiu versão nova: ao voltar pro app, o aviso aparece (a checagem roda quando a aba fica visível).
  versao = "abc1234";
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.locator(".versaobanner")).toContainText("Tem versão nova do painel");

  // Não recarrega sozinho: só quando a pessoa toca.
  let recargas = 0;
  page.on("load", () => recargas++);
  await page.waitForTimeout(1500);
  expect(recargas).toBe(0);
  await page.getByRole("button", { name: "atualizar" }).click();
  await expect.poll(() => recargas).toBe(1);
  await ctx.close();
  expect(erros).toEqual([]);
});

test("versão nova no telão: recarrega sozinho, uma vez só", async ({ browser }) => {
  test.setTimeout(60_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const tv = await ctx.newPage();
  await tv.route("**/versao", (rota) => rota.fulfill({ json: { versao: "abc1234" }, headers: { "cache-control": "no-store" } }));
  await tv.addInitScript(() => ((window as unknown as { __versaoDeTeste: boolean }).__versaoDeTeste = true));
  let cargas = 0;
  tv.on("load", () => cargas++);
  await tv.goto(`/?sala=${SALA}&telao=1`);
  await expect(tv.locator(".telao")).toBeVisible();
  // Depois de ~4 s a checagem acha a versão "nova" e recarrega; na página nova ela acha de novo
  // mas não recarrega outra vez (senão ficaria em loop).
  await expect.poll(() => cargas, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  await tv.waitForTimeout(9000);
  expect(cargas).toBe(2);
  await expect(tv.locator(".telao")).toBeVisible();
  await ctx.close();
});
