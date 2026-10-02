import { expect, test } from "@playwright/test";
import { decodificarMascara } from "../src/lib/visao";
import {
  SALA,
  apagarPecasDoBanco,
  cenaDoBanco,
  bancoConfigurado,
  coletarErros,
  comoJogador,
  criarFicha,
  criarParedes,
  criarPeca,
  entrarComoMestre,
  limparSala,
  mudarFicha,
  mudarCena,
  mudarParede,
  paredesDoBanco,
  pecasDoBanco,
  pngDeTeste,
  marcasDoBanco,
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

test("modelos de magia: o Mestre e o jogador marcam esfera, cone, cubo e linha, e a mesa vê a mesma figura", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 10, hp_max: 10 });

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
    .setInputFiles({ name: "mapa-area.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
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

  // A barra de tamanhos muda de altura conforme a forma e empurra o mapa: a
  // posição do canvas é medida de novo a cada arrasto.
  const arrastar = async (quem: typeof page, de: [number, number], para: [number, number]) => {
    const canvas = quem.locator(".cena-canvas");
    await canvas.scrollIntoViewIfNeeded();
    const c = (await canvas.boundingBox())!;
    // 900×600 de imagem, vista = mapa inteiro com folga de 3%.
    const escala = Math.min(c.width / (900 * 1.06), c.height / (600 * 1.06));
    const naTela = (ix: number, iy: number) => ({ x: c.x + c.width / 2 + (ix - 450) * escala, y: c.y + c.height / 2 + (iy - 300) * escala });
    const a = naTela(...de);
    const b = naTela(...para);
    await quem.mouse.move(a.x, a.y);
    await quem.mouse.down();
    await quem.mouse.move(b.x, b.y, { steps: 8 });
    await quem.mouse.up();
  };

  // ── Mestre ──
  await page.getByRole("button", { name: /área/ }).click();
  // Esfera é o padrão: raio de 6 m (4 quadrados).
  await expect(page.getByText("Esfera: raio de 6 m (4 quadrados).")).toBeVisible();
  await arrastar(page, [300, 300], [300, 300]);
  await expect.poll(async () => (await textosDe(page)).includes("Mestre: Esfera · raio 6 m")).toBe(true);
  await expect.poll(async () => (await textosDe(jogador)).includes("Mestre: Esfera · raio 6 m")).toBe(true);

  // Cone de 9 m (tamanho pronto), apontando pra direita.
  await page.waitForTimeout(900);
  await page.getByRole("group", { name: "Forma da magia" }).getByRole("button", { name: "Cone" }).click();
  await page.getByRole("group", { name: /Tamanho/ }).getByRole("button", { name: "9 m" }).click();
  await arrastar(page, [150, 150], [450, 150]);
  await expect.poll(async () => (await textosDe(jogador)).includes("Mestre: Cone · 9 m")).toBe(true);

  // Linha de 30 m por 1,5 m e cubo de 4,5 m (um tamanho que o Mestre digita).
  await page.waitForTimeout(900);
  await page.getByRole("group", { name: "Forma da magia" }).getByRole("button", { name: "Linha" }).click();
  await arrastar(page, [150, 450], [500, 450]);
  await expect.poll(async () => (await textosDe(jogador)).includes("Mestre: Linha · 30 m × 1,5 m")).toBe(true);
  await page.waitForTimeout(900);
  await page.getByRole("group", { name: "Forma da magia" }).getByRole("button", { name: "Cubo" }).click();
  await page.getByLabel(/Outro tamanho/).fill("7,5");
  await arrastar(page, [600, 300], [800, 300]);
  await expect.poll(async () => (await textosDe(jogador)).includes("Mestre: Cubo · lado 7,5 m")).toBe(true);

  // ── Jogador ── (a barra dele tem "✨ área", e o Mestre vê o nome dele)
  await jogador.getByRole("button", { name: /área/ }).click();
  await jogador.getByRole("group", { name: "Forma da magia" }).getByRole("button", { name: "Cone" }).click();
  await jogador.getByRole("group", { name: /Tamanho/ }).getByRole("button", { name: "18 m" }).click();
  await arrastar(jogador, [150, 300], [450, 300]);
  await expect.poll(async () => (await textosDe(page)).includes("Jogador Robô: Cone · 18 m")).toBe(true);

  await contexto.close();
  expect(erros).toEqual([]);
});

test("paredes e visão: a névoa abre sozinha pelo grupo, a porta decide, e a mesa nunca vê a marcação", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 10, hp_max: 10 });
  await criarFicha("dragao-robo", "Dragão do Robô", { is_npc: true, hp: 50, hp_max: 50 });

  // O canvas não tem texto no DOM: o robô escuta o que é DESENHADO nele (o nome
  // do peão só é desenhado quando ele não está sob a névoa).
  const espiar = () => {
    const w = window as unknown as { __textos: string[] };
    w.__textos = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof original>) {
      w.__textos.push(String(args[0]));
      return original.apply(this, args);
    };
  };
  const textosDe = (p: typeof page) => p.evaluate(() => (window as unknown as { __textos: string[] }).__textos);
  const zerarTextos = (p: typeof page) => p.evaluate(() => ((window as unknown as { __textos: string[] }).__textos = []));

  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-visao.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "levar a mesa pra este mapa" }).click();
  await expect(page.getByText("A mesa está vendo este mapa")).toBeVisible();

  // A seção está ligada (senão ela diz "falta rodar a migration 0021").
  await page.locator(".fc-sechead", { hasText: "Paredes e visão" }).click();
  await expect(page.getByText("Falta rodar a migration 0021")).toHaveCount(0);
  await page.getByLabel(/visão automática/).check();
  const cena = await cenaDoBanco();
  await expect.poll(async () => (await cenaDoBanco()).visao_ligada).toBe(true);

  // Sala do jogador à esquerda, dragão à direita, uma parede inteira no meio com
  // uma porta fechada (x = 450 numa imagem de 900 de largura).
  await criarParedes(cena.id, [
    { tipo: "parede", x1: 450, y1: 0, x2: 450, y2: 250 },
    { tipo: "porta", x1: 450, y1: 250, x2: 450, y2: 350 },
    { tipo: "parede", x1: 450, y1: 350, x2: 450, y2: 600 },
  ]);
  await criarPeca(cena.id, "jogador-robo", 150, 300);
  await criarPeca(cena.id, "dragao-robo", 750, 300, { oculto: false });
  await mudarFicha("dragao-robo", { revealed: true });

  const contexto = await browser.newContext();
  const jogador = await contexto.newPage();
  const errosJogador = coletarErros(jogador);
  await jogador.addInitScript(espiar);
  await comoJogador(jogador, "jogador-robo");
  await jogador.goto(`/?sala=${SALA}`);
  await jogador.getByRole("button", { name: "ver o mapa" }).click();
  await expect(jogador.locator(".cena-canvas")).toBeVisible();
  await expect(jogador.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });

  // Porta fechada: o jogador se vê (JR), mas o dragão (DD) está atrás da parede.
  await expect.poll(async () => (await textosDe(jogador)).includes("JR")).toBe(true);
  await jogador.waitForTimeout(600);
  expect(await textosDe(jogador)).not.toContain("DD");
  // Com a visão automática ligada, quem põe o peão é o Mestre.
  await expect(jogador.getByRole("button", { name: "pôr meu peão no mapa" })).toHaveCount(0);

  // O Mestre abre a porta (tocando nela, com a ferramenta de mover): o dragão aparece.
  await page.getByRole("button", { name: /mover/ }).first().click();
  const canvas = page.locator(".cena-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const c = (await canvas.boundingBox())!;
  const escala = Math.min(c.width / (900 * 1.06), c.height / (600 * 1.06));
  const naTela = (ix: number, iy: number) => ({ x: c.x + c.width / 2 + (ix - 450) * escala, y: c.y + c.height / 2 + (iy - 300) * escala });
  const porta = naTela(450, 300);
  await page.mouse.click(porta.x, porta.y);
  await expect.poll(async () => (await paredesDoBanco()).find((p) => p.tipo === "porta")?.aberta).toBe(true);
  await expect.poll(async () => (await textosDe(jogador)).includes("DD")).toBe(true);

  // O que o grupo viu fica guardado (o aparelho do Mestre grava).
  await expect.poll(async () => (await cenaDoBanco()).explorado, { timeout: 15_000 }).not.toBe("");

  // Fechando de novo (pelo banco, como outro aparelho), o dragão some outra vez.
  const idDaPorta = (await paredesDoBanco()).find((p) => p.tipo === "porta")!.id;
  await jogador.waitForTimeout(500);
  await zerarTextos(jogador);
  await mudarParede(idDaPorta, { aberta: false });
  await expect.poll(async () => (await textosDe(jogador)).includes("JR")).toBe(true);
  expect(await textosDe(jogador)).not.toContain("DD");

  // Desligando a visão, volta o comportamento de antes (só a névoa feita à mão).
  await mudarCena(cena.id, { visao_ligada: false });

  await contexto.close();
  await apagarPecasDoBanco();
  expect(erros).toEqual([]);
  expect(errosJogador).toEqual([]);
});

test("paredes: o Mestre desenha parede, porta e cômodo, apaga, e escolhe onde o grupo entra", async ({ page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 10, hp_max: 10 });
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-paredes.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });

  const arrastar = async (de: [number, number], para: [number, number]) => {
    const canvas = page.locator(".cena-canvas");
    await canvas.scrollIntoViewIfNeeded();
    const c = (await canvas.boundingBox())!;
    const escala = Math.min(c.width / (900 * 1.06), c.height / (600 * 1.06));
    const p = (ix: number, iy: number) => ({ x: c.x + c.width / 2 + (ix - 450) * escala, y: c.y + c.height / 2 + (iy - 300) * escala });
    const a = p(...de);
    const b = p(...para);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
  };
  const modo = (nome: string) => page.getByRole("group", { name: "O que desenhar" }).getByRole("button", { name: nome });

  await page.getByRole("button", { name: "🧱 paredes" }).click();
  // Parede: as pontas encaixam no cruzamento da grade (o lado vem da cena, não é chute).
  const lado = Number((await cenaDoBanco()).grade_px);
  await modo("parede").click();
  await arrastar([140, 140], [420, 140]);
  await expect.poll(async () => (await paredesDoBanco()).length).toBe(1);
  const parede = (await paredesDoBanco())[0];
  expect(parede.tipo).toBe("parede");
  expect(Number(parede.x1) % lado).toBeCloseTo(0, 5);
  expect(Number(parede.y1) % lado).toBeCloseTo(0, 5);

  // Porta nasce fechada.
  await modo("porta").click();
  await arrastar([420, 140], [420, 280]);
  await expect.poll(async () => (await paredesDoBanco()).length).toBe(2);
  expect((await paredesDoBanco()).find((p) => p.tipo === "porta")?.aberta).toBe(false);

  // Cômodo: quatro paredes de uma vez.
  await modo("cômodo").click();
  await arrastar([560, 350], [840, 560]);
  await expect.poll(async () => (await paredesDoBanco()).length).toBe(6);

  // Apagar: tocar numa parede a tira.
  await modo("apagar").click();
  await arrastar([280, 140], [280, 140]);
  await expect.poll(async () => (await paredesDoBanco()).length).toBe(5);

  // Desfazer tira o último DESENHO inteiro: as quatro paredes do cômodo saem
  // juntas (era uma por toque — com parede em curva, seriam dezenas de toques).
  await page.locator(".fc-sechead", { hasText: "Paredes e visão" }).click();
  await page.getByRole("button", { name: "↩ desfazer parede" }).click();
  await expect.poll(async () => (await paredesDoBanco()).length).toBe(1);
  expect((await paredesDoBanco())[0].tipo).toBe("porta");

  // Onde o grupo entra: o Mestre toca no mapa e os peões se agrupam em volta do ponto.
  await page.locator(".fc-sechead", { hasText: "Peões" }).click();
  await page.getByRole("button", { name: "grupo onde eu tocar" }).click();
  await expect(page.getByText("Toque no mapa no lugar onde o grupo entra")).toBeVisible();
  await arrastar([700, 120], [700, 120]);
  await expect.poll(async () => (await pecasDoBanco()).length).toBe(1);
  const peao = (await pecasDoBanco())[0];
  expect(Math.hypot(Number(peao.x) - 700, Number(peao.y) - 120)).toBeLessThan(lado * 3);

  await apagarPecasDoBanco();
  expect(erros).toEqual([]);
});

test("visão: se as paredes demoram a chegar, a memória não ganha o que estava atrás delas", async ({ page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 10, hp_max: 10 });
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-corrida.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "levar a mesa pra este mapa" }).click();
  await expect(page.getByText("A mesa está vendo este mapa")).toBeVisible();
  const cena = await cenaDoBanco();
  // Parede inteira no meio (x = 450), sem alcance: sem a parede, o grupo "veria" o mapa todo.
  await criarParedes(cena.id, [{ tipo: "parede", x1: 450, y1: 0, x2: 450, y2: 600 }]);
  await criarPeca(cena.id, "jogador-robo", 150, 300);
  await mudarCena(cena.id, { visao_ligada: true, visao_alcance: null, explorado: "" });

  // Recarrega a tela do Mestre com a resposta das paredes atrasada em 3,5 s.
  await page.route("**/rest/v1/cena_paredes**", async (rota) => {
    await new Promise((r) => setTimeout(r, 3500));
    await rota.continue();
  });
  await page.reload();
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  // O aparelho do Mestre grava o que o grupo viu 1,5 s depois de ver.
  await expect.poll(async () => (await cenaDoBanco()).explorado, { timeout: 25_000 }).not.toBe("");
  await page.waitForTimeout(2500);

  const gravada = await cenaDoBanco();
  const mascara = decodificarMascara(gravada.explorado, {
    grade_ligada: Boolean(gravada.grade_ligada),
    grade_px: Number(gravada.grade_px),
    largura: Number(gravada.largura),
    altura: Number(gravada.altura),
  });
  expect(mascara).not.toBeNull();
  let vistasDoOutroLado = 0;
  let vistasDesteLado = 0;
  for (let r = 0; r < mascara!.rows; r++) {
    for (let c = 0; c < mascara!.cols; c++) {
      if (!mascara!.celulas[r * mascara!.cols + c]) continue;
      if ((c + 0.5) * mascara!.lado > 450) vistasDoOutroLado++;
      else vistasDesteLado++;
    }
  }
  expect(vistasDesteLado).toBeGreaterThan(0);
  expect(vistasDoOutroLado).toBe(0);

  await apagarPecasDoBanco();
  expect(erros).toEqual([]);
});


test("desenhos e notas: o Mestre risca e anota, a mesa só vê o liberado, e a borracha apaga", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await criarFicha("jogador-robo", "Jogador Robô");

  // O canvas não tem texto no DOM: o robô escuta o que é DESENHADO nele (o número do alfinete).
  const espiar = () => {
    const w = window as unknown as { __textos: string[] };
    w.__textos = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof original>) {
      w.__textos.push(String(args[0]));
      return original.apply(this, args);
    };
  };
  const textosDe = (p: typeof page) => p.evaluate(() => (window as unknown as { __textos: string[] }).__textos);

  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-marcas.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  // Sem névoa por cima: o que se confere aqui é o desenho, não a névoa.
  await mudarCena((await cenaDoBanco()).id, { nevoa_ligada: false });
  await page.getByRole("button", { name: "levar a mesa pra este mapa" }).click();
  await expect(page.getByText("A mesa está vendo este mapa")).toBeVisible();

  const arrastar = async (de: [number, number], para: [number, number]) => {
    const canvas = page.locator(".cena-canvas");
    await canvas.scrollIntoViewIfNeeded();
    const c = (await canvas.boundingBox())!;
    const escala = Math.min(c.width / (900 * 1.06), c.height / (600 * 1.06));
    const p = (ix: number, iy: number) => ({ x: c.x + c.width / 2 + (ix - 450) * escala, y: c.y + c.height / 2 + (iy - 300) * escala });
    const a = p(...de);
    const b = p(...para);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
  };
  const modo = (nome: string) => page.getByRole("group", { name: "O que marcar" }).getByRole("button", { name: nome });

  await page.getByRole("button", { name: "✏️ desenhar" }).click();

  // Traço livre: acompanha o movimento (uma diagonal vira um traço de poucos pontos).
  await modo("✏️ livre").click();
  await arrastar([100, 100], [300, 200]);
  await expect.poll(async () => (await marcasDoBanco()).length).toBe(1);
  let [traco] = await marcasDoBanco();
  expect(traco.tipo).toBe("traco");
  expect(traco.visivel).toBe(true);
  expect(traco.pontos.length).toBeGreaterThanOrEqual(2);
  expect(Math.hypot(traco.pontos[0][0] - 100, traco.pontos[0][1] - 100)).toBeLessThan(15);

  // Linha reta: só as duas pontas.
  await modo("╱ linha").click();
  await arrastar([100, 300], [400, 300]);
  await expect.poll(async () => (await marcasDoBanco()).length).toBe(2);
  const reta = (await marcasDoBanco())[1];
  expect(reta.pontos).toHaveLength(2);

  // Um toque simples não é desenho.
  await arrastar([600, 100], [600, 100]);
  await page.waitForTimeout(400);
  expect((await marcasDoBanco()).length).toBe(2);

  // Nota escondida da mesa (a primeira) e nota liberada (a segunda).
  await modo("📌 nota").click();
  await page.getByRole("button", { name: "👁 a mesa vê" }).click(); // vira "só eu vejo"
  await arrastar([500, 150], [500, 150]);
  await page.getByLabel("Texto da nota").fill("segredo do mestre");
  await page.getByRole("button", { name: "pôr nota" }).click();
  await expect.poll(async () => (await marcasDoBanco()).length).toBe(3);
  await page.getByRole("button", { name: "🔒 só eu vejo" }).click(); // volta pra "a mesa vê"
  await arrastar([700, 400], [700, 400]);
  await page.getByLabel("Texto da nota").fill("armadilha na ponte");
  await page.getByLabel("Texto da nota").press("Enter");
  await expect.poll(async () => (await marcasDoBanco()).length).toBe(4);
  const notas = (await marcasDoBanco()).filter((m) => m.tipo === "nota");
  expect(notas.map((n) => [n.texto, n.visivel])).toEqual([["segredo do mestre", false], ["armadilha na ponte", true]]);

  // Mestre: as duas notas na lista, numeradas 1 e 2.
  await page.locator(".fc-sechead", { hasText: "Desenhos e notas" }).click();
  await expect(page.locator(".mapa-notas .mapa-nota")).toHaveCount(2);

  // Jogador: só a nota liberada, e ela é a nº 1 (sem buraco onde há nota escondida).
  const jogador = await browser.newContext();
  const paginaJogador = await jogador.newPage();
  const errosJogador = coletarErros(paginaJogador);
  await paginaJogador.addInitScript(espiar);
  await comoJogador(paginaJogador, "jogador-robo");
  await paginaJogador.goto(`/?sala=${SALA}`);
  await paginaJogador.getByRole("button", { name: "ver o mapa" }).click();
  await expect(paginaJogador.locator(".cena-canvas")).toBeVisible();
  await expect(paginaJogador.locator(".mapa-notas .mapa-nota")).toHaveCount(1);
  await expect(paginaJogador.locator(".mapa-notas")).toContainText("armadilha na ponte");
  await expect(paginaJogador.locator(".mapa-notas")).not.toContainText("segredo");
  await expect.poll(async () => (await textosDe(paginaJogador)).includes("1")).toBe(true);
  expect(await textosDe(paginaJogador)).not.toContain("2");

  // Telão: a lista cobre o canto do mapa, só com a nota liberada.
  const telao = await browser.newContext();
  const paginaTelao = await telao.newPage();
  await paginaTelao.goto(`/?sala=${SALA}&telao=1`);
  await expect(paginaTelao.locator(".mapa-notas--telao")).toContainText("armadilha na ponte");
  await expect(paginaTelao.locator(".mapa-notas--telao")).not.toContainText("segredo");

  // Ao vivo: o Mestre libera a nota escondida e ela aparece no celular, agora como nº 1 e 2.
  await page.getByRole("button", { name: "Esconder da mesa a nota 2" }).waitFor();
  await page.getByRole("button", { name: "Mostrar pra mesa a nota 1" }).click();
  await expect(paginaJogador.locator(".mapa-notas .mapa-nota")).toHaveCount(2);
  await expect(paginaJogador.locator(".mapa-notas")).toContainText("segredo do mestre");

  // Borracha: tocar no traço livre o apaga (e só ele).
  await modo("apagar").click();
  await arrastar([200, 150], [200, 150]);
  await expect.poll(async () => (await marcasDoBanco()).length).toBe(3);
  expect((await marcasDoBanco()).some((m) => m.id === traco.id)).toBe(false);

  // Apagar a nota pela lista.
  await page.getByRole("button", { name: "Apagar a nota 1" }).click();
  await expect.poll(async () => (await marcasDoBanco()).length).toBe(2);
  await expect(paginaJogador.locator(".mapa-notas .mapa-nota")).toHaveCount(1);

  traco = (await marcasDoBanco())[0];
  await jogador.close();
  await telao.close();
  expect(erros).toEqual([]);
  expect(errosJogador).toEqual([]);
});
