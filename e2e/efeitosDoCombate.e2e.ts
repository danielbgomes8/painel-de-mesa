import { expect, test } from "@playwright/test";
import { SALA, abrirMontagem, bancoConfigurado, coletarErros, comoJogador, criarFicha, entrarComoMestre, limparSala, porNaIniciativa, rest } from "./apoio";

/**
 * Efeitos com duração do combate: o Mestre cria um pelo painel da linha (chip na iniciativa), o efeito
 * só acaba no início do turno de quem lançou, o aviso "acabou" chega a quem lançou (e ao Mestre), contar
 * à mesa apaga a linha e só então escreve no log, o jogador nunca vê efeito de inimigo oculto, e
 * reiniciar o combate leva todos embora.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

type Linha = { nome: string; alvo_slug: string; lancador_slug: string | null; termina_rodada: number };
async function efeitosDoBanco(): Promise<Linha[]> {
  const r = await rest(`combate_efeitos?select=nome,alvo_slug,lancador_slug,termina_rodada&room_code=eq.${SALA}&order=created_at`);
  if (!r.ok) throw new Error(`não leu os efeitos: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) as Linha[];
}
async function logDoBanco(): Promise<string[]> {
  const r = await rest(`combat_log?select=text&room_code=eq.${SALA}&order=created_at.desc`);
  return ((await r.json()) as { text: string }[]).map((l) => l.text);
}
async function irPara(round: number, turn: number): Promise<void> {
  const r = await rest(`combat_state?room_code=eq.${SALA}`, { method: "PATCH", body: JSON.stringify({ round, turn }) });
  if (!r.ok) throw new Error(`não mudou a rodada: HTTP ${r.status} ${await r.text()}`);
}
async function criarEfeito(corpo: Linha): Promise<void> {
  const r = await rest("combate_efeitos", { method: "POST", body: JSON.stringify({ room_code: SALA, ...corpo }) });
  if (!r.ok) throw new Error(`não criou o efeito: HTTP ${r.status} ${await r.text()}`);
}

test("efeitos do combate: criar na linha, acabar no turno de quem lançou, contar à mesa, segredo e reiniciar", async ({ browser, page }) => {
  test.setTimeout(180_000);
  const erros = coletarErros(page);
  page.on("dialog", (d) => void d.accept());
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 20, hp_max: 20 });
  await criarFicha("clerigo-robo", "Clérigo Robô", { is_npc: true, revealed: false, hp: 20, hp_max: 20 });
  await porNaIniciativa([
    { slug: "jogador-robo", name: "Jogador Robô", init: 15 },
    { slug: "clerigo-robo", name: "Clérigo Robô", init: 10 },
  ]);

  // O Mestre cria "Bênção, 1 rodada" no inimigo oculto, lançada por ele mesmo (padrão do formulário).
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Combate", exact: true }).click();
  await page.locator(".initrow .whobtn", { hasText: "Clérigo Robô" }).click();
  await page.getByRole("button", { name: "+ Efeito" }).click();
  await page.getByLabel("Nome do efeito").fill("Bênção");
  await page.getByRole("button", { name: "1 rodada", exact: true }).click();
  await page.getByRole("button", { name: "Guardar efeito" }).click();
  await expect.poll(async () => (await efeitosDoBanco()).length).toBe(1);
  expect((await efeitosDoBanco())[0]).toEqual({ nome: "Bênção", alvo_slug: "clerigo-robo", lancador_slug: "clerigo-robo", termina_rodada: 2 });
  await expect(page.locator(".efeitotag", { hasText: "Bênção" })).toContainText("1 rod.");

  // Um efeito do próprio jogador, lançado por ele (criado direto no banco).
  await criarEfeito({ nome: "Escudo da Fé", alvo_slug: "jogador-robo", lancador_slug: "jogador-robo", termina_rodada: 2 });

  const contexto = await browser.newContext();
  const jogador = await contexto.newPage();
  const errosJogador = coletarErros(jogador);
  await comoJogador(jogador, "jogador-robo");
  await jogador.goto(`/?sala=${SALA}`);
  await jogador.getByRole("button", { name: "Combate", exact: true }).click();
  await expect(jogador.locator(".efeitotag", { hasText: "Escudo da Fé" })).toBeVisible();
  // O de inimigo oculto não existe pro jogador: nem chip nem texto.
  expect(await jogador.evaluate(() => document.documentElement.outerHTML)).not.toContain("Bênção");

  // Rodada 2, vez do jogador (1º da ordem): o Escudo dele acaba, a Bênção do clérigo (2º) ainda não.
  await irPara(2, 0);
  await expect(jogador.locator(".evaviso")).toHaveCount(1);
  await expect(jogador.locator(".evaviso")).toContainText("Escudo da Fé");
  await expect(page.locator(".evaviso")).toHaveCount(1);
  await expect(page.locator(".evaviso")).toContainText("Escudo da Fé");
  expect((await logDoBanco()).join("\n")).not.toContain("acabou");

  // Contar à mesa: apaga a linha e SÓ DEPOIS escreve no log.
  await jogador.locator(".evaviso").getByRole("button", { name: "Acabou · contar à mesa" }).click();
  await expect.poll(async () => (await logDoBanco()).includes("⏳ Escudo da Fé em Jogador Robô acabou")).toBe(true);
  await expect.poll(async () => (await efeitosDoBanco()).map((e) => e.nome)).toEqual(["Bênção"]);
  await expect(page.locator(".evaviso")).toHaveCount(0);

  // Vez do clérigo: a Bênção acaba. O Mestre vê (com o nome real); o jogador não vê aviso nenhum.
  await irPara(2, 1);
  await expect(page.locator(".evaviso")).toContainText("Bênção");
  await expect(page.locator(".evaviso")).toContainText("Clérigo Robô");
  await expect(jogador.locator(".evaviso")).toHaveCount(0);
  expect(await jogador.evaluate(() => document.documentElement.outerHTML)).not.toContain("Bênção");
  await page.locator(".evaviso").getByRole("button", { name: "Acabou · contar à mesa" }).click();
  // No log público o inimigo oculto continua oculto.
  await expect.poll(async () => (await logDoBanco()).includes("⏳ Bênção em Um inimigo acabou")).toBe(true);
  expect((await logDoBanco()).join("\n")).not.toContain("Clérigo Robô acabou");
  await expect.poll(async () => (await efeitosDoBanco()).length).toBe(0);
  await contexto.close();

  // Reiniciar o combate leva os efeitos que sobraram.
  await criarEfeito({ nome: "Escudo da Fé", alvo_slug: "jogador-robo", lancador_slug: "jogador-robo", termina_rodada: 9 });
  await expect.poll(async () => (await efeitosDoBanco()).length).toBe(1);
  await abrirMontagem(page);
  await page.getByRole("button", { name: "Reiniciar combate" }).click();
  await expect.poll(async () => (await efeitosDoBanco()).length).toBe(0);
  expect(erros).toEqual([]);
  expect(errosJogador).toEqual([]);
});
