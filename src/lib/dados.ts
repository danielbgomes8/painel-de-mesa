/** Rolagem de dado simples — usa Math.random, por isso fica fora de regras.ts
 *  (que só guarda função pura testável; aleatoriedade não dá pra testar). */
export function d20(): number {
  return 1 + Math.floor(Math.random() * 20);
}
