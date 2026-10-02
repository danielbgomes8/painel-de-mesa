/**
 * Inventário, moedas e baú do grupo — as regras puras: somar peso, contar
 * sintonia, empilhar item repetido, dividir moedas. A tela só chama estas
 * funções (ver `InventarioPersonagem.tsx` e `BauDoGrupo.tsx`).
 *
 * Tudo que vem do banco passa por `normalizar*`: a coluna é JSON livre e a
 * linha pode ser de antes da migration 0026 (aí o campo nem existe).
 */
import type { ItemInventario, MoedaId, Moedas, Sintonia } from "./tipos";

export const MOEDAS: { id: MoedaId; sigla: string; nome: string; emPo: number }[] = [
  { id: "pc", sigla: "PC", nome: "cobre", emPo: 0.01 },
  { id: "pp", sigla: "PP", nome: "prata", emPo: 0.1 },
  { id: "pe", sigla: "PE", nome: "electro", emPo: 0.5 },
  { id: "po", sigla: "PO", nome: "ouro", emPo: 1 },
  { id: "pl", sigla: "PL", nome: "platina", emPo: 10 },
];

/** Itens mágicos em que o personagem pode estar sintonizado ao mesmo tempo. */
export const LIMITE_SINTONIA = 3;
/** Capacidade de carga: Força × 15 libras no livro; 7,5 kg por ponto na
 *  tradução brasileira, que é a medida que o resto do app usa (metros, kg). */
export const KG_POR_FORCA = 7.5;
/** O livro conta 50 moedas por libra: ~0,01 kg cada. */
export const KG_POR_MOEDA = 0.01;

export const QTD_MAXIMA = 1_000_000;
const PESO_MAXIMO = 100_000;

export function moedasVazias(): Moedas {
  return { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 };
}

function inteiro(v: unknown, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

function decimal(v: unknown, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.round(n * 100) / 100));
}

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Moedas vindas do banco (ou de um backup antigo) → sempre as cinco, inteiras e não negativas. */
export function normalizarMoedas(v: unknown): Moedas {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const m = moedasVazias();
  for (const { id } of MOEDAS) m[id] = inteiro(o[id], QTD_MAXIMA);
  return m;
}

export function normalizarItem(v: unknown): ItemInventario {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const magico = o.magico === true;
  const sintonia: Sintonia = magico && (o.sintonia === 1 || o.sintonia === 2) ? o.sintonia : 0;
  return {
    nome: texto(o.nome, 80),
    qtd: inteiro(o.qtd, QTD_MAXIMA),
    peso: decimal(o.peso, PESO_MAXIMO),
    descricao: texto(o.descricao, 500),
    magico,
    raridade: texto(o.raridade, 20),
    equipado: o.equipado === true,
    sintonia,
  };
}

export function normalizarInventario(v: unknown): ItemInventario[] {
  return Array.isArray(v) ? v.map(normalizarItem) : [];
}

export function itemNovo(nome: string): ItemInventario {
  return { nome, qtd: 1, peso: 0, descricao: "", magico: false, raridade: "", equipado: false, sintonia: 0 };
}

export function somarMoedas(a: Moedas, b: Moedas): Moedas {
  const r = moedasVazias();
  for (const { id } of MOEDAS) r[id] = Math.min(QTD_MAXIMA, a[id] + b[id]);
  return r;
}

/** Tira `custo` de `moedas`, sem trocar tipo: devolve null se faltar de qualquer uma. */
export function tirarMoedas(moedas: Moedas, custo: Moedas): Moedas | null {
  const r = moedasVazias();
  for (const { id } of MOEDAS) {
    if (custo[id] > moedas[id]) return null;
    r[id] = moedas[id] - custo[id];
  }
  return r;
}

export function temMoeda(m: Moedas): boolean {
  return MOEDAS.some(({ id }) => m[id] > 0);
}

/** Valor de tudo em peças de ouro (pode ter centavos de PO). */
export function valorEmPo(m: Moedas): number {
  const total = MOEDAS.reduce((acc, { id, emPo }) => acc + m[id] * emPo, 0);
  return Math.round(total * 100) / 100;
}

/** "12 PO · 5 PP" — só as moedas que existem; "—" quando não há nenhuma. */
export function textoMoedas(m: Moedas): string {
  const partes = MOEDAS.filter(({ id }) => m[id] > 0)
    .reverse()
    .map(({ id, sigla }) => `${m[id]} ${sigla}`);
  return partes.length > 0 ? partes.join(" · ") : "—";
}

export function pesoDoItem(i: ItemInventario): number {
  return Math.round(i.qtd * i.peso * 100) / 100;
}

export function pesoDasMoedas(m: Moedas): number {
  const total = MOEDAS.reduce((acc, { id }) => acc + m[id], 0);
  return Math.round(total * KG_POR_MOEDA * 100) / 100;
}

/** Tudo o que o personagem carrega: itens e moedas. */
export function pesoCarregado(inventario: ItemInventario[], moedas: Moedas): number {
  const itens = inventario.reduce((acc, i) => acc + pesoDoItem(i), 0);
  return Math.round((itens + pesoDasMoedas(moedas)) * 100) / 100;
}

export function capacidadeDeCarga(forca: number): number {
  return Math.max(0, Math.round(forca * KG_POR_FORCA * 100) / 100);
}

export function sintonizados(inventario: ItemInventario[]): number {
  return inventario.filter((i) => i.sintonia === 2).length;
}

/** "3,5 kg" — vírgula decimal, sem zero sobrando. */
export function formatarKg(kg: number): string {
  return `${String(Math.round(kg * 100) / 100).replace(".", ",")} kg`;
}

function chave(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Põe um item no inventário. Item comum (não mágico, sem sintonia) com o
 *  mesmo nome de um que já existe empilha — "Flecha" ×20 e "flecha" ×10 viram
 *  ×30 —; o resto entra como linha nova. */
export function juntarItem(inventario: ItemInventario[], novo: ItemInventario): ItemInventario[] {
  if (!novo.magico && novo.sintonia === 0) {
    const i = inventario.findIndex(
      (x) => !x.magico && x.sintonia === 0 && chave(x.nome) === chave(novo.nome),
    );
    if (i !== -1) {
      return inventario.map((x, idx) =>
        idx === i
          ? { ...x, qtd: Math.min(QTD_MAXIMA, x.qtd + novo.qtd), peso: x.peso || novo.peso }
          : x,
      );
    }
  }
  return [...inventario, novo];
}

/** Tira `qtd` unidades da linha `indice`; some a linha quando acaba. */
export function tirarQuantidade(inventario: ItemInventario[], indice: number, qtd: number): ItemInventario[] {
  return inventario.flatMap((x, idx) => {
    if (idx !== indice) return [x];
    const resta = x.qtd - qtd;
    return resta > 0 ? [{ ...x, qtd: resta }] : [];
  });
}

/** Divide as moedas igualmente entre `pessoas`. O que não divide certo (3 PO
 *  entre 2) fica em `resto`, no baú — ninguém leva troco que não existe. */
export function dividirMoedas(moedas: Moedas, pessoas: number): { cada: Moedas; resto: Moedas } {
  const n = Math.max(1, Math.floor(pessoas));
  const cada = moedasVazias();
  const resto = moedasVazias();
  for (const { id } of MOEDAS) {
    cada[id] = Math.floor(moedas[id] / n);
    resto[id] = moedas[id] - cada[id] * n;
  }
  return { cada, resto };
}

/** Um item do baú do grupo (ver migration 0026). `moeda` preenchida = a linha
 *  guarda dinheiro daquele tipo (a quantidade está em `qtd`). */
export type ItemBau = {
  id: string;
  room_code: string;
  nome: string;
  qtd: number;
  peso: number;
  descricao: string;
  magico: boolean;
  raridade: string;
  moeda: MoedaId | null;
  created_at: string;
};

export type NovoItemBau = Pick<ItemBau, "nome"> & Partial<Pick<ItemBau, "qtd" | "peso" | "descricao" | "magico" | "raridade">>;

const IDS_DE_MOEDA = new Set<string>(MOEDAS.map((m) => m.id));

export function normalizarItemBau(v: unknown): ItemBau {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    id: texto(o.id, 80),
    room_code: texto(o.room_code, 80),
    nome: texto(o.nome, 80),
    qtd: inteiro(o.qtd, QTD_MAXIMA),
    peso: decimal(o.peso, PESO_MAXIMO),
    descricao: texto(o.descricao, 500),
    magico: o.magico === true,
    raridade: texto(o.raridade, 20),
    moeda: typeof o.moeda === "string" && IDS_DE_MOEDA.has(o.moeda) ? (o.moeda as MoedaId) : null,
    created_at: texto(o.created_at, 40),
  };
}

/** O dinheiro do baú, somando as linhas de moeda. */
export function moedasDoBau(itens: ItemBau[]): Moedas {
  const m = moedasVazias();
  for (const i of itens) if (i.moeda) m[i.moeda] = Math.min(QTD_MAXIMA, m[i.moeda] + i.qtd);
  return m;
}

/** Os objetos do baú (sem as linhas de moeda), na ordem em que foram guardados. */
export function objetosDoBau(itens: ItemBau[]): ItemBau[] {
  return itens.filter((i) => i.moeda === null && i.qtd > 0);
}

export function itemDoBauParaInventario(i: ItemBau, qtd: number): ItemInventario {
  return {
    nome: i.nome,
    qtd,
    peso: i.peso,
    descricao: i.descricao,
    magico: i.magico,
    raridade: i.raridade,
    equipado: false,
    sintonia: 0,
  };
}
