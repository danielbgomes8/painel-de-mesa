import { describe, expect, it } from "vitest";
import { contornos, detectarContorno, distanciaDoFundo } from "./detectarContorno";

/** Fundo preto; duas salas de 120×120 ligadas por um corredor de 24 px de largura e 100 de comprimento. */
function duasSalas() {
  const w = 460;
  const h = 220;
  const d = new Uint8Array(w * h); // distância do fundo: 0 = fundo
  const encher = (x1: number, y1: number, x2: number, y2: number) => {
    for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) d[y * w + x] = 120;
  };
  encher(40, 50, 160, 170); // sala da esquerda
  encher(260, 50, 380, 170); // sala da direita
  encher(160, 98, 260, 122); // corredor
  return { d, w, h };
}

describe("contornos", () => {
  it("um retângulo dá uma volta fechada que passa pelos quatro cantos", () => {
    const w = 20;
    const h = 12;
    const m = new Uint8Array(w * h);
    for (let y = 3; y < 9; y++) for (let x = 4; x < 15; x++) m[y * w + x] = 1;
    const voltas = contornos(m, w, h);
    expect(voltas).toHaveLength(1);
    const tem = (x: number, y: number) => voltas[0].some((p) => p[0] === x && p[1] === y);
    expect(tem(4, 3) && tem(15, 3) && tem(15, 9) && tem(4, 9)).toBe(true);
    expect(voltas[0]).toHaveLength(2 * (11 + 6));
  });

  it("um buraco dentro do mapa ganha a volta dele", () => {
    const w = 30;
    const h = 30;
    const m = new Uint8Array(w * h);
    for (let y = 5; y < 25; y++) for (let x = 5; x < 25; x++) m[y * w + x] = 1;
    for (let y = 12; y < 18; y++) for (let x = 12; x < 18; x++) m[y * w + x] = 0;
    expect(contornos(m, w, h)).toHaveLength(2);
  });
});

describe("detectarContorno", () => {
  it("contorna as salas por fora e marca as duas saídas do corredor como portas", () => {
    const { d, w, h } = duasSalas();
    const r = detectarContorno(d, w, h);
    // Toda parede fica na borda do desenho (a até 3 px dela) — nenhuma corta o chão.
    const naBorda = (x: number, y: number) => {
      const dentro = (px: number, py: number) => px >= 0 && py >= 0 && px < w && py < h && d[Math.round(py) * w + Math.round(px)] > 0;
      let fora = false;
      let chao = false;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          if (dentro(x + dx, y + dy)) chao = true;
          else fora = true;
        }
      return fora && chao;
    };
    expect(r.paredes.length).toBeGreaterThanOrEqual(12);
    for (const s of r.paredes) {
      expect(naBorda(s[0], s[1])).toBe(true);
      expect(naBorda((s[0] + s[2]) / 2, (s[1] + s[3]) / 2)).toBe(true);
    }
    // Duas portas, uma em cada ponta do corredor, de parede a parede (24 px), em pé.
    expect(r.portas).toHaveLength(2);
    const xs = r.portas.map((s) => (s[0] + s[2]) / 2).sort((a, b) => a - b);
    expect(Math.abs(xs[0] - 160)).toBeLessThanOrEqual(12);
    expect(Math.abs(xs[1] - 260)).toBeLessThanOrEqual(12);
    for (const s of r.portas) {
      expect(Math.abs(s[0] - s[2])).toBeLessThanOrEqual(3);
      expect(Math.abs(Math.abs(s[3] - s[1]) - 24)).toBeLessThanOrEqual(3);
    }
  });

  it("canto de sala e sala sem saída não ganham porta", () => {
    const w = 300;
    const h = 300;
    const d = new Uint8Array(w * h);
    for (let y = 60; y < 240; y++) for (let x = 60; x < 240; x++) d[y * w + x] = 120;
    const r = detectarContorno(d, w, h);
    expect(r.portas).toHaveLength(0);
    expect(r.paredes).toHaveLength(4);
  });

  it("cabe no teto pedido, afrouxando o contorno", () => {
    const w = 400;
    const h = 400;
    const d = new Uint8Array(w * h);
    // Um círculo: o contorno fiel teria dezenas de trechos.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.hypot(x - 200, y - 200) < 150) d[y * w + x] = 120;
    expect(detectarContorno(d, w, h, { maximo: 12 }).paredes.length).toBeLessThanOrEqual(12);
    expect(detectarContorno(d, w, h).paredes.length).toBeGreaterThan(12);
  });
});

describe("distanciaDoFundo", () => {
  const rgba = (w: number, h: number, cor: (x: number, y: number) => [number, number, number]) => {
    const a = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const [r, g, b] = cor(x, y);
        a.set([r, g, b, 255], (y * w + x) * 4);
      }
    return a;
  };

  it("mapa sobre preto: fundo liso, e o desenho fica longe do fundo", () => {
    const w = 200;
    const h = 200;
    const r = distanciaDoFundo(rgba(w, h, (x, y) => (x > 50 && x < 150 && y > 50 && y < 150 ? [110, 100, 90] : [2, 2, 2])), w, h);
    expect(r.fundoLiso).toBe(true);
    expect(r.distancia[100 * w + 100]).toBeGreaterThan(100);
    expect(r.distancia[10 * w + 10]).toBeLessThanOrEqual(2);
  });

  it("mapa que ocupa a imagem toda (cantos diferentes entre si) não tem fundo liso", () => {
    const w = 200;
    const h = 200;
    expect(distanciaDoFundo(rgba(w, h, (x, y) => [(x * 7 + y * 13) % 200, (x * 3) % 180, (y * 5) % 160]), w, h).fundoLiso).toBe(false);
  });
});
