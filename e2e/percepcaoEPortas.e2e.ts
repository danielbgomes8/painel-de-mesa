import { expect, test, type Page } from "@playwright/test";
import {
  SALA,
  abrirFerramenta,
  bancoConfigurado,
  cenaDoBanco,
  coletarErros,
  criarFicha,
  criarPeca,
  entrarComoMestre,
  escolherNoPainel,
  fecharPainelDoMapa,
  limparSala,
  pecasDoBanco,
  pngDeTeste,
  rest,
} from "./apoio";

/**
 * Percepção passiva nas armadilhas e portas trancadas ou secretas (migration 0038). Mesma sala `ci-teste`, limpa antes e
 * depois. O mapa de teste tem 900×600 px e quadradinho de 30 px = 1,5 m (4,5 m = 90 px).
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

async function tocarNoMapa(page: Page, ix: number, iy: number) {
  const canvas = page.locator(".cena-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const caixa = (await canvas.boundingBox())!;
  const escala = Math.min(caixa.width / (900 * 1.06), caixa.height / (600 * 1.06));
  await page.mouse.click(caixa.x + caixa.width / 2 + (ix - 450) * escala, caixa.y + caixa.height / 2 + (iy - 300) * escala);
}

async function prepararMapa(page: Page) {
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-percepcao.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "levar a mesa pra este mapa" }).click();
  await expect(page.locator(".palco-nome").getByText("Na mesa")).toBeVisible();
}

async function linhasDoLog(): Promise<string[]> {
  const r = await rest(`combat_log?select=text&room_code=eq.${SALA}&order=created_at`);
  return ((await r.json()) as { text: string }[]).map((l) => l.text);
}
type LinhaPorta = { id: string; tipo: string; aberta: boolean; trancada: boolean; secreta: boolean; cd: number | null; cd_achar: number | null };
async function portasDoBanco(): Promise<LinhaPorta[]> {
  const r = await rest(`cena_paredes?select=id,tipo,aberta,trancada,secreta,cd,cd_achar&room_code=eq.${SALA}&tipo=eq.porta&order=created_at`);
  if (!r.ok) throw new Error(`não leu as portas: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) as LinhaPorta[];
}
type LinhaArmadilha = { id: string; estado: string; cd_achar: number | null };
async function armadilhasDoBanco(): Promise<LinhaArmadilha[]> {
  const r = await rest(`cena_armadilhas?select=id,estado,cd_achar&room_code=eq.${SALA}&order=created_at`);
  if (!r.ok) throw new Error(`não leu as armadilhas: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) as LinhaArmadilha[];
}
const moverPeca = (id: string, x: number, y: number) => rest(`cena_pecas?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ x, y }) });

test("percepção passiva: quem tem PP >= CD e chega perto de uma armadilha escondida avisa só o Mestre, que revela à mesa", async ({ page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await prepararMapa(page);
  const cena = await cenaDoBanco();
  await criarFicha("atenta-robo", "Atenta Robô", { hp: 20, hp_max: 20, pp: 15 });
  await criarFicha("distraida-robo", "Distraída Robô", { hp: 20, hp_max: 20, pp: 10 });
  await criarPeca(cena.id, "atenta-robo", 45, 45);
  await criarPeca(cena.id, "distraida-robo", 75, 45);
  const r = await rest("cena_armadilhas", {
    method: "POST",
    body: JSON.stringify({ cena_id: cena.id, room_code: SALA, nome: "Poço escondido", x: 405, y: 285, raio: 0.75, salvaguarda: "DES", cd: 12, dano: "2d6", estado: "armada", cd_achar: 13 }),
  });
  expect(r.ok).toBe(true);
  expect((await armadilhasDoBanco())[0].cd_achar).toBe(13);

  await page.getByRole("button", { name: "Combate", exact: true }).click();
  await page.waitForTimeout(2500); // o vigia aprende onde cada um está
  const pecas = await pecasDoBanco();
  const atenta = pecas.find((p) => p.slug === "atenta-robo")!;
  const distraida = pecas.find((p) => p.slug === "distraida-robo")!;

  // A Distraída (PP 10 < CD 13) chega perto: nada. A Atenta (PP 15) chega à mesma distância: o Mestre é avisado.
  expect((await moverPeca(distraida.id, 405 + 60, 285)).ok).toBe(true);
  await page.waitForTimeout(2500);
  await expect(page.locator(".arm-aviso")).toHaveCount(0);
  expect((await moverPeca(atenta.id, 405, 285 + 60)).ok).toBe(true);
  const aviso = page.locator(".arm-aviso");
  await expect(aviso).toBeVisible({ timeout: 30_000 });
  await expect(aviso).toContainText("Atenta Robô repara em Poço escondido");
  await expect(aviso).toContainText("Percepção passiva 15 (CD 13)");
  expect((await armadilhasDoBanco())[0].estado).toBe("armada"); // o app nunca revela sozinho

  // Revelar à mesa: o estado muda, o log conta (sem a CD) e o aviso some.
  await aviso.getByRole("button", { name: "revelar à mesa" }).click();
  await expect.poll(async () => (await armadilhasDoBanco())[0].estado).toBe("revelada");
  await expect(aviso).toHaveCount(0);
  await expect.poll(async () => (await linhasDoLog()).some((t) => t.includes('Atenta Robô percebe "Poço escondido"'))).toBe(true);
  expect((await linhasDoLog()).some((t) => t.includes("13"))).toBe(false);
  expect(erros).toEqual([]);
});

test("porta secreta: a Percepção passiva avisa o Mestre, que abre a porta; e a armadilha da UI guarda a CD de achar", async ({ page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await prepararMapa(page);
  const cena = await cenaDoBanco();
  await criarFicha("atenta-robo", "Atenta Robô", { hp: 20, hp_max: 20, pp: 16 });
  await criarPeca(cena.id, "atenta-robo", 45, 45);
  const r = await rest("cena_paredes", {
    method: "POST",
    body: JSON.stringify({ cena_id: cena.id, room_code: SALA, tipo: "porta", x1: 600, y1: 300, x2: 600, y2: 360, aberta: false, secreta: true, cd_achar: 15 }),
  });
  expect(r.ok).toBe(true);
  await page.getByRole("button", { name: "Combate", exact: true }).click();
  await page.waitForTimeout(2500);
  const peca = (await pecasDoBanco())[0];
  expect((await moverPeca(peca.id, 600 - 60, 330)).ok).toBe(true);
  const aviso = page.locator(".arm-aviso");
  await expect(aviso).toBeVisible({ timeout: 30_000 });
  await expect(aviso).toContainText("Atenta Robô repara em uma porta secreta");
  await expect(aviso).toContainText("Percepção passiva 16 (CD 15)");
  await aviso.getByRole("button", { name: "abrir a porta" }).click();
  await expect.poll(async () => (await portasDoBanco())[0].aberta).toBe(true);
  expect((await portasDoBanco())[0].secreta).toBe(false);
  await expect(aviso).toHaveCount(0);
  await expect.poll(async () => (await linhasDoLog()).some((t) => t.includes("Atenta Robô percebe uma porta secreta"))).toBe(true);

  // Pela tela: a CD de achar de uma armadilha nova vai pro banco.
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await abrirFerramenta(page, "Armadilhas");
  await page.getByRole("button", { name: "Poço escondido", exact: true }).click();
  await page.getByLabel("CD pra achar pela Percepção passiva").fill("14");
  await page.getByRole("button", { name: "📍 colocar no mapa" }).click();
  await fecharPainelDoMapa(page);
  await tocarNoMapa(page, 405, 285);
  await expect.poll(async () => (await armadilhasDoBanco()).length).toBe(1);
  expect((await armadilhasDoBanco())[0].cd_achar).toBe(14);
  expect(erros).toEqual([]);
});

test("porta trancada: o Mestre marca pelas propriedades, vê o cadeado e a CD, e só abre destrancando", async ({ page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await prepararMapa(page);
  const cena = await cenaDoBanco();
  const r = await rest("cena_paredes", {
    method: "POST",
    body: JSON.stringify({ cena_id: cena.id, room_code: SALA, tipo: "porta", x1: 270, y1: 300, x2: 330, y2: 300, aberta: false }),
  });
  expect(r.ok).toBe(true);

  // Propriedades: toca na porta, marca "trancada" e dá a CD.
  await escolherNoPainel(page, "Paredes e portas", /O que desenhar/, "🔒 trancas", "preparar");
  await tocarNoMapa(page, 300, 300);
  const editor = page.getByRole("group", { name: "Propriedades da porta" });
  await expect(editor).toBeVisible();
  await editor.getByRole("checkbox", { name: /trancada/ }).check();
  await expect.poll(async () => (await portasDoBanco())[0].trancada).toBe(true);
  await editor.getByLabel("CD pra destrancar").fill("14");
  await editor.getByLabel("CD pra destrancar").blur();
  await expect.poll(async () => (await portasDoBanco())[0].cd).toBe(14);
  await editor.getByRole("checkbox", { name: /secreta/ }).check();
  await expect.poll(async () => (await portasDoBanco())[0].secreta).toBe(true);
  await editor.getByRole("checkbox", { name: /secreta/ }).uncheck();
  await expect.poll(async () => (await portasDoBanco())[0].secreta).toBe(false);
  await editor.getByRole("button", { name: "pronto" }).click();
  await expect(editor).toHaveCount(0);

  // Mover: tocar na porta trancada não abre, mostra a CD.
  await abrirFerramenta(page, "Mover");
  await fecharPainelDoMapa(page);
  await tocarNoMapa(page, 300, 300);
  const aviso = page.locator(".arm-aviso").filter({ hasText: "Porta trancada" });
  await expect(aviso).toBeVisible({ timeout: 15_000 });
  await expect(aviso).toContainText("CD 14");
  expect((await portasDoBanco())[0].aberta).toBe(false);
  // Deixar trancada fecha o aviso e não muda nada.
  await aviso.getByRole("button", { name: "deixar trancada" }).click();
  await expect(aviso).toHaveCount(0);
  expect((await portasDoBanco())[0]).toMatchObject({ trancada: true, aberta: false });

  // Destrancar e abrir: tira o cadeado, abre e o log conta.
  await tocarNoMapa(page, 300, 300);
  await expect(aviso).toBeVisible({ timeout: 15_000 });
  await aviso.getByRole("button", { name: "destrancar e abrir" }).click();
  await expect.poll(async () => (await portasDoBanco())[0].aberta).toBe(true);
  expect((await portasDoBanco())[0].trancada).toBe(false);
  await expect.poll(async () => (await linhasDoLog()).some((t) => t.includes("destrancada e aberta"))).toBe(true);

  // Destrancada, abre e fecha com um toque como sempre.
  await tocarNoMapa(page, 300, 300);
  await expect.poll(async () => (await portasDoBanco())[0].aberta).toBe(false);
  expect(erros).toEqual([]);
});
