import { expect, test } from "@playwright/test";
import {
  abrirFerramenta,
  bancoConfigurado,
  cenaDoBanco,
  coletarErros,
  criarParedes,
  entrarComoMestre,
  limparSala,
  paredesDoBanco,
  pngDeTeste,
} from "./apoio";

/**
 * Duas paredes na mesma linha com um quadradinho de abertura: o botão "marcar vãos como portas" cria uma porta
 * ABERTA no vão numa escrita só, e "↩ desfazer parede" tira a porta.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.beforeAll(limparSala);
test.afterAll(limparSala);

test("vão entre paredes vira porta aberta, e desfazer tira", async ({ page }) => {
  const erros = coletarErros(page);
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-vaos.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });

  const cena = await cenaDoBanco();
  const g = cena.grade_px;
  // Parede horizontal com um quadradinho de abertura no meio.
  await criarParedes(cena.id, [
    { tipo: "parede", x1: 150, y1: 300, x2: 390, y2: 300 },
    { tipo: "parede", x1: 390 + g, y1: 300, x2: 630, y2: 300 },
  ]);

  await abrirFerramenta(page, "Paredes e portas", "preparar");
  const botao = page.getByRole("button", { name: /marcar 1 vão como porta/ });
  await expect(botao).toBeVisible({ timeout: 30_000 });
  await botao.click();

  await expect.poll(async () => (await paredesDoBanco()).filter((p) => p.tipo === "porta").length).toBe(1);
  const porta = (await paredesDoBanco()).find((p) => p.tipo === "porta")!;
  expect(porta.aberta).toBe(true);
  expect([porta.x1, porta.x2].sort((a, b) => a - b)).toEqual([390, 390 + g]);
  // Com a porta no vão, o botão some (não marca duas vezes).
  await expect(page.getByRole("button", { name: /marcar .* como porta/ })).toHaveCount(0);

  await page.getByRole("button", { name: "↩ desfazer parede" }).click();
  await expect.poll(async () => (await paredesDoBanco()).filter((p) => p.tipo === "porta").length).toBe(0);
  expect(erros).toEqual([]);
});
