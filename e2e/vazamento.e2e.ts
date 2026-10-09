import { expect, test, type Page } from "@playwright/test";
import { iniciais } from "../src/lib/pecas";
import {
  SALA,
  bancoConfigurado,
  cenaDoBanco,
  coletarErros,
  comoJogador,
  criarFicha,
  criarPeca,
  mudarCena,
  entrarComoMestre,
  limparSala,
  pngDeTeste,
  porNaIniciativa,
  rest,
} from "./apoio";

/**
 * Teste de vazamento de segredo.
 *
 * O app esconde NA TELA (o banco é aberto de propósito — ver "Segurança" no README):
 * NPC oculto, segredo e cartão escondido do Quadro, nota 🔒 do mapa, peão oculto, PV de inimigo.
 * Um descuido numa tela nova entrega o chefão sem ninguém perceber, e cada regra
 * é testada separada. Este teste é a rede por baixo de todas: semeia uma ISCA em
 * cada lugar secreto (um texto "ISCA_..." diferente por campo), passeia por TODAS
 * as telas como jogador e como telão, e confere que nenhuma isca apareceu —
 * nem no texto, nem em atributo (aria-label, title...), nem em campo de formulário,
 * nem desenhada no mapa (o robô espia o que o canvas escreve).
 *
 * Tela nova não precisa de teste novo: se ela mostrar uma isca, este aqui falha.
 * Os "controles" no fim provam que o robô enxerga as iscas (o Mestre as vê), senão
 * um seletor errado faria o teste passar sem olhar nada.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

const ISCA = /ISCA_[A-Z0-9_]+/g;
/** PV do inimigo oculto (antes e depois do dano de 7): números que o jogador nunca pode ver. */
const PV_SECRETO = /\b(4711|4704)\b/;

async function inserir(tabela: string, corpo: unknown, devolver = false): Promise<{ id: string }[]> {
  const r = await rest(tabela, {
    method: "POST",
    body: JSON.stringify(corpo),
    headers: devolver ? { Prefer: "return=representation" } : {},
  });
  if (!r.ok) throw new Error(`não semeou ${tabela}: HTTP ${r.status} ${await r.text()}`);
  return devolver ? ((await r.json()) as { id: string }[]) : [];
}

/** Tudo que esta tela mostra agora: HTML inteiro (atributos inclusive), valor dos campos e texto desenhado no canvas. */
async function recolher(page: Page, saco: string[]): Promise<void> {
  saco.push(
    await page.evaluate(() => {
      const campos = [...document.querySelectorAll("input,textarea,select")].map((e) => (e as HTMLInputElement).value).join("\n");
      const canvas = (window as unknown as { __textos?: string[] }).__textos ?? [];
      return `${document.documentElement.outerHTML}\n${campos}\n${canvas.join("\n")}\n@@canvas@@${canvas.join("|")}@@visivel@@${document.body.innerText}`;
    }),
  );
}

/** O robô espia o que o canvas escreve (ele não tem texto no DOM). */
function espiarCanvas(): void {
  const w = window as unknown as { __textos: string[] };
  w.__textos = [];
  for (const metodo of ["fillText", "strokeText"] as const) {
    const original = CanvasRenderingContext2D.prototype[metodo];
    CanvasRenderingContext2D.prototype[metodo] = function (...args: Parameters<typeof original>) {
      w.__textos.push(String(args[0]));
      return original.apply(this, args);
    };
  }
}

/** Abre cada cartão do Quadro (um de cada vez) e recolhe, pra pegar o que só aparece aberto. */
async function abrirTodosOsCartoes(page: Page, saco: string[]): Promise<number> {
  const total = await page.locator(".qd-cartao").count();
  for (let i = 0; i < total; i++) {
    await page.locator(".qd-cartao").nth(i).click();
    await page.waitForTimeout(150);
    await recolher(page, saco);
    const fechar = page.getByRole("button", { name: "Fechar o cartão" });
    if (await fechar.isVisible()) await fechar.click();
  }
  return total;
}

function iscasEm(saco: string[]): string[] {
  return [...new Set(saco.flatMap((t) => t.match(ISCA) ?? []))].sort();
}
function textoVisivel(saco: string[]): string {
  return saco.map((t) => t.split("@@visivel@@")[1] ?? "").join("\n");
}
/** O que foi desenhado nos canvas (rótulo dos peões, números das notas...), um item por texto. */
function textosDoCanvas(saco: string[]): string[] {
  return saco.flatMap((t) => (t.split("@@canvas@@")[1] ?? "").split("@@visivel@@")[0].split("|")).filter(Boolean);
}

test("o que é segredo da mesa não aparece pro jogador nem no telão (e o Mestre vê tudo)", async ({ browser, page }) => {
  test.setTimeout(240_000);
  const errosMestre = coletarErros(page);

  // ---- Semeia uma isca em cada lugar secreto ----
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 20, hp_max: 20 });
  await criarFicha("outro-robo", "Outro Robô");
  await criarFicha("dragao-oculto", "Dragão ISCA_NPC_NOME", {
    is_npc: true,
    revealed: false,
    cls: "ISCA_NPC_TIPO",
    hp: 4711,
    hp_max: 4711,
    notes: "ISCA_NPC_NOTA",
    ataque: "ISCA_NPC_ATAQUE +9, 2d6 cortante",
  });
  await porNaIniciativa([
    { slug: "jogador-robo", name: "Jogador Robô", init: 15 },
    { slug: "dragao-oculto", name: "Dragão ISCA_NPC_NOME", init: 12 },
  ]);

  const cartoes = await inserir(
    "quadro_cartoes",
    [
      { room_code: SALA, tipo: "npc", titulo: "ISCA_ESC_TITULO", subtitulo: "ISCA_ESC_SUB", texto: "ISCA_ESC_TEXTO", segredo: "ISCA_ESC_SEGREDO", revelacao: "escondido", dono: null },
      { room_code: SALA, tipo: "vilao", titulo: "ISCA_SIL_TITULO", subtitulo: "ISCA_SIL_SUB", texto: "ISCA_SIL_TEXTO", segredo: "ISCA_SIL_SEGREDO", revelacao: "silhueta", dono: null },
      { room_code: SALA, tipo: "npc", titulo: "Cartão Público", subtitulo: "visível", texto: "texto que a mesa lê", segredo: "ISCA_REV_SEGREDO", revelacao: "revelado", dono: null },
      { room_code: SALA, tipo: "item", titulo: "ISCA_PES_TITULO", subtitulo: "ISCA_PES_SUB", texto: "ISCA_PES_TEXTO", segredo: "", revelacao: "escondido", dono: "outro-robo" },
    ],
    true,
  );
  const [escondido, , publico, pessoal] = cartoes;
  await inserir("quadro_ligacoes", { room_code: SALA, de: publico.id, para: escondido.id, rotulo: "ISCA_LIG_ROTULO" });
  await inserir("quadro_notas", { room_code: SALA, cartao_id: escondido.id, autor: "mestre", texto: "ISCA_CARTAO_NOTA" });
  await inserir("diario", { room_code: SALA, title: "Sessão pública", text: "o que todos viram", cartoes: [escondido.id, pessoal.id] });
  await rest("dm_notes", { method: "POST", body: JSON.stringify({ room_code: SALA, text: "ISCA_NOTAS_MESTRE" }), headers: { Prefer: "resolution=merge-duplicates" } });
  await inserir("npc_templates", { room_code: SALA, name: "ISCA_BIBLIOTECA", cls: "ISCA_BIB_TIPO", notes: "ISCA_BIB_NOTA", ataque: "" });
  await inserir("encontros", { room_code: SALA, name: "ISCA_ENCONTRO", grupos: [] });

  // ---- O Mestre sobe um mapa, põe na mesa e dá dano no inimigo oculto (gera o log público) ----
  const mestre: string[] = [];
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .locator('section[aria-label="Mapa"] input[type=file]')
    .setInputFiles({ name: "mapa-vazamento.png", mimeType: "image/png", buffer: pngDeTeste(900, 600) });
  await expect(page.locator(".cena-canvas")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "levar a mesa pra este mapa" }).click();
  await expect(page.locator(".palco-nome").getByText("Na mesa")).toBeVisible();

  const cena = await cenaDoBanco();
  // Sem névoa: o que esconde os peões aqui é só a marca "oculto" (a névoa por cima esconderia tudo e mascararia o teste).
  await mudarCena(cena.id, { nevoa_ligada: false });
  await criarPeca(cena.id, "dragao-oculto", 150, 150, { oculto: true });
  await criarPeca(cena.id, "", 300, 300, { slug: null, nome: "ISCA_PECA_AVULSA", oculto: true });
  await criarPeca(cena.id, "jogador-robo", 450, 300);
  await inserir("cena_marcas", { cena_id: cena.id, room_code: SALA, tipo: "nota", x: 100, y: 400, texto: "ISCA_MARCA_OCULTA", visivel: false });

  await page.getByRole("button", { name: "Combate", exact: true }).click();
  await page.locator(".initrow .whobtn", { hasText: "ISCA_NPC_NOME" }).click();
  await page.getByPlaceholder("quanto?").fill("7");
  await page.getByRole("button", { name: "Dano 7" }).click();
  await expect.poll(async () => {
    const r = await rest(`characters?select=hp&room_code=eq.${SALA}&slug=eq.dragao-oculto`);
    return ((await r.json()) as { hp: number }[])[0]?.hp;
  }).toBe(4704);

  // ---- Controle: o Mestre enxerga as iscas (se não, o robô estaria cego) ----
  await recolher(page, mestre);
  await page.getByRole("button", { name: "Campanha", exact: true }).click();
  await page.getByRole("button", { name: /Quadro/ }).click();
  await expect(page.locator(".qd-cartao").first()).toBeVisible();
  expect(await abrirTodosOsCartoes(page, mestre)).toBeGreaterThanOrEqual(3);
  await page.getByRole("button", { name: "Mestre", exact: true }).click();
  for (const secao of [/^Encontros/, /^NPCs/, /^Notas/]) {
    await page.getByRole("tab", { name: secao }).click();
    await page.waitForTimeout(200);
    await recolher(page, mestre);
  }
  const vistasPeloMestre = iscasEm(mestre);
  for (const isca of ["ISCA_NPC_NOME", "ISCA_ESC_TITULO", "ISCA_ESC_SEGREDO", "ISCA_REV_SEGREDO", "ISCA_BIBLIOTECA", "ISCA_ENCONTRO", "ISCA_NOTAS_MESTRE"]) {
    expect(vistasPeloMestre, `o Mestre deveria ver ${isca} (controle do teste)`).toContain(isca);
  }

  // ---- O jogador passeia por todas as telas ----
  const contextoJogador = await browser.newContext();
  await contextoJogador.addInitScript(espiarCanvas);
  const jogador = await contextoJogador.newPage();
  const errosJogador = coletarErros(jogador);
  await comoJogador(jogador, "jogador-robo");
  await jogador.goto(`/?sala=${SALA}`);
  const visto: string[] = [];

  await expect(jogador.getByRole("button", { name: "Campanha", exact: true })).toBeVisible();
  for (const parte of [/Quadro/, /Baú/, /Tempo|Dia \d+/, /Sessões/]) {
    await jogador.getByRole("button", { name: parte }).click();
    await jogador.waitForTimeout(250);
    await recolher(jogador, visto);
  }
  await jogador.getByRole("button", { name: /Quadro/ }).click();
  await expect(jogador.locator(".qd-cartao").first()).toBeVisible();
  const cartoesDoJogador = await abrirTodosOsCartoes(jogador, visto);

  await jogador.getByRole("button", { name: "Combate", exact: true }).click();
  await expect(jogador.locator(".initrow")).toHaveCount(2);
  await recolher(jogador, visto);
  // Abre tudo que dá pra abrir (gavetas do log) e a linha do inimigo, onde ele tocar.
  for (const gaveta of await jogador.locator("details > summary").all()) {
    if (await gaveta.isVisible()) await gaveta.click();
  }
  await recolher(jogador, visto);
  for (const linha of await jogador.locator(".initrow .whobtn").all()) {
    if (await linha.isVisible()) {
      await linha.click();
      await jogador.waitForTimeout(150);
      await recolher(jogador, visto);
    }
  }

  await jogador.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(jogador.locator(".cena-canvas")).toBeVisible();
  await expect(jogador.getByText("Carregando o mapa")).toHaveCount(0, { timeout: 30_000 });
  await jogador.waitForTimeout(1200);
  await recolher(jogador, visto);

  await jogador.getByRole("button", { name: "Fichas", exact: true }).click();
  await jogador.waitForTimeout(400);
  await recolher(jogador, visto);

  // ---- O telão ----
  const contextoTelao = await browser.newContext();
  await contextoTelao.addInitScript(espiarCanvas);
  const telao = await contextoTelao.newPage();
  const errosTelao = coletarErros(telao);
  await telao.goto(`/?sala=${SALA}&telao=1`);
  await expect(telao.locator(".telao--mapa .cena-canvas")).toBeVisible();
  await telao.waitForTimeout(1500);
  const vistoNoTelao: string[] = [];
  await recolher(telao, vistoNoTelao);

  // ---- O veredito ----
  expect(iscasEm(visto), "iscas que o JOGADOR conseguiu ver").toEqual([]);
  expect(iscasEm(vistoNoTelao), "iscas que o TELÃO mostrou").toEqual([]);
  expect(textoVisivel(visto), "PV do inimigo oculto na tela do jogador").not.toMatch(PV_SECRETO);
  expect(textoVisivel(vistoNoTelao), "PV do inimigo oculto no telão").not.toMatch(PV_SECRETO);
  // Peão oculto não é desenhado: o dragão ("?" pra quem não pode ver o nome) e o marcador avulso
  // (que desenharia as iniciais do nome) ficam fora do mapa do jogador e do telão.
  for (const [quem, saco] of [["jogador", visto], ["telão", vistoNoTelao]] as const) {
    const desenhado = textosDoCanvas(saco);
    expect(desenhado, `peão oculto desenhado no mapa do ${quem}`).not.toContain("?");
    expect(desenhado, `marcador oculto desenhado no mapa do ${quem}`).not.toContain(iniciais("ISCA_PECA_AVULSA"));
  }

  // ---- Controles do lado do jogador: viu o público, o robô não passeou por tela vazia ----
  expect(cartoesDoJogador).toBeGreaterThanOrEqual(1);
  expect(textosDoCanvas(visto), "o robô deveria ver o peão do próprio jogador no canvas (controle)").toContain(iniciais("Jogador Robô"));
  expect(textoVisivel(visto)).toContain("Cartão Público");
  expect(textoVisivel(visto)).toContain("Inimigo 1");
  expect(textoVisivel(visto)).toContain("Um inimigo");
  expect(textoVisivel(vistoNoTelao)).toContain("Inimigo 1");

  await contextoJogador.close();
  await contextoTelao.close();
  expect(errosMestre).toEqual([]);
  expect(errosJogador).toEqual([]);
  expect(errosTelao).toEqual([]);
});
