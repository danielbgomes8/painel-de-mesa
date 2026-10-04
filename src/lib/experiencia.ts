/**
 * Pontos de experiência (XP) dos personagens — as regras puras: a tabela de XP por nível, quanto falta
 * pro próximo, dividir um prêmio entre o grupo e as linhas do log. A tela só chama estas funções (ver
 * `XpDoPersonagem.tsx` e as Ações em massa).
 *
 * O XP é um número por personagem (`xp`, migration 0030) que só o Mestre mexe. Ele NÃO sobe o nível
 * sozinho nem trava nada: campanha por marco simplesmente não usa o XP, e o "Subir de nível" da ficha
 * continua valendo pros dois jeitos de jogar. O XP só mostra quanto falta.
 */

export const XP_MAXIMO = 10_000_000;

/** XP mínimo pra estar em cada nível (índice 0 = nível 1). Tabela "Character Advancement" do livro, a
 *  mesma de 2014 e 2024; o SRD 5.2 (open5e) confirma dois pontos dela: 64.000 XP no nível 10 e 355.000
 *  no 20. */
export const XP_MINIMO_DO_NIVEL: readonly number[] = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

export function normalizarXp(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.max(0, Math.min(XP_MAXIMO, n));
}

/** Milhar com ponto, como se escreve no Brasil ("1.250"). Feito à mão pra não depender do ICU. */
export function formatarXp(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** O nível que esse tanto de XP dá (1 a 20). */
export function nivelPorXp(xp: number): number {
  let nivel = 1;
  for (let i = 0; i < XP_MINIMO_DO_NIVEL.length; i++) if (xp >= XP_MINIMO_DO_NIVEL[i]) nivel = i + 1;
  return nivel;
}

export type ProgressoDeXp = {
  xp: number;
  /** Nível 20: não há próximo. */
  maximo: boolean;
  /** XP pra chegar ao próximo nível (null no 20). */
  ate: number | null;
  /** Quanto falta (0 se já chegou). */
  faltam: number;
  /** 0 a 1: o quanto andou entre o início do nível e o próximo. */
  fracao: number;
  /** Já tem XP pro próximo nível. */
  podeSubir: boolean;
};

/** Onde o personagem está na escada de XP, dado o nível dele na ficha (a soma das classes). null = sem nível. */
export function progressoDeXp(xp: number, nivel: number): ProgressoDeXp | null {
  if (!Number.isFinite(nivel) || nivel < 1) return null;
  const n = Math.min(20, Math.round(nivel));
  if (n >= 20) return { xp, maximo: true, ate: null, faltam: 0, fracao: 1, podeSubir: false };
  const de = XP_MINIMO_DO_NIVEL[n - 1];
  const ate = XP_MINIMO_DO_NIVEL[n];
  return {
    xp,
    maximo: false,
    ate,
    faltam: Math.max(0, ate - xp),
    fracao: Math.max(0, Math.min(1, (xp - de) / (ate - de))),
    podeSubir: xp >= ate,
  };
}

/** Divide um prêmio entre `n` personagens. A sobra (quando não divide certo) não vai pra ninguém. */
export function dividirXp(total: number, n: number): { cada: number; sobra: number } {
  if (n < 1) return { cada: 0, sobra: total };
  const cada = Math.floor(total / n);
  return { cada, sobra: total - cada * n };
}

/** Toda linha do log sobre XP começa com esta marca (o recap reconhece). */
export const MARCA_DE_XP = "🏅";

export function ehLinhaDeXp(texto: string): boolean {
  return texto.trimStart().startsWith(MARCA_DE_XP);
}

/** "🏅 Ana ganhou 300 XP (total 1.250)"; com `ganho` negativo, "perdeu" (correção do Mestre). */
export function linhaDeXp(nome: string, ganho: number, total: number): string {
  const verbo = ganho >= 0 ? "ganhou" : "perdeu";
  return `${MARCA_DE_XP} ${nome} ${verbo} ${formatarXp(Math.abs(ganho))} XP (total ${formatarXp(total)})`;
}
