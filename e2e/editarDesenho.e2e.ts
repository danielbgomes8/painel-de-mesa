import { expect, test } from "@playwright/test";
import { SALA, bancoConfigurado, cenaDoBanco, coletarErros, entrarComoMestre, limparSala, marcasDoBanco, mudarCena, pngDeTeste, rest } from "./apoio";

/**
 * Editar um desenho que já existe (modo "✋ editar" da ferramenta de desenhar): tocar seleciona,
 * arrastar move, o quadradinho do canto redimensiona, a bolinha de cima gira, e cor, "só eu vejo"
 * e apagar mudam nos botões. Cada gesto grava só os pontos (ou a coluna) que mudou.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.beforeAll(limparSala);
test.afterAll(limparSala);

test("editar desenho: mover, redimensionar, girar, cor, só eu vejo e apagar", async ({ page }) => {
  const erros = coletarErros(page);
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-editar.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  const cena = await cenaDoBanco();
  await mudarCena(cena.id, { nevoa_ligada: false });

  // Um retângulo 100×100 gravado direto no banco (chega ao Mestre pelo tempo real).
  const quadrado = [[300, 200], [400, 200], [400, 300], [300, 300], [300, 200]];
  const r = await rest("cena_marcas", {
    method: "POST",
    body: JSON.stringify({ cena_id: cena.id, room_code: SALA, tipo: "traco", cor: "#f0c24b", pontos: quadrado, visivel: true }),
  });
  expect(r.ok).toBe(true);

  const canvas = page.locator(".cena-canvas");
  const tela = async () => {
    await canvas.scrollIntoViewIfNeeded();
    const c = (await canvas.boundingBox())!;
    const escala = Math.min(c.width / (900 * 1.06), c.height / (600 * 1.06));
    return { escala, p: (ix: number, iy: number) => ({ x: c.x + c.width / 2 + (ix - 450) * escala, y: c.y + c.height / 2 + (iy - 300) * escala }) };
  };
  const arrastar = async (de: [number, number], para: [number, number]) => {
    const { p } = await tela();
    const a = p(...de);
    const b = p(...para);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
  };
  const pontos = async () => (await marcasDoBanco())[0].pontos;
  const caixa = (ps: [number, number][]) => ({
    x1: Math.min(...ps.map((q) => q[0])),
    x2: Math.max(...ps.map((q) => q[0])),
    y1: Math.min(...ps.map((q) => q[1])),
    y2: Math.max(...ps.map((q) => q[1])),
  });

  await expect.poll(async () => (await marcasDoBanco()).length).toBe(1);
  await page.getByRole("button", { name: "✏️ desenhar" }).click();
  await page.getByRole("group", { name: "O que marcar" }).getByRole("button", { name: "✋ editar" }).click();
  // Posição na PÁGINA (a rolagem muda a da janela): o painel de edição não pode mudá-la.
  const alturaDoCanvas = () => canvas.evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY));
  const topoAntes = await alturaDoCanvas();

  // Tocar no vazio não seleciona nada; tocar na borda seleciona (e abre os botões).
  await arrastar([700, 500], [700, 500]);
  await expect(page.getByRole("group", { name: "Editar o desenho selecionado" })).toHaveCount(0);
  await arrastar([350, 200], [350, 200]);
  await expect(page.getByRole("group", { name: "Editar o desenho selecionado" })).toBeVisible();
  expect(await pontos()).toEqual(quadrado); // só tocar não grava nada
  expect(await alturaDoCanvas()).toBe(topoAntes); // e o painel de edição não empurra o mapa (o desenho pularia debaixo do dedo)

  // Mover: arrasta a borda 100 px pra direita e pra baixo.
  await arrastar([350, 200], [450, 300]);
  // (o mouse tem pixels inteiros na tela: o mapa pode errar por um ou dois pixels)
  await expect.poll(async () => Math.round((await pontos())[0][0] / 3)).toBe(Math.round(400 / 3));
  const movido = caixa(await pontos());
  expect(Math.abs(movido.x1 - 400)).toBeLessThan(3);
  expect(Math.abs(movido.y1 - 300)).toBeLessThan(3);
  expect(Math.round(movido.x2 - movido.x1)).toBe(100); // mover não muda o tamanho

  // Cor e "só eu vejo" gravam só a coluna pedida.
  await page.getByRole("button", { name: "Mudar a cor do desenho para #e0504f" }).click();
  await expect.poll(async () => (await marcasDoBanco())[0].cor).toBe("#e0504f");
  await page.getByRole("button", { name: "👁 a mesa vê" }).click();
  await expect.poll(async () => (await marcasDoBanco())[0].visivel).toBe(false);
  expect(caixa(await pontos())).toEqual(movido); // e não mexeram nos pontos

  // Redimensionar: o quadradinho do canto (500, 400) vai pra longe do centro (450, 350) e o lado triplica.
  await arrastar([500, 400], [600, 500]);
  await expect.poll(async () => { const c = caixa(await pontos()); return Math.round((c.x2 - c.x1) / 10); }).toBe(30);
  const grande = caixa(await pontos());
  expect(Math.abs((grande.x1 + grande.x2) / 2 - 450)).toBeLessThan(4); // o centro não saiu do lugar
  expect(Math.abs((grande.y1 + grande.y2) / 2 - 350)).toBeLessThan(4);

  // Girar 90°: a bolinha fica acima do topo da caixa; arrastar pra direita do centro dá um quarto de volta.
  const antes = (await pontos())[0];
  const { escala } = await tela();
  await arrastar([(grande.x1 + grande.x2) / 2, grande.y1 - 30 / escala], [750, (grande.y1 + grande.y2) / 2]);
  await expect.poll(async () => (await pontos())[0][0]).not.toBe(antes[0]);
  const girado = (await pontos())[0];
  // O canto de cima à esquerda (300, 200) passa, num quarto de volta no sentido horário, pro de cima à direita (600, 200).
  expect(Math.abs(girado[0] - (grande.x2)) ).toBeLessThan(6);
  expect(Math.abs(girado[1] - grande.y1)).toBeLessThan(6);

  // Apagar pelo botão fecha o painel.
  await page.getByRole("button", { name: "apagar desenho" }).click();
  await expect.poll(async () => (await marcasDoBanco()).length).toBe(0);
  await expect(page.getByRole("group", { name: "Editar o desenho selecionado" })).toHaveCount(0);
  expect(erros).toEqual([]);
});
