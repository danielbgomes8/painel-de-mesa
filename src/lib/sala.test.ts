import { describe, expect, it } from "vitest";
import {
  campanhasParaEscolher,
  codigoDigitado,
  escolherSala,
  mestreDaSala,
  rotuloDaSala,
  SALA_PADRAO,
} from "./sala";

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

describe("campanhas pra escolher", () => {
  const codigos = (salas: string[], atual: string) =>
    campanhasParaEscolher(salas, atual).map((c) => c.codigo);

  it("as campanhas do grupo aparecem pra qualquer um, mesmo em aparelho novo", () => {
    expect(codigos([], "setimo-raio")).toEqual(["setimo-raio", "forgotten-realms"]);
  });

  it("a Forgotten Realms é do Diogo, com nome bonito", () => {
    expect(rotuloDaSala("forgotten-realms")).toBe("Forgotten Realms");
    expect(mestreDaSala("forgotten-realms")).toBe("Diogo");
    expect(mestreDaSala("cripta-de-ferro")).toBeUndefined();
  });

  it("sala aberta por código neste aparelho entra depois das do grupo, sem repetir", () => {
    expect(codigos(["zz-teste", "forgotten-realms", "cripta-de-ferro"], "setimo-raio")).toEqual([
      "setimo-raio",
      "forgotten-realms",
      "cripta-de-ferro",
      "zz-teste",
    ]);
  });

  it("a sala aberta agora aparece mesmo antes de a pessoa entrar nela", () => {
    expect(codigos([], "cripta-de-ferro")).toEqual(["setimo-raio", "forgotten-realms", "cripta-de-ferro"]);
    expect(codigos(["cripta-de-ferro"], "cripta-de-ferro")).toHaveLength(3);
  });
});

describe("código digitado", () => {
  it("nome escrito do jeito que der vira o código da sala", () => {
    expect(codigoDigitado("  Forgotten Realms ")).toBe("forgotten-realms");
    expect(codigoDigitado("Cripta-de-Ferro-7K2")).toBe("cripta-de-ferro-7k2");
  });

  it("campo vazio não leva ninguém pra Sétimo Raio sem querer", () => {
    expect(codigoDigitado("")).toBeNull();
    expect(codigoDigitado(" !! ")).toBeNull();
  });
});
