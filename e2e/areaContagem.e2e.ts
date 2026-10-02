import { expect, test, type Page } from "@playwright/test";
import {
  SALA,
  bancoConfigurado,
  cenaDoBanco,
  coletarErros,
  comoJogador,
  criarFicha,
  criarPeca,
  entrarComoMestre,
  limparSala,
  mudarCena,
  pngDeTeste,
} from "./apoio";

/**
 * Modelo de magia diz quantas criaturas pega — mas só conta quem a MESA enxerga.
 * Peão oculto dentro da área não entra no número de ninguém; só o Mestre vê, à parte,
 * "(+1 oculto)". Mesma sala `ci-teste`, limpa antes e depois.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

/** O canvas não tem DOM: o robô escuta o que é DESENHADO nele. */
const espiar = () => {
  const w = window as unknown as { __textos: string[] };
  w.__textos = [];
  const original = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof original>) {
    w.__textos.push(String(args[0]));
    return original.apply(this, args);
  };
};
const textosDe = (p: Page) => p.evaluate(() => (window as unknown as { __textos: string[] }).__textos);

/** Toca (sem arrastar) num ponto da imagem de 900×600; a vista abre com o mapa inteiro e 3% de folga. */
async function tocar(page: Page, ix: number, iy: number) {
  const canvas = page.locator(".cena-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const c = (await canvas.boundingBox())!;
  const escala = Math.min(c.width / (900 * 1.06), c.height / (600 * 1.06));
  await page.mouse.click(c.x + c.width / 2 + (ix - 450) * escala, c.y + c.height / 2 + (iy - 300) * escala);
}

test("área: conta quem a mesa vê; o oculto só aparece pro Mestre, à parte", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await page.addInitScript(espiar);
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-contagem.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  const cena = await cenaDoBanco(); // quadradinho de 30 px = 1,5 m
  // Sem névoa por cima: o que se confere aqui é a contagem, não a névoa.
  await mudarCena(cena.id, { nevoa_ligada: false });
  await page.getByRole("button", { name: "levar a mesa pra este mapa" }).click();
  await expect(page.getByText("A mesa está vendo este mapa")).toBeVisible();

  await criarFicha("jogador-robo", "Jogador Robô");
  // Dentro da esfera de 6 m (120 px) centrada em (180, 180): dois à vista e um OCULTO. Um longe.
  await criarPeca(cena.id, "", 165, 165, { slug: null, nome: "Visível A" });
  await criarPeca(cena.id, "", 225, 165, { slug: null, nome: "Visível B" });
  await criarPeca(cena.id, "", 195, 225, { slug: null, nome: "Oculto C", oculto: true });
  await criarPeca(cena.id, "", 705, 465, { slug: null, nome: "Longe D" });

  const contexto = await browser.newContext();
  const jogador = await contexto.newPage();
  const errosJogador = coletarErros(jogador);
  await jogador.addInitScript(espiar);
  await comoJogador(jogador, "jogador-robo");
  await jogador.goto(`/?sala=${SALA}`);
  await jogador.getByRole("button", { name: "ver o mapa" }).click();
  await expect(jogador.locator(".cena-canvas")).toBeVisible();
  await expect(jogador.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  // Os peões chegam do banco um instante depois do mapa: espera aparecerem no desenho do Mestre.
  await page.getByRole("button", { name: /área/ }).click();
  await expect(page.getByText("Esfera: raio de 6 m (4 quadrados).")).toBeVisible();

  // Esfera no cruzamento (180, 180): pega A, B e C — C está oculto.
  await expect(async () => {
    await tocar(page, 180, 180);
    await expect.poll(async () => (await textosDe(page)).some((t) => t.includes("criaturas")), { timeout: 2500 }).toBe(true);
  }).toPass({ timeout: 30_000 });
  const doMestre = (await textosDe(page)).filter((t) => /criatura|ninguém/.test(t));
  expect(doMestre).toContain("2 criaturas (+1 oculto)");

  // A mesa: o mesmo desenho, mas o número é só o dos que ela vê. Nunca um "+" nem a palavra "oculto".
  await expect.poll(async () => (await textosDe(jogador)).includes("2 criaturas"), { timeout: 30_000 }).toBe(true);
  const dosJogador = await textosDe(jogador);
  expect(dosJogador.filter((t) => /oculto|\+\d/.test(t))).toEqual([]);

  // Área sem ninguém dentro: "ninguém" (e o Mestre não ganha um "+" à toa, pois não há oculto lá).
  await page.waitForTimeout(900);
  await expect(async () => {
    await tocar(page, 780, 90);
    await expect.poll(async () => (await textosDe(page)).includes("ninguém"), { timeout: 2500 }).toBe(true);
  }).toPass({ timeout: 30_000 });

  await contexto.close();
  expect(erros).toEqual([]);
  expect(errosJogador).toEqual([]);
});
