import { expect, test, type Page } from "@playwright/test";
import {
  SALA,
  bancoConfigurado,
  cenaDoBanco,
  coletarErros,
  comoJogador,
  criarFicha,
  criarPeca,
  entrarComoMestre,
  limparSala,
  pecasDoBanco,
  pngDeTeste,
  rest,
} from "./apoio";

/**
 * Aura (emanação) no peão: o Mestre liga no peão de um jogador, ela anda com o peão,
 * o jogador liga a do próprio peão, e a aura de um peão oculto NUNCA chega na mesa.
 * Mesma sala `ci-teste`, limpa antes e depois.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

/** O canvas não tem DOM: o robô escuta o que é DESENHADO. Cada quadro começa no
 *  preenchimento do fundo (0,0); os arcos [x, y, raio] caem no quadro em andamento. */
const espiar = () => {
  const w = window as unknown as { __quadros: number[][][] };
  w.__quadros = [[]];
  const preencher = CanvasRenderingContext2D.prototype.fillRect;
  CanvasRenderingContext2D.prototype.fillRect = function (...args: Parameters<typeof preencher>) {
    if (args[0] === 0 && args[1] === 0) {
      w.__quadros.push([]);
      if (w.__quadros.length > 40) w.__quadros.shift();
    }
    return preencher.apply(this, args);
  };
  const arco = CanvasRenderingContext2D.prototype.arc;
  CanvasRenderingContext2D.prototype.arc = function (...args: Parameters<typeof arco>) {
    w.__quadros[w.__quadros.length - 1].push([args[0], args[1], args[2]]);
    return arco.apply(this, args);
  };
};
/** Os arcos do último quadro COMPLETO (o de agora pode estar pela metade). */
const ultimoQuadro = (p: Page) =>
  p.evaluate(() => {
    const q = (window as unknown as { __quadros: number[][][] }).__quadros;
    return q.length >= 2 ? q[q.length - 2] : [];
  });
const temRaio = (arcos: number[][], raio: number) => arcos.some((a) => Math.abs(a[2] - raio) < 0.6);

/** Espera o que uma tela DESENHA. O tempo real do Supabase às vezes demora mais de 20 s (o
 *  robô já oscila por isso: ver AGENTS.md); então, enquanto espera, dispara o mesmo "voltei pra
 *  aba" que o app trata relendo tudo do banco. O que se confere é a aura gravada, lida e desenhada. */
async function ver(pagina: Page, cond: (arcos: number[][]) => boolean, esperado = true) {
  await expect
    .poll(
      async () => {
        await pagina.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
        return cond(await ultimoQuadro(pagina));
      },
      { timeout: 30_000, intervals: [1000] },
    )
    .toBe(esperado);
}

async function tocarNoMapa(page: Page, ix: number, iy: number) {
  const canvas = page.locator(".cena-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const caixa = (await canvas.boundingBox())!;
  const escala = Math.min(caixa.width / (900 * 1.06), caixa.height / (600 * 1.06));
  await page.mouse.click(caixa.x + caixa.width / 2 + (ix - 450) * escala, caixa.y + caixa.height / 2 + (iy - 300) * escala);
}
async function abrirCartao(page: Page, ix: number, iy: number) {
  const cartao = page.locator(".mapa-cartao");
  await expect(async () => {
    await tocarNoMapa(page, ix, iy);
    await expect(cartao).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });
  return cartao;
}
const auraDoBanco = async (slug: string) => (await pecasDoBanco()).find((x) => x.slug === slug)!;

test("aura: o Mestre liga no peão do jogador, ela anda junto, o jogador liga a própria, e a de peão oculto não chega na mesa", async ({ browser, page }) => {
  const erros = coletarErros(page);
  await page.addInitScript(espiar);
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-aura.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "levar a mesa pra este mapa" }).click();
  await expect(page.getByText("A mesa está vendo este mapa")).toBeVisible();

  const cena = await cenaDoBanco(); // 900 px de largura: quadradinho de 30 px = 1,5 m
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 20, hp_max: 20 });
  await criarPeca(cena.id, "jogador-robo", 165, 165);
  // Marcador OCULTO com aura de 6 m (raio = 15 + 120): é a prova de que a aura não entrega peão escondido.
  await criarPeca(cena.id, "", 585, 405, { slug: null, nome: "Armadilha", oculto: true, aura: 6 });

  // Jogador na outra ponta: vê o mapa, e o próprio peão aparece mesmo com névoa.
  const contexto = await browser.newContext();
  const jogador = await contexto.newPage();
  const errosJogador = coletarErros(jogador);
  await jogador.addInitScript(espiar);
  await comoJogador(jogador, "jogador-robo");
  await jogador.goto(`/?sala=${SALA}`);
  await jogador.getByRole("button", { name: "ver o mapa" }).click();
  await expect(jogador.locator(".cena-canvas")).toBeVisible();
  await expect(jogador.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });

  // Mestre toca no peão do jogador e liga uma aura de 3 m: raio = 15 (borda) + 60 (3 m) = 75 px.
  const cartao = await abrirCartao(page, 165, 165);
  await cartao.getByRole("button", { name: "Aura de 3 m" }).click();
  await expect.poll(async () => (await auraDoBanco("jogador-robo")).aura).toBe(3);
  await expect(cartao).toContainText("Aura de 3 m ligada");
  // O Mestre vê a aura do peão oculto (raio 135) e a do jogador; o jogador, só a dele.
  await ver(page, (q) => temRaio(q, 135));
  await ver(jogador, (q) => temRaio(q, 75));
  expect(temRaio(await ultimoQuadro(jogador), 135)).toBe(false);

  // A aura anda com o peão: muda o peão de lugar no banco e o halo vai junto (no celular do jogador).
  const peao = await auraDoBanco("jogador-robo");
  const r = await rest(`cena_pecas?id=eq.${peao.id}`, { method: "PATCH", body: JSON.stringify({ x: 405, y: 285 }) });
  expect(r.ok).toBe(true);
  await ver(jogador, (q) => q.some((a) => Math.abs(a[2] - 75) < 0.6 && Math.abs(a[0] - 405) < 0.6 && Math.abs(a[1] - 285) < 0.6));

  // "Outro raio": 4,5 (com vírgula, como no teclado do celular) liga; fora do limite não grava.
  await cartao.getByLabel("Outro raio da aura, em metros").fill("4,5");
  await cartao.getByRole("button", { name: "ligar", exact: true }).click();
  await expect.poll(async () => (await auraDoBanco("jogador-robo")).aura).toBe(4.5);
  await ver(jogador, (q) => temRaio(q, 15 + 90)); // 4,5 m = 3 quadrados de 30 px
  await cartao.getByLabel("Outro raio da aura, em metros").fill("500");
  await cartao.getByRole("button", { name: "ligar", exact: true }).click();
  await expect(cartao).toContainText("Use um raio de 0,1 a 120 m");
  expect((await auraDoBanco("jogador-robo")).aura).toBe(4.5);

  // Desligar: some pra todo mundo.
  await cartao.getByRole("button", { name: "Desligar a aura de Jogador Robô" }).click();
  await expect.poll(async () => (await auraDoBanco("jogador-robo")).aura).toBeNull();
  await ver(jogador, (q) => temRaio(q, 15 + 90), false);

  // O jogador liga a aura do PRÓPRIO peão (e o cartão dele traz o controle).
  const meu = await abrirCartao(jogador, 405, 285);
  await meu.getByRole("button", { name: "Aura de 9 m" }).click();
  await expect.poll(async () => (await auraDoBanco("jogador-robo")).aura).toBe(9);
  await ver(page, (q) => temRaio(q, 15 + 180)); // 9 m = 6 quadrados: raio diferente do da armadilha oculta (6 m = 135)
  // Tocar de novo no mesmo raio desliga.
  await meu.getByRole("button", { name: "Aura de 9 m" }).click();
  await expect.poll(async () => (await auraDoBanco("jogador-robo")).aura).toBeNull();

  await contexto.close();
  expect(erros).toEqual([]);
  expect(errosJogador).toEqual([]);
});
