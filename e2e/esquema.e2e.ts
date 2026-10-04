import { expect, test } from "@playwright/test";
import type {
  Encontro,
  EntradaDiario,
  InstalacaoBastiao,
  LinhaLog,
  LinhaLogBastiao,
  ModeloNpc,
  Personagem,
} from "../src/lib/tipos";
import type { Cena, RegraNevoa } from "../src/lib/cenas";
import type { Peca } from "../src/lib/pecas";
import type { Parede } from "../src/lib/paredes";
import type { Marca } from "../src/lib/marcas";
import type { Cartao, Ligacao, NotaDoCartao } from "../src/lib/quadro";
import type { LinhaBastiao, LinhaCombate } from "../src/hooks/useSala";
import { SALA, bancoConfigurado, criarFicha, limparSala, rest } from "./apoio";

/**
 * O banco bate com os tipos do código? Antes era conferido à mão (25/09).
 *
 * Duas metades:
 * - **tipo → lista**: cada lista abaixo é um objeto com TODAS as chaves do tipo
 *   e nenhuma a mais — o `tsc` (no `npm run verificar`) não compila se alguém
 *   acrescentar um campo em `tipos.ts` e esquecer daqui, ou o contrário;
 * - **lista → banco**: este robô pede essas colunas ao banco de verdade
 *   (`select=a,b,c&limit=0`, só leitura). Coluna que o código espera e o banco
 *   não tem (migration não rodada, nome trocado) volta 400 com o nome dela.
 *
 * O caminho inverso (coluna no banco que o tipo não conhece) só dá pra ver com
 * uma linha na mão — a chave pública não lê o esquema —, então é conferido nas
 * tabelas em que a sala de teste sempre tem linha.
 */
test.skip(!bancoConfigurado, "sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY: o robô precisa do banco");

/** Todas as chaves de T, nem uma a mais nem a menos (o tsc confere). */
function colunas<T>(mapa: { [K in keyof Required<T>]: true }): string[] {
  return Object.keys(mapa);
}

const PERSONAGEM = colunas<Personagem>({
  id: true,
  room_code: true,
  slug: true,
  name: true,
  cls: true,
  ac: true,
  init_mod: true,
  speed: true,
  hp: true,
  hp_max: true,
  hp_temp: true,
  exh: true,
  dss: true,
  dsf: true,
  cond: true,
  notes: true,
  vantagens_resistencias: true,
  ficha_epiteto: true,
  ficha_secoes: true,
  atributos: true,
  proficiencias: true,
  classes: true,
  modificadores: true,
  ataque: true,
  is_npc: true,
  revealed: true,
  inspiration: true,
  concentration: true,
  concentration_on: true,
  hd_max: true,
  hd_cur: true,
  hd_die: true,
  resources: true,
  cond_prazo: true,
  pp: true,
  spell_dc: true,
  save_str: true,
  save_dex: true,
  save_con: true,
  save_int: true,
  save_wis: true,
  save_cha: true,
  items: true,
  moedas: true,
  inventario: true,
  magias: true,
  ataques: true,
  created_at: true,
  updated_at: true,
});

const COMBATE = colunas<LinhaCombate>({ room_code: true, round: true, turn: true, order_json: true, version: true, updated_at: true });
const BASTIAO = colunas<LinhaBastiao>({ room_code: true, turno: true, tesouro_po: true, defensores: true, notes: true, version: true });
// Sem tipo próprio no código (o app só lê `text`): a lista é a da migration 0001.
const NOTAS_DO_MESTRE = ["room_code", "text"];
const SALAS = ["code", "created_at"];

const TABELAS: { tabela: string; colunas: string[] }[] = [
  { tabela: "characters", colunas: PERSONAGEM },
  { tabela: "combat_state", colunas: COMBATE },
  { tabela: "dm_notes", colunas: NOTAS_DO_MESTRE },
  { tabela: "rooms", colunas: SALAS },
  {
    tabela: "npc_templates",
    colunas: colunas<ModeloNpc>({
      id: true,
      room_code: true,
      name: true,
      cls: true,
      ac: true,
      hp_max: true,
      speed: true,
      init_mod: true,
      notes: true,
      ataque: true,
      created_at: true,
    }),
  },
  { tabela: "combat_log", colunas: colunas<LinhaLog>({ id: true, room_code: true, text: true, created_at: true }) },
  { tabela: "diario", colunas: colunas<EntradaDiario>({ id: true, room_code: true, title: true, text: true, cartoes: true, created_at: true }) },
  { tabela: "bastiao", colunas: BASTIAO },
  {
    tabela: "bastiao_instalacoes",
    colunas: colunas<InstalacaoBastiao>({
      id: true,
      room_code: true,
      name: true,
      categoria: true,
      tamanho: true,
      nivel_min: true,
      ordem: true,
      contratado: true,
      ativa: true,
      ultimo_turno_executado: true,
      notes: true,
      created_at: true,
    }),
  },
  { tabela: "bastiao_log", colunas: colunas<LinhaLogBastiao>({ id: true, room_code: true, text: true, created_at: true }) },
  { tabela: "encontros", colunas: colunas<Encontro>({ id: true, room_code: true, name: true, grupos: true, created_at: true }) },
  {
    tabela: "cenas",
    colunas: colunas<Cena>({
      id: true,
      room_code: true,
      nome: true,
      imagem: true,
      largura: true,
      altura: true,
      grade_ligada: true,
      grade_px: true,
      grade_dx: true,
      grade_dy: true,
      metros: true,
      nevoa_ligada: true,
      na_mesa: true,
      camera: true,
      visao_ligada: true,
      visao_alcance: true,
      explorado: true,
      created_at: true,
    }),
  },
  {
    // O tipo da pincelada é o que a tela usa; a linha ainda leva cena, sala e hora.
    tabela: "cena_nevoa",
    colunas: [...colunas<RegraNevoa>({ id: true, seq: true, modo: true, forma: true, dados: true }), "cena_id", "room_code", "created_at"],
  },
  {
    tabela: "cena_pecas",
    colunas: colunas<Peca>({
      id: true,
      cena_id: true,
      room_code: true,
      slug: true,
      nome: true,
      x: true,
      y: true,
      tamanho: true,
      cor: true,
      oculto: true,
      aura: true,
      created_at: true,
    }),
  },
  {
    tabela: "cena_paredes",
    colunas: colunas<Parede>({ id: true, cena_id: true, room_code: true, tipo: true, x1: true, y1: true, x2: true, y2: true, aberta: true, created_at: true }),
  },
  {
    tabela: "cena_marcas",
    colunas: colunas<Marca>({ id: true, cena_id: true, room_code: true, tipo: true, cor: true, pontos: true, x: true, y: true, texto: true, visivel: true, created_at: true }),
  },
  {
    tabela: "quadro_cartoes",
    colunas: colunas<Cartao>({
      id: true,
      room_code: true,
      tipo: true,
      titulo: true,
      subtitulo: true,
      foto: true,
      texto: true,
      segredo: true,
      revelacao: true,
      dono: true,
      coluna: true,
      destaque_em: true,
      created_at: true,
    }),
  },
  { tabela: "quadro_ligacoes", colunas: colunas<Ligacao>({ id: true, room_code: true, de: true, para: true, rotulo: true, created_at: true }) },
  { tabela: "quadro_notas", colunas: colunas<NotaDoCartao>({ id: true, room_code: true, cartao_id: true, autor: true, texto: true, created_at: true }) },
  // Relato de erro dos aparelhos (lib/relatarErro.ts monta a linha à mão).
  {
    tabela: "erros",
    colunas: ["id", "created_at", "room_code", "quem", "onde", "mensagem", "detalhe", "endereco", "navegador", "versao"],
  },
];

test("toda coluna que o código espera existe no banco", async () => {
  const falhas: string[] = [];
  for (const { tabela, colunas: lista } of TABELAS) {
    const r = await rest(`${tabela}?select=${lista.join(",")}&limit=0`);
    if (!r.ok) falhas.push(`${tabela}: HTTP ${r.status} ${((await r.json()) as { message?: string }).message ?? ""}`);
  }
  expect(falhas).toEqual([]);
});

test("e o banco não tem coluna que o tipo não conhece (nas tabelas com linha da sala de teste)", async () => {
  await limparSala();
  await criarFicha("esquema-robo", "Esquema Robô");
  const conferir: [string, string, string[]][] = [
    ["characters", `room_code=eq.${SALA}`, PERSONAGEM],
    ["combat_state", `room_code=eq.${SALA}`, COMBATE],
    ["bastiao", `room_code=eq.${SALA}`, BASTIAO],
    ["dm_notes", `room_code=eq.${SALA}`, NOTAS_DO_MESTRE],
    ["rooms", `code=eq.${SALA}`, SALAS],
  ];
  const diferencas: string[] = [];
  for (const [tabela, filtro, esperadas] of conferir) {
    const r = await rest(`${tabela}?select=*&${filtro}&limit=1`);
    expect(r.ok, `${tabela}: HTTP ${r.status}`).toBe(true);
    const [linha] = (await r.json()) as Record<string, unknown>[];
    // A sala de teste é aberta pelo robô toda vez, então essas linhas existem;
    // se um dia não existirem, é aqui que avisa (não passa calado).
    expect(linha, `a sala ${SALA} não tem linha em ${tabela}`).toBeTruthy();
    const noBanco = Object.keys(linha);
    const sobrando = noBanco.filter((c) => !esperadas.includes(c));
    const faltando = esperadas.filter((c) => !noBanco.includes(c));
    if (sobrando.length) diferencas.push(`${tabela}: o banco tem e o tipo não: ${sobrando.join(", ")}`);
    if (faltando.length) diferencas.push(`${tabela}: o tipo tem e o banco não: ${faltando.join(", ")}`);
  }
  await limparSala();
  expect(diferencas).toEqual([]);
});
