import { describe, expect, it } from "vitest";
import { lerAtaquesRolaveis } from "./regras";
import {
  ataqueNovo,
  calcularAtaque,
  dadoValido,
  normalizarAtaque,
  normalizarAtaques,
  textoDosAtaques,
  textoEfetivoDeAtaques,
} from "./ataquesFicha";
import type { AtaqueFicha, Atributos } from "./tipos";

const atributos: Atributos = { for: 18, des: 14, con: 12, int: 8, sab: 10, car: 16 };
const espada: AtaqueFicha = { nome: "Espada longa", atributo: "for", proficiente: true, bonusAcerto: 0, dado: "1d8", bonusDano: 0, tipo: "cortante" };

describe("cálculo do ataque", () => {
  it("acerto = modificador + proficiência; dano = dado + modificador", () => {
    // FOR 18 = +4; nível 5 = proficiência +3
    expect(calcularAtaque(espada, atributos, 5)).toEqual({ acerto: 7, dano: "1d8+4 cortante" });
    // nível 1 = +2
    expect(calcularAtaque(espada, atributos, 1).acerto).toBe(6);
  });

  it("proficiência só entra no acerto; bônus extra de acerto e de dano são separados", () => {
    const magica = { ...espada, bonusAcerto: 1, bonusDano: 1 };
    expect(calcularAtaque(magica, atributos, 5)).toEqual({ acerto: 8, dano: "1d8+5 cortante" });
    const semProf = { ...espada, proficiente: false };
    expect(calcularAtaque(semProf, atributos, 5)).toEqual({ acerto: 4, dano: "1d8+4 cortante" });
  });

  it("modificador negativo e soma zero", () => {
    const fraco = { ...espada, atributo: "int" as const };
    expect(calcularAtaque(fraco, atributos, 1)).toEqual({ acerto: 1, dano: "1d8-1 cortante" });
    expect(calcularAtaque({ ...fraco, bonusDano: 1 }, atributos, 1).dano).toBe("1d8 cortante");
  });

  it("sem atributo (ataque fixo) usa só proficiência e os bônus", () => {
    const fixo = { ...espada, atributo: null, bonusAcerto: 2, bonusDano: 3 };
    expect(calcularAtaque(fixo, atributos, 5)).toEqual({ acerto: 5, dano: "1d8+3 cortante" });
  });

  it("sem dado, só o acerto; nível 0 (sem classe) conta como 1", () => {
    expect(calcularAtaque({ ...espada, dado: "" }, atributos, 0)).toEqual({ acerto: 6, dano: "" });
  });
});

describe("texto compatível com o rolador da iniciativa", () => {
  it("o texto gerado é lido por lerAtaquesRolaveis com o mesmo acerto e dano", () => {
    const lista: AtaqueFicha[] = [espada, { ...espada, nome: "Adaga fraca", atributo: "int", proficiente: false, dado: "1d4", tipo: "perfurante" }];
    const texto = textoDosAtaques(lista, atributos, 5);
    expect(texto).toBe("Espada longa: +7, 1d8+4 cortante\nAdaga fraca: -1, 1d4-1 perfurante");
    const lido = lerAtaquesRolaveis(texto).ataques;
    expect(lido.map((a) => a.nome)).toEqual(["Espada longa", "Adaga fraca"]);
    expect(lido.map((a) => a.bonus)).toEqual([7, -1]);
    expect(lido[0].partes[0]).toMatchObject({ qtd: 1, faces: 8, mod: 4, tipo: "cortante" });
    expect(lido[1].partes[0]).toMatchObject({ qtd: 1, faces: 4, mod: -1 });
  });

  it("ataque sem dado e sem nome ainda gera uma linha", () => {
    const texto = textoDosAtaques([{ ...espada, nome: "", dado: "" }], atributos, 5);
    expect(texto).toBe("Ataque: +7");
  });

  it("junta os calculados com o texto livre antigo; NPC só usa o livre", () => {
    const base = { atributos, classes: [{ nivel: 5 }], is_npc: false };
    expect(textoEfetivoDeAtaques({ ...base, ataques: [espada], ataque: "Malho +1: +7, 2d6+9" })).toBe(
      "Espada longa: +7, 1d8+4 cortante\nMalho +1: +7, 2d6+9",
    );
    expect(textoEfetivoDeAtaques({ ...base, ataque: "Malho +1: +7, 2d6+9" })).toBe("Malho +1: +7, 2d6+9");
    expect(textoEfetivoDeAtaques({ ...base, ataques: [espada], ataque: "Garra +5, 2d6+3", is_npc: true })).toBe("Garra +5, 2d6+3");
    expect(textoEfetivoDeAtaques({ ...base, ataques: undefined, ataque: undefined })).toBe("");
  });

  it("subir a Força muda o texto sozinho (nada guardado)", () => {
    const base = { ataques: [espada], classes: [{ nivel: 5 }], is_npc: false };
    expect(textoEfetivoDeAtaques({ ...base, atributos })).toContain("+7, 1d8+4");
    expect(textoEfetivoDeAtaques({ ...base, atributos: { ...atributos, for: 20 } })).toContain("+8, 1d8+5");
  });
});

describe("normalizar do banco", () => {
  it("coluna ausente ou lixo vira lista vazia", () => {
    expect(normalizarAtaques(undefined)).toEqual([]);
    expect(normalizarAtaques("x")).toEqual([]);
  });

  it("corrige o que veio estragado", () => {
    const a = normalizarAtaque({ nome: 5, atributo: "xx", proficiente: "sim", bonusAcerto: 999, dado: "tres d8", bonusDano: Number.NaN, tipo: "x".repeat(99) });
    expect(a).toMatchObject({ nome: "", atributo: null, proficiente: false, bonusAcerto: 30, dado: "", bonusDano: 0 });
    expect(a.tipo).toHaveLength(30);
  });

  it("dado válido", () => {
    expect(["1d8", "2d6", "1D12", "10d10"].every(dadoValido)).toBe(true);
    expect(["d8", "0d6", "1d0", "1d8+2", "", "abc"].some(dadoValido)).toBe(false);
  });

  it("ataque novo já calcula alguma coisa útil", () => {
    expect(calcularAtaque(ataqueNovo(), atributos, 1).dano).toBe("1d8+4");
  });
});
