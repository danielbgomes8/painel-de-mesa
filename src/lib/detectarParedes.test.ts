import { describe, expect, it } from "vitest";
import {
  NIVEIS_DE_SENSIBILIDADE,
  aplicarComCor,
  aplicarDeteccao,
  comoTextoDeImportacao,
  detectarParedes,
  prepararDeteccao,
  rgbaParaCinza,
  rgbaParaSaturacao,
  unirDeteccoes,
} from "./detectarParedes";

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
  it("acha as paredes retas e a porta desenhada no vão, sem depender de fundo preto", () => {
    const { g, w, h } = mapaSintetico();
    // A folha da porta: um traço fino e bem mais fraco que a parede, no vão da divisória.
    for (let y = 112; y <= 138; y++) for (let x = 199; x <= 201; x++) g[y * w + x] = 150;
    const r = detectarParedes(g, w, h, { minimo: 0.15 });
    const vertical = r.paredes.filter((s) => s[0] === s[2]);
    expect(vertical.some((s) => Math.abs(s[0] - 200) <= 3)).toBe(true);
    expect(r.paredes.filter((s) => s[1] === s[3]).length).toBeGreaterThanOrEqual(2);
    const porta = r.portas.find((s) => Math.abs(s[0] - 200) <= 3);
    expect(porta).toBeDefined();
    expect(porta![1]).toBeGreaterThan(100);
    expect(porta![3]).toBeLessThan(150);
  });

  it("vão de chão liso é passagem aberta: não vira porta", () => {
    const { g, w, h } = mapaSintetico();
    const r = detectarParedes(g, w, h, { minimo: 0.15 });
    expect(r.paredes.filter((s) => s[0] === s[2] && Math.abs(s[0] - 200) <= 3).length).toBeGreaterThanOrEqual(1);
    expect(r.portas.some((s) => Math.abs(s[0] - 200) <= 3)).toBe(false);
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

  it("parede clara de contraste modesto (pedra bege sobre chão marrom) sai com linhas: \"claras\"", () => {
    // Os números do labirinto de verdade: chão ~85, parede ~136 (só 1,6× mais clara).
    const w = 400;
    const h = 300;
    const g = new Uint8Array(w * h);
    for (let i = 0; i < g.length; i++) g[i] = 82 + ((i * 7919) % 7);
    const traco = (x1: number, y1: number, x2: number, y2: number) => {
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) g[y * w + x] = 136;
    };
    traco(40, 60, 360, 65);
    traco(40, 60, 45, 240);
    const n = NIVEIS_DE_SENSIBILIDADE[4];
    const r = aplicarDeteccao(prepararDeteccao(g, w, h, { linhas: "claras", comp: n.comp, limiar: n.limiar }), { minimo: n.minimo, razao: n.razao, curvas: false });
    expect(r.paredes.some((s) => s[1] === s[3] && Math.abs(s[1] - 62.5) <= 3)).toBe(true);
    expect(r.paredes.some((s) => s[0] === s[2] && Math.abs(s[0] - 42.5) <= 3)).toBe(true);
  });

  it("duas paredes na mesma linha, com um corredor entre elas, não viram uma parede só", () => {
    const { g, w, h } = mapaSintetico();
    // Mesma altura (y = 150), separadas por 30 px de chão: é um corredor, a linha não pode atravessar.
    for (let y = 148; y <= 152; y++) {
      for (let x = 60; x <= 120; x++) g[y * w + x] = 40;
      for (let x = 150; x <= 190; x++) g[y * w + x] = 40;
    }
    const n = NIVEIS_DE_SENSIBILIDADE[5];
    const r = aplicarDeteccao(prepararDeteccao(g, w, h, { comp: n.comp, limiar: n.limiar }), { minimo: n.minimo, razao: n.razao, curvas: false });
    const naLinha = r.paredes.filter((s) => s[1] === s[3] && Math.abs(s[1] - 150) <= 3);
    expect(naLinha.length).toBeGreaterThanOrEqual(2);
    // Nenhum trecho cobre o meio do corredor (x = 135).
    expect(naLinha.some((s) => s[0] < 130 && s[2] > 140)).toBe(false);
  });

  it("saturação: cinza dá 0, cor viva dá 255", () => {
    expect(Array.from(rgbaParaSaturacao(new Uint8Array([120, 120, 120, 255, 200, 0, 0, 255, 200, 100, 100, 255]), 3, 1))).toEqual([0, 255, 128]);
  });

  it("unir: o trecho que repete uma parede da primeira leitura sai; o que é novo entra", () => {
    const a = { largura: 100, altura: 100, paredes: [[10, 20, 90, 20]] as [number, number, number, number][], portas: [] };
    const b = { largura: 100, altura: 100, paredes: [[15, 23, 80, 23], [50, 30, 50, 90], [10, 20, 10, 28]] as [number, number, number, number][], portas: [] };
    const u = unirDeteccoes(a, b, 5);
    expect(u.paredes).toEqual([[10, 20, 90, 20], [50, 30, 50, 90], [10, 20, 10, 28]]); // a perpendicular curtinha NÃO é repetição
  });

  it("parede com o mesmo brilho do chão, mas menos cor, sai pela leitura da cor", () => {
    // Chão marrom vivo e parede bege: brilho igual (140), saturação 150 contra 115 — o miolo do labirinto de verdade.
    const w = 400;
    const h = 300;
    const brilho = new Uint8Array(w * h).fill(140);
    const cor = new Uint8Array(w * h);
    for (let i = 0; i < cor.length; i++) cor[i] = 148 + ((i * 7919) % 5);
    for (let y = 100; y <= 105; y++) for (let x = 60; x <= 340; x++) cor[y * w + x] = 115;
    const n = NIVEIS_DE_SENSIBILIDADE[5];
    const r = aplicarComCor(
      prepararDeteccao(brilho, w, h, { linhas: "claras", comp: n.comp, limiar: n.limiar, limiarLocal: n.limiarLocal }),
      prepararDeteccao(cor, w, h, { linhas: "escuras", comp: n.comp, limiar: 0.6, limiarLocal: 0.4 }),
      { minimo: n.minimo, razao: n.razao, curvas: false },
    );
    expect(r.paredes.some((s) => s[1] === s[3] && Math.abs(s[1] - 102.5) <= 3 && s[2] - s[0] > 200)).toBe(true);
  });
});
