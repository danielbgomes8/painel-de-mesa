/** As 14 condições do D&D 2024 (SRD 5.2), na ordem em que aparecem nos chips. */
export const CONDICOES = [
  "Cego",
  "Enfeitiçado",
  "Surdo",
  "Amedrontado",
  "Agarrado",
  "Incapacitado",
  "Invisível",
  "Paralisado",
  "Petrificado",
  "Envenenado",
  "Caído",
  "Contido",
  "Atordoado",
  "Inconsciente",
] as const;

export type Condicao = (typeof CONDICOES)[number];
