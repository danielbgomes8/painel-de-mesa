import { deflateSync, crc32 } from "node:zlib";
import type { Page } from "@playwright/test";

/** A sala de teste do robô. Fixa: depois da migration 0020 ninguém apaga sala
 *  pelo app, então uma sala por execução deixaria lixo; esta é limpa a cada vez. */
export const SALA = process.env.E2E_SALA ?? "ci-teste";

try {
  // Local: lê o .env.local (o Playwright não lê). No CI as variáveis já vêm do ambiente.
  process.loadEnvFile(".env.local");
} catch {
  // sem arquivo: segue com o que o ambiente tiver
}

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const bancoConfigurado = Boolean(url && chave);

const cabecalhos = { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" };

/** Pedido direto à API do banco, com a chave pública (o que qualquer aparelho faz). */
export async function rest(caminho: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${url}/rest/v1/${caminho}`, { ...init, headers: { ...cabecalhos, ...(init.headers as Record<string, string>) } });
}

/** Tira do Storage as imagens da sala: as dos mapas (na pasta da sala) e as fotos dos
 *  cartões do Quadro (em `<sala>/quadro/`). O `delete` da cena ou do cartão no banco não leva o arquivo. */
async function limparImagens(): Promise<void> {
  for (const pasta of [SALA, `${SALA}/quadro`]) {
    const lista = await fetch(`${url}/storage/v1/object/list/mapas`, {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify({ prefix: pasta, limit: 200 }),
    });
    if (!lista.ok) continue;
    // Subpasta também vem na lista (sem `id`): só arquivo de verdade entra.
    const arquivos = ((await lista.json()) as { name: string; id: string | null }[]).filter((a) => a.id);
    if (arquivos.length === 0) continue;
    await fetch(`${url}/storage/v1/object/mapas`, {
      method: "DELETE",
      headers: cabecalhos,
      body: JSON.stringify({ prefixes: arquivos.map((a) => `${pasta}/${a.name}`) }),
    });
  }
}

/** Deixa a sala de teste vazia: apaga o que o robô criou, tabela por tabela
 *  (filhas antes das mães) e zera o combate. A linha da sala em si fica. */
export async function limparSala(): Promise<void> {
  if (!bancoConfigurado) return;
  await limparImagens();
  for (const tabela of ["campanha_efeitos", "campanha_tempo", "bau_itens", "quadro_notas", "quadro_ligacoes", "quadro_cartoes", "cena_marcas", "cena_paredes", "cena_pecas", "cena_nevoa", "cenas", "characters", "combat_log", "diario", "encontros", "npc_templates", "uso"]) {
    // Tabela que ainda não existe (migration por rodar) não é erro aqui.
    await rest(`${tabela}?room_code=eq.${SALA}`, { method: "DELETE" });
  }
  await rest(`combat_state?room_code=eq.${SALA}`, {
    method: "PATCH",
    body: JSON.stringify({ order_json: [], turn: 0, round: 1 }),
  });
}

export async function criarFicha(slug: string, nome: string, extra: Record<string, unknown> = {}): Promise<void> {
  const r = await rest("characters", { method: "POST", body: JSON.stringify({ room_code: SALA, slug, name: nome, ...extra }) });
  if (!r.ok) throw new Error(`não criou a ficha ${nome}: HTTP ${r.status} ${await r.text()}`);
}

/** Muda colunas de uma ficha direto no banco (o robô não precisa repetir a tela). */
export async function mudarFicha(slug: string, patch: Record<string, unknown>): Promise<void> {
  const r = await rest(`characters?room_code=eq.${SALA}&slug=eq.${slug}`, { method: "PATCH", body: JSON.stringify(patch) });
  if (!r.ok) throw new Error(`não mudou a ficha ${slug}: HTTP ${r.status} ${await r.text()}`);
}

/** Põe gente na ordem de iniciativa direto no banco (o robô não precisa repetir o formulário). */
export async function porNaIniciativa(itens: { slug: string; name: string; init: number }[]): Promise<void> {
  const r = await rest(`combat_state?room_code=eq.${SALA}`, {
    method: "PATCH",
    body: JSON.stringify({ order_json: itens, turn: 0, round: 1 }),
  });
  if (!r.ok) throw new Error(`não pôs na iniciativa: HTTP ${r.status} ${await r.text()}`);
}

/** Uma ficha, lida do banco. */
export async function fichaDoBanco(slug: string): Promise<{ hp: number; revealed: boolean } & Record<string, unknown>> {
  const r = await rest(`characters?select=*&room_code=eq.${SALA}&slug=eq.${slug}`);
  if (!r.ok) throw new Error(`não leu a ficha ${slug}: HTTP ${r.status}`);
  const linhas = (await r.json()) as ({ hp: number; revealed: boolean } & Record<string, unknown>)[];
  if (linhas.length === 0) throw new Error(`a ficha ${slug} não existe`);
  return linhas[0];
}

/** A ordem de iniciativa da sala, lida do banco. */
export async function combateDoBanco(): Promise<{ turn: number; round: number; order_json: { slug: string }[] }> {
  const r = await rest(`combat_state?select=turn,round,order_json&room_code=eq.${SALA}`);
  if (!r.ok) throw new Error(`não leu o combate: HTTP ${r.status}`);
  return ((await r.json()) as { turn: number; round: number; order_json: { slug: string }[] }[])[0];
}

export type LinhaPeca = { id: string; slug: string | null; nome: string; oculto: boolean; tamanho: number; x: number; y: number; aura: number | null };

/** Os peões da sala, lidos do banco (o canvas não dá pra conferir pelo DOM). */
export async function pecasDoBanco(): Promise<LinhaPeca[]> {
  const r = await rest(`cena_pecas?select=id,slug,nome,oculto,tamanho,x,y,aura&room_code=eq.${SALA}&order=created_at`);
  if (!r.ok) throw new Error(`não leu os peões: HTTP ${r.status}`);
  return (await r.json()) as LinhaPeca[];
}

export async function apagarPecasDoBanco(): Promise<void> {
  await rest(`cena_pecas?room_code=eq.${SALA}`, { method: "DELETE" });
}

/** A cena da sala de teste (a primeira), lida do banco. */
export async function cenaDoBanco(): Promise<{ id: string; explorado: string; visao_ligada: boolean; grade_px: number; grade_ligada: boolean; largura: number; altura: number } & Record<string, unknown>> {
  const r = await rest(`cenas?select=*&room_code=eq.${SALA}&order=created_at&limit=1`);
  if (!r.ok) throw new Error(`não leu a cena: HTTP ${r.status}`);
  const linhas = (await r.json()) as ({ id: string; explorado: string; visao_ligada: boolean; grade_px: number; grade_ligada: boolean; largura: number; altura: number } & Record<string, unknown>)[];
  if (linhas.length === 0) throw new Error("a sala de teste não tem cena");
  return linhas[0];
}

export async function mudarCena(id: string, patch: Record<string, unknown>): Promise<void> {
  const r = await rest(`cenas?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  if (!r.ok) throw new Error(`não mudou a cena: HTTP ${r.status} ${await r.text()}`);
}

/** Põe um peão numa posição conhecida (px da imagem). */
export async function criarPeca(cenaId: string, slug: string, x: number, y: number, extra: Record<string, unknown> = {}): Promise<void> {
  const r = await rest("cena_pecas", { method: "POST", body: JSON.stringify({ cena_id: cenaId, room_code: SALA, slug, nome: "", x, y, ...extra }) });
  if (!r.ok) throw new Error(`não criou o peão: HTTP ${r.status} ${await r.text()}`);
}

export type LinhaMarca = { id: string; tipo: string; cor: string; pontos: [number, number][]; x: number | null; y: number | null; texto: string; visivel: boolean };
export async function marcasDoBanco(): Promise<LinhaMarca[]> {
  const r = await rest(`cena_marcas?select=id,tipo,cor,pontos,x,y,texto,visivel&room_code=eq.${SALA}&order=created_at`);
  if (!r.ok) throw new Error(`não leu as marcas: HTTP ${r.status}`);
  return (await r.json()) as LinhaMarca[];
}

export type LinhaParede = { id: string; tipo: string; x1: number; y1: number; x2: number; y2: number; aberta: boolean };

export async function criarParedes(cenaId: string, linhas: { tipo: "parede" | "porta"; x1: number; y1: number; x2: number; y2: number }[]): Promise<void> {
  const r = await rest("cena_paredes", { method: "POST", body: JSON.stringify(linhas.map((l) => ({ cena_id: cenaId, room_code: SALA, aberta: false, ...l }))) });
  if (!r.ok) throw new Error(`não criou as paredes: HTTP ${r.status} ${await r.text()}`);
}

export async function paredesDoBanco(): Promise<LinhaParede[]> {
  const r = await rest(`cena_paredes?select=id,tipo,x1,y1,x2,y2,aberta&room_code=eq.${SALA}&order=created_at`);
  if (!r.ok) throw new Error(`não leu as paredes: HTTP ${r.status}`);
  return (await r.json()) as LinhaParede[];
}

export async function mudarParede(id: string, patch: Record<string, unknown>): Promise<void> {
  const r = await rest(`cena_paredes?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  if (!r.ok) throw new Error(`não mudou a parede: HTTP ${r.status} ${await r.text()}`);
}

/** Entra na sala de teste como Mestre (o app não tem login: é só um clique). */
export async function entrarComoMestre(page: Page): Promise<void> {
  await page.goto(`/?sala=${SALA}`);
  await page.getByText("Sou o Mestre").click();
}

/** Faz este navegador "ser" um personagem, como depois de escolher na tela de entrada. */
export async function comoJogador(page: Page, slug: string): Promise<void> {
  await page.addInitScript(
    ([sala, quem]) => localStorage.setItem(`mesa-identidade:${sala}`, JSON.stringify({ tipo: "jogador", slug: quem })),
    [SALA, slug],
  );
}

/** Erros de verdade na tela (exceção solta, console.error), sem o ruído do modo de desenvolvimento. */
export function coletarErros(page: Page): string[] {
  const erros: string[] = [];
  const ruido = /_next\/hmr|\/_next\/webpack-hmr|favicon|apple-icon|Download the React DevTools/i;
  page.on("pageerror", (e) => erros.push(`exceção: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !ruido.test(m.text() + m.location().url)) {
      // O endereço que falhou vem junto: "Failed to load resource" sozinho não diz qual.
      erros.push(`console: ${m.text()} [${m.location().url.replace(/^https?:\/\/[^/]+/, "")}]`);
    }
  });
  return erros;
}

/** Um PNG de verdade (cor lisa com uma grade clara), feito aqui mesmo: sem arquivo de teste no repositório. */
export function pngDeTeste(largura: number, altura: number): Buffer {
  const crc = (buf: Buffer) => {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(crc32(buf) >>> 0);
    return b;
  };
  const bloco = (tipo: string, dados: Buffer) => {
    const t = Buffer.from(tipo, "ascii");
    const tam = Buffer.alloc(4);
    tam.writeUInt32BE(dados.length);
    return Buffer.concat([tam, t, dados, crc(Buffer.concat([t, dados]))]);
  };
  const cab = Buffer.alloc(13);
  cab.writeUInt32BE(largura, 0);
  cab.writeUInt32BE(altura, 4);
  cab[8] = 8; // 8 bits por canal
  cab[9] = 2; // RGB
  const linhas = Buffer.alloc((largura * 3 + 1) * altura);
  for (let y = 0; y < altura; y++) {
    const base = y * (largura * 3 + 1);
    linhas[base] = 0; // sem filtro
    for (let x = 0; x < largura; x++) {
      const linhaDeGrade = x % 50 === 0 || y % 50 === 0;
      const i = base + 1 + x * 3;
      linhas[i] = linhaDeGrade ? 200 : 74;
      linhas[i + 1] = linhaDeGrade ? 190 : 67;
      linhas[i + 2] = linhaDeGrade ? 160 : 56;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", cab),
    bloco("IDAT", deflateSync(linhas)),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Escolhe uma ferramenta da barra de ícones do mapa (o nome é o do ícone: "Mover", "Névoa", "Medir",
 * "Desenhar", "Peões", "Paredes e portas", "Cena e grade") e deixa o painel dela aberto. O Mestre troca de
 * fase antes quando precisa: paredes e grade só existem em "preparar", medir só em "jogar".
 */
export async function abrirFerramenta(page: Page, ferramenta: string, fase?: "preparar" | "jogar"): Promise<void> {
  if (fase) {
    const botaoFase = page.getByRole("group", { name: "Modo" }).getByRole("button", { name: fase === "preparar" ? "Preparar" : "Jogar", exact: true });
    if ((await botaoFase.getAttribute("aria-pressed")) !== "true") await botaoFase.click();
  }
  const botao = page.getByRole("toolbar", { name: "Ferramentas do mapa" }).getByRole("button", { name: ferramenta, exact: true });
  const ativo = (await botao.getAttribute("aria-pressed")) === "true";
  if (!ativo || !(await page.locator(".palco-painel").isVisible())) await botao.click();
}

/** Fecha o painel flutuante: ele cobre um pedaço do mapa, então quem vai tocar no mapa fecha antes. */
export async function fecharPainelDoMapa(page: Page): Promise<void> {
  const fechar = page.getByRole("button", { name: "Fechar o painel" });
  if (await fechar.isVisible()) await fechar.click();
}

/** Escolhe uma opção do painel de uma ferramenta (abre o painel, toca na opção e fecha o painel, que cobre o mapa). */
export async function escolherNoPainel(page: Page, ferramenta: string, grupo: string | RegExp, nome: string, fase?: "preparar" | "jogar"): Promise<void> {
  await abrirFerramenta(page, ferramenta, fase);
  await page.getByRole("group", { name: grupo }).getByRole("button", { name: nome }).click();
  await fecharPainelDoMapa(page);
}

/** Abre o painel "A mesa" (o alvo embaixo do mapa): o que a mesa vê e pra onde olha. */
export async function abrirMesa(page: Page): Promise<void> {
  const botao = page.getByRole("button", { name: "A mesa", exact: true });
  const ativo = (await botao.getAttribute("aria-pressed")) === "true";
  if (!ativo || !(await page.locator(".palco-painel").isVisible())) await botao.click();
}

/** Abre a gaveta "Montar o combate" da aba Combate (ela abre sozinha só com a
 *  ordem vazia). Não faz nada se já estiver aberta. */
export async function abrirMontagem(page: Page): Promise<void> {
  const gaveta = page.locator("details.gavetacombate", { hasText: "Montar o combate" });
  if (!(await gaveta.evaluate((d) => (d as HTMLDetailsElement).open))) await gaveta.locator(":scope > summary").click();
}
