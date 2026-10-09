import { describe, expect, it } from "vitest";
import {
  ATRIBUTOS_DA_SALVAGUARDA,
  bonusDaSalvaguarda,
  danoNoAlvo,
  lerDanoDaSalvaguarda,
  linhaDaSalvaguarda,
  rolarDanoDoEfeito,
  rolarSalvaguardas,
  rotuloDoDano,
} from "./salvaguarda";

/** Dado viciado: devolve os números combinados, na ordem. */
const sequencia = (...valores: number[]) => {
  let i = 0;
  return () => valores[i++ % valores.length];
};

describe("lerDanoDaSalvaguarda", () => {
  it("entende dado com tipo, com modificador e vários tipos", () => {
    expect(lerDanoDaSalvaguarda("8d6 fogo")).toEqual({ ok: true, partes: [{ qtd: 8, faces: 6, mod: 0, tipo: "fogo" }] });
    expect(lerDanoDaSalvaguarda("2d8+4")).toEqual({ ok: true, partes: [{ qtd: 2, faces: 8, mod: 4, tipo: "" }] });
    const dois = lerDanoDaSalvaguarda("3d6 frio + 1d6 trovão");
    expect(dois.ok && dois.partes.map((p) => [p.qtd, p.tipo])).toEqual([[3, "frio"], [1, "trovão"]]);
  });
  it("número solto é dano fixo; vazio é efeito sem dano", () => {
    expect(lerDanoDaSalvaguarda("12")).toEqual({ ok: true, partes: [{ qtd: 0, faces: 0, mod: 12, tipo: "" }] });
    expect(lerDanoDaSalvaguarda("   ")).toEqual({ ok: true, partes: [] });
  });
  it("recusa lixo, zero e dado exagerado", () => {
    for (const ruim of ["fogo", "0", "oito d seis", "999d6", "2d1", "2d500"]) {
      expect(lerDanoDaSalvaguarda(ruim).ok, ruim).toBe(false);
    }
  });
});

describe("rolarDanoDoEfeito", () => {
  it("soma os dados e o modificador de todas as partes", () => {
    const partes = [
      { qtd: 2, faces: 6, mod: 3, tipo: "fogo" },
      { qtd: 1, faces: 4, mod: 0, tipo: "" },
    ];
    expect(rolarDanoDoEfeito(partes, sequencia(5, 2, 4))).toEqual({ dados: [5, 2, 4], total: 14 });
  });
  it("dano fixo não rola dado e nunca fica negativo", () => {
    expect(rolarDanoDoEfeito([{ qtd: 0, faces: 0, mod: 9, tipo: "" }], sequencia(1))).toEqual({ dados: [], total: 9 });
    expect(rolarDanoDoEfeito([{ qtd: 1, faces: 4, mod: -9, tipo: "" }], sequencia(2)).total).toBe(0);
  });
});

describe("rolarSalvaguardas", () => {
  it("passa quem chega na CD (empate passa) e cada alvo usa o próprio bônus", () => {
    const r = rolarSalvaguardas(
      [{ id: "a", bonus: 2 }, { id: "b", bonus: 0 }, { id: "c", bonus: -1 }],
      15,
      sequencia(13, 14, 16),
    );
    expect(r.map((x) => [x.id, x.total, x.passou])).toEqual([["a", 15, true], ["b", 14, false], ["c", 15, true]]);
  });
  it("20 natural não passa sozinho e 1 natural não falha sozinho (regra de 2024)", () => {
    const [vinte] = rolarSalvaguardas([{ id: "a", bonus: -5 }], 20, sequencia(20));
    expect(vinte.passou).toBe(false);
    const [um] = rolarSalvaguardas([{ id: "a", bonus: 20 }], 15, sequencia(1));
    expect(um.passou).toBe(true);
  });
});

describe("danoNoAlvo", () => {
  it("falhou leva tudo; passou leva metade (pra baixo), nada ou tudo conforme o efeito", () => {
    expect(danoNoAlvo(27, false, "metade")).toBe(27);
    expect(danoNoAlvo(27, true, "metade")).toBe(13);
    expect(danoNoAlvo(27, true, "nada")).toBe(0);
    expect(danoNoAlvo(27, true, "tudo")).toBe(27);
    expect(danoNoAlvo(1, true, "metade")).toBe(0);
  });
});

describe("bonusDaSalvaguarda", () => {
  const ficha = { save_str: 1, save_dex: 5, save_con: 2, save_int: 0, save_wis: -1, save_cha: 3 };
  it("lê o campo certo de cada atributo (sab = save_wis)", () => {
    expect(bonusDaSalvaguarda(ficha, "des")).toBe(5);
    expect(bonusDaSalvaguarda(ficha, "sab")).toBe(-1);
    expect(bonusDaSalvaguarda(ficha, "for")).toBe(1);
  });
  it("cobre os seis atributos sem repetir campo", () => {
    expect(new Set(ATRIBUTOS_DA_SALVAGUARDA.map((a) => a.campo)).size).toBe(6);
  });
});

describe("textos", () => {
  it("rotuloDoDano junta os tipos", () => {
    expect(rotuloDoDano([{ qtd: 1, faces: 6, mod: 0, tipo: "fogo" }, { qtd: 1, faces: 6, mod: 0, tipo: "fogo" }])).toBe("fogo");
    expect(rotuloDoDano([{ qtd: 1, faces: 6, mod: 0, tipo: "frio" }, { qtd: 1, faces: 6, mod: 0, tipo: "trovão" }])).toBe("frio e trovão");
    expect(rotuloDoDano([{ qtd: 1, faces: 6, mod: 0, tipo: "" }])).toBe("");
  });
  it("a linha do log só tem a contagem, sem nome de ninguém", () => {
    expect(linhaDaSalvaguarda("des", 15, 2, 3)).toBe("🎲 Salvaguarda de Destreza (CD 15): 2 passaram, 3 falharam");
    expect(linhaDaSalvaguarda("con", 10, 1, 1)).toBe("🎲 Salvaguarda de Constituição (CD 10): 1 passou, 1 falhou");
  });
});
