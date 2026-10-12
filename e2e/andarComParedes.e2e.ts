import { expect, test, type Page } from "@playwright/test";
import {
  abrirFerramenta,
  escolherNoPainel,
  fecharPainelDoMapa,
  SALA,
  bancoConfigurado,
  cenaDoBanco,
  coletarErros,
  comoJogador,
  criarFicha,
  criarParedes,
  criarPeca,
  entrarComoMestre,
  limparSala,
  mudarParede,
  paredesDoBanco,
  pecasDoBanco,
  pngDeTeste,
} from "./apoio";

/**
 * O jogador não atravessa parede nem porta fechada arrastando o próprio peão
 * (era o jeito de abrir a névoa de qualquer sala: com a visão automática, onde
 * o peão está, a névoa abre). Porta aberta deixa passar; o Mestre passa sempre.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.beforeAll(limparSala);
test.afterAll(limparSala);

/** Arrasta de um ponto a outro da imagem de 900×600 (vista = mapa inteiro com 3% de folga). */
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

/** Toca e solta num ponto da imagem (sem arrastar). */
async function tocar(page: Page, [ix, iy]: [number, number]) {
  const canvas = page.locator(".cena-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const c = (await canvas.boundingBox())!;
  const escala = Math.min(c.width / (900 * 1.06), c.height / (600 * 1.06));
  await page.mouse.click(c.x + c.width / 2 + (ix - 450) * escala, c.y + c.height / 2 + (iy - 300) * escala);
}

const peaoDoJogador = async () => {
  const p = (await pecasDoBanco()).find((x) => x.slug === "jogador-robo")!;
  return [p.x, p.y];
};

test("o jogador não atravessa parede nem porta fechada; porta aberta passa, e o Mestre passa sempre", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await criarFicha("jogador-robo", "Jogador Robô");
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-andar.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "levar a mesa pra este mapa" }).click();
  await expect(page.locator(".palco-nome").getByText("Na mesa")).toBeVisible();

  // Uma parede de cima a baixo em x = 450, com uma porta FECHADA no meio; o
  // jogador começa do lado esquerdo, de frente pra porta (grade de 30 px).
  const cena = await cenaDoBanco();
  await criarParedes(cena.id, [
    { tipo: "parede", x1: 450, y1: 0, x2: 450, y2: 240 },
    { tipo: "porta", x1: 450, y1: 240, x2: 450, y2: 360 },
    { tipo: "parede", x1: 450, y1: 360, x2: 450, y2: 600 },
  ]);
  await criarPeca(cena.id, "jogador-robo", 375, 315);

  const contexto = await browser.newContext();
  const jogador = await contexto.newPage();
  const errosJogador = coletarErros(jogador);
  await comoJogador(jogador, "jogador-robo");
  await jogador.goto(`/?sala=${SALA}`);
  await jogador.getByRole("button", { name: "ver o mapa" }).click();
  await expect(jogador.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  // Paredes e peões já chegaram do banco (antes disso o jogador nem pega o peão).
  await expect(jogador.locator('.cena-caixa[data-pronto="sim"]')).toBeVisible();

  // De frente pra porta fechada: o peão anda até encostar nela e para (435 é o
  // centro do último quadradinho antes da parede).
  await arrastar(jogador, [375, 315], [525, 315]);
  await expect.poll(peaoDoJogador).toEqual([435, 315]);

  // Na diagonal, por cima da parede: desliza por ela, mas não passa.
  await arrastar(jogador, [435, 315], [525, 105]);
  await expect.poll(peaoDoJogador).toEqual([435, 105]);
  // (o eco atrasado do movimento anterior pode tirar o peão do lugar por um instante: o gesto repete)
  await expect(async () => {
    await arrastar(jogador, [435, 105], [435, 315]);
    await expect.poll(peaoDoJogador, { timeout: 2500 }).toEqual([435, 315]);
  }).toPass({ timeout: 30_000 });

  // O Mestre abre a porta: agora passa — por ela.
  const porta = (await paredesDoBanco()).find((p) => p.tipo === "porta")!;
  await mudarParede(porta.id, { aberta: true });
  await expect(async () => {
    await arrastar(jogador, [435, 315], [525, 315]);
    await expect.poll(peaoDoJogador, { timeout: 2500 }).toEqual([525, 315]);
  }).toPass({ timeout: 30_000 });
  // E pela parede continua não passando, mesmo com a porta aberta.
  await arrastar(jogador, [525, 315], [375, 105]);
  // (desliza por ela do lado direito: 465 é o centro do primeiro quadradinho depois da parede)
  await expect.poll(peaoDoJogador).toEqual([465, 105]);

  // O Mestre põe o peão onde quiser, parede no meio ou não.
  await mudarParede(porta.id, { aberta: false });
  // A tela do Mestre recebe a posição nova pelo tempo real, um instante depois
  // do banco: toca no lugar novo até o cartão do peão abrir (tocar no vazio não
  // mexe em nada; arrastar no vazio arrastaria o mapa).
  await expect(async () => {
    await tocar(page, [465, 105]);
    await expect(page.locator(".mapa-cartao")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await arrastar(page, [465, 105], [375, 105]);
  await expect.poll(peaoDoJogador).toEqual([375, 105]);

  await contexto.close();
  expect(erros).toEqual([]);
  expect(errosJogador).toEqual([]);
});

test("parede em curva: o traço vira trechos emendados sem fresta, desfazer tira a curva inteira e a borracha apaga por onde passa", async ({ page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-curva.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  await abrirFerramenta(page, "Paredes e portas", "preparar");
  const modo = (nome: string) => ({ click: () => escolherNoPainel(page, "Paredes e portas", "O que desenhar", nome, "preparar") });
  await fecharPainelDoMapa(page);

  /** Passa o mouse apertado por uma fileira de pontos da imagem (o caminho do dedo). */
  const riscar = async (pontos: [number, number][]) => {
    const canvas = page.locator(".cena-canvas");
    await canvas.scrollIntoViewIfNeeded();
    const c = (await canvas.boundingBox())!;
    const escala = Math.min(c.width / (900 * 1.06), c.height / (600 * 1.06));
    const naTela = ([ix, iy]: [number, number]) => [c.x + c.width / 2 + (ix - 450) * escala, c.y + c.height / 2 + (iy - 300) * escala] as const;
    await page.mouse.move(...naTela(pontos[0]));
    await page.mouse.down();
    for (const p of pontos.slice(1)) await page.mouse.move(...naTela(p));
    await page.mouse.up();
  };
  // Meia-volta por cima: centro (450, 300), raio 120, da esquerda pra direita.
  const arco: [number, number][] = Array.from({ length: 61 }, (_, i) => {
    const a = Math.PI + (Math.PI * i) / 60;
    return [450 + Math.cos(a) * 120, 300 + Math.sin(a) * 120];
  });

  await modo("curva").click();
  await riscar(arco);
  await expect.poll(async () => (await paredesDoBanco()).length).toBeGreaterThanOrEqual(6);
  const curva = await paredesDoBanco();
  expect(curva.length).toBeLessThanOrEqual(60);
  expect(curva.every((w) => w.tipo === "parede")).toBe(true);
  // Acompanha o traço: toda ponta está em cima do círculo (a poucos px), e não num cruzamento da grade.
  const pontas = curva.flatMap((w) => [[Number(w.x1), Number(w.y1)], [Number(w.x2), Number(w.y2)]]);
  for (const [x, y] of pontas) expect(Math.abs(Math.hypot(x - 450, y - 300) - 120)).toBeLessThan(6);
  expect(pontas.some(([x, y]) => x % 30 !== 0 || y % 30 !== 0)).toBe(true);
  // Emendada sem fresta: só as duas pontas do traço aparecem uma vez; as outras, duas.
  const vezes = new Map<string, number>();
  for (const [x, y] of pontas) vezes.set(`${x},${y}`, (vezes.get(`${x},${y}`) ?? 0) + 1);
  expect([...vezes.values()].filter((n) => n === 1)).toHaveLength(2);
  expect([...vezes.values()].every((n) => n <= 2)).toBe(true);

  // Desfazer tira a curva inteira de uma vez.
  await abrirFerramenta(page, "Paredes e portas", "preparar");
  await page.getByRole("button", { name: "↩ desfazer parede" }).click();
  await fecharPainelDoMapa(page);
  await expect.poll(async () => (await paredesDoBanco()).length).toBe(0);

  // De novo, e a borracha: passando o dedo de lado a lado, saem os trechos por onde ele passa (o arco é cruzado duas vezes).
  await riscar(arco);
  await expect.poll(async () => (await paredesDoBanco()).length).toBeGreaterThanOrEqual(6);
  const antes = (await paredesDoBanco()).length;
  await modo("apagar").click();
  await riscar(Array.from({ length: 41 }, (_, i) => [300 + i * 7.5, 240] as [number, number]));
  await expect.poll(async () => (await paredesDoBanco()).length).toBeLessThanOrEqual(antes - 2);
  expect((await paredesDoBanco()).length).toBeGreaterThan(0);
  expect(erros).toEqual([]);
});
