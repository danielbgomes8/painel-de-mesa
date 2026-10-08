import { expect, test, type Page } from "@playwright/test";
import {
  SALA,
  abrirMontagem,
  bancoConfigurado,
  cenaDoBanco,
  coletarErros,
  combateDoBanco,
  comoJogador,
  criarFicha,
  criarPeca,
  entrarComoMestre,
  fichaDoBanco,
  limparSala,
  pecasDoBanco,
  pngDeTeste,
  porNaIniciativa,
} from "./apoio";

/**
 * A iniciativa e o mapa conversando: inimigo que entra na ordem ganha peão
 * oculto, o que sai leva o peão (e o desfazer devolve), ficha apagada não deixa
 * "?" órfão, e tocar num peão abre as ações dele (dano, mostrar, a vez).
 * Mesma sala `ci-teste` do outro arquivo, limpa antes e depois.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

async function subirMapaNaMesa(page: Page) {
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-iniciativa.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "levar a mesa pra este mapa" }).click();
  await expect(page.locator(".palco-nome").getByText("Na mesa")).toBeVisible();
}

/** Toca e solta (sem arrastar) num ponto da imagem de 900×600 — a vista abre
 *  com o mapa inteiro e 3% de folga. */
async function tocarNoMapa(page: Page, ix: number, iy: number) {
  const canvas = page.locator(".cena-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const caixa = (await canvas.boundingBox())!;
  const escala = Math.min(caixa.width / (900 * 1.06), caixa.height / (600 * 1.06));
  await page.mouse.click(caixa.x + caixa.width / 2 + (ix - 450) * escala, caixa.y + caixa.height / 2 + (iy - 300) * escala);
}

/** Toca no peão até o cartão dele abrir: os peões chegam do banco um instante
 *  DEPOIS do mapa (no CI, o primeiro toque caiu 50 ms antes deles e não pegou
 *  nada — é o que aconteceria com uma pessoa também; ela tocaria de novo). */
async function abrirCartao(page: Page, ix: number, iy: number) {
  const cartao = page.locator(".mapa-cartao");
  await expect(async () => {
    await tocarNoMapa(page, ix, iy);
    await expect(cartao).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });
  return cartao;
}

test("inimigo que entra na iniciativa ganha peão oculto; o que sai leva o peão, e desfazer devolve", async ({ page }) => {
  const erros = coletarErros(page);
  await criarFicha("ogro-robo", "Ogro do Robô", { is_npc: true, cls: "Gigante grande", hp: 30, hp_max: 30 });
  await entrarComoMestre(page);
  await subirMapaNaMesa(page);
  await page.getByRole("button", { name: "Combate", exact: true }).click();

  // Um NPC novo, pelo formulário: peão de 1 quadradinho, oculto.
  await abrirMontagem(page);
  await page.getByPlaceholder("nome do NPC/monstro").fill("Goblin do Robô");
  await page.getByPlaceholder("PV máx").fill("7");
  await page.getByPlaceholder("CA").fill("15");
  await page.getByPlaceholder("iniciativa").fill("12");
  await page.getByRole("button", { name: "Adicionar à ordem" }).click();
  await expect.poll(async () => (await pecasDoBanco()).length).toBe(1);
  const goblin = (await pecasDoBanco())[0];
  expect(goblin).toMatchObject({ oculto: true, tamanho: 1 });

  // Uma ficha que já existia ("Gigante grande"): peão de 2×2, também oculto.
  await abrirMontagem(page);
  await page.locator(".addcombatant select").selectOption({ label: "Ogro do Robô (NPC)" });
  await page.getByPlaceholder("iniciativa").fill("14");
  await page.getByRole("button", { name: "Adicionar à ordem" }).click();
  await expect.poll(async () => (await pecasDoBanco()).find((p) => p.slug === "ogro-robo")).toMatchObject({ oculto: true, tamanho: 2 });
  expect(await pecasDoBanco()).toHaveLength(2);

  // Tirar o goblin da ordem tira o peão dele; desfazer devolve no mesmo lugar.
  await page.locator(".initrow", { hasText: "Goblin do Robô" }).getByRole("button", { name: "Remover da ordem" }).click();
  await expect.poll(async () => (await pecasDoBanco()).some((p) => p.id === goblin.id)).toBe(false);
  // Espera a barra mostrar ESTA ação (o peão sai antes de o desfazer guardá-la).
  await expect(page.locator(".desfazertexto")).toHaveText("Goblin do Robô saiu da ordem");
  await page.getByRole("button", { name: "↩ Desfazer" }).click();
  await expect(page.locator(".initrow", { hasText: "Goblin do Robô" })).toHaveCount(1);
  await expect
    .poll(async () => (await pecasDoBanco()).find((p) => p.id === goblin.id))
    .toMatchObject({ x: goblin.x, y: goblin.y, oculto: true });
  expect(erros).toEqual([]);
});

test("tocar no peão abre as ações: o Mestre dá dano e mostra o inimigo; o jogador passa a própria vez", async ({ browser, page }) => {
  const erros = coletarErros(page);
  const cena = await cenaDoBanco();
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 20, hp_max: 20 });
  // Centro do quadradinho (5, 5) da grade de 30 px.
  await criarPeca(cena.id, "jogador-robo", 165, 165);
  // O jogador na frente da ordem: é a vez dele.
  const antes = (await combateDoBanco()).order_json as unknown as { slug: string; name: string; init: number }[];
  await porNaIniciativa([{ slug: "jogador-robo", name: "Jogador Robô", init: 20 }, ...antes]);
  const ogro = (await pecasDoBanco()).find((p) => p.slug === "ogro-robo")!;

  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  const cartao = await abrirCartao(page, ogro.x, ogro.y);
  await expect(cartao).toContainText("Ogro do Robô");
  await expect(cartao).toContainText("30/30 PV");
  // O teclado do celular não sobe sozinho por cima do mapa.
  await expect(cartao.getByPlaceholder("quanto?")).not.toBeFocused();

  await cartao.getByPlaceholder("quanto?").fill("7");
  await cartao.getByRole("button", { name: "Dano 7" }).click();
  await expect.poll(async () => (await fichaDoBanco("ogro-robo")).hp).toBe(23);
  await expect(cartao).toContainText("23/30 PV");
  await expect(cartao.locator(".initretorno")).toBeVisible();
  // O cartão continua aberto e o campo volta vazio pro próximo golpe.
  await expect(cartao.getByPlaceholder("quanto?")).toHaveValue("");

  await cartao.getByRole("button", { name: "Mostrar o peão de Ogro do Robô pra mesa" }).click();
  await expect.poll(async () => (await pecasDoBanco()).find((p) => p.slug === "ogro-robo")?.oculto).toBe(false);
  await cartao.getByRole("button", { name: "Revelar o nome de Ogro do Robô pra mesa" }).click();
  await expect.poll(async () => (await fichaDoBanco("ogro-robo")).revealed).toBe(true);

  // O ✕ do painel fecha o cartão.
  await cartao.getByRole("button", { name: "Fechar" }).click();
  await expect(cartao).toHaveCount(0);

  // O jogador toca no próprio peão: é a vez dele, e passa a vez dali.
  const contexto = await browser.newContext();
  const jogador = await contexto.newPage();
  const errosJogador = coletarErros(jogador);
  await comoJogador(jogador, "jogador-robo");
  await jogador.goto(`/?sala=${SALA}`);
  await jogador.getByRole("button", { name: "ver o mapa" }).click();
  await expect(jogador.locator(".cena-canvas")).toBeVisible();
  await expect(jogador.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  const meu = await abrirCartao(jogador, 165, 165);
  await expect(meu).toContainText("Jogador Robô");
  await expect(meu).toContainText("é a vez");
  // O jogador não esconde peão nem revela nome: isso é do Mestre.
  await expect(meu.getByRole("button", { name: /Mostrar o peão|Esconder o peão|nome/ })).toHaveCount(0);
  await meu.getByRole("button", { name: "Passar a vez →" }).click();
  await expect.poll(async () => (await combateDoBanco()).turn).toBe(1);
  await expect(meu).not.toContainText("é a vez");

  await contexto.close();
  expect(erros).toEqual([]);
  expect(errosJogador).toEqual([]);
});

test("apagar a ficha do inimigo tira o peão dele do mapa (sem deixar um '?' cinza)", async ({ page }) => {
  const erros = coletarErros(page);
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Fichas", exact: true }).click();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "remover Goblin do Robô" }).click();
  await expect.poll(async () => (await pecasDoBanco()).map((p) => p.slug).sort()).toEqual(["jogador-robo", "ogro-robo"]);
  expect(erros).toEqual([]);
});
