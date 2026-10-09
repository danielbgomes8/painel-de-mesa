import { expect, test } from "@playwright/test";
import { SALA, bancoConfigurado, coletarErros, criarFicha, entrarComoMestre, fichaDoBanco, limparSala, rest } from "./apoio";

/**
 * Salvaguarda em massa (Combate → Ações em massa): o Mestre escolhe os alvos,
 * diz atributo, CD e dano, o app rola o d20 de cada um e o dano uma vez só, o
 * Mestre confere e aplica. Os dados são fixados (Math.random = 0,5): d20 = 11 e
 * d6 = 4, então "8d6 fogo" rola 32.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

async function logDoBanco(): Promise<string[]> {
  const r = await rest(`combat_log?select=text&room_code=eq.${SALA}&order=created_at.desc`);
  return ((await r.json()) as { text: string }[]).map((l) => l.text);
}

test("salvaguarda em massa: rola, mostra quem passou, deixa corrigir, aplica metade/tudo e desfaz", async ({ page }) => {
  const erros = coletarErros(page);
  await criarFicha("ana-robo", "Ana Robô", { hp: 40, hp_max: 40, save_dex: 5 });
  await criarFicha("goblin-robo", "Goblin Robô", { is_npc: true, revealed: false, hp: 40, hp_max: 40, save_dex: 0 });
  await criarFicha("cego-robo", "Cego Robô", { hp: 40, hp_max: 40, save_dex: 0 });

  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Combate", exact: true }).click();
  await page.locator("details.gavetacombate", { hasText: "Ações em massa" }).locator(":scope > summary").click();

  // Dados fixos só daqui em diante (trocar Math.random desde o início quebra a abertura do app).
  await page.evaluate(() => {
    Math.random = () => 0.5;
  });

  // Sem alvo, o botão de rolar não funciona; sem CD, avisa.
  await expect(page.getByRole("button", { name: /Rolar por 0 alvos/ })).toBeDisabled();
  for (const nome of ["Ana Robô", "Goblin Robô · NPC"]) await page.getByRole("button", { name: nome, exact: true }).click();
  await page.getByRole("button", { name: /Rolar por 2 alvos/ }).click();
  await expect(page.getByText("Digite a CD")).toBeVisible();

  // CD 15, 8d6 fogo, metade se passar. Ana: 11+5 = 16 passa. Goblin: 11+0 = 11 falha.
  await page.getByLabel("CD da salvaguarda").fill("15");
  await page.getByLabel("Dano do efeito (vazio = sem dano)").fill("8d6 fogo");
  await page.getByRole("button", { name: /Rolar por 2 alvos/ }).click();
  const linhaAna = page.locator(".salvlista li", { hasText: "Ana Robô" });
  const linhaGoblin = page.locator(".salvlista li", { hasText: "Goblin Robô" });
  await expect(page.locator(".salvresultado")).toContainText("1 passou");
  await expect(page.locator(".salvresultado")).toContainText("O efeito rolou 32 de fogo");
  await expect(linhaAna).toContainText("11 +5 = 16");
  await expect(linhaAna.getByLabel("Dano em Ana Robô")).toHaveValue("16");
  await expect(linhaGoblin.getByLabel("Dano em Goblin Robô")).toHaveValue("32");

  // Corrigir: o goblin tinha resistência a fogo → o Mestre troca o dano pra 16; e vira "passou" e volta.
  await linhaGoblin.getByRole("button", { name: /Goblin Robô: falhou/ }).click();
  await expect(linhaGoblin.getByLabel("Dano em Goblin Robô")).toHaveValue("16");
  await linhaGoblin.getByRole("button", { name: /Goblin Robô: passou/ }).click();
  await expect(linhaGoblin.getByLabel("Dano em Goblin Robô")).toHaveValue("32");
  await linhaGoblin.getByLabel("Dano em Goblin Robô").fill("20");

  // "Selecionar quem falhou" deixa só o goblin marcado (pra pôr a condição depois).
  await page.getByRole("button", { name: "Selecionar quem falhou" }).click();
  await expect(page.getByRole("button", { name: "Goblin Robô · NPC", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Ana Robô", exact: true })).toHaveAttribute("aria-pressed", "false");

  // Aplicar: Ana 40-16 = 24; goblin 40-20 = 20; quem não estava na rolagem não muda.
  await page.getByRole("button", { name: "Aplicar o dano" }).click();
  await expect.poll(async () => (await fichaDoBanco("ana-robo")).hp).toBe(24);
  await expect.poll(async () => (await fichaDoBanco("goblin-robo")).hp).toBe(20);
  expect((await fichaDoBanco("cego-robo")).hp).toBe(40);
  await expect(page.locator(".salvresultado")).toHaveCount(0);

  // O log é público: a linha da salvaguarda só tem a contagem, e o goblin oculto é "Um inimigo".
  await expect
    .poll(async () => (await logDoBanco()).some((t) => t === "🎲 Salvaguarda de Destreza (CD 15): 1 passou, 1 falhou"))
    .toBe(true);
  const log = (await logDoBanco()).join("\n");
  expect(log).not.toContain("Goblin Robô");
  expect(log).toContain("Um inimigo");

  // Desfazer devolve o PV dos dois.
  await page.getByRole("button", { name: "↩ Desfazer" }).click();
  await expect.poll(async () => (await fichaDoBanco("ana-robo")).hp).toBe(40);
  await expect.poll(async () => (await fichaDoBanco("goblin-robo")).hp).toBe(40);

  // Efeito sem dano: só mostra quem passou e registra a linha, sem mexer em PV.
  await page.getByLabel("Dano do efeito (vazio = sem dano)").fill("");
  await page.getByRole("button", { name: /Rolar por 1 alvo/ }).click();
  await expect(page.getByLabel("Dano em Goblin Robô")).toHaveCount(0);
  await page.getByRole("button", { name: "Registrar no log" }).click();
  await expect
    .poll(async () => (await logDoBanco()).some((t) => t === "🎲 Salvaguarda de Destreza (CD 15): 0 passaram, 1 falhou"))
    .toBe(true);
  expect((await fichaDoBanco("goblin-robo")).hp).toBe(40);
  expect(erros).toEqual([]);
});
