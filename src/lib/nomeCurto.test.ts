import { describe, expect, it } from "vitest";
import { nomeCurtoDoTelao } from "./nomeCurto";

describe("nome curto no telão", () => {
  it("nome comprido vira só o primeiro nome", () => {
    expect(nomeCurtoDoTelao("Thorgrim Martelo de Pedra")).toBe("Thorgrim");
  });
  it("nome curto fica inteiro", () => {
    expect(nomeCurtoDoTelao("Clérigo Teste")).toBe("Clérigo Teste");
    expect(nomeCurtoDoTelao("Inimigo 3")).toBe("Inimigo 3");
  });
  it("mantém o número que distingue inimigos iguais", () => {
    expect(nomeCurtoDoTelao("Goblin Batedor Chefe 2")).toBe("Goblin 2");
  });
  it("uma palavra só comprida não é cortada", () => {
    expect(nomeCurtoDoTelao("Anticonstitucionalissimamente")).toBe("Anticonstitucionalissimamente");
  });
  it("espaços sobrando não atrapalham", () => {
    expect(nomeCurtoDoTelao("  Thorgrim   Martelo de Pedra ")).toBe("Thorgrim");
  });
});
