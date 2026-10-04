import { describe, expect, it } from "vitest";
import {
  agruparPorNivel,
  conjurar,
  contarPreparadas,
  contarSempre,
  contarTruques,
  contarTruquesExtras,
  devolverEspaco,
  espacosDosRecursos,
  espacosPossiveis,
  gastarEspaco,
  jaTemMagia,
  limiteDePreparadas,
  limiteDeTruques,
  magiaNova,
  normalizarMagia,
  normalizarMagias,
} from "./magias";
import { PREFIXO_ESPACO_MAGIA } from "./regras";
import type { ClassePersonagem, Recurso } from "./tipos";

const espaco = (nivel: number, cur: number, max = 4): Recurso => ({
  name: `${PREFIXO_ESPACO_MAGIA}${nivel}`,
  max,
  cur,
  short_rest: false,
});
const furia: Recurso = { name: "Fúria", max: 3, cur: 3, short_rest: false };

describe("normalizar magias do banco", () => {
  it("linha de antes da migration vira lista vazia", () => {
    expect(normalizarMagias(undefined)).toEqual([]);
    expect(normalizarMagias("x")).toEqual([]);
  });

  it("nível preso entre 0 e 9, campos ausentes viram vazio", () => {
    expect(normalizarMagia({ nome: "Desejo", nivel: 12 }).nivel).toBe(9);
    expect(normalizarMagia({ nome: "X", nivel: -2 }).nivel).toBe(0);
    expect(normalizarMagia({ nome: "X" })).toMatchObject({ nivel: 0, preparada: false, descricao: "" });
  });
});

describe("espaços de magia nos recursos", () => {
  it("só reconhece o nome gerado pela calculadora; Fúria e afins ficam de fora", () => {
    const r = [furia, espaco(3, 2), espaco(1, 4)];
    expect(espacosDosRecursos(r).map((e) => [e.nivel, e.cur, e.indice])).toEqual([
      [1, 4, 2],
      [3, 2, 1],
    ]);
  });

  it("nome com nível quebrado é ignorado, não vira espaço 0 nem NaN", () => {
    const r: Recurso[] = [{ name: `${PREFIXO_ESPACO_MAGIA}x`, max: 2, cur: 2, short_rest: false }];
    expect(espacosDosRecursos(r)).toEqual([]);
  });

  it("possíveis: do nível da magia pra cima, só com uso sobrando", () => {
    const r = [espaco(1, 0), espaco(2, 1), espaco(3, 0), espaco(4, 2)];
    expect(espacosPossiveis(r, 2).map((e) => e.nivel)).toEqual([2, 4]);
    expect(espacosPossiveis(r, 5)).toEqual([]);
  });

  it("gastar tira um uso só do espaço pedido, sem tocar nos outros recursos", () => {
    const r = [furia, espaco(1, 4), espaco(2, 3)];
    const depois = gastarEspaco(r, 2)!;
    expect(depois[2].cur).toBe(2);
    expect(depois[1].cur).toBe(4);
    expect(depois[0]).toBe(furia);
    expect(r[2].cur).toBe(3); // não muda o original
  });

  it("gastar espaço que acabou ou não existe devolve null", () => {
    expect(gastarEspaco([espaco(1, 0)], 1)).toBeNull();
    expect(gastarEspaco([espaco(1, 2)], 2)).toBeNull();
  });

  it("devolver sobe um uso e para no máximo", () => {
    expect(devolverEspaco([espaco(1, 1, 4)], 1)![0].cur).toBe(2);
    expect(devolverEspaco([espaco(1, 4, 4)], 1)).toBeNull();
  });
});

describe("conjurar", () => {
  const base = { resources: [espaco(1, 2), espaco(2, 1)], concentration: false, concentration_on: "" };

  it("truque não gasta espaço", () => {
    const r = conjurar(base, { nome: "Raio de Fogo", nivel: 0, concentracao: false, ritual: false })!;
    expect(r.mudanca).toEqual({});
    expect(r.resumo).toBe("Raio de Fogo");
  });

  it("magia de 1º nível gasta espaço de 1º por padrão", () => {
    const r = conjurar(base, { nome: "Escudo Arcano", nivel: 1, concentracao: false, ritual: false })!;
    expect(r.mudanca.resources![0].cur).toBe(1);
    expect(r.mudanca.concentration).toBeUndefined();
  });

  it("em espaço maior, gasta o maior e diz isso no resumo", () => {
    const r = conjurar(base, { nome: "Curar Ferimentos", nivel: 1, concentracao: false, ritual: false }, { nivelDoEspaco: 2 })!;
    expect(r.mudanca.resources![1].cur).toBe(0);
    expect(r.mudanca.resources![0].cur).toBe(2);
    expect(r.resumo).toContain("2º nível");
  });

  it("espaço menor que a magia não vale", () => {
    expect(conjurar(base, { nome: "Bola de Fogo", nivel: 3, concentracao: false, ritual: false }, { nivelDoEspaco: 2 })).toBeNull();
  });

  it("sem espaço sobrando, não conjura (e não liga concentração de graça)", () => {
    const vazio = { ...base, resources: [espaco(1, 0)] };
    expect(conjurar(vazio, { nome: "Bênção", nivel: 1, concentracao: true, ritual: false })).toBeNull();
  });

  it("ritual não gasta espaço, mas só se a magia for ritual", () => {
    const magia = { nome: "Detectar Magia", nivel: 1, concentracao: true, ritual: true };
    const r = conjurar(base, magia, { comoRitual: true })!;
    expect(r.mudanca.resources).toBeUndefined();
    expect(r.resumo).toContain("ritual");
    expect(r.mudanca.concentration_on).toBe("Detectar Magia");
    // marcar "ritual" numa magia que não é ritual não vira espaço de graça
    const comum = conjurar(base, { nome: "Escudo Arcano", nivel: 1, concentracao: false, ritual: false }, { comoRitual: true })!;
    expect(comum.mudanca.resources![0].cur).toBe(1);
  });

  it("concentração liga e aponta pra magia", () => {
    const r = conjurar(base, { nome: "Bênção", nivel: 1, concentracao: true, ritual: false })!;
    expect(r.mudanca).toMatchObject({ concentration: true, concentration_on: "Bênção" });
    expect(r.largouConcentracao).toBeNull();
  });

  it("segurar outra concentração larga a anterior e avisa qual", () => {
    const segurando = { ...base, concentration: true, concentration_on: "Voo" };
    const r = conjurar(segurando, { nome: "Bênção", nivel: 1, concentracao: true, ritual: false })!;
    expect(r.largouConcentracao).toBe("Voo");
    expect(r.mudanca.concentration_on).toBe("Bênção");
  });

  it("conjurar de novo a mesma magia que já segura não conta como largar outra", () => {
    const segurando = { ...base, concentration: true, concentration_on: "bênção" };
    const r = conjurar(segurando, { nome: "Bênção", nivel: 1, concentracao: true, ritual: false })!;
    expect(r.largouConcentracao).toBeNull();
  });

  it("magia sem concentração não mexe em quem já está concentrado", () => {
    const segurando = { ...base, concentration: true, concentration_on: "Voo" };
    const r = conjurar(segurando, { nome: "Escudo Arcano", nivel: 1, concentracao: false, ritual: false })!;
    expect(r.mudanca.concentration).toBeUndefined();
    expect(r.mudanca.concentration_on).toBeUndefined();
  });
});

describe("lista de magias", () => {
  const m = (nome: string, nivel: number, preparada = false) => ({ ...magiaNova(nome, nivel), preparada });

  it("agrupa por nível, preparadas primeiro, depois alfabética", () => {
    const grupos = agruparPorNivel([m("Zumbido", 1), m("Armadura", 1, true), m("Luz", 0), m("Bênção", 1, true)]);
    expect(grupos.map((g) => g.nivel)).toEqual([0, 1]);
    expect(grupos[1].magias.map((x) => x.magia.nome)).toEqual(["Armadura", "Bênção", "Zumbido"]);
  });

  it("guarda o índice original (a tela edita pelo índice da lista inteira)", () => {
    const grupos = agruparPorNivel([m("B", 1), m("A", 1)]);
    expect(grupos[0].magias.map((x) => x.indice)).toEqual([1, 0]);
  });

  it("truque preparado não entra na conta de preparadas", () => {
    expect(contarPreparadas([m("Luz", 0, true), m("A", 1, true), m("B", 1), m("C", 2, true)])).toBe(2);
  });

  it("detecta magia repetida ignorando maiúscula e acento", () => {
    expect(jaTemMagia([m("Mísseis Mágicos", 1)], "misseis magicos")).toBe(true);
    expect(jaTemMagia([m("Mísseis Mágicos", 1)], "Escudo")).toBe(false);
  });
});

describe("limite de magias preparadas", () => {
  const cl = (classe: ClassePersonagem["classe"], nivel: number): ClassePersonagem => ({
    classe,
    nivel,
    conjurador: "completo",
    atributo_conjuracao: null,
  });

  it("lê a coluna da classe no nível dela (SRD 5.2)", () => {
    expect(limiteDePreparadas([cl("mago", 1)])?.total).toBe(4);
    expect(limiteDePreparadas([cl("mago", 20)])?.total).toBe(25);
    expect(limiteDePreparadas([cl("clerigo", 5)])?.total).toBe(9);
    expect(limiteDePreparadas([cl("feiticeiro", 1)])?.total).toBe(2);
    expect(limiteDePreparadas([cl("bruxo", 9)])?.total).toBe(10);
    expect(limiteDePreparadas([cl("paladino", 6)])?.total).toBe(6);
    expect(limiteDePreparadas([cl("patrulheiro", 17)])?.total).toBe(14);
  });

  it("multiclasse soma as classes e detalha cada uma", () => {
    const r = limiteDePreparadas([cl("clerigo", 3), cl("paladino", 2)]);
    expect(r?.total).toBe(6 + 3);
    expect(r?.porClasse).toEqual([
      { classe: "clerigo", nivel: 3, limite: 6 },
      { classe: "paladino", nivel: 2, limite: 3 },
    ]);
  });

  it("classe sem coluna no SRD (Bárbaro, Guerreiro, Ladino, Monge) não entra; sem nenhuma, devolve null", () => {
    expect(limiteDePreparadas([cl("guerreiro", 7)])).toBeNull();
    expect(limiteDePreparadas([])).toBeNull();
    expect(limiteDePreparadas([cl("guerreiro", 7), cl("mago", 2)])?.total).toBe(5);
  });

  it("nível fora da faixa não quebra", () => {
    expect(limiteDePreparadas([cl("mago", 0)])).toBeNull();
    expect(limiteDePreparadas([cl("mago", 99)])?.total).toBe(25);
    expect(limiteDePreparadas([cl("mago", Number.NaN)])).toBeNull();
  });
});

describe("magia sempre preparada", () => {
  const m = (nome: string, nivel: number, extra: object = {}) => ({ ...magiaNova(nome, nivel), preparada: true, ...extra });

  it("fica preparada mas não conta no limite", () => {
    expect(contarPreparadas([m("A", 1), m("B", 2, { sempre: true }), m("C", 3, { sempre: true })])).toBe(1);
    expect(contarSempre([m("A", 1), m("B", 2, { sempre: true }), m("Luz", 0, { sempre: true })])).toBe(1);
  });

  it("o banco que diz sempre sem preparada vira as duas coisas; ficha antiga vira false", () => {
    expect(normalizarMagia({ nome: "X", nivel: 2, sempre: true })).toMatchObject({ sempre: true, preparada: true });
    expect(normalizarMagia({ nome: "X", nivel: 2, preparada: true })).toMatchObject({ sempre: false, preparada: true });
    expect(magiaNova("X", 1).sempre).toBe(false);
  });
});

describe("limite de truques conhecidos", () => {
  const cl = (classe: ClassePersonagem["classe"], nivel: number): ClassePersonagem => ({
    classe,
    nivel,
    conjurador: "completo",
    atributo_conjuracao: null,
  });

  it("lê a coluna Cantrips da classe no nível dela (SRD 5.2)", () => {
    expect(limiteDeTruques([cl("mago", 1)])?.total).toBe(3);
    expect(limiteDeTruques([cl("mago", 10)])?.total).toBe(5);
    expect(limiteDeTruques([cl("clerigo", 4)])?.total).toBe(4);
    expect(limiteDeTruques([cl("feiticeiro", 10)])?.total).toBe(6);
    expect(limiteDeTruques([cl("bardo", 3)])?.total).toBe(2);
    expect(limiteDeTruques([cl("bruxo", 4)])?.total).toBe(3);
  });

  it("multiclasse soma; Paladino, Patrulheiro e sem conjuração não entram", () => {
    expect(limiteDeTruques([cl("mago", 1), cl("clerigo", 1)])?.total).toBe(6);
    expect(limiteDeTruques([cl("paladino", 9)])).toBeNull();
    expect(limiteDeTruques([cl("paladino", 9), cl("druida", 1)])?.total).toBe(2);
    expect(limiteDeTruques([])).toBeNull();
    expect(limiteDeTruques([cl("mago", 0)])).toBeNull();
  });

  it("conta só os truques da lista, preparados ou não", () => {
    const m = (nivel: number) => ({ ...normalizarMagia({ nome: "x", nivel }) });
    expect(contarTruques([m(0), m(0), m(1), m(3)])).toBe(2);
  });

  it("truque extra (espécie, talento, subclasse) sai da conta e é contado à parte", () => {
    const t = (sempre: boolean) => normalizarMagia({ nome: "x", nivel: 0, sempre });
    expect(contarTruques([t(false), t(true), t(true)])).toBe(1);
    expect(contarTruquesExtras([t(false), t(true), t(true)])).toBe(2);
    // a marca num truque não mexe na conta das preparadas
    expect(contarSempre([t(true)])).toBe(0);
  });
});
