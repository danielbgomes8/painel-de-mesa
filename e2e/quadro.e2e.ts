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

async function ligacoesDoBanco(): Promise<{ de: string; para: string; rotulo: string }[]> {
  const r = await rest(`quadro_ligacoes?select=de,para,rotulo&room_code=eq.${SALA}&order=created_at`);
  if (!r.ok) throw new Error(`não leu as ligações: HTTP ${r.status}`);
  return (await r.json()) as { de: string; para: string; rotulo: string }[];
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

  // Ligar arrastando: da alça 🔗 do Barão até o cartão do Culto, e escolhe o tipo.
  expect(await ligacoesDoBanco()).toHaveLength(1);
  const alca = page.getByRole("button", { name: "Ligar Barão Vael a outro cartão" });
  const alvo = page.locator(".qd-cartao", { hasText: "Culto do Raio" });
  const a = (await alca.boundingBox())!;
  const t = (await alvo.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 });
  await expect(page.locator("[data-alvo-ligacao]")).toContainText("Culto do Raio");
  await page.mouse.up();
  await page.locator(".qd-folhaligacao").getByRole("button", { name: "mora em" }).click();
  await page.locator(".qd-folhaligacao").getByRole("button", { name: "Ligar", exact: true }).click();
  await expect(page.getByText("Ligado: Barão Vael → mora em → Culto do Raio")).toBeVisible();
  const ligacoes = await ligacoesDoBanco();
  expect(ligacoes).toHaveLength(2);
  expect(ligacoes[1].rotulo).toBe("mora em");
  // Soltar no vazio não liga nada.
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(5, 5, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(".qd-folhaligacao")).toHaveCount(0);
  expect(await ligacoesDoBanco()).toHaveLength(2);

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
  await expect.poll(async () => (await cartoesDoBanco())[0].coluna).toBe("Suspeitos");

  // Arrastar pela alça: o Culto (sem coluna) vai pra "Suspeitos"; depois pra uma coluna nova.
  const arrastar = async (alcaNome: string, destino: ReturnType<typeof page.locator>) => {
    const origem = (await page.getByRole("button", { name: alcaNome }).boundingBox())!;
    await page.mouse.move(origem.x + origem.width / 2, origem.y + origem.height / 2);
    await page.mouse.down();
    await page.mouse.move(origem.x + 5, origem.y + 5, { steps: 2 });
    const alvo = (await destino.boundingBox())!;
    await page.mouse.move(alvo.x + alvo.width / 2, alvo.y + 30, { steps: 8 });
    await expect(page.locator("[data-alvo]")).toHaveCount(1);
    await page.mouse.up();
  };
  await arrastar("Arrastar Culto do Raio para outra coluna", page.locator('[data-coluna="Suspeitos"]'));
  await expect.poll(async () => (await cartoesDoBanco())[1].coluna).toBe("Suspeitos");
  page.once("dialog", (d) => void d.accept("Vilões"));
  await arrastar("Arrastar Culto do Raio para outra coluna", page.locator('[data-coluna="__nova__"]'));
  await expect.poll(async () => (await cartoesDoBanco())[1].coluna).toBe("Vilões");
  await expect(page.locator('[data-coluna="Vilões"] .qd-cartao')).toContainText("Culto do Raio");

  // Coluna nova pelo botão: nasce vazia, e um cartão arrastado pra ela grava o nome.
  await page.getByRole("button", { name: "＋ nova coluna" }).click();
  await page.getByLabel("Nome da nova coluna").fill("Aliados");
  await page.getByRole("button", { name: "criar", exact: true }).click();
  await expect(page.locator('[data-coluna="Aliados"]')).toContainText("arraste um cartão para cá");
  await arrastar("Arrastar Barão Vael para outra coluna", page.locator('[data-coluna="Aliados"]'));
  await expect.poll(async () => (await cartoesDoBanco())[0].coluna).toBe("Aliados");

  expect(erros).toEqual([]);
  expect(errosAna).toEqual([]);
  await ctx.close();
});
