import { describe, expect, it } from "vitest";
import { lerVersaoRemota, podeRecarregarSozinho, temVersaoNova } from "./versao";

describe("lerVersaoRemota", () => {
  it("aceita o início de um commit", () => {
    expect(lerVersaoRemota({ versao: "f0a376f" })).toBe("f0a376f");
    expect(lerVersaoRemota({ versao: "F0A376F" })).toBe("f0a376f");
  });
  it("tudo que não é isso vira null (nunca avisa por engano)", () => {
    for (const ruim of [null, undefined, 3, "x", {}, { versao: null }, { versao: "" }, { versao: "local" }, { versao: "<html>" }, { versao: 123 }]) {
      expect(lerVersaoRemota(ruim)).toBeNull();
    }
  });
});

describe("temVersaoNova", () => {
  it("avisa quando a versão do ar é outra", () => {
    expect(temVersaoNova("dfaa512", "f0a376f")).toBe(true);
  });
  it("não avisa quando é a mesma, nem sem resposta", () => {
    expect(temVersaoNova("f0a376f", "f0a376f")).toBe(false);
    expect(temVersaoNova("F0A376F", "f0a376f")).toBe(false);
    expect(temVersaoNova("dfaa512", null)).toBe(false);
  });
  it("app rodando fora do Vercel ('local') com servidor sem versão não avisa", () => {
    expect(temVersaoNova("local", null)).toBe(false);
  });
});

describe("podeRecarregarSozinho", () => {
  it("uma vez por versão", () => {
    expect(podeRecarregarSozinho("f0a376f", null)).toBe(true);
    expect(podeRecarregarSozinho("f0a376f", "dfaa512")).toBe(true);
    expect(podeRecarregarSozinho("f0a376f", "f0a376f")).toBe(false);
  });
});
