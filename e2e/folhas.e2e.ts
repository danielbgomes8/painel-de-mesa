import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { SALA, bancoConfigurado, coletarErros, comoJogador, criarFicha, entrarComoMestre, limparSala, pngDeTeste, rest } from "./apoio";

/**
 * Folhas de entrega (migration 0037): o Mestre escreve, escolhe pra quem vai e entrega; quem recebeu vê o aviso e lê.
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

type LinhaFolha = { id: string; titulo: string; texto: string; foto: string | null; para: string | null; entregue_em: string | null };
async function folhasDoBanco(): Promise<LinhaFolha[]> {
  const r = await rest(`folhas?select=id,titulo,texto,foto,para,entregue_em&room_code=eq.${SALA}&order=created_at`);
  if (!r.ok) throw new Error(`não leu as folhas: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) as LinhaFolha[];
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

async function irParaFolhas(page: Page) {
  await page.getByRole("button", { name: "Campanha", exact: true }).click();
  await page.getByRole("button", { name: /Folhas/ }).click();
}

test("folhas: o Mestre escreve pra um jogador, entrega, recolhe, manda pra mesa toda e apaga", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await criarFicha("ana-robo", "Ana Robô", { hp: 20, hp_max: 20 });
  await criarFicha("beto-robo", "Beto Robô", { hp: 20, hp_max: 20 });
  await entrarComoMestre(page);
  await irParaFolhas(page);

  const ana = await abrirJogador(browser, "ana-robo");
  const beto = await abrirJogador(browser, "beto-robo");

  // O Mestre escreve a carta secreta da Ana, com foto: nasce como rascunho.
  await page.getByLabel("Título da folha").fill("Carta do rei");
  await page.getByLabel("Texto da folha").fill("Venham ao castelo antes da lua cheia.");
  await page.getByLabel("Pra quem é a folha").selectOption({ label: "só Ana Robô" });
  await page.getByLabel("Foto da folha").setInputFiles({ name: "selo.png", mimeType: "image/png", buffer: pngDeTeste(300, 200) });
  await page.getByRole("button", { name: "criar rascunho" }).click();
  await expect.poll(async () => (await folhasDoBanco()).length).toBe(1);
  const criada = (await folhasDoBanco())[0];
  expect(criada).toMatchObject({ titulo: "Carta do rei", texto: "Venham ao castelo antes da lua cheia.", para: "ana-robo", entregue_em: null });
  expect(criada.foto).toMatch(new RegExp(`^${SALA}/folhas/`));
  await expect(page.getByText("rascunho — só Ana Robô")).toBeVisible();

  // Rascunho: ninguém enxerga, nem aviso.
  await irParaFolhas(ana.pagina);
  await expect(ana.pagina.getByText("Nenhuma folha pra você por enquanto.")).toBeVisible();
  await expect(ana.pagina.getByText("Carta do rei")).toHaveCount(0);
  await ana.pagina.getByRole("button", { name: "Combate", exact: true }).click();

  // Entregar: a Ana recebe o aviso e lê; o Beto não recebe nada.
  await page.getByRole("button", { name: "entregar", exact: true }).click();
  await expect.poll(async () => (await folhasDoBanco())[0].entregue_em).not.toBeNull();
  await expect(ana.pagina.getByText("Chegou uma folha pra você")).toBeVisible({ timeout: 30_000 });
  await expect(beto.pagina.getByText(/Chegou|Chegaram/)).toHaveCount(0);
  await ana.pagina.getByRole("button", { name: "ler", exact: true }).click();
  await expect(ana.pagina.getByRole("heading", { name: /Carta do rei/ })).toBeVisible();
  await expect(ana.pagina.getByText("Venham ao castelo antes da lua cheia.")).toBeVisible();
  await expect(ana.pagina.getByText("só pra você")).toBeVisible();
  // A foto carrega de verdade (a política de segurança do site deixa).
  const imagem = ana.pagina.locator(".fol-foto img");
  await expect(imagem).toBeVisible();
  await expect.poll(async () => imagem.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  // Abrir as Folhas apaga o aviso e o número do botão.
  await ana.pagina.getByRole("button", { name: "Combate", exact: true }).click();
  await expect(ana.pagina.getByText("Chegou uma folha pra você")).toHaveCount(0);

  // O Beto abre as Folhas e não vê a carta da Ana.
  await irParaFolhas(beto.pagina);
  await expect(beto.pagina.getByText("Carta do rei")).toHaveCount(0);
  await expect(beto.pagina.getByText("Nenhuma folha pra você por enquanto.")).toBeVisible();

  // Recolher: some pra Ana na hora, volta a ser rascunho.
  await page.getByRole("button", { name: "recolher", exact: true }).click();
  await expect.poll(async () => (await folhasDoBanco())[0].entregue_em).toBeNull();
  await irParaFolhas(ana.pagina);
  await expect(ana.pagina.getByText("Carta do rei")).toHaveCount(0);

  // Mudar o destino pra mesa toda e entregar: os dois enxergam.
  await page.getByRole("button", { name: "editar", exact: true }).click();
  await page.locator(".fol-item").getByLabel("Pra quem é a folha").selectOption({ label: "a mesa toda" }); // o formulário "Nova folha" também tem esse campo
  await page.getByRole("button", { name: "salvar alterações" }).click();
  await expect.poll(async () => (await folhasDoBanco())[0].para).toBeNull();
  await page.getByRole("button", { name: "entregar", exact: true }).click();
  await expect(ana.pagina.getByRole("heading", { name: /Carta do rei/ })).toBeVisible({ timeout: 30_000 });
  await expect(beto.pagina.getByRole("heading", { name: /Carta do rei/ })).toBeVisible({ timeout: 30_000 });
  await expect(beto.pagina.getByText("pra mesa toda")).toBeVisible();

  // Apagar: some pra todos e a foto sai do Storage.
  const caminhoDaFoto = (await folhasDoBanco())[0].foto!;
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Apagar a folha Carta do rei" }).click();
  await expect.poll(async () => (await folhasDoBanco()).length).toBe(0);
  await expect(ana.pagina.getByRole("heading", { name: /Carta do rei/ })).toHaveCount(0, { timeout: 30_000 });
  // O arquivo saiu do Storage (a lista do Storage, não o link público: o link pode ficar em cache na CDN).
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  await expect
    .poll(
      async () => {
        const lista = await fetch(`${base}/storage/v1/object/list/mapas`, {
          method: "POST",
          headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: `${SALA}/folhas`, limit: 50 }),
        });
        return ((await lista.json()) as { name: string }[]).map((x) => `${SALA}/folhas/${x.name}`).includes(caminhoDaFoto);
      },
      { timeout: 30_000 },
    )
    .toBe(false);

  expect(erros).toEqual([]);
  expect(ana.erros).toEqual([]);
  expect(beto.erros).toEqual([]);
});
