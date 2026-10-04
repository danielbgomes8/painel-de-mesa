/**
 * Ataques calculados da ficha do jogador — as regras puras. Cada ataque guarda COMO se
 * calcula (atributo, proficiência, bônus extra, dado), não o resultado: o acerto e o dano
 * saem dos atributos e do nível da ficha na hora, então subir de nível ou de Força atualiza
 * tudo sozinho. A tela só chama estas funções (`AtaquesPersonagem.tsx`).
 *
 * O resultado também vira texto no mesmo formato do campo livre `ataque` ("Espada: +7,
 * 1d8+4 cortante"), e é esse texto que o painel de rolagem da iniciativa lê — por isso o
 * `RolarAtaques` e o `lerAtaquesRolaveis` não mudaram.
 */
import { bonusProficiencia, modificador } from "./regras";
import type { AtaqueFicha, Atributo, Atributos } from "./tipos";

export const MAX_ATAQUES = 30;
const LIMITE_BONUS = 30;

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function inteiro(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.max(-LIMITE_BONUS, Math.min(LIMITE_BONUS, n));
}

const ATRIBUTOS_VALIDOS: Atributo[] = ["for", "des", "con", "int", "sab", "car"];

/** "1d8", "2d6": quantidade e faces. Qualquer outra coisa não gera dano calculado. */
export function dadoValido(dado: string): boolean {
  return /^[1-9]\d?d[1-9]\d{0,2}$/.test(dado.trim().toLowerCase());
}

export function normalizarAtaque(v: unknown): AtaqueFicha {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const dado = texto(o.dado, 8).trim().toLowerCase();
  return {
    nome: texto(o.nome, 60),
    atributo: ATRIBUTOS_VALIDOS.includes(o.atributo as Atributo) ? (o.atributo as Atributo) : null,
    proficiente: o.proficiente === true,
    bonusAcerto: inteiro(o.bonusAcerto),
    dado: dadoValido(dado) ? dado : "",
    bonusDano: inteiro(o.bonusDano),
    tipo: texto(o.tipo, 30),
  };
}

export function normalizarAtaques(v: unknown): AtaqueFicha[] {
  return Array.isArray(v) ? v.slice(0, MAX_ATAQUES).map(normalizarAtaque) : [];
}

export function ataqueNovo(): AtaqueFicha {
  return { nome: "", atributo: "for", proficiente: true, bonusAcerto: 0, dado: "1d8", bonusDano: 0, tipo: "" };
}

function comSinal(n: number): string {
  return n >= 0 ? `+${n}` : `-${Math.abs(n)}`;
}

export type AtaqueCalculado = {
  /** Bônus de acerto: atributo + proficiência (se for) + extra. */
  acerto: number;
  /** Dano pronto pra ler ("1d8+4 cortante"); vazio se o ataque não tem dado. */
  dano: string;
};

/** O acerto e o dano de um ataque, pelos atributos e pelo nível total. O modificador do
 *  atributo entra no acerto e no dano; a proficiência só no acerto. */
export function calcularAtaque(a: AtaqueFicha, atributos: Atributos, nivel: number): AtaqueCalculado {
  const mod = a.atributo ? modificador(atributos[a.atributo]) : 0;
  const acerto = mod + (a.proficiente ? bonusProficiencia(nivel) : 0) + a.bonusAcerto;
  if (!a.dado) return { acerto, dano: "" };
  const somaDano = mod + a.bonusDano;
  const tipo = a.tipo.trim();
  const dano = `${a.dado}${somaDano === 0 ? "" : comSinal(somaDano)}${tipo ? ` ${tipo}` : ""}`;
  return { acerto, dano };
}

/** Uma linha por ataque, no formato do campo livre: "Espada longa: +7, 1d8+4 cortante". */
export function textoDosAtaques(ataques: AtaqueFicha[], atributos: Atributos, nivel: number): string {
  return ataques
    .map((a) => {
      const { acerto, dano } = calcularAtaque(a, atributos, nivel);
      const nome = a.nome.trim() || "Ataque";
      return `${nome}: ${comSinal(acerto)}${dano ? `, ${dano}` : ""}`;
    })
    .join("\n");
}

/** Tudo que a ficha tem de ataque, em texto: os calculados primeiro e, depois, o que já
 *  estava no campo livre (ficha antiga continua mostrando e rolando o que tinha). */
export function textoEfetivoDeAtaques(p: {
  ataques?: AtaqueFicha[];
  ataque?: string;
  atributos: Atributos;
  classes: { nivel: number }[];
  is_npc: boolean;
}): string {
  const livre = p.ataque ?? "";
  if (p.is_npc) return livre;
  const classes = Array.isArray(p.classes) ? p.classes : [];
  const nivel = classes.reduce((s, c) => s + (Number.isFinite(c.nivel) ? c.nivel : 0), 0);
  const calculados = textoDosAtaques(normalizarAtaques(p.ataques), p.atributos, nivel);
  return [calculados, livre.trim()].filter(Boolean).join("\n");
}
