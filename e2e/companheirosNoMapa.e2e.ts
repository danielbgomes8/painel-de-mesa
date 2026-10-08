import { expect, test, type Page } from "@playwright/test";
import {
  abrirFerramenta,
  fecharPainelDoMapa,
  SALA,
  bancoConfigurado,
  cenaDoBanco,
  coletarErros,
  criarFicha,
  criarParedes,
  criarPeca,
  entrarComoMestre,
  limparSala,
  pecasDoBanco,
  pngDeTeste,
  porNaIniciativa,
} from "./apoio";

/**
 * Companheiro (familiar, montaria): anda junto com o dono no mapa, a não ser que a mesa desligue o botão, e o telão
 * diz de quem é a vez dele ("de Ana").
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.beforeAll(limparSala);
test.afterAll(limparSala);

/** Toca e solta num ponto da imagem (sem arrastar). */
async function tocar(page: Page, [ix, iy]: [number, number]) {
  const canvas = page.locator(".cena-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const c = (await canvas.boundingBox())!;
  const escala = Math.min(c.width / (900 * 1.06), c.height / (600 * 1.06));
  await page.mouse.click(c.x + c.width / 2 + (ix - 450) * escala, c.y + c.height / 2 + (iy - 300) * escala);
}

async function arrastar(page: Page, de: [number, number], para: [number, number]) {
  const canvas = page.locator(".cena-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const c = (await canvas.boundingBox())!;
  const escala = Math.min(c.width / (900 * 1.06), c.height / (600 * 1.06));
  const naTela = ([ix, iy]: [number, number]) => ({ x: c.x + c.width / 2 + (ix - 450) * escala, y: c.y + c.height / 2 + (iy - 300) * escala });
  const a = naTela(de);
  const b = naTela(para);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
}

const lugar = async (slug: string) => {
  const p = (await pecasDoBanco()).find((x) => x.slug === slug)!;
  return [p.x, p.y];
};

test("o companheiro anda junto com o dono; desligado, fica; o telão diz de quem é a vez", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await criarFicha("ana-robo", "Ana Robô");
  await criarFicha("pip-robo", "Pip Robô", { is_npc: true, revealed: true, dono: "ana-robo", cls: "Companheiro" });
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-companheiro.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "levar a mesa pra este mapa" }).click();
  await expect(page.locator(".palco-nome").getByText("Na mesa")).toBeVisible();

  const cena = await cenaDoBanco();
  await criarPeca(cena.id, "ana-robo", 255, 315);
  await criarPeca(cena.id, "pip-robo", 315, 315);
  await fecharPainelDoMapa(page);
  // Os peões chegam à tela do Mestre pelo tempo real, um instante depois do banco: toca até o cartão abrir.
  await expect(async () => {
    await tocar(page, [255, 315]);
    await expect(page.locator(".mapa-cartao")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await expect(async () => {
    await arrastar(page, [255, 315], [375, 315]);
    await expect.poll(async () => (await lugar("ana-robo"))[0], { timeout: 2500 }).toBe(375);
  }).toPass({ timeout: 30_000 });
  // O mesmo tanto (120 px): 315 → 435.
  await expect.poll(() => lugar("pip-robo")).toEqual([435, 315]);

  // Botão desligado: a Ana anda e o Pip fica onde estava.
  await abrirFerramenta(page, "Mover");
  const botao = page.getByRole("button", { name: "🐾 companheiros junto" });
  await expect(botao).toHaveAttribute("aria-pressed", "true");
  await botao.click();
  await expect(botao).toHaveAttribute("aria-pressed", "false");
  await fecharPainelDoMapa(page);
  await arrastar(page, [375, 315], [255, 315]);
  await expect.poll(async () => (await lugar("ana-robo"))[0]).toBe(255);
  expect(await lugar("pip-robo")).toEqual([435, 315]);

  // Telão: na vez do companheiro aparece de quem ele é.
  await porNaIniciativa([
    { slug: "ana-robo", name: "Ana Robô", init: 15 },
    { slug: "pip-robo", name: "Pip Robô", init: 15 },
  ]);
  const contexto = await browser.newContext();
  const telao = await contexto.newPage();
  const errosTelao = coletarErros(telao);
  await telao.goto(`/?sala=${SALA}&telao=1`);
  await expect(telao.locator(".telao--mapa .cena-canvas")).toBeVisible();
  await expect(telao.getByText("de Ana Robô")).toHaveCount(0);
  await rest_proximoTurno();
  await expect(telao.getByText("🐾 de Ana Robô")).toBeVisible({ timeout: 15_000 });

  await contexto.close();
  expect(erros).toEqual([]);
  expect(errosTelao).toEqual([]);
});

async function rest_proximoTurno() {
  const { rest } = await import("./apoio");
  const r = await rest(`combat_state?room_code=eq.${SALA}`, { method: "PATCH", body: JSON.stringify({ turn: 1 }) });
  if (!r.ok) throw new Error(`não passou o turno: HTTP ${r.status}`);
}

test("o companheiro não atravessa parede atrás do dono (nem o Mestre passando o dono por cima dela)", async ({ page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await criarFicha("ana-robo", "Ana Robô");
  await criarFicha("pip-robo", "Pip Robô", { is_npc: true, revealed: true, dono: "ana-robo", cls: "Companheiro" });
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-companheiro-parede.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "levar a mesa pra este mapa" }).click();
  await expect(page.locator(".palco-nome").getByText("Na mesa")).toBeVisible();

  const cena = await cenaDoBanco();
  // Parede vertical de cima a baixo em x = 345, entre os dois peões e o destino.
  await criarParedes(cena.id, [{ tipo: "parede", x1: 345, y1: 0, x2: 345, y2: 600 }]);
  await criarPeca(cena.id, "ana-robo", 255, 315);
  await criarPeca(cena.id, "pip-robo", 315, 315);
  await expect(async () => {
    await tocar(page, [255, 315]);
    await expect(page.locator(".mapa-cartao")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });

  // O Mestre leva a Ana pro outro lado da parede (ele passa); o Pip encosta nela e fica.
  await arrastar(page, [255, 315], [435, 315]);
  await expect.poll(async () => (await lugar("ana-robo"))[0]).toBe(435);
  // Dá tempo de a escrita do companheiro, se houvesse, chegar ao banco antes de conferir que ela não veio.
  await page.waitForTimeout(2000);
  expect((await lugar("pip-robo"))[0]).toBeLessThan(345);
  expect(erros).toEqual([]);
});
