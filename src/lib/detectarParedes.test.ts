import { describe, expect, it } from "vitest";
import { NIVEIS_DE_SENSIBILIDADE, aplicarDeteccao, comoTextoDeImportacao, detectarParedes, prepararDeteccao, rgbaParaCinza } from "./detectarParedes";

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

  it("borda de tapete (linha só um pouco mais escura que o chão) não vira parede", () => {
    const { g, w, h } = mapaSintetico();
    // Uma linha comprida e fina, mas só ~35% mais escura que o chão: é o tapete, não a parede.
    for (let x = 60; x <= 340; x++) for (let y = 200; y <= 205; y++) g[y * w + x] = 130;
    const r = detectarParedes(g, w, h, { minimo: 0.15 });
    expect(r.paredes.some((s) => s[1] === s[3] && Math.abs(s[1] - 202.5) <= 3)).toBe(false);
    expect(r.paredes.some((s) => s[0] === s[2] && Math.abs(s[0] - 200) <= 3)).toBe(true);
  });

  it("moldura de papel (linha fina longe da borda, com papel claro por fora) não vira parede", () => {
    const w = 500;
    const h = 400;
    const g = new Uint8Array(w * h).fill(210);
    const traco = (x1: number, y1: number, x2: number, y2: number) => {
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) g[y * w + x] = 40;
    };
    traco(30, 20, 470, 24); // moldura de cima: 20 px da borda, com papel por fora
    traco(120, 150, 124, 330); // uma parede de verdade, no meio
    traco(120, 150, 300, 154);
    const r = detectarParedes(g, w, h, { minimo: 0.12 });
    expect(r.paredes.some((s) => s[1] === s[3] && s[1] < 60)).toBe(false);
    expect(r.paredes.some((s) => s[0] === s[2] && Math.abs(s[0] - 122) <= 3)).toBe(true);
  });

  it("parede que encosta na borda da imagem fica (não é moldura)", () => {
    const w = 500;
    const h = 400;
    const g = new Uint8Array(w * h).fill(210);
    for (let y = 0; y <= 5; y++) for (let x = 0; x < w; x++) g[y * w + x] = 40; // parede colada no topo
    const r = detectarParedes(g, w, h, { minimo: 0.12 });
    expect(r.paredes.some((s) => s[1] === s[3] && s[1] < 10)).toBe(true);
  });

  it("contorno claro sobre fundo escuro: só sai com linhas: \"claras\"", () => {
    const w = 400;
    const h = 300;
    const g = new Uint8Array(w * h).fill(45);
    const traco = (x1: number, y1: number, x2: number, y2: number) => {
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) g[y * w + x] = 225;
    };
    traco(60, 50, 340, 54); // topo
    traco(60, 246, 340, 250); // base
    traco(60, 50, 64, 250); // esquerda
    traco(336, 50, 340, 250); // direita
    const claras = detectarParedes(g, w, h, { minimo: 0.15, linhas: "claras" });
    expect(claras.paredes.some((s) => s[1] === s[3] && Math.abs(s[1] - 52.5) <= 3)).toBe(true);
    expect(claras.paredes.some((s) => s[0] === s[2] && Math.abs(s[0] - 62.5) <= 3)).toBe(true);
    const escuras = detectarParedes(g, w, h, { minimo: 0.15 });
    expect(escuras.paredes.some((s) => s[1] === s[3] && Math.abs(s[1] - 52.5) <= 3)).toBe(false);
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

  it("sensibilidade: níveis mais altos aceitam mais linhas, e a parte pesada se reaproveita", () => {
    const { g, w, h } = mapaSintetico();
    // Uma parede curta (35 px) entre as salas: só o nível alto enxerga.
    for (let y = 150; y <= 154; y++) for (let x = 250; x <= 285; x++) g[y * w + x] = 40;
    const pesada = prepararDeteccao(g, w, h, { comp: NIVEIS_DE_SENSIBILIDADE[5].comp });
    const baixo = aplicarDeteccao(pesada, { minimo: NIVEIS_DE_SENSIBILIDADE[2].minimo, razao: NIVEIS_DE_SENSIBILIDADE[2].razao, curvas: false });
    const alto = aplicarDeteccao(pesada, { minimo: NIVEIS_DE_SENSIBILIDADE[5].minimo, razao: NIVEIS_DE_SENSIBILIDADE[5].razao, curvas: false });
    expect(alto.paredes.length).toBeGreaterThan(baixo.paredes.length);
    expect(alto.paredes.some((s) => s[1] === s[3] && Math.abs(s[1] - 152.5) <= 3)).toBe(true);
    expect(baixo.paredes.some((s) => s[1] === s[3] && Math.abs(s[1] - 152.5) <= 3)).toBe(false);
  });
});
