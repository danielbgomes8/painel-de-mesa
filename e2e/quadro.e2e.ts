import { expect, test } from "@playwright/test";
import { SALA, bancoConfigurado, coletarErros, comoJogador, criarFicha, entrarComoMestre, limparSala, pngDeTeste, rest } from "./apoio";

/**
 * Quadro da Campanha: o Mestre cria cartões com foto, liga um ao outro, marca na
 * sessão, e a mesa só vê o que foi liberado (escondido / silhueta / revelado).
 * O jogador anota num cartão revelado, todos leem, e o "mostrar à mesa agora"
 * chega em tela cheia. Mesma sala `ci-teste`, limpa antes e depois.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

type Linha = { id: string; titulo: string; revelacao: string; foto: string | null; coluna: string; destaque_em: string | null };
async function cartoesDoBanco(): Promise<Linha[]> {
  const r = await rest(`quadro_cartoes?select=id,titulo,revelacao,foto,coluna,destaque_em&room_code=eq.${SALA}&order=created_at`);
  if (!r.ok) throw new Error(`não leu os cartões: HTTP ${r.status}`);
  return (await r.json()) as Linha[];
}

test("quadro: foto, revelação em três estados, ligação, anotação, sessão e destaque em tela cheia", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await criarFicha("ana-robo", "Ana Robô");
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Campanha", exact: true }).click();

  // Cria dois cartões; o primeiro com foto.
  for (const [nome, foto] of [["Barão Vael", true], ["Culto do Raio", false]] as const) {
    await page.getByRole("button", { name: "+ cartão" }).click();
    await page.getByLabel("Nome do cartão").fill(nome);
    if (foto) await page.locator(".qd-form input[type=file]").setInputFiles({ name: "baro.png", mimeType: "image/png", buffer: pngDeTeste(300, 400) });
    await page.getByRole("button", { name: "Criar cartão" }).click();
    await expect(page.locator(".qd-folha")).toBeVisible({ timeout: 30_000 });
    if (!foto) {
      // A ligação: o segundo cartão "serve a" o primeiro.
      await page.getByLabel("Tipo da ligação").fill("serve a");
      await page.getByLabel("Ligar a qual cartão").selectOption({ label: "🧑 Barão Vael" });
      await page.getByRole("button", { name: "＋ ligar" }).click();
      await expect(page.locator(".qd-ligacaotexto")).toContainText("Barão Vael");
    }
    await page.getByRole("button", { name: "Fechar o cartão" }).click();
  }
  let cartoes = await cartoesDoBanco();
  expect(cartoes.map((c) => c.titulo)).toEqual(["Barão Vael", "Culto do Raio"]);
  expect(cartoes.every((c) => c.revelacao === "escondido")).toBe(true);
  expect(cartoes[0].foto).toMatch(/quadro\//);
  // A foto carrega de verdade (a política de segurança do site já bloqueou imagens uma vez).
  await expect(page.locator(".qd-cartao img").first()).toBeVisible();
  const carregou = await page.locator(".qd-cartao img").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
  expect(carregou).toBe(true);

  // Jogador (outro navegador): escondido não aparece.
  const ctx = await browser.newContext();
  const ana = await ctx.newPage();
  const errosAna = coletarErros(ana);
  await comoJogador(ana, "ana-robo");
  await ana.goto(`/?sala=${SALA}`);
  await ana.getByRole("button", { name: "Campanha", exact: true }).click();
  await expect(ana.locator(".qd-cartao")).toHaveCount(0);

  // Silhueta: aparece "???" e nada do nome.
  await page.locator(".qd-cartao", { hasText: "Barão Vael" }).click();
  await page.locator(".qd-folha").getByRole("button", { name: /Silhueta/ }).click();
  await expect(ana.locator(".qd-cartao")).toHaveCount(1);
  await expect(ana.locator(".qd-cartao")).toContainText("???");
  await expect(ana.locator(".qd-cartao")).not.toContainText("Barão");

  // O segredo só o Mestre lê, mesmo revelado.
  await page.locator(".qd-folha").getByRole("button", { name: /Revelado/ }).click();
  await expect(ana.locator(".qd-cartao")).toContainText("Barão Vael");
  await ana.locator(".qd-cartao").click();
  await expect(ana.locator(".qd-folha")).not.toContainText("Segredo");
  // O cartão ligado continua escondido: a ligação não o entrega.
  await expect(ana.locator(".qd-ligacao")).toHaveCount(0);

  // Anotação do jogador: todos leem.
  await ana.getByLabel("Nova anotação").fill("acho que ele mente");
  await ana.getByRole("button", { name: "anotar" }).click();
  await expect(ana.locator(".qd-notatexto")).toContainText("Ana Robô: acho que ele mente");
  await expect(page.locator(".qd-notatexto")).toContainText("Ana Robô: acho que ele mente", { timeout: 15_000 });
  await ana.getByRole("button", { name: "Fechar o cartão" }).click();

  // Libera o segundo: agora a ligação aparece pra ela, nos dois sentidos.
  await page.getByRole("button", { name: "Fechar o cartão" }).click();
  await page.locator(".qd-cartao", { hasText: "Culto do Raio" }).click();
  await page.locator(".qd-folha").getByRole("button", { name: /Revelado/ }).click();
  await page.getByRole("button", { name: "Fechar o cartão" }).click();
  await ana.locator(".qd-cartao", { hasText: "Barão Vael" }).click();
  await expect(ana.locator(".qd-ligacao")).toContainText("Culto do Raio", { timeout: 15_000 });
  await ana.getByRole("button", { name: "Fechar o cartão" }).click();

  // Mostrar à mesa agora: tela cheia no jogador, e o Mestre não vê a própria.
  await page.locator(".qd-cartao", { hasText: "Barão Vael" }).click();
  await page.getByRole("button", { name: "📣 Mostrar à mesa agora" }).click();
  await expect(ana.locator(".qd-destaque")).toContainText("Barão Vael", { timeout: 15_000 });
  await expect(page.locator(".qd-destaque")).toHaveCount(0);
  await ana.locator(".qd-destaque").click();
  await expect(ana.locator(".qd-destaque")).toHaveCount(0);
  cartoes = await cartoesDoBanco();
  expect(cartoes[0].destaque_em).not.toBeNull();

  // Sessão: o Mestre marca o cartão, e ele aparece na sessão e no cartão.
  await page.getByRole("button", { name: "Fechar o cartão" }).click();
  await page.getByRole("button", { name: "📖 Sessões" }).click();
  await page.getByPlaceholder("resumo da sessão...").fill("A mesa conheceu o barão.");
  await page.getByRole("button", { name: "+ nova entrada" }).click();
  await page.getByLabel("Marcar um cartão nesta sessão").selectOption({ label: "🧑 Barão Vael" });
  await expect(page.locator(".qd-chipcartao")).toContainText("Barão Vael");
  await ana.getByRole("button", { name: "📖 Sessões" }).click();
  await expect(ana.locator(".qd-sessaocartoes")).toContainText("Barão Vael", { timeout: 15_000 });

  // Coluna (o arrastar em si só dá pra simular na mão; aqui o dado e a tela).
  await page.getByRole("button", { name: "🗂 Quadro" }).click();
  await page.locator(".qd-cartao", { hasText: "Barão Vael" }).click();
  await page.getByRole("button", { name: "Suspeitos", exact: true }).click();
  await page.getByRole("button", { name: "Fechar o cartão" }).click();
  await page.getByRole("button", { name: "☰ Colunas" }).click();
  await expect(page.locator('[data-coluna="Suspeitos"] .qd-cartao')).toContainText("Barão Vael");
  expect((await cartoesDoBanco())[0].coluna).toBe("Suspeitos");

  expect(erros).toEqual([]);
  expect(errosAna).toEqual([]);
  await ctx.close();
});
