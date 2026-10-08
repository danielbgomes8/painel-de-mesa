import { describe, expect, it } from "vitest";
import { comoTextoDeImportacao, detectarParedes, rgbaParaCinza } from "./detectarParedes";

/** Mapa de mentira: chão claro com ruído, duas salas separadas por uma parede com vão de porta. */
function mapaSintetico(w = 400, h = 300) {
  const g = new Uint8Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = 200 + ((i * 7919) % 17); // chão com textura leve
  const traco = (x1: number, y1: number, x2: number, y2: number) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) g[y * w + x] = 40;
  };
  traco(20, 20, 380, 26); // topo
  traco(20, 274, 380, 280); // base
  traco(20, 20, 26, 280); // esquerda
  traco(374, 20, 380, 280); // direita
  traco(197, 20, 203, 110); // divisória, parte de cima
  traco(197, 140, 203, 280); // divisória, parte de baixo (vão de 30 px = porta)
  return { g, w, h };
}

describe("detectarParedes", () => {
  it("acha as paredes retas e a porta no vão, sem depender de fundo preto", () => {
    const { g, w, h } = mapaSintetico();
    const r = detectarParedes(g, w, h, { minimo: 0.15 });
    const vertical = r.paredes.filter((s) => s[0] === s[2]);
    expect(vertical.some((s) => Math.abs(s[0] - 200) <= 3)).toBe(true);
    expect(r.paredes.filter((s) => s[1] === s[3]).length).toBeGreaterThanOrEqual(2);
    const porta = r.portas.find((s) => Math.abs(s[0] - 200) <= 3);
    expect(porta).toBeDefined();
    expect(porta![1]).toBeGreaterThan(100);
    expect(porta![3]).toBeLessThan(150);
  });

  it("imagem lisa não vira parede", () => {
    const g = new Uint8Array(300 * 300).fill(180);
    const r = detectarParedes(g, 300, 300);
    expect(r.paredes).toHaveLength(0);
    expect(r.portas).toHaveLength(0);
  });

  it("o texto de importação leva o tamanho da imagem analisada", () => {
    const t = JSON.parse(comoTextoDeImportacao({ largura: 10, altura: 20, paredes: [[0, 0, 5, 0]], portas: [] }));
    expect(t).toEqual({ largura: 10, altura: 20, paredes: [[0, 0, 5, 0]], portas: [] });
  });

  it("converte RGBA em cinza", () => {
    expect(Array.from(rgbaParaCinza(new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]), 2, 1))).toEqual([255, 0]);
  });
});
