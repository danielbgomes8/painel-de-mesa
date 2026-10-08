import { describe, expect, it } from "vitest";
import { afinar, simplificar } from "./detectarCurvas";
import { detectarParedes } from "./detectarParedes";

describe("afinar", () => {
  it("uma faixa grossa vira um fio de 1 px no meio dela", () => {
    const w = 60;
    const h = 30;
    const m = new Uint8Array(w * h);
    for (let y = 10; y <= 16; y++) for (let x = 5; x <= 54; x++) m[y * w + x] = 1; // 7 px de espessura
    afinar(m, w, h);
    const ys = new Set<number>();
    for (let y = 0; y < h; y++) for (let x = 12; x <= 47; x++) if (m[y * w + x]) ys.add(y);
    expect(ys.size).toBeLessThanOrEqual(2);
    expect([...ys].every((y) => y >= 12 && y <= 14)).toBe(true);
  });
});

describe("simplificar", () => {
  it("uma reta vira dois pontos; um L mantém o canto", () => {
    const reta: [number, number][] = Array.from({ length: 20 }, (_, i) => [i, 2 * i]);
    expect(simplificar(reta, 1)).toEqual([[0, 0], [19, 38]]);
    const ele: [number, number][] = [...Array.from({ length: 10 }, (_, i) => [i, 0] as [number, number]), ...Array.from({ length: 10 }, (_, i) => [9, i + 1] as [number, number])];
    expect(simplificar(ele, 1)).toEqual([[0, 0], [9, 0], [9, 10]]);
  });
});

describe("curvas no detector", () => {
  /** Um anel escuro de raio 80 (traço de 5 px) num chão claro, sem nenhuma reta. */
  function anel() {
    const w = 300;
    const h = 300;
    const g = new Uint8Array(w * h);
    for (let i = 0; i < g.length; i++) g[i] = 205 + ((i * 7919) % 11);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - 150, y - 150);
        if (Math.abs(d - 80) <= 2.5) g[y * w + x] = 35;
      }
    return { g, w, h };
  }

  it("uma sala redonda sai como trechos que seguem o círculo", () => {
    const { g, w, h } = anel();
    const r = detectarParedes(g, w, h, { minimo: 0.12 });
    const oblicuas = r.paredes.filter((s) => s[0] !== s[2] && s[1] !== s[3]);
    expect(oblicuas.length).toBeGreaterThanOrEqual(6);
    for (const s of r.paredes) {
      for (const [x, y] of [[s[0], s[1]], [s[2], s[3]]]) expect(Math.abs(Math.hypot(x - 150, y - 150) - 80)).toBeLessThanOrEqual(6);
    }
  });

  it("com curvas desligadas, nenhum trecho inclinado (só os pedaços retos do topo, base e lados)", () => {
    const { g, w, h } = anel();
    const r = detectarParedes(g, w, h, { curvas: false });
    expect(r.paredes.filter((s) => s[0] !== s[2] && s[1] !== s[3])).toHaveLength(0);
  });
});
