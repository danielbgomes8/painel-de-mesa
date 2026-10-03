import { expect, test } from "@playwright/test";
import { SALA, bancoConfigurado, coletarErros, comoJogador, criarFicha, fichaDoBanco, limparSala, rest } from "./apoio";

/**
 * Subir de nível, contra o banco de verdade: um Paladino de nível 3 sobe pro 4 (nível de
 * aumento de atributo) escolhendo +1 em Força e +1 em Constituição — que muda o modificador de
 * Constituição e dá PV retroativo —, e depois desfaz pelo botão de desfazer.
 * Mesma sala `ci-teste`, limpa antes e depois.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

const PALADINO_3 = {
  classes: [{ classe: "paladino", nivel: 3, conjurador: "meio", atributo_conjuracao: "car" }],
  atributos: { for: 16, des: 12, con: 15, int: 10, sab: 10, car: 14 },
  hp: 20,
  hp_max: 28,
  hd_max: 3,
  hd_cur: 2,
  hd_die: "d10",
  resources: [{ name: "Espaço de magia Nv. 1", max: 3, cur: 1, short_rest: false }],
};

test("subir de nível: confirma o que muda, grava tudo de uma vez, vai pro log e desfaz", async ({ page }) => {
  const erros = coletarErros(page);
  await criarFicha("ana-robo", "Ana Robô", PALADINO_3);
  await comoJogador(page, "ana-robo");
  await page.goto(`/?sala=${SALA}`);
  await page.getByRole("button", { name: "Fichas", exact: true }).click();

  await page.locator(".fc-sechead", { hasText: "Próximo nível · Paladino 4" }).click();
  await page.getByRole("button", { name: /Subir para o nível 4 de Paladino/ }).click();
  const painel = page.getByRole("group", { name: /Subir Paladino para o nível 4/ });

  // Nível 4 pede aumento de atributo: sem dois pontos distribuídos direito, não confirma.
  await painel.getByRole("radio", { name: /\+1 em dois/ }).check();
  await painel.getByLabel("primeiro atributo que ganha +1").selectOption("for");
  await painel.getByLabel("segundo atributo que ganha +1").selectOption("for");
  await expect(painel).toContainText("FOR +2 (16 → 18)"); // dois +1 no mesmo atributo viram +2
  await painel.getByLabel("segundo atributo que ganha +1").selectOption("con");

  // Valor rolado fora do dado bloqueia, e o motivo aparece.
  await painel.getByRole("radio", { name: /rolei o d10/ }).check();
  await painel.getByLabel("resultado do d10").fill("11");
  await expect(painel).toContainText("de 1 a 10");
  await expect(painel.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  await painel.getByRole("radio", { name: /valor fixo do d10/ }).check();

  // A prévia: PV fixo d10 = 6, CON 15→16 (+2→+3): 6+3 = 9 do nível e +3 retroativo dos 3 níveis de antes.
  await expect(painel).toContainText("PV máximo +12");
  await expect(painel).toContainText("CON +1 (15 → 16)");
  await expect(painel).toContainText("Dados de vida: 4 × d10");

  await painel.getByRole("button", { name: "Confirmar" }).click();
  await expect
    .poll(async () => {
      const f = await fichaDoBanco("ana-robo");
      return JSON.stringify([
        (f.classes as { nivel: number }[])[0].nivel,
        f.hp_max,
        f.hp,
        f.hd_max,
        f.hd_cur,
        (f.atributos as { for: number; con: number }).for,
        (f.atributos as { for: number; con: number }).con,
      ]);
    })
    .toBe(JSON.stringify([4, 40, 32, 4, 3, 17, 16]));
  await expect(page.locator(".sn-feito")).toContainText("Subiu de nível");

  // Foi pro log (público) e as habilidades novas foram pra ficha completa.
  await expect
    .poll(async () => {
      const log = await rest(`combat_log?select=text&room_code=eq.${SALA}`);
      return ((await log.json()) as { text: string }[]).map((l) => l.text);
    })
    .toContain("Ana Robô subiu para o nível 4 (Paladino 4)");
  const secoes = (await fichaDoBanco("ana-robo")).ficha_secoes as { titulo: string; itens?: { titulo: string }[] }[];
  expect(secoes.find((s) => s.titulo === "Habilidades de Paladino")?.itens?.length).toBeGreaterThan(0);

  // Desfazer volta tudo o que o nível mexeu.
  await page.getByRole("button", { name: "↩ Desfazer" }).click();
  await expect
    .poll(async () => {
      const f = await fichaDoBanco("ana-robo");
      return JSON.stringify([(f.classes as { nivel: number }[])[0].nivel, f.hp_max, f.hp, f.hd_max, (f.atributos as { con: number }).con, (f.ficha_secoes as unknown[]).length]);
    })
    .toBe(JSON.stringify([3, 28, 20, 3, 15, 0]));

  expect(erros).toEqual([]);
});
