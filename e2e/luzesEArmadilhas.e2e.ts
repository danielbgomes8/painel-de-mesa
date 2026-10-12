import { expect, test, type Page } from "@playwright/test";
import {
  SALA,
  bancoConfigurado,
  cenaDoBanco,
  coletarErros,
  comoJogador,
  criarFicha,
  criarPeca,
  abrirFerramenta,
  entrarComoMestre,
  fecharPainelDoMapa,
  limparSala,
  mudarCena,
  pecasDoBanco,
  pngDeTeste,
  porNaIniciativa,
  rest,
} from "./apoio";
import { contarCelulas, decodificarMascara } from "../src/lib/visao";

/**
 * Luzes que acabam e armadilhas no mapa (migration 0036). Mesma sala `ci-teste`, limpa antes e depois.
 * O mapa de teste tem 900×600 px e quadradinho de 30 px = 1,5 m.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

/** Janelas de jogador abertas pelo teste: fecham sempre, mesmo se o teste falhar no meio (uma janela esquecida
 *  continua ligada na sala `ci-teste` e atrapalha os testes que vêm depois). */
const contextosAbertos: import("@playwright/test").BrowserContext[] = [];
test.afterEach(async () => {
  for (const c of contextosAbertos.splice(0)) await c.close().catch(() => undefined);
});

/** O canvas não tem DOM: o robô escuta o que é DESENHADO (arcos [x, y, raio] do último quadro). */
const espiar = () => {
  const w = window as unknown as { __quadros: number[][][] };
  w.__quadros = [[]];
  const preencher = CanvasRenderingContext2D.prototype.fillRect;
  CanvasRenderingContext2D.prototype.fillRect = function (...args: Parameters<typeof preencher>) {
    if (args[0] === 0 && args[1] === 0) {
      w.__quadros.push([]);
      if (w.__quadros.length > 40) w.__quadros.shift();
    }
    return preencher.apply(this, args);
  };
  const arco = CanvasRenderingContext2D.prototype.arc;
  CanvasRenderingContext2D.prototype.arc = function (...args: Parameters<typeof arco>) {
    w.__quadros[w.__quadros.length - 1].push([args[0], args[1], args[2]]);
    return arco.apply(this, args);
  };
};
const ultimoQuadro = (p: Page) =>
  p.evaluate(() => {
    const q = (window as unknown as { __quadros: number[][][] }).__quadros;
    return q[q.length - 1] ?? [];
  });
const temRaio = (arcos: number[][], raio: number) => arcos.some((a) => Math.abs(a[2] - raio) < 0.6);
async function ver(pagina: Page, cond: (arcos: number[][]) => boolean, esperado = true) {
  await expect.poll(async () => cond(await ultimoQuadro(pagina)), { timeout: 30_000, intervals: [500] }).toBe(esperado);
}

async function tocarNoMapa(page: Page, ix: number, iy: number) {
  const canvas = page.locator(".cena-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const caixa = (await canvas.boundingBox())!;
  const escala = Math.min(caixa.width / (900 * 1.06), caixa.height / (600 * 1.06));
  await page.mouse.click(caixa.x + caixa.width / 2 + (ix - 450) * escala, caixa.y + caixa.height / 2 + (iy - 300) * escala);
}

type LinhaLuz = { slug: string | null; luz_nome: string | null; luz_alcance: number | null; luz_minutos: number | null };
async function luzesDoBanco(): Promise<LinhaLuz[]> {
  const r = await rest(`cena_pecas?select=slug,luz_nome,luz_alcance,luz_minutos&room_code=eq.${SALA}&order=created_at`);
  if (!r.ok) throw new Error(`não leu as luzes: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) as LinhaLuz[];
}
const luzDe = async (slug: string) => (await luzesDoBanco()).find((l) => l.slug === slug)!;

type LinhaArmadilha = { id: string; nome: string; x: number; y: number; raio: number; salvaguarda: string; cd: number | null; dano: string; estado: string };
async function armadilhasDoBanco(): Promise<LinhaArmadilha[]> {
  const r = await rest(`cena_armadilhas?select=id,nome,x,y,raio,salvaguarda,cd,dano,estado&room_code=eq.${SALA}&order=created_at`);
  if (!r.ok) throw new Error(`não leu as armadilhas: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) as LinhaArmadilha[];
}
async function linhasDoLog(): Promise<string[]> {
  const r = await rest(`combat_log?select=text&room_code=eq.${SALA}&order=created_at`);
  return ((await r.json()) as { text: string }[]).map((l) => l.text);
}

async function prepararMapa(page: Page) {
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-luzes.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "levar a mesa pra este mapa" }).click();
  await expect(page.locator(".palco-nome").getByText("Na mesa")).toBeVisible();
}

async function abrirComoJogador(browser: import("@playwright/test").Browser, slug: string) {
  const contexto = await browser.newContext();
  contextosAbertos.push(contexto);
  const jogador = await contexto.newPage();
  const erros = coletarErros(jogador);
  await jogador.addInitScript(espiar);
  await comoJogador(jogador, slug);
  await jogador.goto(`/?sala=${SALA}`);
  await jogador.getByRole("button", { name: "ver o mapa" }).click();
  await expect(jogador.locator(".cena-canvas")).toBeVisible();
  await expect(jogador.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  return { jogador, erros, contexto };
}

test("luzes: o Mestre dá a tocha, passa o tempo, a mesa vê o que falta, apaga e desfaz", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await page.addInitScript(espiar);
  await prepararMapa(page);
  const cena = await cenaDoBanco();
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 20, hp_max: 20 });
  await criarPeca(cena.id, "jogador-robo", 165, 165);
  const { jogador, erros: errosJogador, contexto } = await abrirComoJogador(browser, "jogador-robo");

  await abrirFerramenta(page, "Escuridão e luzes");
  await page.getByRole("button", { name: "Tocha", exact: true }).click();
  await expect.poll(async () => (await luzDe("jogador-robo")).luz_minutos).toBe(60);
  expect(await luzDe("jogador-robo")).toMatchObject({ luz_nome: "Tocha", luz_alcance: 12, luz_minutos: 60 });
  // A mesa vê quanto falta.
  await expect(jogador.getByText("Tocha de Jogador Robô — faltam 1 h")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "⏳ 30 min" }).click();
  await expect.poll(async () => (await luzDe("jogador-robo")).luz_minutos).toBe(30);
  await expect(jogador.getByText("Tocha de Jogador Robô — faltam 30 min")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Quase apagando")).toHaveCount(0);

  // Mais 25 minutos: faltam 5, e o painel avisa.
  await page.getByPlaceholder("outro (min)").fill("25");
  await page.getByRole("button", { name: "passar", exact: true }).click();
  await expect.poll(async () => (await luzDe("jogador-robo")).luz_minutos).toBe(5);
  await expect(page.getByText("quase apagando")).toBeVisible();

  // Passa do que falta: apaga, o minuto nunca fica negativo e o log conta.
  await page.getByRole("button", { name: "⏳ 10 min" }).click();
  await expect.poll(async () => (await luzDe("jogador-robo")).luz_minutos).toBe(0);
  await expect(jogador.getByText("Tocha de Jogador Robô — apagada")).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await linhasDoLog()).some((t) => t.includes("Tocha de Jogador Robô apagou"))).toBe(true);
  await expect(page.getByText("Apagou: Tocha de Jogador Robô.")).toBeVisible();

  // Desfazer devolve os 10 minutos (o último passo): a luz volta a ter 5.
  await page.getByRole("button", { name: /desfazer 10 min/ }).click();
  await expect.poll(async () => (await luzDe("jogador-robo")).luz_minutos).toBe(5);

  // Tirar a luz limpa as três colunas.
  await page.getByRole("button", { name: "Tirar a luz de Jogador Robô" }).click();
  await expect.poll(async () => await luzDe("jogador-robo")).toMatchObject({ luz_nome: null, luz_alcance: null, luz_minutos: null });
  await expect(jogador.getByText(/Tocha de Jogador Robô/)).toHaveCount(0);

  expect(erros).toEqual([]);
  expect(errosJogador).toEqual([]);
  await contexto.close();
});

test("mapa escuro: com a tocha acesa o grupo explora longe; apagada, só o quadradinho em volta", async ({ page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await prepararMapa(page);
  const cena = await cenaDoBanco();
  await mudarCena(cena.id, { visao_ligada: true, escura: true, explorado: "" });
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 20, hp_max: 20 });
  // Tocha de 12 m = 240 px de raio, no canto de cima do mapa.
  await criarPeca(cena.id, "jogador-robo", 165, 165, { luz_nome: "Tocha", luz_alcance: 12, luz_minutos: 60 });

  const explorados = async () => {
    const c = await cenaDoBanco();
    const m = decodificarMascara(String(c.explorado ?? ""), c as unknown as Parameters<typeof decodificarMascara>[1]);
    return m ? contarCelulas(m) : 0;
  };
  // O Mestre guarda o que o grupo viu 1,5 s depois de mudar.
  await expect.poll(explorados, { timeout: 45_000, intervals: [1000] }).toBeGreaterThan(60);
  const comTocha = await explorados();

  // Apaga a tocha e leva o peão pro outro lado: só o quadradinho em volta (30 px de raio) é descoberto.
  const peao = (await pecasDoBanco()).find((p) => p.slug === "jogador-robo")!;
  let r = await rest(`cena_pecas?id=eq.${peao.id}`, { method: "PATCH", body: JSON.stringify({ luz_minutos: 0, x: 765, y: 465 }) });
  expect(r.ok).toBe(true);
  await expect.poll(explorados, { timeout: 45_000, intervals: [1000] }).toBeGreaterThan(comTocha);
  const depoisApagada = (await explorados()) - comTocha;
  expect(depoisApagada).toBeGreaterThan(0);
  expect(depoisApagada).toBeLessThan(25); // ~π·30²/32² ≈ 3 células (até uns 9 nas bordas), nada perto das ~170 da tocha

  // Mapa claro de novo: a visão volta ao que a cena manda (sem limite, vê o mapa todo).
  await mudarCena(cena.id, { escura: false });
  await expect.poll(explorados, { timeout: 45_000, intervals: [1000] }).toBeGreaterThan(comTocha + 100);
  r = await rest(`cena_pecas?id=eq.${peao.id}`, { method: "DELETE" });
  expect(erros).toEqual([]);
});

test("mapa escuro: a tocha de um ilumina o que outro jogador, sem luz, enxerga", async ({ page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await prepararMapa(page);
  const cena = await cenaDoBanco();
  await mudarCena(cena.id, { visao_ligada: true, escura: true, explorado: "" });
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 20, hp_max: 20 });
  await criarPeca(cena.id, "jogador-robo", 165, 165); // sem luz: só enxerga o quadradinho em volta

  const explorados = async () => {
    const c = await cenaDoBanco();
    const m = decodificarMascara(String(c.explorado ?? ""), c as unknown as Parameters<typeof decodificarMascara>[1]);
    return m ? contarCelulas(m) : 0;
  };
  await expect.poll(explorados, { timeout: 45_000, intervals: [1000] }).toBeGreaterThan(0);
  await page.waitForTimeout(3000);
  const sozinho = await explorados();
  expect(sozinho).toBeLessThan(25); // só o quadradinho em volta

  // Uma tocha no chão (marcador avulso, ao lado do jogador) acende: ela ilumina 12 m e o jogador enxerga isso.
  await criarPeca(cena.id, "", 225, 165, { slug: null, nome: "Tocha no chão", luz_nome: "Tocha", luz_alcance: 12, luz_minutos: 60 });
  await expect.poll(explorados, { timeout: 45_000, intervals: [1000] }).toBeGreaterThan(sozinho + 60);

  // Apagada, não ilumina mais: o jogador levado pra longe não ganha nada além do quadradinho dele.
  const antes = await explorados();
  const peao = (await pecasDoBanco()).find((p) => p.slug === "jogador-robo")!;
  const marcador = (await pecasDoBanco()).find((p) => p.slug === null)!;
  let r = await rest(`cena_pecas?id=eq.${marcador.id}`, { method: "PATCH", body: JSON.stringify({ luz_minutos: 0 }) });
  expect(r.ok).toBe(true);
  r = await rest(`cena_pecas?id=eq.${peao.id}`, { method: "PATCH", body: JSON.stringify({ x: 765, y: 465 }) });
  expect(r.ok).toBe(true);
  await expect.poll(explorados, { timeout: 45_000, intervals: [1000] }).toBeGreaterThan(antes);
  await page.waitForTimeout(3000);
  expect((await explorados()) - antes).toBeLessThan(25);
  expect(erros).toEqual([]);
});

test("armadilhas: nasce escondida, só o Mestre é avisado quando alguém pisa, e ele dispara, deixa passar ou desarma", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await page.addInitScript(espiar);
  await prepararMapa(page);
  const cena = await cenaDoBanco();
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 20, hp_max: 20 });
  await criarPeca(cena.id, "jogador-robo", 165, 165);
  const { jogador, erros: errosJogador, contexto } = await abrirComoJogador(browser, "jogador-robo");

  await abrirFerramenta(page, "Armadilhas");
  await page.getByRole("button", { name: "Poço escondido", exact: true }).click();
  await page.getByRole("button", { name: "4,5 m", exact: true }).click(); // zona de raio 90 px: diferente de qualquer outro arco
  await page.getByRole("button", { name: "📍 colocar no mapa" }).click();
  await fecharPainelDoMapa(page); // o painel cobre um pedaço do mapa
  await tocarNoMapa(page, 405, 285);
  await expect.poll(async () => (await armadilhasDoBanco()).length).toBe(1);
  expect((await armadilhasDoBanco())[0]).toMatchObject({ nome: "Poço escondido", x: 405, y: 285, raio: 4.5, salvaguarda: "DES", cd: 12, dano: "2d6 contundente", estado: "armada" });

  // O Mestre a enxerga (tracejada); a mesa, não.
  await ver(page, (q) => temRaio(q, 90));
  await jogador.waitForTimeout(1500);
  expect(temRaio(await ultimoQuadro(jogador), 90)).toBe(false);

  // O jogador anda até a zona: SÓ o Mestre é avisado, com a salvaguarda e o dano à mão.
  const peao = (await pecasDoBanco()).find((p) => p.slug === "jogador-robo")!;
  const mover = async (x: number, y: number) => {
    const r = await rest(`cena_pecas?id=eq.${peao.id}`, { method: "PATCH", body: JSON.stringify({ x, y }) });
    expect(r.ok).toBe(true);
  };
  /** Sai da zona e volta. A pausa deixa o aparelho do Mestre ver o peão FORA antes de ele voltar: duas escritas
   *  coladas chegam juntas num aparelho lento (o CI) e o "fora" nunca é visto, então não há "entrada" pra avisar. */
  const saireVoltar = async () => {
    await mover(165, 165);
    await page.waitForTimeout(2000);
    await mover(405, 285);
  };
  await mover(405, 285);
  const aviso = page.locator(".arm-aviso");
  await expect(aviso).toBeVisible({ timeout: 30_000 });
  await expect(aviso).toContainText("Jogador Robô pisou em Poço escondido");
  await expect(aviso).toContainText("Salvaguarda DES CD 12 · 2d6 contundente");
  await expect(jogador.locator(".arm-aviso")).toHaveCount(0);
  expect(temRaio(await ultimoQuadro(jogador), 90)).toBe(false);

  // Rolar o dano mostra o total e a conta; ainda não revelou nada.
  await aviso.getByRole("button", { name: /rolar o dano/ }).click();
  await expect(aviso.getByRole("status")).toContainText(/Dano: \d+/);
  expect((await armadilhasDoBanco())[0].estado).toBe("armada");

  // Deixar passar some com o aviso e a armadilha continua escondida e vigiando.
  await aviso.getByRole("button", { name: "deixar passar" }).click();
  await expect(aviso).toHaveCount(0);
  expect((await armadilhasDoBanco())[0].estado).toBe("armada");
  expect(temRaio(await ultimoQuadro(jogador), 90)).toBe(false);

  // Sai e volta: avisa de novo. Agora o Mestre dispara: a mesa passa a ver e o log conta.
  await saireVoltar();
  await expect(aviso).toBeVisible({ timeout: 30_000 });
  await aviso.getByRole("button", { name: "disparar" }).click();
  await expect.poll(async () => (await armadilhasDoBanco())[0].estado).toBe("disparada");
  await expect(aviso).toHaveCount(0);
  await ver(jogador, (q) => temRaio(q, 90));
  await expect.poll(async () => (await linhasDoLog()).some((t) => t.includes("Jogador Robô caiu em Poço escondido"))).toBe(true);

  // Disparada não avisa mais: sai e entra de novo, nada.
  await saireVoltar();
  await page.waitForTimeout(2500);
  await expect(aviso).toHaveCount(0);

  // Rearmar (escondida de novo) some pra mesa; revelar mostra; desarmar neutraliza.
  await abrirFerramenta(page, "Armadilhas");
  await page.getByRole("button", { name: "Armar Poço escondido de novo, escondida" }).click();
  await expect.poll(async () => (await armadilhasDoBanco())[0].estado).toBe("armada");
  await ver(jogador, (q) => temRaio(q, 90), false);
  await page.getByRole("button", { name: "Revelar Poço escondido pra mesa" }).click();
  await ver(jogador, (q) => temRaio(q, 90));
  await saireVoltar();
  await expect(aviso).toBeVisible({ timeout: 30_000 });
  await aviso.getByRole("button", { name: "desarmar" }).click();
  await expect.poll(async () => (await armadilhasDoBanco())[0].estado).toBe("desarmada");
  await expect.poll(async () => (await linhasDoLog()).some((t) => t.includes("Poço escondido foi desarmada"))).toBe(true);

  // Editar a CD e apagar.
  await page.getByRole("button", { name: "Editar Poço escondido" }).click();
  await page.getByLabel("CD da salvaguarda").fill("15");
  await page.getByRole("button", { name: "salvar alterações" }).click();
  await expect.poll(async () => (await armadilhasDoBanco())[0].cd).toBe(15);
  await page.getByRole("button", { name: "Apagar Poço escondido" }).click();
  await expect.poll(async () => (await armadilhasDoBanco()).length).toBe(0);
  await ver(jogador, (q) => temRaio(q, 90), false);

  expect(erros).toEqual([]);
  expect(errosJogador).toEqual([]);
  await contexto.close();
});

test("armadilhas: o aviso de pisada aparece em qualquer aba do Mestre, não só no Mapa", async ({ page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await prepararMapa(page);
  const cena = await cenaDoBanco();
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 20, hp_max: 20 });
  await criarPeca(cena.id, "jogador-robo", 165, 165);
  const r = await rest("cena_armadilhas", {
    method: "POST",
    body: JSON.stringify({ cena_id: cena.id, room_code: SALA, nome: "Chamas ocultas", x: 405, y: 285, raio: 0.75, salvaguarda: "DES", cd: 14, dano: "3d6 fogo", estado: "armada" }),
  });
  expect(r.ok).toBe(true);

  // O Mestre sai do Mapa e fica na aba Combate.
  await page.getByRole("button", { name: "Combate", exact: true }).click();
  await expect(page.locator(".cena-canvas")).toHaveCount(0);
  await page.waitForTimeout(2500); // o vigia aprende onde cada um está antes de alguém pisar

  const peao = (await pecasDoBanco()).find((p) => p.slug === "jogador-robo")!;
  const mover = await rest(`cena_pecas?id=eq.${peao.id}`, { method: "PATCH", body: JSON.stringify({ x: 405, y: 285 }) });
  expect(mover.ok).toBe(true);
  const aviso = page.locator(".arm-aviso");
  await expect(aviso).toBeVisible({ timeout: 30_000 });
  await expect(aviso).toContainText("Jogador Robô pisou em Chamas ocultas");

  // Resolver daqui já vale: dispara, e o estado muda no banco.
  await aviso.getByRole("button", { name: "disparar" }).click();
  await expect.poll(async () => (await armadilhasDoBanco())[0].estado).toBe("disparada");
  await expect(aviso).toHaveCount(0);
  expect(erros).toEqual([]);
});

test("perigo contínuo: a mesa vê a zona; o Mestre é avisado ao entrar e no início do turno, e extingue", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await page.addInitScript(espiar);
  await prepararMapa(page);
  const cena = await cenaDoBanco();
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 20, hp_max: 20 });
  await criarFicha("outro-robo", "Outro Robô", { hp: 20, hp_max: 20 });
  await criarPeca(cena.id, "jogador-robo", 165, 165);
  const r = await rest("cena_armadilhas", {
    method: "POST",
    body: JSON.stringify({ cena_id: cena.id, room_code: SALA, nome: "Fogo", tipo: "perigo", estado: "revelada", x: 405, y: 285, raio: 3, salvaguarda: "DES", cd: 13, dano: "1d6 fogo" }),
  });
  expect(r.ok).toBe(true);
  // A vez é do outro: o jogador entra no fogo fora do turno dele.
  await porNaIniciativa([
    { slug: "jogador-robo", name: "Jogador Robô", init: 20 },
    { slug: "outro-robo", name: "Outro Robô", init: 10 },
  ]);
  const vez = (turn: number) => rest(`combat_state?room_code=eq.${SALA}`, { method: "PATCH", body: JSON.stringify({ turn }) });
  expect((await vez(1)).ok).toBe(true);
  const { jogador, erros: errosJogador } = await abrirComoJogador(browser, "jogador-robo");

  // O perigo é à vista da mesa (a zona de 3 m = 60 px); o Mestre também a vê.
  await ver(page, (q) => temRaio(q, 60));
  await ver(jogador, (q) => temRaio(q, 60));

  await page.getByRole("button", { name: "Combate", exact: true }).click();
  await page.waitForTimeout(2500); // o vigia aprende onde cada um está
  const peao = (await pecasDoBanco()).find((p) => p.slug === "jogador-robo")!;
  const mover = (x: number, y: number) => rest(`cena_pecas?id=eq.${peao.id}`, { method: "PATCH", body: JSON.stringify({ x, y }) });
  expect((await mover(405, 285)).ok).toBe(true);
  const aviso = page.locator(".arm-aviso");
  await expect(aviso).toBeVisible({ timeout: 30_000 });
  await expect(aviso).toContainText("Jogador Robô entrou em Fogo");
  await expect(aviso).toContainText("Salvaguarda DES CD 13 · 1d6 fogo");
  await aviso.getByRole("button", { name: "registrar no log" }).click();
  await expect(aviso).toHaveCount(0);
  await expect.poll(async () => (await linhasDoLog()).some((t) => t.includes("Jogador Robô entrou em Fogo"))).toBe(true);
  expect((await armadilhasDoBanco())[0].estado).toBe("revelada"); // perigo não se gasta

  // A vez chega nele, que está dentro do fogo: avisa de novo, agora como início do turno.
  expect((await vez(0)).ok).toBe(true);
  await expect(aviso).toBeVisible({ timeout: 30_000 });
  await expect(aviso).toContainText("Jogador Robô começou o turno em Fogo");
  await aviso.getByRole("button", { name: "deixar passar" }).click();
  await expect(aviso).toHaveCount(0);

  // Mais uma volta e o Mestre extingue: some o perigo pra mesa (continua marcado como extinto) e o log conta.
  expect((await vez(1)).ok).toBe(true);
  await page.waitForTimeout(1500);
  expect((await vez(0)).ok).toBe(true);
  await expect(aviso).toBeVisible({ timeout: 30_000 });
  await aviso.getByRole("button", { name: "extinguir" }).click();
  await expect.poll(async () => (await armadilhasDoBanco())[0].estado).toBe("desarmada");
  await expect.poll(async () => (await linhasDoLog()).some((t) => t.includes("Fogo foi extinto"))).toBe(true);

  // Extinto não avisa mais, nem no turno.
  expect((await vez(1)).ok).toBe(true);
  await page.waitForTimeout(1500);
  expect((await vez(0)).ok).toBe(true);
  await page.waitForTimeout(2500);
  await expect(aviso).toHaveCount(0);

  expect(erros).toEqual([]);
  expect(errosJogador).toEqual([]);
});

test("perigo pela tela: o Mestre escolhe Perigo, um pronto, toca no mapa, e ele nasce à vista da mesa", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await limparSala();
  await page.addInitScript(espiar);
  await prepararMapa(page);
  const cena = await cenaDoBanco();
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 20, hp_max: 20 });
  await criarPeca(cena.id, "jogador-robo", 165, 165);
  const { jogador, erros: errosJogador } = await abrirComoJogador(browser, "jogador-robo");

  await abrirFerramenta(page, "Armadilhas");
  await page.getByRole("button", { name: "☠️ Perigo" }).click();
  await page.getByRole("button", { name: "Gás venenoso", exact: true }).click(); // CON 13, 1d6 veneno, 4,5 m = 90 px
  await page.getByRole("button", { name: "📍 colocar no mapa" }).click();
  await fecharPainelDoMapa(page);
  await tocarNoMapa(page, 405, 285);
  await expect.poll(async () => (await armadilhasDoBanco()).length).toBe(1);
  expect((await armadilhasDoBanco())[0]).toMatchObject({ nome: "Gás venenoso", x: 405, y: 285, raio: 4.5, salvaguarda: "CON", cd: 13, dano: "1d6 veneno", estado: "revelada" });
  const tipo = (await (await rest(`cena_armadilhas?select=tipo&room_code=eq.${SALA}`)).json()) as { tipo: string }[];
  expect(tipo[0].tipo).toBe("perigo");
  // A mesa vê a zona na hora (perigo não nasce escondido).
  await ver(jogador, (q) => temRaio(q, 90));
  // E a lista fala de perigo: extinguir, e não "desarmar".
  await abrirFerramenta(page, "Armadilhas");
  await expect(page.getByRole("button", { name: "Extinguir Gás venenoso" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Disparar Gás venenoso" })).toHaveCount(0);
  await page.getByRole("button", { name: "Extinguir Gás venenoso" }).click();
  await expect.poll(async () => (await armadilhasDoBanco())[0].estado).toBe("desarmada");
  expect(erros).toEqual([]);
  expect(errosJogador).toEqual([]);
});
