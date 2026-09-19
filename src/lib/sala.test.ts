import { describe, expect, it } from "vitest";
import { escolherSala, rotuloDaSala, SALA_PADRAO } from "./sala";

describe("qual sala abrir", () => {
  it("o ?sala= do link sempre manda, mesmo com outra sala lembrada", () => {
    expect(escolherSala("cripta-de-ferro", "setimo-raio")).toBe("cripta-de-ferro");
  });

  it("sem ?sala= (app instalado abre em /), volta pra última sala do aparelho", () => {
    expect(escolherSala(null, "cripta-de-ferro")).toBe("cripta-de-ferro");
  });

  it("sem link e sem sala lembrada, cai no padrão — quem só joga a Sétimo Raio não sente nada", () => {
    expect(escolherSala(null, null)).toBe(SALA_PADRAO);
  });

  it("sala lembrada estragada não vira sala nova à toa", () => {
    expect(escolherSala(null, "   ")).toBe(SALA_PADRAO);
    expect(escolherSala(null, "Cripta de Ferro!")).toBe("cripta-de-ferro");
  });
});

describe("rótulo da sala", () => {
  it("a Sétimo Raio mantém o acento que o código não guarda", () => {
    expect(rotuloDaSala("setimo-raio")).toBe("Sétimo Raio");
  });

  it("sala nova vira título a partir do código", () => {
    expect(rotuloDaSala("cripta-de-ferro")).toBe("Cripta De Ferro");
  });
});
