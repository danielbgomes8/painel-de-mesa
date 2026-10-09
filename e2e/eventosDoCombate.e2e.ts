import { expect, test } from "@playwright/test";
import { SALA, abrirMontagem, bancoConfigurado, coletarErros, comoJogador, criarFicha, entrarComoMestre, limparSala, mudarFicha, rest } from "./apoio";

/**
 * Eventos do combate: o Mestre prepara avisos no encontro (por rodada e por PV de um grupo), eles
 * entram no combate quando o encontro começa, aparecem sozinhos quando o gatilho chega, "contar à
 * mesa" vai pro log público só ao marcar feito, e reiniciar o combate leva os avisos embora.
 * Quem joga nunca vê os avisos.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

type Linha = { tipo: string; rodada: number | null; pct: number | null; slugs: string[]; texto: string; publico: boolean; feito: boolean };
async function eventosDoBanco(): Promise<Linha[]> {
  const r = await rest(`combate_eventos?select=tipo,rodada,pct,slugs,texto,publico,feito&room_code=eq.${SALA}&order=created_at,texto`);
  if (!r.ok) throw new Error(`não leu os eventos: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) as Linha[];
}
async function logDoBanco(): Promise<string[]> {
  const r = await rest(`combat_log?select=text&room_code=eq.${SALA}&order=created_at.desc`);
  return ((await r.json()) as { text: string }[]).map((l) => l.text);
}
async function mudarRodada(round: number): Promise<void> {
  const r = await rest(`combat_state?room_code=eq.${SALA}`, { method: "PATCH", body: JSON.stringify({ round }) });
  if (!r.ok) throw new Error(`não mudou a rodada: HTTP ${r.status} ${await r.text()}`);
}

const monstro = (name: string, hp_max: number, quantidade: number) => ({ name, cls: "Monstruosidade média", ac: 12, hp_max, speed: 9, init_mod: 0, ataque: "", notes: "", quantidade });

test("eventos do combate: preparados no encontro, aparecem no gatilho, contam à mesa só ao marcar, somem ao reiniciar", async ({ browser, page }) => {
  test.setTimeout(180_000);
  const erros = coletarErros(page);
  page.on("dialog", (d) => void d.accept());
  await criarFicha("jogador-robo", "Jogador Robô", { hp: 20, hp_max: 20 });

  const criado = await rest("encontros", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      room_code: SALA,
      name: "Ponte",
      grupos: [monstro("Goblin", 7, 2), monstro("Chefe", 20, 1)],
      eventos: [
        { id: "e-r2", tipo: "rodada", rodada: 2, grupo: null, pct: null, texto: "A ponte range", publico: false },
        { id: "e-r3", tipo: "rodada", rodada: 3, grupo: null, pct: null, texto: "O teto desaba", publico: true },
        { id: "e-pv", tipo: "pv", rodada: null, grupo: 1, pct: 50, texto: "O chefe foge", publico: false },
        { id: "e-g0", tipo: "pv", rodada: null, grupo: 0, pct: 0, texto: "Os goblins se rendem", publico: false },
      ],
    }),
  });
  expect(criado.ok).toBe(true);

  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Combate", exact: true }).click();

  // Começa o encontro: os 4 avisos entram no combate, o de PV já com os slugs dos monstros do grupo certo.
  await abrirMontagem(page);
  await page.getByRole("button", { name: /Ponte · 3 monstros/ }).click();
  await expect.poll(async () => (await eventosDoBanco()).length).toBe(4);
  const aoComecar = await eventosDoBanco();
  expect(aoComecar.find((e) => e.texto === "O chefe foge")?.slugs).toHaveLength(1);
  expect(aoComecar.find((e) => e.texto === "Os goblins se rendem")?.slugs).toHaveLength(2);
  expect(aoComecar.every((e) => !e.feito)).toBe(true);
  // Rodada 1 e ninguém ferido: nada pede atenção ainda.
  await expect(page.locator(".evaviso")).toHaveCount(0);

  // Rodada 2: aparece o aviso da rodada 2 (e só ele). "Feito" marca e tira da tela, sem ir pro log.
  await mudarRodada(2);
  await expect(page.locator(".evaviso")).toHaveCount(1);
  await expect(page.locator(".evaviso")).toContainText("Rodada 2");
  await expect(page.locator(".evaviso")).toContainText("A ponte range");
  await page.locator(".evaviso").getByRole("button", { name: "Feito", exact: true }).click();
  await expect.poll(async () => (await eventosDoBanco()).find((e) => e.texto === "A ponte range")?.feito).toBe(true);
  await expect(page.locator(".evaviso")).toHaveCount(0);
  expect((await logDoBanco()).join("\n")).not.toContain("A ponte range");

  // Rodada 3: aviso "contar à mesa" — só vai pro log público depois de marcar feito.
  await mudarRodada(3);
  await expect(page.locator(".evaviso")).toContainText("O teto desaba");
  expect((await logDoBanco()).join("\n")).not.toContain("O teto desaba");
  await page.locator(".evaviso").getByRole("button", { name: "Feito · contar à mesa" }).click();
  await expect.poll(async () => (await logDoBanco()).includes("📜 O teto desaba")).toBe(true);
  await expect(page.locator(".evaviso")).toHaveCount(0);

  // PV: o chefe a 50% (10 de 20) dispara; um goblin a 0 dispara o dos goblins.
  const fichas = (await (await rest(`characters?select=slug,name&room_code=eq.${SALA}&is_npc=eq.true`)).json()) as { slug: string; name: string }[];
  const chefe = fichas.find((f) => f.name === "Chefe")!;
  const goblin = fichas.find((f) => f.name.startsWith("Goblin"))!;
  await mudarFicha(chefe.slug, { hp: 10 });
  await expect(page.locator(".evaviso")).toContainText("50% de PV · Chefe");
  await expect(page.locator(".evaviso")).toContainText("O chefe foge");
  await mudarFicha(goblin.slug, { hp: 0 });
  await expect(page.locator(".evaviso")).toHaveCount(2);

  // Quem joga não vê nenhum aviso (nem o texto), só o que o Mestre contou à mesa no log.
  const contexto = await browser.newContext();
  const jogador = await contexto.newPage();
  await comoJogador(jogador, "jogador-robo");
  await jogador.goto(`/?sala=${SALA}`);
  await jogador.getByRole("button", { name: "Combate", exact: true }).click();
  await expect(jogador.locator(".initrow").first()).toBeVisible();
  for (const gaveta of await jogador.locator("details > summary").all()) if (await gaveta.isVisible()) await gaveta.click();
  const textoDoJogador = await jogador.evaluate(() => document.documentElement.outerHTML);
  for (const segredo of ["A ponte range", "O chefe foge", "Os goblins se rendem"]) expect(textoDoJogador).not.toContain(segredo);
  expect(textoDoJogador).toContain("O teto desaba"); // contado à mesa de propósito
  await expect(jogador.locator(".evaviso")).toHaveCount(0);
  await contexto.close();

  // Aviso avulso pela gaveta do combate, e reiniciar o combate leva todos.
  await page.locator("details.gavetacombate", { hasText: "Eventos do combate" }).locator(":scope > summary").click();
  await page.getByLabel("Número da rodada").fill("7");
  await page.getByLabel("O que acontece (texto do aviso)").fill("Reforços chegam");
  await page.getByRole("button", { name: "+ aviso" }).click();
  await expect.poll(async () => (await eventosDoBanco()).some((e) => e.texto === "Reforços chegam" && e.rodada === 7)).toBe(true);
  await expect(page.locator(".evitem", { hasText: "Reforços chegam" })).toContainText("esperando");

  await abrirMontagem(page); // a gaveta fecha sozinha quando o combate tem gente na ordem
  await page.getByRole("button", { name: "Reiniciar combate" }).click();
  await expect.poll(async () => (await eventosDoBanco()).length).toBe(0);
  expect(erros).toEqual([]);
});
