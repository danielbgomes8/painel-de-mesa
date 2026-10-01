import { describe, expect, it } from "vitest";
import {
  CONDICOES,
  EFEITOS_CONDICAO,
  EFEITOS_EXAUSTAO,
  ICONE_CONDICAO,
  ICONE_EXAUSTAO,
  condicoesAtivas,
  textoPrazo,
} from "./condicoes";
import { CONDICOES_QUE_QUEBRAM_CONCENTRACAO } from "./regras";

describe("o que cada condição faz", () => {
  it("toda condição dos chips tem explicação, sem efeito vazio", () => {
    for (const nome of CONDICOES) {
      expect(EFEITOS_CONDICAO[nome].length, nome).toBeGreaterThan(0);
      for (const e of EFEITOS_CONDICAO[nome]) {
        expect(e.titulo.trim(), nome).not.toBe("");
        expect(e.texto.trim(), nome).not.toBe("");
      }
    }
    expect(EFEITOS_EXAUSTAO.length).toBeGreaterThan(0);
  });

  it("inclui Incapacitado exatamente nas que quebram a concentração (regras.ts)", () => {
    const incluem = CONDICOES.filter(
      (nome) =>
        nome === "Incapacitado" ||
        EFEITOS_CONDICAO[nome].some((e) => e.titulo === "Incapacitado" || e.texto.includes("Incapacitado")),
    );
    expect([...incluem].sort()).toEqual([...CONDICOES_QUE_QUEBRAM_CONCENTRACAO].sort());
  });

  it("quem fica Incapacitado por outra condição vê o que isso faz ali mesmo", () => {
    for (const nome of ["Paralisado", "Petrificado", "Atordoado", "Inconsciente"] as const) {
      const texto = EFEITOS_CONDICAO[nome].map((e) => `${e.titulo} ${e.texto}`).join(" ");
      expect(texto, nome).toContain("reação");
      expect(texto, nome).toContain("concentração");
    }
  });

  it("paralisado e inconsciente levam crítico de perto; atordoado não (regras 2024)", () => {
    const temCritico = (nome: (typeof CONDICOES)[number]) => EFEITOS_CONDICAO[nome].some((e) => e.titulo === "Crítico");
    expect(temCritico("Paralisado")).toBe(true);
    expect(temCritico("Inconsciente")).toBe(true);
    expect(temCritico("Atordoado")).toBe(false);
  });

  it("condições ativas saem na ordem dos chips e ignoram nome desconhecido ou desligado", () => {
    expect(condicoesAtivas({ Atordoado: true, Cego: true, Caído: false, Voando: true })).toEqual(["Cego", "Atordoado"]);
    expect(condicoesAtivas(null)).toEqual([]);
  });

  it("prazo no singular e no plural", () => {
    expect(textoPrazo(1)).toBe("1 rodada");
    expect(textoPrazo(3)).toBe("3 rodadas");
  });
});

describe("ícone de cada condição no peão", () => {
  it("toda condição tem emoji e cor, e nenhuma se parece com outra (senão o ícone não diz qual é)", () => {
    const emojis = [...CONDICOES.map((n) => ICONE_CONDICAO[n].emoji), ICONE_EXAUSTAO.emoji];
    expect(new Set(emojis).size).toBe(emojis.length);
    for (const nome of CONDICOES) {
      expect(ICONE_CONDICAO[nome].emoji.trim(), nome).not.toBe("");
      expect(ICONE_CONDICAO[nome].cor, nome).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(ICONE_EXAUSTAO.cor).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
