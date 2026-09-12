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

  it("todo monstro tem tipo, nota e ataque preenchidos", () => {
    for (const m of MONSTROS_SRD) {
      expect(m.cls, m.name).not.toBe("");
      expect(m.notes, m.name).not.toBe("");
      expect(m.ataque, m.name).not.toBe("");
    }
  });

  // Guarda de edição: o catálogo já esteve com números de 2014 num app que joga
  // 2024. Estes três valores mudaram entre as edições — se alguém voltar a
  // copiar de fonte antiga, o teste quebra em vez de passar despercebido.
  it("os números são da edição 2024, não da anterior", () => {
    const pega = (nome: string) => MONSTROS_SRD.find((m) => m.name === nome)!;
    expect(pega("Goblin").hp_max, "Goblin tinha 7 PV em 2014, tem 10 em 2024").toBe(10);
    expect(pega("Zumbi").hp_max, "Zumbi tinha 22 PV em 2014, tem 15 em 2024").toBe(15);
    expect(pega("Lich").init_mod, "em 2024 a iniciativa é bônus próprio, não o mod de Destreza").toBe(17);
  });

  it("toda linha de ataque tem bônus de acerto e dado de dano", () => {
    for (const m of MONSTROS_SRD) {
      expect(m.ataque, `${m.name} sem bônus de acerto`).toMatch(/[+-]\d+/);
      expect(m.ataque, `${m.name} sem dado de dano`).toMatch(/\d+d\d+/);
    }
  });
});
