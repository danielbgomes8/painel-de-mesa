import { describe, expect, it } from "vitest";
import {
  agruparPorNivel,
  conjurar,
  contarPreparadas,
  devolverEspaco,
  espacosDosRecursos,
  espacosPossiveis,
  gastarEspaco,
  jaTemMagia,
  magiaNova,
  normalizarMagia,
  normalizarMagias,
} from "./magias";
import { PREFIXO_ESPACO_MAGIA } from "./regras";
import type { Recurso } from "./tipos";

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
