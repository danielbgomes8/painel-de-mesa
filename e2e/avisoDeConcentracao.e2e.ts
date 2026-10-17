import { expect, test } from "@playwright/test";
import { SALA, bancoConfigurado, coletarErros, comoJogador, criarFicha, entrarComoMestre, limparSala, mudarFicha, rest } from "./apoio";

/**
 * Aviso de teste de concentração: quem concentra e perde PV (aqui o PV muda direto no banco, como se fosse o
 * jogador no −/+ do celular dele) gera um aviso fixo, só pro Mestre, com a CD. O app não rola nada. "Feito" tira o
 * aviso e a linha do banco. Quem larga a concentração no meio não deixa aviso pendurado.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

type Linha = { tipo: string; slugs: string[]; texto: string };
async function avisosDoBanco(): Promise<Linha[]> {
  const r = await rest(`combate_eventos?select=tipo,slugs,texto&room_code=eq.${SALA}&tipo=eq.concentracao&order=created_at`);
  if (!r.ok) throw new Error(`não leu os avisos: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) as Linha[];
}

test("concentração: dano em quem concentra avisa o Mestre com a CD, sem rolar; feito tira; o jogador não vê", async ({ browser, page }) => {
  test.setTimeout(120_000);
  const erros = coletarErros(page);
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 40, hp_max: 40, concentration: true, concentration_on: "Bênção" });

  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Combate", exact: true }).click();
  await expect(page.locator(".evaviso")).toHaveCount(0);

  // 6 de dano: metade é 3, vale o piso de 10.
  await mudarFicha("jogador-robo", { hp: 34 });
  await expect(page.locator(".evaviso")).toHaveCount(1);
  await expect(page.locator(".evaviso")).toContainText("Concentração · Jogador Robô");
  await expect(page.locator(".evaviso")).toContainText("CD 10");
  await expect(page.locator(".evaviso")).toContainText("Bênção");
  expect((await avisosDoBanco()).map((a) => a.slugs)).toEqual([["jogador-robo"]]);

  // Cura não gera aviso novo.
  await mudarFicha("jogador-robo", { hp: 38 });
  await page.waitForTimeout(1500);
  await expect(page.locator(".evaviso")).toHaveCount(1);

  // 30 de dano: CD 15, e fica na fila junto do primeiro.
  await mudarFicha("jogador-robo", { hp: 8 });
  await expect(page.locator(".evaviso")).toHaveCount(2);
  await expect(page.locator(".evaviso", { hasText: "CD 15" })).toHaveCount(1);

  // O jogador não vê o aviso.
  const contexto = await browser.newContext();
  const jogador = await contexto.newPage();
  await comoJogador(jogador, "jogador-robo");
  await jogador.goto(`/?sala=${SALA}`);
  await jogador.getByRole("button", { name: "Combate", exact: true }).click();
  await jogador.waitForTimeout(1500);
  await expect(jogador.locator(".evaviso")).toHaveCount(0);
  expect(await jogador.evaluate(() => document.documentElement.outerHTML)).not.toContain("Teste de Constituição, CD");
  await contexto.close();

  // "Feito" tira da tela e do banco.
  await page.locator(".evaviso", { hasText: "CD 10" }).getByRole("button", { name: "Feito", exact: true }).click();
  await expect(page.locator(".evaviso")).toHaveCount(1);
  await expect.poll(async () => (await avisosDoBanco()).length).toBe(1);

  // Largar a concentração (aqui, caiu a 0 PV) leva o aviso que sobrou: não há mais o que testar.
  await mudarFicha("jogador-robo", { hp: 0, concentration: false });
  await expect(page.locator(".evaviso")).toHaveCount(0);
  expect(erros).toEqual([]);
});
