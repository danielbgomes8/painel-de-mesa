/**
 * Loja — o Mestre monta (nome, itens, preço, estoque) e abre pra mesa; o jogador compra pelo celular: o dinheiro sai
 * da ficha dele, o item entra no inventário e o estoque baixa. As regras puras: ler do banco, o preço em moedas, o
 * troco e o item que vai pro inventário. A tela só chama estas funções (`LojaDaCampanha.tsx`).
 *
 * **O preço é guardado em peças de cobre** (`preco_pc`, inteiro): 1 PO = 100 PC, e não existe "meio centavo" nem erro
 * de arredondamento. Pra mostrar, vira "5 PO", "3 PP" ou "2 PO · 5 PP". Só o Mestre mexe na loja; loja fechada é
 * invisível pra mesa (esconde NA TELA, como o resto: o banco é aberto, ver README "Segurança").
 */
import type { ItemInventario, MoedaId, Moedas } from "./tipos";
import { moedasVazias } from "./inventario";

export type Loja = {
  id: string;
  room_code: string;
  nome: string;
  /** Falso = só o Mestre vê. */
  aberta: boolean;
  created_at: string;
};

export type ItemDaLoja = {
  id: string;
  loja_id: string;
  room_code: string;
  nome: string;
  descricao: string;
  /** Preço de UMA unidade, em peças de cobre. */
  preco_pc: number;
  /** Quantas há; null = sempre tem (não acaba). */
  estoque: number | null;
  peso: number;
  magico: boolean;
  raridade: string;
  created_at: string;
};

export type NovoItemDaLoja = Pick<ItemDaLoja, "nome" | "preco_pc"> & Partial<Pick<ItemDaLoja, "descricao" | "estoque" | "peso" | "magico" | "raridade">>;

export const LOJAS_MAXIMAS = 10;
export const ITENS_MAXIMOS_POR_LOJA = 60;
export const NOME_DA_LOJA_MAXIMO = 60;
export const NOME_DO_ITEM_MAXIMO = 80;
export const DESCRICAO_MAXIMA = 300;
export const PRECO_MAXIMO_PC = 1_000_000_000;
export const ESTOQUE_MAXIMO = 100_000;
export const QTD_MAXIMA_POR_COMPRA = 999;

/** Quanto vale cada moeda, em peças de cobre. */
export const VALOR_EM_PC: Record<MoedaId, number> = { pc: 1, pp: 10, pe: 50, po: 100, pl: 1000 };
/** As moedas que a loja dá de troco, da maior pra menor (electro e platina não são troco). */
const MOEDAS_DE_TROCO: MoedaId[] = ["po", "pp", "pc"];
const SIGLAS: Record<MoedaId, string> = { pc: "PC", pp: "PP", pe: "PE", po: "PO", pl: "PL" };

function cortar(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function numero(v: unknown): number | null {
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function normalizarLoja(linha: unknown): Loja | null {
  if (!linha || typeof linha !== "object") return null;
  const o = linha as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id) return null;
  return {
    id: o.id,
    room_code: typeof o.room_code === "string" ? o.room_code : "",
    nome: cortar(o.nome, NOME_DA_LOJA_MAXIMO),
    aberta: o.aberta === true,
    created_at: typeof o.created_at === "string" ? o.created_at : "",
  };
}

export function normalizarItemDaLoja(linha: unknown): ItemDaLoja | null {
  if (!linha || typeof linha !== "object") return null;
  const o = linha as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id || typeof o.loja_id !== "string") return null;
  const preco = numero(o.preco_pc);
  const estoque = o.estoque === null || o.estoque === undefined ? null : numero(o.estoque);
  const peso = numero(o.peso);
  return {
    id: o.id,
    loja_id: o.loja_id,
    room_code: typeof o.room_code === "string" ? o.room_code : "",
    nome: cortar(o.nome, NOME_DO_ITEM_MAXIMO),
    descricao: cortar(o.descricao, DESCRICAO_MAXIMA),
    preco_pc: preco === null ? 0 : Math.max(0, Math.min(PRECO_MAXIMO_PC, Math.round(preco))),
    estoque: estoque === null ? null : Math.max(0, Math.min(ESTOQUE_MAXIMO, Math.round(estoque))),
    peso: peso === null ? 0 : Math.max(0, Math.min(100_000, Math.round(peso * 100) / 100)),
    magico: o.magico === true,
    raridade: cortar(o.raridade, 20),
    created_at: typeof o.created_at === "string" ? o.created_at : "",
  };
}

/** O que a mesa enxerga: só as lojas abertas (e os itens delas); o Mestre, tudo. */
export function lojasVisiveis(lojas: readonly Loja[], mestre: boolean): Loja[] {
  return (mestre ? [...lojas] : lojas.filter((l) => l.aberta)).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function itensDaLoja(itens: readonly ItemDaLoja[], lojaId: string): ItemDaLoja[] {
  return itens.filter((i) => i.loja_id === lojaId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Nome pra mostrar: vazio vira "Loja". */
export function nomeDaLoja(l: Pick<Loja, "nome">): string {
  return l.nome.trim() || "Loja";
}

// ── Preço e troco ──────────────────────────────────────────────────────────

/** Valor de todas as moedas, em peças de cobre. */
export function totalEmPc(m: Moedas): number {
  return (Object.keys(VALOR_EM_PC) as MoedaId[]).reduce((acc, id) => acc + m[id] * VALOR_EM_PC[id], 0);
}

/** Preço escrito como o Mestre digita ("5" + "po") → peças de cobre; null se não vale (negativo, torto ou grande demais). */
export function precoEmPc(valor: string | number, moeda: MoedaId): number | null {
  const n = numero(valor);
  if (n === null || n < 0) return null;
  const pc = Math.round(n * VALOR_EM_PC[moeda]);
  return pc <= PRECO_MAXIMO_PC ? pc : null;
}

/** A moeda em que um preço fica redondo, pra tela de edição: ouro se dá, senão prata, senão cobre. */
export function moedaDoPreco(pc: number): "po" | "pp" | "pc" {
  if (pc % VALOR_EM_PC.po === 0) return "po";
  return pc % VALOR_EM_PC.pp === 0 ? "pp" : "pc";
}

/** "5 PO", "3 PP", "2 PO · 5 PP", "grátis". Mostra ouro, prata e cobre: 10 PL aparece como "100 PO", que é como a mesa conta. */
export function textoDoPreco(pc: number): string {
  if (pc <= 0) return "grátis";
  const partes: string[] = [];
  let resta = Math.round(pc);
  for (const id of ["po", "pp", "pc"] as MoedaId[]) {
    const n = Math.floor(resta / VALOR_EM_PC[id]);
    if (n > 0) partes.push(`${n} ${SIGLAS[id]}`);
    resta -= n * VALOR_EM_PC[id];
  }
  return partes.join(" · ");
}

/**
 * Tira `custoPc` das moedas e devolve o que sobra, com troco; null se o dinheiro não chega. Gasta primeiro as moedas
 * pequenas (cobre, prata, electro, ouro, platina) pra não quebrar moeda grande sem necessidade; quando falta, quebra a
 * menor moeda que cobre o resto e devolve o troco em ouro, prata e cobre.
 */
export function pagar(moedas: Moedas, custoPc: number): Moedas | null {
  if (custoPc < 0 || !Number.isFinite(custoPc)) return null;
  if (totalEmPc(moedas) < custoPc) return null;
  const ordem: MoedaId[] = ["pc", "pp", "pe", "po", "pl"];
  const sobra: Moedas = { ...moedasVazias(), ...moedas };
  let resta = Math.round(custoPc);
  for (const id of ordem) {
    const usa = Math.min(sobra[id], Math.floor(resta / VALOR_EM_PC[id]));
    sobra[id] -= usa;
    resta -= usa * VALOR_EM_PC[id];
  }
  if (resta > 0) {
    const quebrar = ordem.find((id) => sobra[id] > 0 && VALOR_EM_PC[id] >= resta);
    if (!quebrar) return null; // não acontece (o total chegava), mas nunca devolve conta errada
    sobra[quebrar] -= 1;
    let troco = VALOR_EM_PC[quebrar] - resta;
    for (const id of MOEDAS_DE_TROCO) {
      const n = Math.floor(troco / VALOR_EM_PC[id]);
      sobra[id] += n;
      troco -= n * VALOR_EM_PC[id];
    }
  }
  return sobra;
}

/** O item que entra no inventário de quem comprou `qtd` unidades. */
export function itemComprado(item: ItemDaLoja, qtd: number): ItemInventario {
  return { nome: item.nome, qtd, peso: item.peso, descricao: item.descricao, magico: item.magico, raridade: item.raridade, equipado: false, sintonia: 0 };
}

/** Por que não dá pra comprar `qtd` agora, ou null se dá. */
export function motivoDeNaoComprar(item: ItemDaLoja, qtd: number, moedas: Moedas): string | null {
  if (!Number.isInteger(qtd) || qtd < 1) return "Escolha quantos quer.";
  if (qtd > QTD_MAXIMA_POR_COMPRA) return `No máximo ${QTD_MAXIMA_POR_COMPRA} de uma vez.`;
  if (item.estoque !== null && item.estoque < qtd) return item.estoque === 0 ? "Esgotado." : `Só restam ${item.estoque}.`;
  const custo = item.preco_pc * qtd;
  if (pagar(moedas, custo) === null) return `Faltam ${textoDoPreco(custo - totalEmPc(moedas))}.`;
  return null;
}

/** Linha do log: "🛒 Ana comprou 2× Poção de cura por 100 PO (Loja da esquina)". */
export function linhaDeCompra(quem: string, item: Pick<ItemDaLoja, "nome" | "preco_pc">, qtd: number, loja: Pick<Loja, "nome">): string {
  const total = item.preco_pc * qtd;
  return `🛒 ${quem} comprou ${qtd > 1 ? `${qtd}× ` : ""}${item.nome} por ${textoDoPreco(total)} (${nomeDaLoja(loja)})`;
}
