import { expect, test } from "@playwright/test";
import { SALA, bancoConfigurado, coletarErros, criarFicha, entrarComoMestre, limparSala, rest } from "./apoio";

/**
 * Recap da sessão: o Mestre pede o rascunho, o app acha a sessão no histórico do
 * log (que tem mais de 40 linhas — o `sala.log` da tela só guarda as últimas 40),
 * conta o que aconteceu e põe no formulário do diário. Nada é salvo até o Mestre
 * apertar "+ nova entrada". Mesma sala `ci-teste`, limpa antes e depois.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");
test.describe.configure({ mode: "serial" });

test.beforeAll(limparSala);
test.afterAll(limparSala);

const DOIS_DIAS = 2 * 24 * 60 * 60 * 1000;
const VINTE_DIAS = 20 * 24 * 60 * 60 * 1000;
const minutos = (base: number, n: number) => new Date(base + n * 60_000).toISOString();

async function inserir(tabela: string, linhas: Record<string, unknown>[]): Promise<void> {
  const r = await rest(tabela, { method: "POST", body: JSON.stringify(linhas) });
  if (!r.ok) throw new Error(`não inseriu em ${tabela}: HTTP ${r.status} ${await r.text()}`);
}

test("recap: acha a sessão no histórico, escreve o rascunho, o Mestre edita e salva no diário", async ({ page }) => {
  const erros = coletarErros(page);
  await criarFicha("ana-robo", "Ana Robô");
  const base = Date.now() - DOIS_DIAS;

  // Uma sessão de ontem... de anteontem: 9 linhas de jogo, 10 minutos entre elas.
  const jogo = [
    "Um inimigo entrou no combate (iniciativa 12)",
    "Um inimigo entrou no combate (iniciativa 9)",
    "Rodada 2 começou",
    "Ana Robô sofreu 12 de dano (0/20)",
    "Um inimigo sofreu 30 de dano",
    "Ana Robô conjura Bênção",
    "Ana Robô conjura Bênção (espaço de 2º nível)",
    "Rodada 3 começou",
    "🎒 Ana Robô pegou 2× Poção de cura do baú",
  ];
  // Mais de 40 linhas no total (o limite do `sala.log`): o recap tem de ler do banco, não da tela.
  const ruido = Array.from({ length: 45 }, (_, i) => ({ room_code: SALA, text: `Rodada ${i + 4} começou`, created_at: minutos(base, 100 + i) }));
  await inserir("combat_log", [...jogo.map((text, i) => ({ room_code: SALA, text, created_at: minutos(base, i * 10) })), ...ruido]);
  // Uma mexida avulsa de semanas atrás (poucas linhas) não vira sessão.
  await inserir("combat_log", [
    { room_code: SALA, text: "Combate reiniciado", created_at: minutos(base - VINTE_DIAS, 0) },
    { room_code: SALA, text: "Combate reiniciado", created_at: minutos(base - VINTE_DIAS, 1) },
  ]);
  // Um cartão que o Mestre mostrou à mesa durante a sessão.
  await inserir("quadro_cartoes", [{ room_code: SALA, tipo: "npc", titulo: "Barão Vael", revelacao: "revelado", destaque_em: minutos(base, 25) }]);

  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Campanha", exact: true }).click();
  await page.getByRole("button", { name: "📖 Sessões" }).click();
  await page.getByRole("button", { name: "📝 Gerar recap da sessão" }).click();

  // Só uma sessão na lista (as duas linhas avulsas ficaram de fora), com o total de registros dela.
  const botoes = page.locator(".recap-lista .btn");
  await expect(botoes).toHaveCount(1);
  await expect(botoes.first()).toContainText(`${jogo.length + ruido.length} registros`);
  await botoes.first().click();

  const caixa = page.locator("textarea[placeholder='resumo da sessão...']");
  await expect(caixa).toHaveValue(/⚔️ Combate: 47 rodadas jogadas; 2 inimigos entraram na luta; os inimigos sofreram 30 de dano no total\./);
  const texto = await caixa.inputValue();
  expect(texto).toContain("💥 Ana Robô sofreu 12 de dano.");
  expect(texto).toContain("🩸 Caíram: Ana Robô.");
  expect(texto).toContain("🔮 Magias: Ana Robô: Bênção (2×).");
  expect(texto).toContain("🗂 Mostrado à mesa: Barão Vael.");
  expect(texto).toContain("🎒 Ana Robô pegou 2× Poção de cura do baú");
  expect(texto.length).toBeLessThanOrEqual(2000);
  await expect(page.getByPlaceholder("título (opcional)")).toHaveValue(/^Sessão de \d{2}\/\d{2}$/);

  // Gerar não salva nada: o diário continua vazio até o Mestre confirmar.
  const antes = await rest(`diario?select=id&room_code=eq.${SALA}`);
  expect(await antes.json()).toEqual([]);

  // O Mestre acrescenta uma frase dele e salva.
  await caixa.fill(`${texto}\n\nO Barão ofereceu um acordo.`);
  await page.getByRole("button", { name: "+ nova entrada" }).click();
  await expect
    .poll(async () => {
      const r = await rest(`diario?select=title,text&room_code=eq.${SALA}`);
      const linhas = (await r.json()) as { title: string; text: string }[];
      return linhas.length === 1 && linhas[0].text.includes("O Barão ofereceu um acordo.") && linhas[0].text.includes("47 rodadas jogadas");
    })
    .toBe(true);

  expect(erros).toEqual([]);
});

test("recap: sem sessão no histórico, a tela explica em vez de gerar um rascunho vazio", async ({ page }) => {
  await limparSala();
  await entrarComoMestre(page);
  await page.getByRole("button", { name: "Campanha", exact: true }).click();
  await page.getByRole("button", { name: "📖 Sessões" }).click();
  await page.getByRole("button", { name: "📝 Gerar recap da sessão" }).click();
  await expect(page.getByText("Ainda não há uma sessão no histórico")).toBeVisible();
  await expect(page.locator(".recap-lista")).toHaveCount(0);
});
