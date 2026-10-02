import { expect, test } from "@playwright/test";
import { SALA, bancoConfigurado, coletarErros, comoJogador, criarFicha, entrarComoMestre, fichaDoBanco, limparSala, mudarFicha, rest } from "./apoio";

/**
 * Inventário, magias e baú do grupo (migration 0026), contra o banco de verdade:
 * a jogadora conjura (gasta espaço, liga concentração, vai pro log), mexe no
 * inventário e nas moedas; o Mestre guarda no baú, entrega item e divide o dinheiro.
 * Mesma sala `ci-teste`, limpa antes e depois.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

const ESPACOS = [
  { name: "Espaço de magia Nv. 1", max: 4, cur: 4, short_rest: false },
  { name: "Espaço de magia Nv. 2", max: 3, cur: 3, short_rest: false },
];

type Bau = { nome: string; qtd: number; moeda: string | null };
async function bauDoBanco(): Promise<Bau[]> {
  const r = await rest(`bau_itens?select=nome,qtd,moeda&room_code=eq.${SALA}&order=created_at`);
  if (!r.ok) throw new Error(`não leu o baú: HTTP ${r.status}`);
  return (await r.json()) as Bau[];
}

test("magias: catálogo, preparar, conjurar com espaço, concentração e log", async ({ page }) => {
  const erros = coletarErros(page);
  await criarFicha("ana-robo", "Ana Robô", { resources: ESPACOS });
  await comoJogador(page, "ana-robo");
  await page.goto(`/?sala=${SALA}`);
  await page.getByRole("button", { name: "Fichas", exact: true }).click();

  await page.locator(".fc-sechead", { hasText: "Magias" }).click();
  await expect(page.locator(".mg-espaco")).toHaveCount(2);

  // Catálogo: acha pelo nome em português e pelo original em inglês, sem acento.
  await page.getByRole("button", { name: "+ magia" }).click();
  await page.getByLabel("buscar magia no catálogo").fill("bencao");
  await expect(page.locator(".mg-resultado").first()).toContainText("Bênção");
  await page.locator(".mg-resultado", { hasText: "Bênção" }).getByRole("button", { name: "+ adicionar" }).click();
  await page.getByLabel("buscar magia no catálogo").fill("fireball");
  await page.locator(".mg-resultado").filter({ has: page.locator("b", { hasText: /^Bola de fogo$/ }) }).getByRole("button", { name: "+ adicionar" }).click();
  await page.getByLabel("nome da magia a cadastrar à mão").fill("Luz própria");
  await page.getByLabel("nível da magia").selectOption("0");
  await page.getByRole("button", { name: "+ cadastrar" }).click();
  await page.getByRole("button", { name: "fechar busca" }).click();

  await expect.poll(async () => ((await fichaDoBanco("ana-robo")).magias as unknown[]).length).toBe(3);
  const magias = (await fichaDoBanco("ana-robo")).magias as { nome: string; nivel: number; concentracao: boolean; descricao: string }[];
  const bola = magias.find((m) => m.nome === "Bola de fogo")!;
  expect(bola.nivel).toBe(3);
  expect(bola.descricao).toContain("Esfera de 6 m de raio"); // texto em português, em metros
  expect(magias.find((m) => m.nome === "Bênção")!.concentracao).toBe(true);

  // Truque não gasta espaço.
  await page.locator(".mg-item", { hasText: "Luz própria" }).getByRole("button", { name: "conjurar" }).click();
  expect(((await fichaDoBanco("ana-robo")).resources as { cur: number }[]).map((r) => r.cur)).toEqual([4, 3]);

  // Bênção (1º nível, concentração): há dois espaços possíveis, então pergunta qual.
  await page.locator(".mg-item", { hasText: "Bênção" }).getByRole("button", { name: "conjurar" }).click();
  await page.getByRole("group", { name: /Como conjurar Bênção/ }).getByRole("button", { name: "1º (4)" }).click();
  await expect
    .poll(async () => {
      const f = await fichaDoBanco("ana-robo");
      return JSON.stringify([(f.resources as { cur: number }[]).map((r) => r.cur), f.concentration, f.concentration_on]);
    })
    .toBe(JSON.stringify([[3, 3], true, "Bênção"]));
  await expect(page.locator(".mg-conc")).toContainText("Bênção");

  // Bola de fogo (3º nível) sem espaço de 3º: avisa e não gasta nada.
  await page.locator(".mg-item", { hasText: "Bola de fogo" }).getByRole("button", { name: "conjurar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sem espaço" })).toBeVisible();
  expect(((await fichaDoBanco("ana-robo")).resources as { cur: number }[]).map((r) => r.cur)).toEqual([3, 3]);

  // O gasto foi pro log do combate.
  const log = await rest(`combat_log?select=text&room_code=eq.${SALA}`);
  expect(((await log.json()) as { text: string }[]).map((l) => l.text)).toContain("Ana Robô conjura Bênção");

  expect(erros).toEqual([]);
});

test("inventário: moedas, item que empilha, peso e limite de sintonia", async ({ page }) => {
  const erros = coletarErros(page);
  await comoJogador(page, "ana-robo");
  await page.goto(`/?sala=${SALA}`);
  await page.getByRole("button", { name: "Fichas", exact: true }).click();
  await page.locator(".fc-sechead", { hasText: "Inventário e moedas" }).click();

  await page.getByLabel("PO", { exact: true }).fill("12");
  await page.getByLabel("PO", { exact: true }).blur();
  await expect.poll(async () => ((await fichaDoBanco("ana-robo")).moedas as { po: number }).po).toBe(12);

  // Duas vezes o mesmo item comum empilha numa linha só.
  for (const q of ["2", "3"]) {
    const novo = page.locator(".inv-novo");
    await novo.getByLabel("nome do novo item").fill("Corda");
    await novo.getByLabel("quantidade", { exact: true }).fill(q);
    await novo.getByLabel("peso de cada unidade, em quilos").fill("2,5");
    await novo.getByRole("button", { name: "+ item" }).click();
  }
  await expect
    .poll(async () => JSON.stringify(((await fichaDoBanco("ana-robo")).inventario as { nome: string; qtd: number; peso: number }[]).map((i) => [i.nome, i.qtd, i.peso])))
    .toBe(JSON.stringify([["Corda", 5, 2.5]]));
  // 5 × 2,5 kg + 12 moedas × 0,01 kg
  await expect(page.locator(".inv-resumo")).toContainText("12,62 kg");

  // Três itens já sintonizados: o quarto recusa e explica.
  const mag = (nome: string, sintonia: number) => ({ nome, qtd: 1, peso: 0, descricao: "", magico: true, raridade: "raro", equipado: false, sintonia });
  await mudarFicha("ana-robo", { inventario: [mag("Anel A", 2), mag("Anel B", 2), mag("Anel C", 2), mag("Anel D", 1)] });
  await expect(page.locator(".inv-item", { hasText: "Anel D" })).toBeVisible();
  await page.locator(".inv-item", { hasText: "Anel D" }).getByRole("button", { name: "sintonizar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "limite" })).toBeVisible();
  const aneis = (await fichaDoBanco("ana-robo")).inventario as { nome: string; sintonia: number }[];
  expect(aneis.find((i) => i.nome === "Anel D")!.sintonia).toBe(1);

  expect(erros).toEqual([]);
});

test("baú do grupo: guardar, entregar item, dividir o dinheiro", async ({ page }) => {
  const erros = coletarErros(page);
  await criarFicha("beto-robo", "Beto Robô");
  await mudarFicha("ana-robo", { inventario: [], moedas: { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 } });
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Campanha", exact: true }).click();
  await page.getByRole("button", { name: "🎒 Baú" }).click();

  await page.getByLabel("nome do item a guardar").fill("Poção de cura");
  await page.locator(".bau input[aria-label=quantidade]").fill("3");
  await page.getByRole("button", { name: "+ guardar" }).click();
  await page.getByRole("group", { name: "Quantidade de moedas" }).getByRole("spinbutton").nth(3).fill("41"); // PO
  await page.getByRole("button", { name: "guardar no baú" }).click();
  await expect.poll(bauDoBanco).toEqual([
    { nome: "Poção de cura", qtd: 3, moeda: null },
    { nome: "", qtd: 41, moeda: "po" },
  ]);
  await expect(page.locator(".bau-total")).toContainText("41 PO");

  // O Mestre escolhe quem recebe e leva 2 poções pra Ana.
  await page.getByLabel(/Quem recebe/).selectOption({ label: "Ana Robô" });
  await page.locator(".inv-item", { hasText: "Poção de cura" }).getByLabel("quantas Poção de cura pegar").fill("2");
  await page.locator(".inv-item", { hasText: "Poção de cura" }).getByRole("button", { name: /pegar/ }).click();
  await expect.poll(async () => (await bauDoBanco()).find((b) => b.nome === "Poção de cura")?.qtd).toBe(1);
  await expect
    .poll(async () => JSON.stringify(((await fichaDoBanco("ana-robo")).inventario as { nome: string; qtd: number }[]).map((i) => [i.nome, i.qtd])))
    .toBe(JSON.stringify([["Poção de cura", 2]]));

  // Dividir 41 PO entre dois: 20 pra cada, 1 sobra no baú.
  await page.getByRole("button", { name: "dividir o dinheiro entre o grupo" }).click();
  await expect(page.locator(".bau-sub").last()).toContainText("20 PO");
  await page.getByRole("button", { name: "dividir", exact: true }).click();
  await expect.poll(async () => ((await fichaDoBanco("ana-robo")).moedas as { po: number }).po).toBe(20);
  expect(((await fichaDoBanco("beto-robo")).moedas as { po: number }).po).toBe(20);
  expect((await bauDoBanco()).find((b) => b.moeda === "po")?.qtd).toBe(1);

  expect(erros).toEqual([]);
});

test("baú: duas pessoas pegam a mesma poção ao mesmo tempo, só uma leva", async () => {
  await limparSala();
  await criarFicha("ana-robo", "Ana Robô");
  const r = await rest("bau_itens", { method: "POST", body: JSON.stringify({ room_code: SALA, nome: "Poção única", qtd: 1 }), headers: { Prefer: "return=representation" } });
  const [{ id }] = (await r.json()) as { id: string }[];
  // O mesmo "troco só se ninguém mexeu" que o app usa: update ... where qtd = a que li.
  const tirar = () => rest(`bau_itens?id=eq.${id}&qtd=eq.1`, { method: "PATCH", body: JSON.stringify({ qtd: 0 }), headers: { Prefer: "return=representation" } });
  const respostas = await Promise.all([tirar(), tirar(), tirar()]);
  const levaram = (await Promise.all(respostas.map((x) => x.json()))).filter((linhas) => (linhas as unknown[]).length > 0);
  expect(levaram).toHaveLength(1);
});
