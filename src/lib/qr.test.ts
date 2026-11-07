import { describe, expect, it } from "vitest";
import { desenharQr } from "./qr";

describe("desenharQr", () => {
  it("o link do telão cabe num QR pequeno e quadrado", () => {
    const { lado, caminho } = desenharQr("https://painel-de-mesa.vercel.app/?sala=setimo-raio&telao=1");
    // Versão 1 tem 21 módulos por lado e cada versão acrescenta 4: lado = 17 + 4 * versão.
    expect((lado - 17) % 4).toBe(0);
    expect(lado).toBeLessThanOrEqual(41);
    expect(caminho.startsWith("M")).toBe(true);
  });

  it("os três cantos de posição aparecem (quadrado 7x7 com a borda cheia)", () => {
    const { lado, caminho } = desenharQr("https://exemplo.com");
    const escuros = new Set(Array.from(caminho.matchAll(/M(\d+) (\d+)h1v1h-1z/g), (m) => `${m[1]},${m[2]}`));
    for (const [ox, oy] of [
      [0, 0],
      [lado - 7, 0],
      [0, lado - 7],
    ]) {
      for (let i = 0; i < 7; i++) {
        expect(escuros.has(`${ox + i},${oy}`)).toBe(true); // linha de cima
        expect(escuros.has(`${ox},${oy + i}`)).toBe(true); // coluna da esquerda
        expect(escuros.has(`${ox + 6},${oy + i}`)).toBe(true); // coluna da direita
        expect(escuros.has(`${ox + i},${oy + 6}`)).toBe(true); // linha de baixo
      }
    }
  });

  it("textos diferentes dão desenhos diferentes", () => {
    expect(desenharQr("a").caminho).not.toBe(desenharQr("b").caminho);
  });
});
