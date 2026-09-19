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

/** Um efeito de condição: título curto pra bater o olho e o que ele faz. */
export type EfeitoCondicao = { titulo: string; texto: string };

// O que cada condição faz, pra mostrar na hora (etiqueta na ordem de
// iniciativa, ficha). Resumo em português do Rules Glossary das Regras 2024 /
// SRD 5.2 (CC-BY-4.0), conferido no texto da página
// (dndbeyond.com/sources/dnd/free-rules/rules-glossary) em 2026-09-19.
// Distância em metros, como no resto do app (5 pés = 1,5 m).
//
// Condição que inclui Incapacitado traz o que ele faz escrito junto, em vez
// de mandar a pessoa procurar outro verbete no meio da luta. O teste
// "inclui Incapacitado" confere que esta lista bate com
// CONDICOES_QUE_QUEBRAM_CONCENTRACAO (regras.ts).
const INCAPACITADO: EfeitoCondicao = {
  titulo: "Incapacitado",
  texto: "sem ação, ação bônus nem reação; não fala e perde a concentração",
};
const DESLOCAMENTO_0: EfeitoCondicao = { titulo: "Deslocamento 0", texto: "e não pode aumentar" };
const FALHA_FOR_DES: EfeitoCondicao = {
  titulo: "Resistência",
  texto: "falha automaticamente nos testes de resistência de Força e Destreza",
};
const CRITICO_PERTO: EfeitoCondicao = {
  titulo: "Crítico",
  texto: "ataque que acerta vindo de até 1,5 m é acerto crítico",
};
const ATACADO_COM_VANTAGEM: EfeitoCondicao = { titulo: "Ataques", texto: "ataques contra ele têm vantagem" };

export const EFEITOS_CONDICAO: Record<Condicao, readonly EfeitoCondicao[]> = {
  Cego: [
    { titulo: "Não enxerga", texto: "falha automaticamente em teste de atributo que dependa da visão" },
    { titulo: "Ataques", texto: "ataques contra ele têm vantagem; os dele têm desvantagem" },
  ],
  Enfeitiçado: [
    {
      titulo: "Não fere quem o enfeitiçou",
      texto: "não pode atacá-lo nem mirá-lo com habilidade ou efeito mágico que cause dano",
    },
    { titulo: "Social", texto: "quem o enfeitiçou tem vantagem em teste de atributo pra interagir socialmente com ele" },
  ],
  Surdo: [{ titulo: "Não ouve", texto: "falha automaticamente em teste de atributo que dependa da audição" }],
  Amedrontado: [
    {
      titulo: "Testes e ataques",
      texto: "desvantagem em teste de atributo e jogada de ataque enquanto vê a fonte do medo",
    },
    { titulo: "Não se aproxima", texto: "não pode chegar mais perto da fonte do medo por vontade própria" },
  ],
  Agarrado: [
    DESLOCAMENTO_0,
    { titulo: "Ataques", texto: "desvantagem pra atacar qualquer um que não seja quem o agarra" },
    {
      titulo: "Arrastado",
      texto:
        "quem agarra pode levá-lo junto, gastando o dobro de movimento (a não ser que ele seja Miúdo ou 2 tamanhos menor)",
    },
  ],
  Incapacitado: [
    { titulo: "Inativo", texto: "não pode fazer ação, ação bônus nem reação" },
    { titulo: "Concentração", texto: "perde a concentração" },
    { titulo: "Calado", texto: "não pode falar" },
    { titulo: "Iniciativa", texto: "se estiver Incapacitado ao rolar iniciativa, rola com desvantagem" },
  ],
  Invisível: [
    { titulo: "Iniciativa", texto: "se estiver Invisível ao rolar iniciativa, rola com vantagem" },
    {
      titulo: "Oculto",
      texto:
        "efeito que exige ver o alvo não o afeta, a não ser que quem o criou consiga vê-lo; o que ele veste e carrega também fica oculto",
    },
    {
      titulo: "Ataques",
      texto: "ataques contra ele têm desvantagem; os dele têm vantagem — não vale contra quem consegue vê-lo",
    },
  ],
  Paralisado: [INCAPACITADO, DESLOCAMENTO_0, FALHA_FOR_DES, ATACADO_COM_VANTAGEM, CRITICO_PERTO],
  Petrificado: [
    {
      titulo: "Vira pedra",
      texto:
        "vira substância inanimada (geralmente pedra) com o que veste e carrega de não mágico; pesa 10 vezes mais e para de envelhecer",
    },
    INCAPACITADO,
    DESLOCAMENTO_0,
    ATACADO_COM_VANTAGEM,
    FALHA_FOR_DES,
    { titulo: "Dano", texto: "resistência a todo dano" },
    { titulo: "Veneno", texto: "imune à condição Envenenado" },
  ],
  Envenenado: [{ titulo: "Testes e ataques", texto: "desvantagem em jogada de ataque e teste de atributo" }],
  Caído: [
    {
      titulo: "Movimento",
      texto:
        "só rasteja, ou gasta metade do deslocamento (pra baixo) pra se levantar e acabar com a condição; com deslocamento 0, não levanta",
    },
    {
      titulo: "Ataques",
      texto:
        "os dele têm desvantagem; contra ele, vantagem se o atacante estiver a até 1,5 m e desvantagem se estiver mais longe",
    },
  ],
  Contido: [
    DESLOCAMENTO_0,
    { titulo: "Ataques", texto: "ataques contra ele têm vantagem; os dele têm desvantagem" },
    { titulo: "Resistência", texto: "desvantagem nos testes de resistência de Destreza" },
  ],
  Atordoado: [INCAPACITADO, FALHA_FOR_DES, ATACADO_COM_VANTAGEM],
  Inconsciente: [
    {
      titulo: "Apagado",
      texto:
        "fica Incapacitado (sem ação, ação bônus nem reação; não fala, perde a concentração) e Caído, e larga o que segura; quando a condição acaba, continua Caído",
    },
    DESLOCAMENTO_0,
    ATACADO_COM_VANTAGEM,
    FALHA_FOR_DES,
    CRITICO_PERTO,
    { titulo: "Alheio", texto: "não percebe nada ao redor" },
  ],
};

/** Exaustão não é chip (é a trilha de 0 a 6 da ficha), mas também é condição
 *  nas regras de 2024 — a etiqueta dela na iniciativa explica com isto, mais
 *  a penalidade já calculada do nível atual (`efeitoExaustao` em regras.ts). */
export const EFEITOS_EXAUSTAO: readonly EfeitoCondicao[] = [
  { titulo: "Acumula", texto: "cada vez que recebe, ganha 1 nível; no nível 6, morre" },
  { titulo: "Testes de D20", texto: "a rolagem diminui 2 × o nível" },
  { titulo: "Deslocamento", texto: "diminui 1,5 m × o nível" },
  { titulo: "Descanso longo", texto: "tira 1 nível" },
];

/** Condições ativas de alguém, na ordem dos chips — só as que o app conhece
 *  (um nome estranho gravado no banco não vira etiqueta sem explicação). */
export function condicoesAtivas(cond: Record<string, boolean> | null | undefined): Condicao[] {
  return CONDICOES.filter((nome) => Boolean(cond?.[nome]));
}

/** "1 rodada", "3 rodadas" — prazo que falta pra condição acabar sozinha. */
export function textoPrazo(rodadas: number): string {
  return rodadas === 1 ? "1 rodada" : `${rodadas} rodadas`;
}
