import { expect, test } from "@playwright/test";
import { SALA, bancoConfigurado, coletarErros, criarFicha, entrarComoMestre, limparSala, rest } from "./apoio";

/**
 * Histórico do baú: lê do log do combate (no banco, não da tela, que guarda só 40 linhas) as
 * trocas que começam com 🎒 ou 💰, agrupa por dia, filtra por tipo e se atualiza sozinho quando
 * alguém mexe no baú. Mesma sala `ci-teste`, limpa antes e depois.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

const horas = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

test("histórico do baú: vazio, depois com linhas de dias diferentes, filtros e atualização ao vivo", async ({ page }) => {
  const erros = coletarErros(page);
  await criarFicha("ana-robo", "Ana Robô");
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Campanha", exact: true }).click();
  await page.getByRole("button", { name: "🎒 Baú" }).click();

  // Fechado por padrão; aberto sem nada, explica que só guarda daqui pra frente.
  const secao = page.getByRole("region", { name: "Histórico do baú" });
  await expect(secao.locator(".bau-hist-dia")).toHaveCount(0);
  await secao.getByRole("button", { name: /Histórico do baú/ }).click();
  await expect(secao).toContainText("Ainda não há nada no histórico");

  // Semeia: 2 trocas de agora há pouco, 1 de 3 dias atrás, 1 linha de combate (que não é do baú).
  const seed = [
    { room_code: SALA, text: "🎒 Ana Robô pegou 2× Poção de cura do baú", created_at: horas(0.2) },
    { room_code: SALA, text: "💰 O Mestre guardou 41 PO no baú", created_at: horas(0.4) },
    { room_code: SALA, text: "🎒 O Mestre guardou 3× Poção de cura no baú", created_at: horas(72) },
    { room_code: SALA, text: "Ana Robô sofreu 5 de dano (10/20)", created_at: horas(0.1) },
  ];
  const r = await rest("combat_log", { method: "POST", body: JSON.stringify(seed) });
  expect(r.ok).toBe(true);

  // Fecha e abre de novo (o histórico só lê quando abre).
  await secao.getByRole("button", { name: /Histórico do baú/ }).click();
  await secao.getByRole("button", { name: /Histórico do baú/ }).click();

  await expect(secao.locator("li")).toHaveCount(3);
  await expect(secao).not.toContainText("sofreu 5 de dano");
  // Mais nova primeiro, e a de 3 dias atrás num grupo à parte (não é "Hoje").
  const linhas = await secao.locator("li").allTextContents();
  expect(linhas[0]).toContain("Ana Robô pegou 2× Poção de cura do baú");
  expect(linhas[1]).toContain("O Mestre guardou 41 PO no baú");
  expect(linhas[2]).toContain("3× Poção de cura no baú");
  await expect(secao.locator(".bau-hist-dia").first().locator(".qd-rotulo")).toHaveText(/Hoje|Ontem/);
  expect(await secao.locator(".bau-hist-dia").count()).toBeGreaterThanOrEqual(2);

  // Filtros.
  await secao.getByRole("button", { name: "💰 Dinheiro" }).click();
  await expect(secao.locator("li")).toHaveCount(1);
  await expect(secao.locator("li").first()).toContainText("41 PO");
  await secao.getByRole("button", { name: "🎒 Itens" }).click();
  await expect(secao.locator("li")).toHaveCount(2);
  await secao.getByRole("button", { name: "Tudo" }).click();
  await expect(secao.locator("li")).toHaveCount(3);

  // Ao vivo: guardar um item aparece no topo sem fechar e abrir.
  await page.getByLabel("nome do item a guardar").fill("Corda de seda");
  await page.getByRole("button", { name: "+ guardar" }).click();
  await expect(secao.locator("li").first()).toContainText("O Mestre guardou Corda de seda no baú");
  await expect(secao.locator("li")).toHaveCount(4);

  expect(erros).toEqual([]);
});

test("histórico do baú: mais de 30 trocas mostram 30 e abrem mais sob pedido", async ({ page }) => {
  await limparSala();
  const muitas = Array.from({ length: 45 }, (_, i) => ({ room_code: SALA, text: `🎒 O Mestre guardou Item ${i} no baú`, created_at: horas(1 + i / 100) }));
  expect((await rest("combat_log", { method: "POST", body: JSON.stringify(muitas) })).ok).toBe(true);
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Campanha", exact: true }).click();
  await page.getByRole("button", { name: "🎒 Baú" }).click();
  const secao = page.getByRole("region", { name: "Histórico do baú" });
  await secao.getByRole("button", { name: /Histórico do baú/ }).click();
  await expect(secao.locator("li")).toHaveCount(30);
  await secao.getByRole("button", { name: /ver mais \(15\)/ }).click();
  await expect(secao.locator("li")).toHaveCount(45);
});
