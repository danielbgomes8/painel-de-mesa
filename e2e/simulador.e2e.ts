import { expect, test } from "@playwright/test";
import { SALA, bancoConfigurado, coletarErros, criarFicha, entrarComoMestre, limparSala, rest } from "./apoio";

/**
 * Simulador de encontro (Mestre → Encontros → "simular este encontro"): luta o encontro preparado contra
 * o grupo da sala 1000 vezes e mostra o que costuma acontecer. Os casos são extremos de propósito
 * (o resultado tem de ser o mesmo em qualquer sorteio): um rato contra um grupo forte e um dragão
 * contra um grupo fraco. Não grava nada no banco.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

const grupo = (name: string, hp_max: number, ac: number, ataque: string, quantidade: number) => ({
  name, cls: "Monstruosidade média", ac, hp_max, speed: 9, init_mod: 0, ataque, notes: "", quantidade,
});

test("simulador: rato contra grupo forte é tranquilo; dragão contra grupo fraco é mortal; avisa quem não ataca", async ({ page }) => {
  const erros = coletarErros(page);
  await criarFicha("ana-robo", "Ana Robô", { hp: 200, hp_max: 200, ac: 22, ataque: "Espada: +12, 3d8+8 cortante" });
  await criarFicha("beto-robo", "Beto Robô", { hp: 180, hp_max: 180, ac: 20, ataque: "Machado: +11, 2d12+7 cortante" });
  await criarFicha("caio-robo", "Caio Robô", { hp: 0, hp_max: 30, ac: 12 });
  for (const e of [
    { name: "Rato", grupos: [grupo("Rato", 1, 5, "Mordida +1, 1 perfurante", 1)] },
    { name: "Dragão", grupos: [grupo("Dragão Ancião", 5000, 30, "3 ataques: Garra +30, 4d10+20 cortante", 1), grupo("Cultista", 9, 12, "", 2)] },
  ]) {
    const r = await rest("encontros", { method: "POST", body: JSON.stringify({ room_code: SALA, ...e }) });
    expect(r.ok).toBe(true);
  }

  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mestre", exact: true }).click();
  const cartaoRato = page.locator(".npclibrow", { has: page.locator('input[value="Rato"]') });
  await cartaoRato.getByRole("button", { name: "🎲 simular este encontro" }).click();

  // O grupo entra pelo PV de agora; quem está a 0 PV fica de fora e a tela diz.
  await expect(cartaoRato.getByRole("button", { name: /Ana Robô · 200 PV/ })).toBeVisible();
  await expect(cartaoRato.getByRole("button", { name: /Beto Robô · 180 PV/ })).toBeVisible();
  await expect(cartaoRato.getByRole("button", { name: /Caio Robô/ })).toHaveCount(0);
  await expect(cartaoRato).toContainText("A 0 PV agora, fora da conta: Caio Robô");

  await cartaoRato.getByRole("button", { name: "Simular", exact: true }).click();
  await expect(cartaoRato.locator(".simveredito")).toContainText("Tranquilo");
  await expect(cartaoRato.locator(".simveredito")).toContainText("o grupo vence em 100% das lutas");
  await expect(cartaoRato.locator(".simnumeros")).toContainText("O grupo inteiro cai0%");
  await expect(cartaoRato.locator(".simbarras li")).toHaveCount(2);

  // "Grupo descansado" troca o PV (e apaga o resultado velho); Caio, a 0 PV agora, entra com o máximo.
  await cartaoRato.getByLabel("grupo descansado (PV cheio)").check();
  await expect(cartaoRato.locator(".simveredito")).toHaveCount(0);
  await expect(cartaoRato.getByRole("button", { name: /Caio Robô · 30 PV/ })).toBeVisible();
  // Caio não tem ataque legível: a tela avisa depois de simular.
  await cartaoRato.getByRole("button", { name: "Simular", exact: true }).click();
  await expect(cartaoRato.locator(".inv-alerta")).toContainText("Caio Robô");
  // Tirar alguém da conta apaga o resultado e muda quem aparece nas barras.
  await cartaoRato.getByRole("button", { name: /Caio Robô/ }).click();
  await cartaoRato.getByRole("button", { name: "Simular", exact: true }).click();
  await expect(cartaoRato.locator(".simbarras li")).toHaveCount(2);

  // O dragão: o grupo todo cai quase sempre; o cultista sem ataque legível é avisado.
  const cartaoDragao = page.locator(".npclibrow", { has: page.locator('input[value="Dragão"]') });
  await cartaoDragao.getByRole("button", { name: "🎲 simular este encontro" }).click();
  await cartaoDragao.getByRole("button", { name: "Simular", exact: true }).click();
  await expect(cartaoDragao.locator(".simveredito")).toContainText("Mortal");
  await expect(cartaoDragao.locator(".simnumeros")).toContainText("O grupo inteiro cai");
  await expect(cartaoDragao.locator(".inv-alerta")).toContainText("Cultista");

  // Simular não grava nada: os encontros continuam como estavam.
  const lidos = (await (await rest(`encontros?select=name,grupos&room_code=eq.${SALA}`)).json()) as { name: string; grupos: unknown[] }[];
  expect(lidos.map((l) => [l.name, l.grupos.length]).sort()).toEqual([["Dragão", 2], ["Rato", 1]]);
  expect(erros).toEqual([]);
});
