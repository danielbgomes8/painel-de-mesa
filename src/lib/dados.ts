/** Rolagem de dado simples — usa Math.random, por isso fica fora de regras.ts
 *  (que só guarda função pura testável; aleatoriedade não dá pra testar). */
export function d20(): number {
  return 1 + Math.floor(Math.random() * 20);
}

/** Pra sortear na tabela de eventos do Bastião (d100). */
export function d100(): number {
  return 1 + Math.floor(Math.random() * 100);
}

/** Um dado de N faces — o que o ataque rolado na iniciativa usa (ver
 *  `resolverAtaque` em regras.ts). */
export function rolarDado(faces: number): number {
  return 1 + Math.floor(Math.random() * faces);
}

/** Rolagem de iniciativa: d20 + modificador. Com `desvantagem` (surpresa, regra de 2024) rola dois d20 e
 *  fica com o MENOR. Devolve os dados rolados pra tela e o log poderem mostrar. O dado vem de fora pra
 *  dar pra testar com número combinado. */
export function rolarIniciativa(
  mod: number,
  desvantagem = false,
  dado: () => number = d20,
): { total: number; dados: number[] } {
  const dados = desvantagem ? [dado(), dado()] : [dado()];
  return { total: Math.min(...dados) + mod, dados };
}
