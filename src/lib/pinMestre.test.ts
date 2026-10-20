import { describe, expect, it } from "vitest";
import { hashDoPin, limparPin, pinConfere, pinValido } from "./pinMestre";

describe("PIN do Mestre", () => {
  it("aceita só 4 a 6 dígitos", () => {
    expect(pinValido("1234")).toBe(true);
    expect(pinValido("123456")).toBe(true);
    expect(pinValido("123")).toBe(false);
    expect(pinValido("1234567")).toBe(false);
    expect(pinValido("12a4")).toBe(false);
    expect(pinValido("")).toBe(false);
  });

  it("limpa o que foi colado", () => {
    expect(limparPin("12 34")).toBe("1234");
    expect(limparPin("ab9-8x7y6z5432")).toBe("987654");
  });

  it("o valor guardado depende da sala e do PIN", async () => {
    const a = await hashDoPin("salamina", "1234");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(await hashDoPin("salamina", "1234"));
    expect(a).not.toBe(await hashDoPin("outra-mesa", "1234"));
    expect(a).not.toBe(await hashDoPin("salamina", "1235"));
  });

  it("confere o PIN; sem PIN guardado, deixa entrar", async () => {
    const guardado = await hashDoPin("salamina", "4321");
    expect(await pinConfere("salamina", "4321", guardado)).toBe(true);
    expect(await pinConfere("salamina", "0000", guardado)).toBe(false);
    expect(await pinConfere("salamina", "", null)).toBe(true);
    expect(await pinConfere("salamina", "", "")).toBe(true);
  });
});
