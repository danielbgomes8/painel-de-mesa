/** Rolagem de dado simples — usa Math.random, por isso fica fora de regras.ts
 *  (que só guarda função pura testável; aleatoriedade não dá pra testar). */
export function d20(): number {
  return 1 + Math.floor(Math.random() * 20);
}

/** Pra sortear na tabela de eventos do Bastião (d100). */
export function d100(): number {
  return 1 + Math.floor(Math.random() * 100);
}
