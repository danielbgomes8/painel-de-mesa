import type { ClasseBase } from "./tipos";

/** Nome de cada classe base, em ordem alfabética (é a ordem dos seletores).
 *  Fica fora de `classesSrd.ts` de propósito: o rótulo é usado na abertura da
 *  ficha, e o catálogo de habilidades (~40 KB de texto) só baixa depois — ver
 *  `useCatalogoClasses`. */
export const NOME_CLASSE: Record<ClasseBase, string> = {
  barbaro: "Bárbaro",
  bardo: "Bardo",
  bruxo: "Bruxo",
  clerigo: "Clérigo",
  druida: "Druida",
  feiticeiro: "Feiticeiro",
  guerreiro: "Guerreiro",
  ladino: "Ladino",
  mago: "Mago",
  monge: "Monge",
  paladino: "Paladino",
  patrulheiro: "Patrulheiro",
};
