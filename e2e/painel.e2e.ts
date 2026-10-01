import { expect, test } from "@playwright/test";
import {
  SALA,
  apagarPecasDoBanco,
  bancoConfigurado,
  coletarErros,
  comoJogador,
  criarFicha,
  entrarComoMestre,
  limparSala,
  mudarFicha,
  pecasDoBanco,
  pngDeTeste,
  porNaIniciativa,
} from "./apoio";

/**
 * O que um robô consegue conferir e as regras puras não: o app abre, as abas
 * existem, o combate anda, o mapa sobe, aparece na mesa, e o telão mostra.
 * Cada teste usa a sala `ci-teste`, que é limpa antes e depois.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

test("o Mestre entra, vê as abas e não aparece erro na tela", async ({ page }) => {
  const erros = coletarErros(page);
  await entrarComoMestre(page);
  for (const aba of ["Diário", "Combate", "Mapa", "Fichas", "Mestre"]) {
    await expect(page.getByRole("button", { name: aba, exact: true })).toBeVisible();
  }
  expect(erros).toEqual([]);
});

test("combate: põe um monstro na iniciativa e passa a vez", async ({ page }) => {
  const erros = coletarErros(page);
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Combate", exact: true }).click();

  await page.getByPlaceholder("nome do NPC/monstro").fill("Goblin do Robô");
  await page.getByPlaceholder("PV máx").fill("7");
  await page.getByPlaceholder("CA").fill("15");
  await page.getByPlaceholder("iniciativa").fill("12");
  await page.getByRole("button", { name: "Adicionar à ordem" }).click();
  await expect(page.locator(".initrow")).toHaveCount(1);

  await expect(page.locator(".combat-head .round")).toContainText("1");
  await page.getByRole("button", { name: /Próximo turno/ }).click();
  await expect(page.locator(".combat-head .round")).toContainText("2");
  expect(erros).toEqual([]);
});

test("mapa: sobe a imagem, ela carrega (a política de segurança deixa), vai pra mesa e aparece pro jogador e no telão", async ({
  browser,
  page,
}) => {
  const erros = coletarErros(page);
  await criarFicha("jogador-robo", "Jogador Robô");

  // Mestre sobe o mapa.
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-do-robo.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  // O defeito que ninguém via nos testes de regras: a CSP recusava a imagem do Storage.
  await expect(page.getByText("Não deu pra carregar o mapa")).toHaveCount(0);
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });

  await page.getByRole("button", { name: "levar a mesa pra este mapa" }).click();
  await expect(page.getByText("A mesa está vendo este mapa")).toBeVisible();

  // Jogador (outro navegador, outra pessoa): o aviso aparece e o mapa abre.
  const jogador = await browser.newContext();
  const paginaJogador = await jogador.newPage();
  const errosJogador = coletarErros(paginaJogador);
  await comoJogador(paginaJogador, "jogador-robo");
  await paginaJogador.goto(`/?sala=${SALA}`);
  await expect(paginaJogador.locator(".mapabanner")).toContainText("Tem um mapa na mesa");
  await paginaJogador.getByRole("button", { name: "ver o mapa" }).click();
  await expect(paginaJogador.locator(".cena-canvas")).toBeVisible();
  await expect(paginaJogador.getByText("Não deu pra carregar o mapa")).toHaveCount(0);
  await expect(paginaJogador.locator(".mapabanner")).toHaveCount(0);

  // Telão: o mapa ocupa a tela.
  const telao = await browser.newContext();
  const paginaTelao = await telao.newPage();
  await paginaTelao.goto(`/?sala=${SALA}&telao=1`);
  await expect(paginaTelao.locator(".telao--mapa .cena-canvas")).toBeVisible();

  // O Mestre tira o mapa da mesa e o jogador perde a aba, ao vivo.
  await page.getByRole("button", { name: "tirar o mapa da mesa" }).click();
  await expect(paginaJogador.getByRole("button", { name: "Mapa", exact: true })).toHaveCount(0);

  await jogador.close();
  await telao.close();
  expect(erros).toEqual([]);
  expect(errosJogador).toEqual([]);
});

test("peões: o Mestre põe o grupo e os inimigos, oculta um, e o jogador põe o próprio", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await criarFicha("jogador-robo", "Jogador Robô");
  await criarFicha("dragao-robo", "Dragão do Robô", { is_npc: true });
  await porNaIniciativa([
    { slug: "jogador-robo", name: "Jogador Robô", init: 15 },
    { slug: "dragao-robo", name: "Dragão do Robô", init: 10 },
  ]);

  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-pecas.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "levar a mesa pra este mapa" }).click();
  await expect(page.getByText("A mesa está vendo este mapa")).toBeVisible();

  // A seção existe e a tabela está ligada (senão ela diz "falta rodar a migration").
  await page.locator(".fc-sechead", { hasText: "Peões" }).click();
  await expect(page.getByText("Falta rodar a migration 0019")).toHaveCount(0);

  // Grupo e inimigos: cada um num peão; o inimigo entra OCULTO.
  await page.getByRole("button", { name: "pôr o grupo no mapa" }).click();
  await expect(page.locator(".mapa-peca")).toHaveCount(1);
  await page.getByRole("button", { name: "pôr os inimigos da iniciativa" }).click();
  await expect(page.locator(".mapa-peca")).toHaveCount(2);
  await expect.poll(async () => (await pecasDoBanco()).length).toBe(2);
  const noBanco = await pecasDoBanco();
  expect(noBanco.find((p) => p.slug === "dragao-robo")?.oculto).toBe(true);
  expect(noBanco.find((p) => p.slug === "jogador-robo")?.oculto).toBe(false);

  // Tocar de novo não duplica ninguém (uma ficha, um peão por cena).
  await page.getByRole("button", { name: "pôr o grupo no mapa" }).click();
  await page.getByRole("button", { name: "pôr os inimigos da iniciativa" }).click();
  await expect(page.locator(".mapa-peca")).toHaveCount(2);
  expect(await pecasDoBanco()).toHaveLength(2);

  // O Mestre revela o dragão e muda o tamanho.
  await page.getByRole("button", { name: /Mostrar o peão Dragão do Robô pra mesa/ }).click();
  await expect.poll(async () => (await pecasDoBanco()).find((p) => p.slug === "dragao-robo")?.oculto).toBe(false);
  await page.getByRole("button", { name: /Tamanho do peão Dragão do Robô/ }).click();
  await expect.poll(async () => (await pecasDoBanco()).find((p) => p.slug === "dragao-robo")?.tamanho).toBe(2);

  // O jogador (outro navegador) já tem o peão: não aparece "pôr meu peão". Sem
  // ele (tirado pelo Mestre), o botão aparece e cria o dele.
  const contexto = await browser.newContext();
  const jogador = await contexto.newPage();
  const errosJogador = coletarErros(jogador);
  await comoJogador(jogador, "jogador-robo");
  await jogador.goto(`/?sala=${SALA}`);
  await jogador.getByRole("button", { name: "ver o mapa" }).click();
  await expect(jogador.locator(".cena-canvas")).toBeVisible();
  await expect(jogador.getByRole("button", { name: "pôr meu peão no mapa" })).toHaveCount(0);

  await page.getByRole("button", { name: /tirar o peão Jogador Robô do mapa/ }).click();
  await expect.poll(async () => (await pecasDoBanco()).length).toBe(1);
  await expect(jogador.getByRole("button", { name: "pôr meu peão no mapa" })).toBeVisible();
  await jogador.getByRole("button", { name: "pôr meu peão no mapa" }).click();
  await expect.poll(async () => (await pecasDoBanco()).some((p) => p.slug === "jogador-robo")).toBe(true);
  await expect(jogador.getByRole("button", { name: "pôr meu peão no mapa" })).toHaveCount(0);

  await contexto.close();
  await apagarPecasDoBanco();
  expect(erros).toEqual([]);
  expect(errosJogador).toEqual([]);
});

test("régua: o Mestre mede na grade (diagonal vale 1 quadrado) e o jogador vê a mesma medida", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await criarFicha("jogador-robo", "Jogador Robô");

  // O canvas não tem texto no DOM: o robô escuta o que é DESENHADO nele.
  const espiar = () => {
    const w = window as unknown as { __textos: string[] };
    w.__textos = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof original>) {
      w.__textos.push(String(args[0]));
      return original.apply(this, args);
    };
  };
  await page.addInitScript(espiar);
  const textosDe = (p: typeof page) => p.evaluate(() => (window as unknown as { __textos: string[] }).__textos);

  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-regua.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "levar a mesa pra este mapa" }).click();
  await expect(page.getByText("A mesa está vendo este mapa")).toBeVisible();

  const contexto = await browser.newContext();
  const jogador = await contexto.newPage();
  await jogador.addInitScript(espiar);
  await comoJogador(jogador, "jogador-robo");
  await jogador.goto(`/?sala=${SALA}`);
  await jogador.getByRole("button", { name: "ver o mapa" }).click();
  await expect(jogador.locator(".cena-canvas")).toBeVisible();
  await expect(jogador.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });

  await page.getByRole("button", { name: /régua/ }).click();
  const canvas = page.locator(".cena-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const caixa = (await canvas.boundingBox())!;
  // 900×600 de imagem, 30 quadrados na largura (30 px cada), vista = mapa inteiro com folga de 3%.
  const escala = Math.min(caixa.width / (900 * 1.06), caixa.height / (600 * 1.06));
  const naTela = (ix: number, iy: number) => ({
    x: caixa.x + caixa.width / 2 + (ix - 450) * escala,
    y: caixa.y + caixa.height / 2 + (iy - 300) * escala,
  });
  const medir = async (de: [number, number], para: [number, number]) => {
    const a = naTela(...de);
    const b = naTela(...para);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
  };

  // 5 quadrados na horizontal (do centro da coluna 5 ao da 10): 5 × 1,5 m = 7,5 m.
  await medir([165, 165], [315, 165]);
  await expect.poll(async () => (await textosDe(page)).some((t) => t === "5 quadrados · 7,5 m")).toBe(true);
  await expect.poll(async () => (await textosDe(jogador)).some((t) => t === "Mestre: 5 quadrados · 7,5 m")).toBe(true);

  // Na diagonal, 3 colunas e 3 linhas: a regra conta 3 (e não 4,2).
  await page.waitForTimeout(900);
  await medir([165, 165], [255, 255]);
  await expect.poll(async () => (await textosDe(jogador)).some((t) => t === "Mestre: 3 quadrados · 4,5 m")).toBe(true);

  // Em linha reta: 3 quadrados na diagonal viram 4,2 quadrados (a diagonal de verdade).
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "em linha reta" }).click();
  await medir([165, 165], [255, 255]);
  await expect.poll(async () => (await textosDe(jogador)).some((t) => /^Mestre: 4,2 quadrados · 6,4 m$/.test(t))).toBe(true);

  await contexto.close();
  expect(erros).toEqual([]);
});

test("condições no peão: o ícone é desenhado pra mesa, e o do inimigo oculto só o Mestre vê", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await limparSala();
  // Vida cheia: jogador a 0 PV ganharia o 💤 sozinho e confundiria a conta.
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 10, hp_max: 10 });
  await criarFicha("dragao-robo", "Dragão do Robô", { is_npc: true, hp: 50, hp_max: 50 });
  await porNaIniciativa([
    { slug: "jogador-robo", name: "Jogador Robô", init: 15 },
    { slug: "dragao-robo", name: "Dragão do Robô", init: 10 },
  ]);

  // O canvas não tem texto no DOM: o robô escuta o que é DESENHADO nele.
  const espiar = () => {
    const w = window as unknown as { __textos: string[] };
    w.__textos = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof original>) {
      w.__textos.push(String(args[0]));
      return original.apply(this, args);
    };
  };
  await page.addInitScript(espiar);
  const textosDe = (p: typeof page) => p.evaluate(() => (window as unknown as { __textos: string[] }).__textos);
  const zerarTextos = (p: typeof page) => p.evaluate(() => ((window as unknown as { __textos: string[] }).__textos = []));

  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-condicoes.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "levar a mesa pra este mapa" }).click();
  await expect(page.getByText("A mesa está vendo este mapa")).toBeVisible();
  await page.locator(".fc-sechead", { hasText: "Peões" }).click();
  await page.getByRole("button", { name: "pôr o grupo no mapa" }).click();
  await page.getByRole("button", { name: "pôr os inimigos da iniciativa" }).click();
  await expect.poll(async () => (await pecasDoBanco()).length).toBe(2);
  // O dragão entrou oculto: a mesa não o vê.
  expect((await pecasDoBanco()).find((p) => p.slug === "dragao-robo")?.oculto).toBe(true);

  const contexto = await browser.newContext();
  const jogador = await contexto.newPage();
  const errosJogador = coletarErros(jogador);
  await jogador.addInitScript(espiar);
  await comoJogador(jogador, "jogador-robo");
  await jogador.goto(`/?sala=${SALA}`);
  await jogador.getByRole("button", { name: "ver o mapa" }).click();
  await expect(jogador.locator(".cena-canvas")).toBeVisible();
  await expect(jogador.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });

  // Cego + exaustão 2 no jogador; Atordoado no dragão (oculto).
  await mudarFicha("jogador-robo", { cond: { Cego: true }, exh: 2 });
  await mudarFicha("dragao-robo", { cond: { Atordoado: true } });
  await expect.poll(async () => (await textosDe(jogador)).includes("🙈")).toBe(true);
  expect(await textosDe(jogador)).toContain("😫");
  expect(await textosDe(jogador)).toContain("2");
  // O Mestre vê o do dragão; a mesa, não (ele está oculto).
  await expect.poll(async () => (await textosDe(page)).includes("💫")).toBe(true);
  expect(await textosDe(jogador)).not.toContain("💫");

  // Jogador a 0 PV aparece Inconsciente; tirando tudo, os ícones somem.
  await zerarTextos(jogador);
  await mudarFicha("jogador-robo", { cond: {}, exh: 0, hp: 0 });
  await expect.poll(async () => (await textosDe(jogador)).includes("💤")).toBe(true);
  expect(await textosDe(jogador)).not.toContain("🙈");
  await zerarTextos(jogador);
  await mudarFicha("jogador-robo", { hp: 10 });
  await expect.poll(async () => (await textosDe(jogador)).includes("JR")).toBe(true);
  expect(await textosDe(jogador)).not.toContain("💤");

  // A legenda existe, recolhida, e não cita peão nenhum.
  await expect(jogador.getByText("O que significam os ícones nos peões")).toBeVisible();

  await contexto.close();
  await apagarPecasDoBanco();
  expect(erros).toEqual([]);
  expect(errosJogador).toEqual([]);
});

