import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { SALA, bancoConfigurado, coletarErros, comoJogador, criarFicha, entrarComoMestre, limparSala, rest } from "./apoio";

/**
 * Relógios de tensão (migration 0038): o Mestre cria e enche; a mesa vê encher e só lê a consequência quando fecha.
 * Mesma sala `ci-teste`, limpa antes e depois.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

const contextosAbertos: BrowserContext[] = [];
test.afterEach(async () => {
  for (const c of contextosAbertos.splice(0)) await c.close().catch(() => undefined);
});

type LinhaRelogio = { id: string; nome: string; fatias: number; cheias: number; visivel: boolean; consequencia: string };
async function relogiosDoBanco(): Promise<LinhaRelogio[]> {
  const r = await rest(`relogios?select=id,nome,fatias,cheias,visivel,consequencia&room_code=eq.${SALA}&order=created_at`);
  if (!r.ok) throw new Error(`não leu os relógios: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) as LinhaRelogio[];
}
async function linhasDoLog(): Promise<string[]> {
  const r = await rest(`combat_log?select=text&room_code=eq.${SALA}&order=created_at`);
  return ((await r.json()) as { text: string }[]).map((l) => l.text);
}

async function abrirJogador(browser: Browser, slug: string) {
  const contexto = await browser.newContext();
  contextosAbertos.push(contexto);
  const pagina = await contexto.newPage();
  const erros = coletarErros(pagina);
  await comoJogador(pagina, slug);
  await pagina.goto(`/?sala=${SALA}`);
  await expect(pagina.getByRole("button", { name: "Campanha", exact: true })).toBeVisible({ timeout: 30_000 });
  return { pagina, erros };
}

test("relógios: o Mestre cria, a mesa vê encher, a consequência só aparece ao fechar, e dá pra esconder e apagar", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await criarFicha("ana-robo", "Ana Robô", { hp: 20, hp_max: 20 });
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Campanha", exact: true }).click();
  await page.getByRole("button", { name: /Relógios/ }).click();
  const ana = await abrirJogador(browser, "ana-robo");

  // Cria um relógio de 4 fatias, com consequência.
  await page.getByLabel("Nome do relógio").fill("Ritual");
  await page.getByLabel("O que acontece quando fecha").fill("O portal se abre.");
  await page.getByRole("group", { name: "Quantas fatias" }).getByRole("button", { name: "4", exact: true }).click();
  await page.getByRole("button", { name: "criar relógio" }).click();
  await expect.poll(async () => (await relogiosDoBanco()).length).toBe(1);
  expect((await relogiosDoBanco())[0]).toMatchObject({ nome: "Ritual", fatias: 4, cheias: 0, visivel: true, consequencia: "O portal se abre." });
  await expect(ana.pagina.getByRole("img", { name: "Ritual: 0 de 4" })).toBeVisible({ timeout: 30_000 });

  // Enche duas fatias: a mesa vê, o log conta, a consequência continua segredo.
  const encher = page.getByRole("button", { name: "Encher uma fatia de Ritual" });
  await encher.click();
  await encher.click();
  await expect.poll(async () => (await relogiosDoBanco())[0].cheias).toBe(2);
  await expect(ana.pagina.getByRole("img", { name: "Ritual: 2 de 4" })).toBeVisible({ timeout: 30_000 });
  await expect(ana.pagina.getByText("O portal se abre.")).toHaveCount(0);
  await expect.poll(async () => (await linhasDoLog()).some((t) => t.includes("Ritual: 2 de 4"))).toBe(true);

  // Esvazia uma e volta a encher (o botão "−" existe, e nunca passa de 0).
  await page.getByRole("button", { name: "Esvaziar uma fatia de Ritual" }).click();
  await expect.poll(async () => (await relogiosDoBanco())[0].cheias).toBe(1);

  // Esconder da mesa: some pra Ana (e o Mestre continua vendo).
  await page.getByRole("button", { name: "Esconder da mesa Ritual" }).click();
  await expect.poll(async () => (await relogiosDoBanco())[0].visivel).toBe(false);
  await expect(ana.pagina.getByRole("img", { name: /Ritual/ })).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "Mostrar pra mesa Ritual" }).click();
  await expect(ana.pagina.getByRole("img", { name: "Ritual: 1 de 4" })).toBeVisible({ timeout: 30_000 });

  // Fecha o relógio: a mesa lê a consequência, e o log anuncia.
  await encher.click();
  await encher.click();
  await encher.click();
  await expect.poll(async () => (await relogiosDoBanco())[0].cheias).toBe(4);
  await expect(ana.pagina.getByText("O portal se abre.")).toBeVisible({ timeout: 30_000 });
  await expect(ana.pagina.getByText("fechou!")).toBeVisible();
  await expect.poll(async () => (await linhasDoLog()).some((t) => t.includes("Ritual fechou") && t.includes("O portal se abre."))).toBe(true);
  await expect(encher).toBeDisabled();

  // Apagar: some pra todos.
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Apagar o relógio Ritual" }).click();
  await expect.poll(async () => (await relogiosDoBanco()).length).toBe(0);
  await expect(ana.pagina.getByRole("img", { name: /Ritual/ })).toHaveCount(0, { timeout: 30_000 });

  expect(erros).toEqual([]);
  expect(ana.erros).toEqual([]);
});
