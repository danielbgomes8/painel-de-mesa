/**
 * Sem internet no meio da luta — as regras, puras (ver offline.test.ts). Quem
 * guarda a fila e a foto da sala e manda tudo pro banco é o useSala.
 *
 * Quando a conexão cai, o combate não para: dano, cura, condição, turno e log
 * continuam na tela e vão pra uma FILA neste aparelho. Quando a conexão volta,
 * a fila vai pro banco na ordem — mas cada mudança só é gravada se o que ela
 * encontrou antes ("antes") ainda for o que está no banco. Se outro celular
 * mexeu na mesma ficha ou na ordem enquanto isto estava sem internet, a
 * mudança daqui é deixada de fora e a tela avisa: atropelar a jogada de outro
 * seria pior que refazer a nossa.
 */

import { mesmoCombate, mesmoValor, type MudancaPersonagem } from "./desfazer";
import type { EstadoCombate, Personagem } from "./tipos";

/** `seq` é a ordem em que a pessoa FEZ a mudança (não a ordem em que a
 *  escrita falhou): com wi-fi "conectado" mas sem internet, as escritas
 *  ficam penduradas e podem falhar fora de ordem. */
export type OpOffline =
  | { id: string; seq: number; tipo: "personagens"; mudancas: MudancaPersonagem[] }
  | { id: string; seq: number; tipo: "combate"; antes: EstadoCombate; depois: EstadoCombate }
  | {
      id: string;
      seq: number;
      tipo: "log";
      textos: string[];
      /** A escrita que esta linha conta (ver `enfileirar`). Se ela não entrar
       *  no banco, a linha também não entra — senão o log jura um dano que
       *  não aconteceu. */
      dependeDe: string | null;
      /** Hora em que aconteceu, pra linha provisória na tela. */
      quando: string;
    };

type NovaOp =
  | Omit<Extract<OpOffline, { tipo: "personagens" }>, "id" | "seq">
  | Omit<Extract<OpOffline, { tipo: "combate" }>, "id" | "seq">
  | Omit<Extract<OpOffline, { tipo: "log" }>, "id" | "seq" | "dependeDe">;

/**
 * A escrita falhou por falta de conexão (e não porque o banco recusou)? O
 * cliente do Supabase devolve a queda de rede como erro sem `code` (e
 * status 0); recusa do banco sempre vem com código (PGRST…, 23505…).
 */
export function ehFalhaDeRede(erro: { code?: string | null; message?: string } | null | undefined): boolean {
  if (!erro) return false;
  return !erro.code || /^(TypeError|FetchError|AbortError)\b/.test(erro.message ?? "");
}

/**
 * Põe uma operação na fila, na posição da ordem em que foi feita (`seq`).
 * Linha de log fica amarrada à escrita que veio logo antes dela (é sempre
 * assim no app: grava a ficha ou a ordem, e só então loga) — ou à mesma
 * escrita da linha anterior, quando uma ação grava o log em duas vezes.
 */
export function enfileirar(fila: OpOffline[], op: NovaOp, id: string, seq: number): OpOffline[] {
  const pos = fila.findIndex((o) => o.seq > seq);
  const onde = pos < 0 ? fila.length : pos;
  const anterior = fila[onde - 1];
  const nova: OpOffline =
    op.tipo === "log"
      ? { ...op, id, seq, dependeDe: !anterior ? null : anterior.tipo === "log" ? anterior.dependeDe : anterior.id }
      : ({ ...op, id, seq } as OpOffline);
  return [...fila.slice(0, onde), nova, ...fila.slice(onde)];
}

/** Nomes de quem mudou no banco desde que a mudança offline foi feita (ou
 *  sumiu da sala). Lista vazia = pode gravar. */
export function conflitosDePersonagens(mudancas: MudancaPersonagem[], noBanco: Partial<Personagem>[]): string[] {
  const nomes: string[] = [];
  for (const m of mudancas) {
    const linha = noBanco.find((p) => p.id === m.id);
    const igual =
      linha !== undefined &&
      Object.keys(m.antes).every((chave) =>
        mesmoValor(linha[chave as keyof Personagem], m.antes[chave as keyof Personagem]),
      );
    if (!igual) nomes.push(m.nome);
  }
  return nomes;
}

/** A ordem de iniciativa no banco ainda é a que a mudança offline encontrou? */
export function combateSemConflito(op: { antes: EstadoCombate }, noBanco: EstadoCombate): boolean {
  return mesmoCombate(noBanco, op.antes);
}

/** Quantas mudanças esperam conexão — o número que aparece no topo. Linha de
 *  log não conta: vai junto com a mudança que ela descreve. */
export function mudancasEsperando(fila: OpOffline[]): number {
  return fila.filter((op) => op.tipo !== "log").length;
}

/** Linhas de log ainda na fila, pra aparecerem na tela como provisórias
 *  (a mais nova primeiro, como o log). */
export function linhasProvisorias(fila: OpOffline[]): { id: string; text: string; created_at: string }[] {
  const linhas: { id: string; text: string; created_at: string }[] = [];
  for (const op of fila) {
    if (op.tipo !== "log") continue;
    op.textos.forEach((text, i) => linhas.push({ id: `fila-${op.id}-${i}`, text, created_at: op.quando }));
  }
  return linhas.reverse();
}

export function ehLinhaProvisoria(id: string): boolean {
  return id.startsWith("fila-");
}

/** Fila guardada no navegador: formato estranho vira fila vazia. */
export function lerFilaGuardada(cru: string | null): OpOffline[] {
  if (!cru) return [];
  try {
    const valor: unknown = JSON.parse(cru);
    if (!Array.isArray(valor)) return [];
    return valor.filter(
      (op): op is OpOffline =>
        op !== null &&
        typeof op === "object" &&
        typeof op.id === "string" &&
        typeof op.seq === "number" &&
        ((op.tipo === "personagens" && Array.isArray(op.mudancas)) ||
          (op.tipo === "combate" && typeof op.antes === "object" && typeof op.depois === "object") ||
          (op.tipo === "log" && Array.isArray(op.textos))),
    );
  } catch {
    return [];
  }
}

/** Foto da sala guardada no aparelho — o que a tela mostra se o app abrir
 *  sem internet. Só confere o básico; campo que faltar vira vazio. */
export type FotoSala = {
  quando: string;
  personagens: Personagem[];
  combate: EstadoCombate;
  combateVersao: number;
  [outros: string]: unknown;
};

export function lerFotoGuardada(cru: string | null): FotoSala | null {
  if (!cru) return null;
  try {
    const valor = JSON.parse(cru) as Partial<FotoSala> | null;
    if (!valor || typeof valor !== "object") return null;
    if (typeof valor.quando !== "string" || !Array.isArray(valor.personagens)) return null;
    const c = valor.combate;
    if (!c || typeof c !== "object" || !Array.isArray(c.order)) return null;
    return { ...valor, combateVersao: Number(valor.combateVersao) || 0 } as FotoSala;
  } catch {
    return null;
  }
}

/** "14:32" — hora da foto, pro aviso "mostrando o que este aparelho tinha às…". */
export function horaCurta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
