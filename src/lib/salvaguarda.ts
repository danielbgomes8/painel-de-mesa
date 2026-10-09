import { lerAtaquesRolaveis, metadeDoDano, type ParteDano } from "./regras";
import type { Atributo, Personagem } from "./tipos";

/**
 * Salvaguarda em massa: o Mestre diz "Destreza, CD 15, 8d6 de fogo, metade se
 * passar" e o app rola o d20 de cada alvo, mostra quem passou e calcula o dano
 * de cada um. As contas ficam aqui (puras, com o dado injetado); a tela é
 * `SalvaguardaEmMassa.tsx`.
 *
 * Regras 2024 que valem aqui: o dano do efeito é rolado UMA vez e todos levam o
 * mesmo número; passa quem tira CD ou mais; em teste de resistência o 20 e o 1
 * naturais NÃO passam nem falham sozinhos (isso é só do teste de morte); "metade
 * se passar" arredonda pra baixo (`metadeDoDano`).
 */

type CampoSave = "save_str" | "save_dex" | "save_con" | "save_int" | "save_wis" | "save_cha";

export const ATRIBUTOS_DA_SALVAGUARDA: { id: Atributo; sigla: string; nome: string; campo: CampoSave }[] = [
  { id: "for", sigla: "FOR", nome: "Força", campo: "save_str" },
  { id: "des", sigla: "DES", nome: "Destreza", campo: "save_dex" },
  { id: "con", sigla: "CON", nome: "Constituição", campo: "save_con" },
  { id: "int", sigla: "INT", nome: "Inteligência", campo: "save_int" },
  { id: "sab", sigla: "SAB", nome: "Sabedoria", campo: "save_wis" },
  { id: "car", sigla: "CAR", nome: "Carisma", campo: "save_cha" },
];

export type AoPassar = "metade" | "nada" | "tudo";

export const CD_MINIMA = 1;
export const CD_MAXIMA = 40;
const DADOS_MAXIMOS = 60;
const FACES_MAXIMAS = 100;

/** Bônus de resistência que o cartão do personagem mostra (o cartão manda: item mágico soma por cima da fórmula). */
export function bonusDaSalvaguarda(p: Pick<Personagem, CampoSave>, atributo: Atributo): number {
  const info = ATRIBUTOS_DA_SALVAGUARDA.find((a) => a.id === atributo);
  const valor = info ? p[info.campo] : 0;
  return Number.isFinite(valor) ? valor : 0;
}

export type LeituraDoDano = { ok: true; partes: ParteDano[] } | { ok: false; motivo: string };

/**
 * "8d6 fogo", "2d8+4", "3d6 gélido + 1d6 trovão" ou só "12". Vazio = efeito sem
 * dano (só a salvaguarda, pra condição). Usa o mesmo leitor do campo de ataque,
 * então o tipo de dano só vale se for um dos conhecidos.
 */
export function lerDanoDaSalvaguarda(texto: string): LeituraDoDano {
  const t = (texto ?? "").trim();
  if (t === "") return { ok: true, partes: [] };
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    return n > 0 ? { ok: true, partes: [{ qtd: 0, faces: 0, mod: n, tipo: "" }] } : { ok: false, motivo: "O dano fixo precisa ser maior que zero." };
  }
  const partes = lerAtaquesRolaveis(`Efeito +0, ${t}`).ataques[0]?.partes ?? [];
  if (partes.length === 0) return { ok: false, motivo: "Não entendi o dano. Escreva como 8d6 fogo, 2d8+4 ou só um número." };
  if (partes.some((p) => p.qtd > DADOS_MAXIMOS || p.faces > FACES_MAXIMAS || p.faces < 2)) {
    return { ok: false, motivo: `Dado grande demais (até ${DADOS_MAXIMOS}d${FACES_MAXIMAS}).` };
  }
  return { ok: true, partes };
}

/** "fogo", "fogo e trovão" ou "" — pra frase da tela. */
export function rotuloDoDano(partes: ParteDano[]): string {
  const tipos = [...new Set(partes.map((p) => p.tipo).filter(Boolean))];
  return tipos.join(" e ");
}

/** Rola o dano do efeito uma vez só. Nunca negativo. */
export function rolarDanoDoEfeito(partes: ParteDano[], rolar: (faces: number) => number): { dados: number[]; total: number } {
  const dados: number[] = [];
  let total = 0;
  for (const p of partes) {
    for (let i = 0; i < p.qtd; i++) {
      const v = rolar(p.faces);
      dados.push(v);
      total += v;
    }
    total += p.mod;
  }
  return { dados, total: Math.max(0, total) };
}

export type RolagemDoAlvo = { id: string; d20: number; bonus: number; total: number; passou: boolean };

/** Um d20 por alvo, mais o bônus de cada um; passa quem chega na CD. */
export function rolarSalvaguardas(
  alvos: { id: string; bonus: number }[],
  cd: number,
  rolar: (faces: number) => number,
): RolagemDoAlvo[] {
  return alvos.map((a) => {
    const d20 = rolar(20);
    const total = d20 + a.bonus;
    return { id: a.id, d20, bonus: a.bonus, total, passou: total >= cd };
  });
}

/** O dano que este alvo leva: quem falha leva tudo; quem passa leva metade, nada ou tudo, conforme o efeito. */
export function danoNoAlvo(danoRolado: number, passou: boolean, aoPassar: AoPassar): number {
  if (!passou || aoPassar === "tudo") return Math.max(0, danoRolado);
  return aoPassar === "metade" ? metadeDoDano(danoRolado) : 0;
}

/** A linha pública do log: só a contagem, sem nome — o log é lido por todos e NPC oculto continua oculto. */
export function linhaDaSalvaguarda(atributo: Atributo, cd: number, passaram: number, falharam: number): string {
  const nome = ATRIBUTOS_DA_SALVAGUARDA.find((a) => a.id === atributo)?.nome ?? "";
  const fmt = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  return `🎲 Salvaguarda de ${nome} (CD ${cd}): ${fmt(passaram, "passou", "passaram")}, ${fmt(falharam, "falhou", "falharam")}`;
}
