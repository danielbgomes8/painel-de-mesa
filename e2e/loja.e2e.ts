import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { SALA, bancoConfigurado, coletarErros, comoJogador, criarFicha, entrarComoMestre, limparSala, rest } from "./apoio";

/**
 * Loja (migration 0038): o Mestre monta e abre; o jogador compra com troco, o estoque baixa sem vender a última duas
 * vezes, e o log conta. Mesma sala `ci-teste`, limpa antes e depois.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

const contextosAbertos: BrowserContext[] = [];
test.afterEach(async () => {
  for (const c of contextosAbertos.splice(0)) await c.close().catch(() => undefined);
});

type Ficha = { moedas: Record<string, number>; inventario: { nome: string; qtd: number }[] };
async function fichaDe(slug: string): Promise<Ficha> {
  const r = await rest(`characters?select=moedas,inventario&room_code=eq.${SALA}&slug=eq.${slug}`);
  return ((await r.json()) as Ficha[])[0];
}
type LinhaItem = { id: string; nome: string; preco_pc: number; estoque: number | null };
async function itensDoBanco(): Promise<LinhaItem[]> {
  const r = await rest(`loja_itens?select=id,nome,preco_pc,estoque&room_code=eq.${SALA}&order=created_at`);
  if (!r.ok) throw new Error(`não leu os itens da loja: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) as LinhaItem[];
}
async function lojasDoBanco(): Promise<{ id: string; nome: string; aberta: boolean }[]> {
  const r = await rest(`lojas?select=id,nome,aberta&room_code=eq.${SALA}&order=created_at`);
  if (!r.ok) throw new Error(`não leu as lojas: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) as { id: string; nome: string; aberta: boolean }[];
}
async function linhasDoLog(): Promise<string[]> {
  const r = await rest(`combat_log?select=text&room_code=eq.${SALA}&order=created_at`);
  return ((await r.json()) as { text: string }[]).map((l) => l.text);
}

async function abrirJogador(browser: Browser, slug: string) {
  const contexto = await browser.newContext();
  contextosAbertos.push(contexto);
  const pagina = await contexto.newPage();
  const erros = coletarErros(pagina);
  await comoJogador(pagina, slug);
  await pagina.goto(`/?sala=${SALA}`);
  await expect(pagina.getByRole("button", { name: "Campanha", exact: true })).toBeVisible({ timeout: 30_000 });
  return { pagina, erros };
}
async function irParaLoja(page: Page) {
  await page.getByRole("button", { name: "Campanha", exact: true }).click();
  await page.getByRole("button", { name: /Loja/ }).click();
}

async function porItem(page: Page, nome: string, preco: string, moeda: string, estoque: number | null) {
  await page.getByLabel("Nome do item").fill(nome);
  await page.getByLabel("Preço", { exact: true }).fill(preco);
  await page.getByLabel("Moeda do preço").selectOption({ label: moeda });
  if (estoque === null) {
    await page.getByRole("checkbox", { name: "sempre tem" }).check();
  } else {
    await page.getByRole("checkbox", { name: "sempre tem" }).uncheck();
    await page.getByLabel("Estoque", { exact: true }).fill(String(estoque));
  }
  await page.getByRole("button", { name: "pôr à venda" }).click();
}

test("loja: o Mestre monta e abre; o jogador compra com troco; sem dinheiro ou estoque não compra; duas pessoas na última unidade, só uma leva", async ({ browser, page }) => {
  const erros = coletarErros(page);
  // Ana tem 20 PO; Beto, 1 PO; Carla, 10 PO (as duas podem pagar a última unidade e disputam).
  await criarFicha("ana-robo", "Ana Robô", { hp: 20, hp_max: 20, moedas: { pc: 0, pp: 0, pe: 0, po: 20, pl: 0 } });
  await criarFicha("beto-robo", "Beto Robô", { hp: 20, hp_max: 20, moedas: { pc: 0, pp: 0, pe: 0, po: 1, pl: 0 } });
  await criarFicha("carla-robo", "Carla Robô", { hp: 20, hp_max: 20, moedas: { pc: 0, pp: 0, pe: 0, po: 10, pl: 0 } });
  await entrarComoMestre(page);
  await irParaLoja(page);
  const ana = await abrirJogador(browser, "ana-robo");
  const beto = await abrirJogador(browser, "beto-robo");
  const carla = await abrirJogador(browser, "carla-robo");

  // Monta a loja (nasce fechada).
  await page.getByLabel("Nome da loja").fill("Empório da esquina");
  await page.getByRole("button", { name: "criar loja" }).click();
  await expect.poll(async () => (await lojasDoBanco()).length).toBe(1);
  expect((await lojasDoBanco())[0]).toMatchObject({ nome: "Empório da esquina", aberta: false });
  await porItem(page, "Poção de cura", "5", "PO", 2);
  await expect.poll(async () => (await itensDoBanco()).length).toBe(1);
  await porItem(page, "Corda", "5", "PP", null);
  await expect.poll(async () => (await itensDoBanco()).length).toBe(2);
  expect(await itensDoBanco()).toEqual([
    expect.objectContaining({ nome: "Poção de cura", preco_pc: 500, estoque: 2 }),
    expect.objectContaining({ nome: "Corda", preco_pc: 50, estoque: null }),
  ]);

  // Fechada: ninguém vê.
  await irParaLoja(ana.pagina);
  await expect(ana.pagina.getByText("Nenhuma loja aberta por enquanto.")).toBeVisible();
  await expect(ana.pagina.getByText("Poção de cura")).toHaveCount(0);

  // Abre pra mesa: aparece pra todos.
  await page.getByRole("button", { name: "abrir pra mesa" }).click();
  await expect.poll(async () => (await lojasDoBanco())[0].aberta).toBe(true);
  await expect(ana.pagina.getByText("Poção de cura")).toBeVisible({ timeout: 30_000 });
  await irParaLoja(beto.pagina);
  await irParaLoja(carla.pagina);
  await expect(ana.pagina.getByText("Seu dinheiro: 20 PO")).toBeVisible();

  // A Ana compra 1 Poção (5 PO): sobram 15 PO, o item entra no inventário, o estoque cai pra 1, o log conta.
  await ana.pagina.getByRole("button", { name: "Comprar Poção de cura" }).click();
  await expect.poll(async () => (await fichaDe("ana-robo")).moedas.po).toBe(15);
  expect((await fichaDe("ana-robo")).inventario).toEqual([expect.objectContaining({ nome: "Poção de cura", qtd: 1 })]);
  await expect.poll(async () => (await itensDoBanco())[0].estoque).toBe(1);
  await expect.poll(async () => (await linhasDoLog()).some((t) => t.includes("Ana Robô comprou Poção de cura por 5 PO"))).toBe(true);
  await expect(ana.pagina.getByText("Comprou Poção de cura por 5 PO.")).toBeVisible();

  // A Ana compra Corda (5 PP) com troco: paga com 1 PO, volta 5 PP.
  await ana.pagina.getByRole("button", { name: "Comprar Corda" }).click();
  await expect.poll(async () => (await fichaDe("ana-robo")).moedas.pp).toBe(5);
  expect((await fichaDe("ana-robo")).moedas).toMatchObject({ po: 14, pp: 5 });
  expect((await itensDoBanco())[1].estoque).toBeNull(); // "sempre tem" não baixa

  // O Beto só tem 1 PO: a Poção custa 5 PO, o botão fica desligado e o motivo aparece.
  await expect(beto.pagina.getByRole("button", { name: "Comprar Poção de cura" })).toBeDisabled();
  await expect(beto.pagina.getByText("Faltam 4 PO.")).toBeVisible();

  // A última Poção: a Ana e a Carla clicam juntas. Só uma leva; a outra é avisada e não paga nada.
  await Promise.all([ana.pagina.getByRole("button", { name: "Comprar Poção de cura" }).click(), carla.pagina.getByRole("button", { name: "Comprar Poção de cura" }).click()]);
  await expect.poll(async () => (await itensDoBanco())[0].estoque).toBe(0);
  await expect
    .poll(async () => {
      const [a, c] = await Promise.all([fichaDe("ana-robo"), fichaDe("carla-robo")]);
      const potes = [a, c].filter((f) => f.inventario.some((i) => i.nome === "Poção de cura" && i.qtd >= 1)).length;
      return potes;
    })
    .toBeGreaterThanOrEqual(1);
  const [a2, c2] = await Promise.all([fichaDe("ana-robo"), fichaDe("carla-robo")]);
  const totalDePocoes = [a2, c2].reduce((soma, f) => soma + f.inventario.filter((i) => i.nome === "Poção de cura").reduce((s, i) => s + i.qtd, 0), 0);
  expect(totalDePocoes).toBe(2); // a Ana já tinha 1, e UMA delas levou a última: nunca vendeu três
  const ficouCarla = c2.inventario.some((i) => i.nome === "Poção de cura");
  // Quem não levou não perdeu dinheiro.
  if (ficouCarla) expect(c2.moedas.po).toBe(5);
  else expect(c2.moedas.po).toBe(10);
  // Esgotado: o botão some e a loja diz.
  await expect(carla.pagina.getByText("esgotado")).toBeVisible({ timeout: 30_000 });
  await expect(carla.pagina.getByRole("button", { name: "Comprar Poção de cura" })).toHaveCount(0);

  // Fechar a loja some pros jogadores.
  await page.getByRole("button", { name: "fechar a loja" }).click();
  await expect(ana.pagina.getByText("Nenhuma loja aberta por enquanto.")).toBeVisible({ timeout: 30_000 });

  // Apagar a loja apaga os itens.
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Apagar a loja Empório da esquina" }).click();
  await expect.poll(async () => (await lojasDoBanco()).length).toBe(0);
  expect(await itensDoBanco()).toEqual([]);

  expect(erros).toEqual([]);
  expect(ana.erros).toEqual([]);
  expect(beto.erros).toEqual([]);
  expect(carla.erros).toEqual([]);
});
