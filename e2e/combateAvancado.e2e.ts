import { expect, test } from "@playwright/test";
import { bancoConfigurado, coletarErros, abrirMontagem, combateDoBanco, criarFicha, entrarComoMestre, fichaDoBanco, limparSala, porNaIniciativa, rest, SALA } from "./apoio";

/**
 * Encerrar combate (XP dos derrotados dividido), ações lendárias (gastar, resistência, voltam no turno do monstro) e
 * emboscada (surpreso vai pro log). Semeia pelo banco e confere na tela e no banco.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });
test.beforeEach(limparSala);
test.afterAll(limparSala);

const logDoBanco = async (): Promise<string[]> => {
  const r = await rest(`combat_log?select=text&room_code=eq.${SALA}&order=created_at.asc`);
  return ((await r.json()) as { text: string }[]).map((l) => l.text);
};

test("encerrar combate: XP do Goblin derrotado dividido entre os jogadores, ordem limpa, e desfazer devolve tudo", async ({ page }) => {
  const erros = coletarErros(page);
  await criarFicha("ana-robo", "Ana Robô", { hp: 20, hp_max: 20 });
  await criarFicha("beto-robo", "Beto Robô", { hp: 20, hp_max: 20 });
  await criarFicha("goblin-robo", "Goblin", { is_npc: true, hp: 0, hp_max: 7, ac: 15 });
  await porNaIniciativa([
    { slug: "ana-robo", name: "Ana Robô", init: 15 },
    { slug: "beto-robo", name: "Beto Robô", init: 12 },
    { slug: "goblin-robo", name: "Goblin", init: 9 },
  ]);
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Combate", exact: true }).click();
  await abrirMontagem(page);
  await page.getByRole("button", { name: "🏁 Encerrar combate" }).click();

  await expect(page.locator(".fim-resumo")).toContainText("1 inimigo a 0 PV");
  // O XP do Goblin vem do catálogo pelo nome (50 XP, ND 1/4).
  await expect(page.getByLabel("XP de Goblin")).toHaveValue("50", { timeout: 30_000 });
  await expect(page.locator(".fim-total")).toContainText("25 pra cada um");
  await page.locator(".fim-acoes").getByRole("button", { name: "🏁 Encerrar combate" }).click();

  await expect.poll(async () => (await fichaDoBanco("ana-robo")).xp).toBe(25);
  expect((await fichaDoBanco("beto-robo")).xp).toBe(25);
  expect((await combateDoBanco()).order_json).toEqual([]);
  await expect.poll(async () => (await logDoBanco()).some((l) => l.startsWith("🏁 Combate encerrado"))).toBe(true);

  // Desfazer devolve o XP e a ordem.
  await page.getByRole("button", { name: /desfazer/i }).first().click();
  await expect.poll(async () => (await fichaDoBanco("ana-robo")).xp).toBe(0);
  await expect.poll(async () => (await combateDoBanco()).order_json.length).toBe(3);
  expect(erros).toEqual([]);
});

test("ações lendárias: gastar vai pro log, resistência gasta, e as ações voltam sozinhas no turno do monstro", async ({ page }) => {
  const erros = coletarErros(page);
  await criarFicha("ana-robo", "Ana Robô", { hp: 20, hp_max: 20 });
  await criarFicha("dragao-robo", "Dragão Robô", { is_npc: true, revealed: true, hp: 100, hp_max: 100, ac: 18 });
  await porNaIniciativa([
    { slug: "dragao-robo", name: "Dragão Robô", init: 20 },
    { slug: "ana-robo", name: "Ana Robô", init: 10 },
  ]);
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Combate", exact: true }).click();

  await page.locator(".initrow", { hasText: "Dragão Robô" }).locator(".whobtn").click();
  await page.getByRole("button", { name: "👑 Ações lendárias" }).click();
  await expect(page.getByText("Ações lendárias 3/3")).toBeVisible();
  await page.getByRole("button", { name: "gastar 2" }).click();
  await expect(page.getByText("Ações lendárias 1/3")).toBeVisible();
  await page.getByRole("button", { name: "usar", exact: true }).click();
  await expect(page.getByText("Resistência lendária 2/3")).toBeVisible();

  const recursos = async () => (await fichaDoBanco("dragao-robo")).resources as { name: string; cur: number }[];
  await expect.poll(async () => (await recursos()).find((r) => r.name === "Ações lendárias")?.cur).toBe(1);
  await expect.poll(async () => (await logDoBanco()).some((l) => l.includes("usou 2 ações lendárias (restam 1/3)"))).toBe(true);

  // Passa pela Ana e volta pro Dragão: as ações voltam a 3; a resistência continua gasta.
  await page.getByRole("button", { name: /Próximo turno/ }).click();
  await page.getByRole("button", { name: /Próximo turno/ }).click();
  await expect.poll(async () => (await recursos()).find((r) => r.name === "Ações lendárias")?.cur).toBe(3);
  expect((await recursos()).find((r) => r.name === "Resistência lendária")?.cur).toBe(2);
  expect(erros).toEqual([]);
});

test("emboscada: o jogador marcado como surpreso entra na ordem e o log diz", async ({ page }) => {
  const erros = coletarErros(page);
  await criarFicha("ana-robo", "Ana Robô", { hp: 20, hp_max: 20 });
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Combate", exact: true }).click();
  await abrirMontagem(page);
  await page.getByText("💥 Emboscada").click();
  await page.locator(".emb").getByRole("button", { name: "Ana Robô", exact: true }).click();
  await expect(page.getByText("💥 Emboscada · 1 surpreso")).toBeVisible();
  await page.getByRole("button", { name: /Pôr 1 jogador na ordem/ }).click();

  await expect.poll(async () => (await combateDoBanco()).order_json.length).toBe(1);
  await expect.poll(async () => (await logDoBanco()).some((l) => l.includes("Ana Robô entrou no combate") && l.includes("surpreso"))).toBe(true);
  expect(erros).toEqual([]);
});
