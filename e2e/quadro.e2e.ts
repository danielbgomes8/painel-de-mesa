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
  await expect
    .poll(() => page.locator(".qd-cartao img").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { timeout: 15_000 })
    .toBe(true);

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
  await page.getByRole("button", { name: "Colunas", exact: true }).click();
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

test("quadro no celular: arrastar um cartão até uma coluna que está fora da tela, à esquerda", async ({ browser }) => {
  await limparSala();
  for (const [i, coluna] of ["Aliados", "Suspeitos", "Locais", "Vilões"].entries()) {
    const r = await rest("quadro_cartoes", {
      method: "POST",
      body: JSON.stringify({ room_code: SALA, tipo: "npc", titulo: `Cartão ${i}`, revelacao: "revelado", coluna }),
    });
    if (!r.ok) throw new Error(`não criou o cartão: HTTP ${r.status} ${await r.text()}`);
  }
  const ctx = await browser.newContext({ viewport: { width: 375, height: 700 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem("mesa-quadro-visao", "colunas"));
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Campanha", exact: true }).click();
  const lista = page.locator(".qd-colunas");
  await expect(lista.locator(".qd-coluna")).toHaveCount(4);
  // Quatro colunas largas num celular: a lista rola de lado. Vai até o fim (Vilões).
  await lista.evaluate((el) => (el.scrollLeft = el.scrollWidth));
  await expect.poll(() => lista.evaluate((el) => el.scrollLeft)).toBeGreaterThan(300);

  // Pega o "Cartão 3" (Vilões) e segura o dedo na borda esquerda até chegar na primeira coluna (Suspeitos).
  const alca = (await page.getByRole("button", { name: "Arrastar Cartão 3 para outra coluna" }).boundingBox())!;
  await page.mouse.move(alca.x + alca.width / 2, alca.y + alca.height / 2);
  await page.mouse.down();
  await page.mouse.move(alca.x - 40, alca.y + 10, { steps: 4 });
  const caixa = (await lista.boundingBox())!;
  await page.mouse.move(caixa.x + 20, alca.y + 10, { steps: 6 });
  await expect.poll(() => lista.evaluate((el) => el.scrollLeft), { timeout: 8000 }).toBeLessThan(5);
  // Já na primeira coluna: solta sobre "Suspeitos".
  const alvo = (await page.locator('[data-coluna="Suspeitos"]').boundingBox())!;
  await page.mouse.move(alvo.x + alvo.width / 2, alvo.y + 40, { steps: 6 });
  await expect(page.locator('[data-coluna="Suspeitos"][data-alvo]')).toHaveCount(1);
  await page.mouse.up();
  await expect.poll(async () => (await cartoesDoBanco())[3].coluna).toBe("Suspeitos");
  await ctx.close();
});

async function criarCartaoNoBanco(titulo: string, extra: Record<string, unknown> = {}): Promise<string> {
  const r = await rest("quadro_cartoes", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ room_code: SALA, tipo: "npc", titulo, revelacao: "revelado", ...extra }),
  });
  if (!r.ok) throw new Error(`não criou o cartão: HTTP ${r.status} ${await r.text()}`);
  return ((await r.json()) as { id: string }[])[0].id;
}
async function ligarNoBanco(de: string, para: string, rotulo: string): Promise<void> {
  const r = await rest("quadro_ligacoes", { method: "POST", body: JSON.stringify({ room_code: SALA, de, para, rotulo }) });
  if (!r.ok) throw new Error(`não criou a ligação: HTTP ${r.status} ${await r.text()}`);
}

test("mapa de ligações: círculos e setas, rótulo escondido em silhueta, tocar abre, arrastar muda de lugar", async ({ browser, page }) => {
  await limparSala();
  await criarFicha("ana-robo", "Ana Robô");
  const barao = await criarCartaoNoBanco("Barão Vael");
  const culto = await criarCartaoNoBanco("Culto do Raio");
  const sombra = await criarCartaoNoBanco("A Sombra Secreta", { revelacao: "silhueta" });
  await criarCartaoNoBanco("Mira Solta");
  await ligarNoBanco(barao, culto, "serve a");
  await ligarNoBanco(culto, sombra, "obedece a");

  await page.addInitScript(() => localStorage.setItem("mesa-quadro-visao", "mapa"));
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Campanha", exact: true }).click();
  await expect(page.locator(".qd-no")).toHaveCount(3);
  await expect(page.locator(".qd-aresta")).toHaveCount(2);
  await expect(page.locator(".qd-rotulo-svg").first()).toContainText("serve a");
  await expect(page.locator(".qd-soltos")).toContainText("Mira Solta");

  // Arrastar um círculo muda a posição (e não abre o cartão); tocar abre.
  const no = page.locator('[data-cartao-no="' + barao + '"]');
  const antes = await no.getAttribute("transform");
  await no.scrollIntoViewIfNeeded();
  const caixa = (await no.boundingBox())!;
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + 20);
  await page.mouse.down();
  // Em direção ao centro do desenho (nas bordas o círculo não tem pra onde ir).
  const [px, py] = (antes!.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const dx = px > 180 ? -60 : 60;
  const dy = py > 160 ? -50 : 50;
  await page.mouse.move(caixa.x + caixa.width / 2 + dx, caixa.y + 20 + dy, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => no.getAttribute("transform")).not.toBe(antes);
  await expect(page.locator(".qd-folha")).toHaveCount(0);
  await no.click();
  await expect(page.locator(".qd-folha")).toHaveAttribute("aria-label", "Barão Vael");
  await page.getByRole("button", { name: "Fechar o cartão" }).click();

  // O jogador vê a sombra como "???", sem o tipo da ligação dela.
  const ctx = await browser.newContext();
  const ana = await ctx.newPage();
  await comoJogador(ana, "ana-robo");
  await ana.addInitScript(() => localStorage.setItem("mesa-quadro-visao", "mapa"));
  await ana.goto(`/?sala=${SALA}`);
  await ana.getByRole("button", { name: "Campanha", exact: true }).click();
  await expect(ana.locator(".qd-no")).toHaveCount(3);
  await expect(ana.locator(".qd-svg, .qd-mapasvg")).not.toContainText("Sombra");
  await expect(ana.locator(".qd-mapasvg")).toContainText("???");
  const rotulos = await ana.locator(".qd-rotulo-svg").allTextContents();
  expect(rotulos.sort()).toEqual(["?", "serve a"]);
  await ctx.close();
});

test("ligar arrastando: a página rola sozinha quando o cartão de destino está fora da tela", async ({ browser }) => {
  await limparSala();
  const ids: string[] = [];
  for (let i = 0; i < 10; i++) ids.push(await criarCartaoNoBanco(`Cartão ${String(i).padStart(2, "0")}`));
  const ctx = await browser.newContext({ viewport: { width: 375, height: 640 }, hasTouch: true });
  const page = await ctx.newPage();
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Campanha", exact: true }).click();
  await expect(page.locator(".qd-cartao")).toHaveCount(10);
  const ultimo = page.locator(".qd-cartao", { hasText: "Cartão 09" });
  expect(await ultimo.evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThan(640); // fora da tela

  const alca = (await page.getByRole("button", { name: "Ligar Cartão 00 a outro cartão" }).boundingBox())!;
  await page.mouse.move(alca.x + alca.width / 2, alca.y + alca.height / 2);
  await page.mouse.down();
  await page.mouse.move(150, 600, { steps: 6 }); // perto da borda de baixo; fica parado
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 15_000 }).toBeGreaterThan(600);
  // Com o cartão de baixo à vista, leva até ele e solta.
  const alvo = (await ultimo.boundingBox())!;
  await page.mouse.move(alvo.x + alvo.width / 2, Math.min(alvo.y + 40, 560), { steps: 6 });
  await expect(page.locator("[data-alvo-ligacao]")).toContainText("Cartão 09");
  await page.mouse.up();
  await expect(page.locator(".qd-folhaligacao")).toContainText("Cartão 00");
  await expect(page.locator(".qd-folhaligacao")).toContainText("Cartão 09");
  await ctx.close();
});

test("telão: o cartão mostrado pelo Mestre aparece em tela cheia (silhueta só a foto escura e ???) e some sozinho", async ({ browser, page }) => {
  test.setTimeout(120_000);
  await limparSala();
  const sombra = await criarCartaoNoBanco("A Sombra Secreta", { revelacao: "silhueta" });

  // O telão (TV): ninguém toca nele.
  const tv = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const telao = await tv.newPage();
  const errosTelao = coletarErros(telao);
  await telao.goto(`/?sala=${SALA}&telao=1`);
  await expect(telao.locator(".telao")).toBeVisible();

  // Silhueta mostrada pelo Mestre vira tela cheia no telão, mas só a foto escura e "???":
  // nem o nome, nem o tipo, nem o texto do cartão vazam (nem no rótulo de acessibilidade).
  await rest(`quadro_cartoes?id=eq.${sombra}`, { method: "PATCH", body: JSON.stringify({ destaque_em: new Date().toISOString() }) });
  const sombraNaTv = telao.locator(".qd-destaque");
  await expect(sombraNaTv).toContainText("???", { timeout: 15_000 });
  await expect(sombraNaTv).not.toContainText("Sombra Secreta");
  await expect(sombraNaTv).not.toContainText("Vilão");
  expect(await sombraNaTv.getAttribute("aria-label")).not.toContain("Sombra");
  await sombraNaTv.click();
  await expect(sombraNaTv).toHaveCount(0);

  // O Mestre cria um cartão com foto e manda pra mesa.
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Campanha", exact: true }).click();
  await page.getByRole("button", { name: "+ cartão" }).click();
  await page.getByLabel("Nome do cartão").fill("Barão Vael");
  await page.locator(".qd-form input[type=file]").setInputFiles({ name: "baro.png", mimeType: "image/png", buffer: pngDeTeste(600, 800) });
  await page.getByRole("button", { name: "Criar cartão" }).click();
  await expect(page.locator(".qd-folha")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Tipo do cartão").first().selectOption("vilao");
  await page.getByPlaceholder("quem é (ex.: barão de Vael)").fill("Senhor da Torre Norte");
  await page.getByPlaceholder("o que a mesa pode ler...").fill("Nobre cruel que cobra tributos em sangue.");
  await page.getByPlaceholder("o que a mesa pode ler...").blur();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "📣 Mostrar à mesa agora" }).click();

  const destaque = telao.locator(".qd-destaque");
  await expect(destaque).toContainText("Barão Vael", { timeout: 15_000 });
  await expect(destaque).toContainText("Senhor da Torre Norte");
  await expect(destaque).toContainText("Nobre cruel");
  await expect(destaque.locator("img")).toBeVisible();
  await expect.poll(() => destaque.locator("img").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  // Cabe na TV sem rolar e a foto não passa da tela.
  const medidas = await destaque.evaluate((el) => ({ rola: el.scrollHeight > el.clientHeight, h: el.clientHeight }));
  expect(medidas.rola).toBe(false);
  await telao.waitForTimeout(800); // a animação de entrada
  await telao.screenshot({ path: process.env.FOTO_TELAO ?? "test-results/telao.png" });
  // O Mestre não vê a própria revelação em tela cheia.
  await expect(page.locator(".qd-destaque")).toHaveCount(0);

  // Ninguém toca no telão: some sozinho (30 s) e volta a mostrar a vez.
  await expect(destaque).toHaveCount(0, { timeout: 45_000 });
  await expect(telao.locator(".telao")).toBeVisible();
  expect(errosTelao).toEqual([]);
  await tv.close();
});
