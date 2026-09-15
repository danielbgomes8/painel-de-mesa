import { describe, expect, it } from "vitest";
import { habilidadesAte, habilidadesMulticlasse } from "./classesSrd";

describe("habilidadesAte", () => {
  it("devolve só as habilidades até o nível dado, em ordem", () => {
    const ate3 = habilidadesAte("feiticeiro", 3);
    expect(ate3.map((h) => h.nome)).toEqual([
      "Conjuração",
      "Feitiçaria Inata",
      "Fonte de Magia",
      "Metamagia",
      "Subclasse de Feiticeiro",
    ]);
    expect(ate3.every((h) => h.nivel <= 3)).toBe(true);
  });

  it("Feiticeiro nível 7 inclui Feitiçaria Encarnada, mas não Dádiva Épica (19)", () => {
    const nomes = habilidadesAte("feiticeiro", 7).map((h) => h.nome);
    expect(nomes).toContain("Feitiçaria Encarnada");
    expect(nomes).not.toContain("Dádiva Épica");
  });

  it("classe sem catálogo ainda devolve lista vazia, não quebra", () => {
    expect(habilidadesAte("monge", 10)).toEqual([]);
  });

  it("multiclasse: concatena as habilidades de cada classe, marcadas com o índice de origem", () => {
    const r = habilidadesMulticlasse([
      { classe: "feiticeiro", nivel: 3 },
      { classe: "barbaro", nivel: 2 },
    ]);
    expect(r.filter((h) => h.classeIndice === 0).map((h) => h.nome)).toEqual([
      "Conjuração",
      "Feitiçaria Inata",
      "Fonte de Magia",
      "Metamagia",
      "Subclasse de Feiticeiro",
    ]);
    expect(r.filter((h) => h.classeIndice === 1).map((h) => h.nome)).toEqual([
      "Fúria",
      "Defesa sem Armadura",
      "Maestria em Armas",
      "Sentido de Perigo",
      "Ataque Imprudente",
    ]);
  });

  it("Bárbaro nível 7 inclui Bote Instintivo e Instinto Selvagem, mas não Golpe Brutal (9)", () => {
    const nomes = habilidadesAte("barbaro", 7).map((h) => h.nome);
    expect(nomes).toContain("Bote Instintivo");
    expect(nomes).toContain("Instinto Selvagem");
    expect(nomes).not.toContain("Golpe Brutal");
  });

  it("Bárbaro nível 1 tem Fúria, Defesa sem Armadura e Maestria em Armas", () => {
    expect(habilidadesAte("barbaro", 1).map((h) => h.nome)).toEqual([
      "Fúria",
      "Defesa sem Armadura",
      "Maestria em Armas",
    ]);
  });
});
