import { expect, test } from "@playwright/test";
import { SALA, bancoConfigurado, coletarErros, combateDoBanco, comoJogador, criarFicha, limparSala, porNaIniciativa, rest } from "./apoio";

/**
 * "Passar a vez" do jogador pela faixa "É a sua vez!" (a do cartão do peão está no robô do mapa): a faixa só
 * aparece no turno do personagem dele, o botão avança o turno, e a faixa some quando a vez passa.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

async function mudarTurno(turn: number): Promise<void> {
  const r = await rest(`combat_state?room_code=eq.${SALA}`, { method: "PATCH", body: JSON.stringify({ turn }) });
  if (!r.ok) throw new Error(`não mudou o turno: HTTP ${r.status} ${await r.text()}`);
}

test("faixa 'É a sua vez!': só no turno dele, passa a vez pro próximo e some", async ({ page }) => {
  test.setTimeout(90_000);
  const erros = coletarErros(page);
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 20, hp_max: 20 });
  await criarFicha("outro-robo", "Outro Robô", { hp: 20, hp_max: 20 });
  await criarFicha("terceiro-robo", "Terceiro Robô", { hp: 20, hp_max: 20 });
  await porNaIniciativa([
    { slug: "outro-robo", name: "Outro Robô", init: 20 },
    { slug: "jogador-robo", name: "Jogador Robô", init: 15 },
    { slug: "terceiro-robo", name: "Terceiro Robô", init: 10 },
  ]);

  await comoJogador(page, "jogador-robo");
  await page.goto(`/?sala=${SALA}`);
  const faixa = page.locator(".turnbanner");
  // Vez de outro: nada de faixa, nem botão de passar a vez em lugar nenhum.
  await expect(page.getByRole("button", { name: "Combate", exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(faixa).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Passar a vez →" })).toHaveCount(0);

  // Chega a vez dele (o Mestre passou): a faixa aparece, vinda do tempo real, sem recarregar.
  await mudarTurno(1);
  await expect(faixa).toBeVisible({ timeout: 20_000 });
  await expect(faixa).toContainText("É a sua vez!");
  await faixa.getByRole("button", { name: "Passar a vez →" }).click();
  await expect.poll(async () => (await combateDoBanco()).turn).toBe(2);
  await expect(faixa).toHaveCount(0);
  expect(erros).toEqual([]);
});
