import { expect, test } from "@playwright/test";
import { SALA, bancoConfigurado, coletarErros, entrarComoMestre, limparSala, rest } from "./apoio";

/**
 * PIN do Mestre: o Mestre liga o PIN na aba Mestre > Sala; depois disso, um aparelho novo
 * que toca em "Sou o Mestre" cai no campo de PIN (errado não entra, certo entra), e o jogador
 * segue entrando normal. Tirar o PIN devolve a entrada direta.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });
test.beforeAll(limparSala);

async function tirarPinDoBanco() {
  await rest(`rooms?code=eq.${SALA}`, { method: "PATCH", body: JSON.stringify({ mestre_pin_hash: null }) });
}
test.afterAll(async () => {
  await tirarPinDoBanco();
  await limparSala();
});

test("PIN do Mestre: liga na aba Sala, o portão pede, errado não entra, tirar libera", async ({ browser }) => {
  test.setTimeout(90_000);
  await tirarPinDoBanco();

  // 1. Sem PIN, entra direto; liga o PIN (com dois campos iguais).
  const mestreCtx = await browser.newContext();
  const mestre = await mestreCtx.newPage();
  const erros = coletarErros(mestre);
  await entrarComoMestre(mestre);
  await mestre.getByRole("button", { name: "Mestre", exact: true }).click();
  await mestre.getByRole("tab", { name: /^Sala/ }).click();
  await mestre.getByRole("button", { name: "criar um PIN" }).click();
  await mestre.getByLabel("Novo PIN do Mestre").fill("2468");
  await mestre.getByLabel("Repita o PIN do Mestre").fill("2469");
  await mestre.getByRole("button", { name: "gravar" }).click();
  await expect(mestre.getByText("Os dois PINs não são iguais.")).toBeVisible();
  await mestre.getByLabel("Repita o PIN do Mestre").fill("2468");
  await mestre.getByRole("button", { name: "gravar" }).click();
  await expect(mestre.getByText("PIN gravado.")).toBeVisible();

  // 2. Aparelho novo: o portão pede o PIN.
  const novoCtx = await browser.newContext();
  const novo = await novoCtx.newPage();
  await novo.goto(`/?sala=${SALA}`);
  await novo.getByText("Sou o Mestre").click();
  const campo = novo.getByLabel("PIN do Mestre");
  await expect(campo).toBeVisible();
  await campo.fill("0000");
  await campo.press("Enter");
  await expect(novo.getByText("PIN errado.")).toBeVisible();
  await expect(novo.getByRole("button", { name: "Mestre", exact: true })).toHaveCount(0);
  await novo.getByLabel("PIN do Mestre").fill("2468");
  await novo.getByLabel("PIN do Mestre").press("Enter");
  await expect(novo.getByRole("button", { name: "Mestre", exact: true })).toBeVisible();
  await novoCtx.close();

  // 3. Tira o PIN: aparelho novo entra direto de novo.
  await mestre.getByRole("button", { name: "tirar o PIN" }).click();
  await expect(mestre.getByText("PIN removido.")).toBeVisible();
  const outroCtx = await browser.newContext();
  const outro = await outroCtx.newPage();
  await outro.goto(`/?sala=${SALA}`);
  await outro.getByText("Sou o Mestre").click();
  await expect(outro.getByRole("button", { name: "Mestre", exact: true })).toBeVisible();
  await outroCtx.close();

  await mestreCtx.close();
  expect(erros).toEqual([]);
});
