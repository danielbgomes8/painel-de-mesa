import { describe, expect, it } from "vitest";
import { espessuraDoContorno } from "./desenharCena";

describe("espessuraDoContorno (contorno do peão)", () => {
  it("peão grande: vale a fração do raio, como antes", () => {
    // raio 35 px da imagem, vista a 1x: 10% = 3,5 px (acima do mínimo de 2 px de tela)
    expect(espessuraDoContorno(35, 1, 0.1, 2)).toBeCloseTo(3.5, 5);
  });

  it("grade pequena e imagem ampliada: o mínimo é em px de TELA, então o contorno não engole o quadradinho", () => {
    // Quadradinho de 8 px, peão com raio 3,52, vista a 11,5x. O mínimo de 2 px de tela são 0,17 px da imagem;
    // a fração (0,35) manda. Antes o mínimo era 2 px da IMAGEM: 57% do raio, e o peão passava do quadrado.
    const w = espessuraDoContorno(3.52, 11.5, 0.1, 2);
    expect(w).toBeCloseTo(0.352, 3);
    expect(w).toBeLessThan(0.1 * 8);
  });

  it("vista afastada: o contorno não some, fica com o mínimo na tela", () => {
    // raio 35, escala 0,25: a fração dá 3,5 px da imagem (0,9 na tela); o mínimo de 2 na tela pede 8 px da imagem
    expect(espessuraDoContorno(35, 0.25, 0.1, 2)).toBeCloseTo(8, 5);
  });

  it("escala zero ou absurda não estoura", () => {
    expect(Number.isFinite(espessuraDoContorno(10, 0, 0.1, 2))).toBe(true);
  });
});
