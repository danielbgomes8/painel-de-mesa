import { describe, expect, it } from "vitest";
import { MAGIAS_SRD, buscarMagias, magiaDoCatalogo } from "./magiasSrd";

const achar = (en: string) => MAGIAS_SRD.find((m) => m.en === en)!;

describe("catálogo de magias do SRD 5.2", () => {
  it("tem as 339 do documento, sem repetir nome", () => {
    expect(MAGIAS_SRD).toHaveLength(339);
    expect(new Set(MAGIAS_SRD.map((m) => m.en)).size).toBe(339);
  });

  it("todo nível está entre 0 e 9 e todo campo de consulta está preenchido", () => {
    for (const m of MAGIAS_SRD) {
      expect(m.nivel).toBeGreaterThanOrEqual(0);
      expect(m.nivel).toBeLessThanOrEqual(9);
      for (const campo of [m.nome, m.escola, m.tempo, m.alcance, m.duracao, m.texto]) expect(campo.trim()).not.toBe("");
      expect(m.classes.length).toBeGreaterThan(0);
    }
  });

  // Guarda de edição: valores conferidos na fonte (open5e, srd-2024) em 02/10/2026.
  it("Bola de Fogo: 3º nível, Evocação, 45 m, 8d6 fogo, salvaguarda de Destreza", () => {
    const m = achar("Fireball");
    expect(m).toMatchObject({
      nome: "Bola de fogo",
      nivel: 3,
      escola: "Evocação",
      alcance: "45 m",
      dano: "8d6 fogo",
      teste: "Salvaguarda de Destreza",
      concentracao: false,
    });
    expect(m.classes).toEqual(expect.arrayContaining(["Feiticeiro", "Mago"]));
  });

  it("Bênção: concentração de até 1 minuto, 1 ação", () => {
    const m = achar("Bless");
    expect(m).toMatchObject({ concentracao: true, tempo: "1 ação", duracao: "Concentração, até 1 minuto" });
  });

  it("Detectar Magia é ritual com concentração", () => {
    expect(achar("Detect Magic")).toMatchObject({ ritual: true, concentracao: true });
  });

  it("Escudo Arcano é reação e diz quando", () => {
    const m = achar("Shield");
    expect(m.tempo).toBe("1 reação");
    expect(m.gatilho).not.toBe("");
  });

  it("o texto das regras está em português, em metros, sem pés nem milhas", () => {
    for (const m of MAGIAS_SRD) {
      const texto = [m.texto, m.superior, m.gatilho, m.componentes].join(" ");
      expect(texto, m.en).not.toMatch(/(feet|foot|miles?|Hit Points|saving throw|spell slot|Bonus Action)/);
      expect(texto, m.en).not.toMatch(/#{2,}/); // sobra de título do PDF original
    }
    expect(achar("Fireball").texto).toContain("Esfera de 6 m de raio");
    expect(achar("Fireball").superior).toContain("nível do espaço de magia");
    expect(achar("Shield").gatilho).toContain("você");
  });

  it("alcance em metros e quilômetros com vírgula decimal", () => {
    expect(achar("Burning Hands").alcance).toBe("Pessoal");
    expect(MAGIAS_SRD.some((m) => m.alcance === "1,5 m")).toBe(true);
    expect(MAGIAS_SRD.some((m) => m.alcance === "1,5 km")).toBe(true);
  });
});

describe("buscar magias", () => {
  it("acha pelo nome em português e pelo original em inglês, sem acento", () => {
    expect(buscarMagias({ texto: "misseis" })[0].en).toBe("Magic Missile");
    expect(buscarMagias({ texto: "magic missile" })[0].en).toBe("Magic Missile");
  });

  it("quem começa com a busca vem antes de quem só contém", () => {
    const r = buscarMagias({ texto: "cura" }).map((m) => m.nome);
    expect(r[0].toLowerCase().startsWith("cura")).toBe(true);
  });

  it("filtra por nível, classe, concentração e ritual", () => {
    const truquesDoBruxo = buscarMagias({ nivel: 0, classe: "Bruxo" }, 100);
    expect(truquesDoBruxo.length).toBeGreaterThan(0);
    expect(truquesDoBruxo.every((m) => m.nivel === 0 && m.classes.includes("Bruxo"))).toBe(true);
    expect(buscarMagias({ soRitual: true }, 100).every((m) => m.ritual)).toBe(true);
    expect(buscarMagias({ soConcentracao: true }, 400).every((m) => m.concentracao)).toBe(true);
  });

  it("respeita o limite", () => {
    expect(buscarMagias({}, 5)).toHaveLength(5);
  });

  it("busca sem resultado devolve lista vazia", () => {
    expect(buscarMagias({ texto: "zzzzzz" })).toEqual([]);
  });
});

describe("magia do catálogo na lista do personagem", () => {
  it("leva os dados de consulta e monta o texto com teste, dano e níveis superiores", () => {
    const m = magiaDoCatalogo(achar("Fireball"));
    expect(m).toMatchObject({ nome: "Bola de fogo", nivel: 3, preparada: false, escola: "Evocação", alcance: "45 m" });
    expect(m.descricao).toContain("Salvaguarda de Destreza");
    expect(m.descricao).toContain("Dano: 8d6 fogo");
    expect(m.descricao).toContain("Em níveis superiores");
  });

  it("reação leva o gatilho no texto", () => {
    expect(magiaDoCatalogo(achar("Shield")).descricao).toContain("Gatilho da reação");
  });

  it("o texto nunca passa do limite da coluna", () => {
    for (const m of MAGIAS_SRD) expect(magiaDoCatalogo(m).descricao.length).toBeLessThanOrEqual(4000);
  });
});
