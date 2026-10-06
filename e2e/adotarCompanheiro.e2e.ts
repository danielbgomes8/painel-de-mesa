import { expect, test } from "@playwright/test";
import { bancoConfigurado, coletarErros, criarFicha, entrarComoMestre, fichaDoBanco, limparSala } from "./apoio";

/** O Mestre transforma uma ficha de NPC que já existe em companheiro de um jogador, e depois solta. */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.beforeAll(limparSala);
test.afterAll(limparSala);

test("o Mestre adota um NPC como companheiro e depois solta", async ({ page }) => {
  const erros = coletarErros(page);
  await criarFicha("ana-robo", "Ana Robô");
  await criarFicha("lobo-robo", "Lobo Robô", { is_npc: true, revealed: false });
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Fichas", exact: true }).click();
  await page.getByText("Ana Robô").first().click();

  await page.getByRole("button", { name: "+ companheiro" }).click();
  await page.getByLabel("NPC que vira companheiro").selectOption({ label: "Lobo Robô" });
  await page.getByRole("button", { name: "adotar", exact: true }).click();

  await expect.poll(async () => (await fichaDoBanco("lobo-robo")).dono).toBe("ana-robo");
  expect((await fichaDoBanco("lobo-robo")).revealed).toBe(true);
  await expect(page.getByText("🐾 Lobo Robô")).toBeVisible();

  await page.getByRole("button", { name: "soltar" }).click();
  await expect.poll(async () => (await fichaDoBanco("lobo-robo")).dono).toBeNull();
  expect(erros).toEqual([]);
});
