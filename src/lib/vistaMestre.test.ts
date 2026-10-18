import { describe, expect, it } from "vitest";
import { pacoteDaVista, validarVista, vistaMestreAoAbrir } from "./vistaMestre";

const mapa = { largura: 3000, altura: 2000 };

describe("validarVista", () => {
  it("aceita um pedaço do mapa, com ou sem foco", () => {
    expect(validarVista({ x: 100, y: 200, w: 600, h: 400, foco: "peao-1" }, mapa)).toEqual({
      regiao: { x: 100, y: 200, w: 600, h: 400 },
      foco: "peao-1",
    });
    expect(validarVista({ x: 0, y: 0, w: 3000, h: 2000 }, mapa)?.foco).toBeNull();
  });

  it("vai e volta pelo pacote do canal", () => {
    const v = { regiao: { x: 10, y: 20, w: 300, h: 200 }, foco: null };
    expect(validarVista(pacoteDaVista(v), mapa)).toEqual(v);
  });

  it("recusa lixo: sem número, sem tamanho, fora do mapa ou gigante", () => {
    expect(validarVista(null, mapa)).toBeNull();
    expect(validarVista({ x: "1", y: 0, w: 10, h: 10 }, mapa)).toBeNull();
    expect(validarVista({ x: 0, y: 0, w: 0, h: 10 }, mapa)).toBeNull();
    expect(validarVista({ x: 0, y: 0, w: Number.NaN, h: 10 }, mapa)).toBeNull();
    expect(validarVista({ x: 5000, y: 0, w: 100, h: 100 }, mapa)).toBeNull();
    expect(validarVista({ x: -500, y: 0, w: 100, h: 100 }, mapa)).toBeNull();
    expect(validarVista({ x: 0, y: 0, w: 99999, h: 100 }, mapa)).toBeNull();
  });

  it("foco estranho vira null, sem derrubar a vista", () => {
    expect(validarVista({ x: 0, y: 0, w: 10, h: 10, foco: 42 }, mapa)?.foco).toBeNull();
    expect(validarVista({ x: 0, y: 0, w: 10, h: 10, foco: "x".repeat(65) }, mapa)?.foco).toBeNull();
  });
});

describe("Vista Mestre ao abrir", () => {
  it("o link manda", () => {
    expect(vistaMestreAoAbrir("?sala=a&telao=1&vista=mestre", null)).toBe(true);
    expect(vistaMestreAoAbrir("?vista=jogador", "1")).toBe(false);
  });

  it("sem link, a última escolha do aparelho; nunca escolheu = desligada", () => {
    expect(vistaMestreAoAbrir("?sala=a", "1")).toBe(true);
    expect(vistaMestreAoAbrir("?sala=a", "0")).toBe(false);
    expect(vistaMestreAoAbrir("", null)).toBe(false);
  });
});
