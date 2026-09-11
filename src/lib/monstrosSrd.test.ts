import { describe, expect, it } from "vitest";
import { MONSTROS_SRD, buscarMonstros } from "./monstrosSrd";

const nomes = (termo: string) => buscarMonstros(termo).map((m) => m.name);

describe("buscarMonstros", () => {
  it("acha sem acento, como se digita no celular", () => {
    expect(nomes("manticora")).toContain("Mantícora");
    expect(nomes("dragao")).toContain("Dragão azul jovem");
  });

  it("acha por tipo, não só por nome", () => {
    expect(nomes("morto-vivo")).toContain("Lich");
    expect(nomes("gigante")).toContain("Gigante do fogo");
  });

  it("ignora caixa e espaço em volta", () => {
    expect(nomes("  GOBLIN ")).toEqual(nomes("goblin"));
  });

  it("devolve vazio sem termo, pra não despejar o catálogo inteiro na tela", () => {
    expect(buscarMonstros("")).toEqual([]);
    expect(buscarMonstros("   ")).toEqual([]);
  });

  it("devolve vazio quando não existe", () => {
    expect(buscarMonstros("tarrasque")).toEqual([]);
  });

  it("não tem nome repetido no catálogo (nome é a chave da lista)", () => {
    expect(new Set(MONSTROS_SRD.map((m) => m.name)).size).toBe(MONSTROS_SRD.length);
  });

  it("todo monstro tem tipo e nota preenchidos", () => {
    for (const m of MONSTROS_SRD) {
      expect(m.cls, m.name).not.toBe("");
      expect(m.notes, m.name).not.toBe("");
    }
  });
});
