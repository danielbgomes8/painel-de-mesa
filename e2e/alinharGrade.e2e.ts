import { expect, test } from "@playwright/test";
import { bancoConfigurado, abrirFerramenta, cenaDoBanco, coletarErros, entrarComoMestre, fecharPainelDoMapa, limparSala, pngDeTeste } from "./apoio";

/**
 * Alinhar a grade arrastando: com "arrastar a grade" ligado um dedo anda a grade por cima do mapa e, ao soltar,
 * grava onde ela começa (volta pro intervalo de um quadradinho); desligado, arrastar anda o mapa e não mexe na
 * grade. Os botões de ± pixel mudam o lado do quadradinho. Mesma sala `ci-teste`, limpa antes e depois.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

test("alinhar a grade: arrastar anda a grade, desligado não mexe, e o lado muda em passos finos", async ({ page }) => {
  test.setTimeout(120_000);
  const erros = coletarErros(page);
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page.locator('section[aria-label="Mapa"] input[type=file]').setInputFiles({ name: "grade.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });

  const antes = await cenaDoBanco();
  expect(antes.grade_ligada).toBe(true);
  const lado = Number(antes.grade_px);

  await abrirFerramenta(page, "Cena e grade", "preparar");

  // Desligado (padrão): arrastar anda o mapa, a grade não muda.
  const canvas = page.locator(".cena-canvas");
  const caixa = (await canvas.boundingBox())!;
  const cx = caixa.x + caixa.width / 2;
  const cy = caixa.y + caixa.height / 2;
  await fecharPainelDoMapa(page);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 30, cy + 20, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  expect(Number((await cenaDoBanco()).grade_dx)).toBe(Number(antes.grade_dx));

  // Ligado: o arrasto vira deslocamento da grade, em px da imagem (a vista abre com o mapa inteiro e 3% de folga).
  await abrirFerramenta(page, "Cena e grade", "preparar");
  await page.getByRole("button", { name: "✋ arrastar a grade" }).click();
  await expect(page.getByRole("button", { name: "✋ arrastar a grade" })).toHaveAttribute("aria-pressed", "true");
  await fecharPainelDoMapa(page);
  const caixa2 = (await canvas.boundingBox())!;
  const escala = Math.min(caixa2.width / (900 * 1.06), caixa2.height / (600 * 1.06));
  const x0 = caixa2.x + caixa2.width / 2;
  const y0 = caixa2.y + caixa2.height / 2;
  const dxTela = 20;
  const dyTela = 12;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + dxTela, y0 + dyTela, { steps: 8 });
  await page.mouse.up();
  const volta = (v: number) => ((v % lado) + lado) % lado;
  await expect
    .poll(async () => Number((await cenaDoBanco()).grade_dx), { timeout: 15_000 })
    .toBeGreaterThan(Number(antes.grade_dx) + 1);
  const depois = await cenaDoBanco();
  expect(Number(depois.grade_dx)).toBeCloseTo(volta(Number(antes.grade_dx) + dxTela / escala), 0);
  expect(Number(depois.grade_dy)).toBeCloseTo(volta(Number(antes.grade_dy) + dyTela / escala), 0);
  expect(Number(depois.grade_dx)).toBeLessThan(lado);
  expect(Number(depois.grade_dy)).toBeLessThan(lado);

  // Passos finos do lado do quadradinho.
  await abrirFerramenta(page, "Cena e grade", "preparar");
  await page.getByRole("button", { name: "aumentar o quadradinho em 0.1 pixel" }).click();
  await expect.poll(async () => Number((await cenaDoBanco()).grade_px)).toBeCloseTo(lado + 0.1, 2);
  await page.getByRole("button", { name: "diminuir o quadradinho em 1 pixel" }).click();
  await expect.poll(async () => Number((await cenaDoBanco()).grade_px)).toBeCloseTo(lado - 0.9, 2);
  expect(erros).toEqual([]);
});
