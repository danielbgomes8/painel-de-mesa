import { describe, expect, it } from "vitest";
import {
  capacidadeDeCarga,
  dividirMoedas,
  formatarKg,
  itemDoBauParaInventario,
  itemNovo,
  juntarItem,
  moedasDoBau,
  moedasVazias,
  normalizarInventario,
  normalizarItem,
  normalizarItemBau,
  normalizarMoedas,
  objetosDoBau,
  pesoCarregado,
  sintonizados,
  somarMoedas,
  textoMoedas,
  tirarMoedas,
  tirarQuantidade,
  valorEmPo,
  type ItemBau,
} from "./inventario";
import type { ItemInventario } from "./tipos";

const item = (extra: Partial<ItemInventario> = {}): ItemInventario => ({ ...itemNovo("Corda"), ...extra });

describe("normalizar o que vem do banco", () => {
  it("linha de antes da migration (sem o campo) vira vazio, não quebra", () => {
    expect(normalizarMoedas(undefined)).toEqual(moedasVazias());
    expect(normalizarMoedas(null)).toEqual(moedasVazias());
    expect(normalizarInventario(undefined)).toEqual([]);
    expect(normalizarInventario("lixo")).toEqual([]);
  });

  it("moeda: inteira, não negativa, só as cinco", () => {
    expect(normalizarMoedas({ po: 12.6, pp: -3, pc: "7", xx: 99, pl: "abc" })).toEqual({
      pc: 7,
      pp: 0,
      pe: 0,
      po: 13,
      pl: 0,
    });
  });

  it("item: peso com vírgula, quantidade inteira, sintonia só em item mágico", () => {
    const i = normalizarItem({ nome: "Cajado", qtd: 2.4, peso: "1,5", magico: false, sintonia: 2, equipado: true });
    expect(i).toMatchObject({ nome: "Cajado", qtd: 2, peso: 1.5, magico: false, sintonia: 0, equipado: true });
    expect(normalizarItem({ nome: "Anel", magico: true, sintonia: 2 }).sintonia).toBe(2);
    expect(normalizarItem({ nome: "Anel", magico: true, sintonia: 7 }).sintonia).toBe(0);
  });
});

describe("moedas", () => {
  it("valor em ouro soma cada tipo pela cotação do livro", () => {
    expect(valorEmPo({ pc: 100, pp: 10, pe: 2, po: 5, pl: 1 })).toBe(18);
  });

  it("texto mostra só o que existe, da mais valiosa pra menos", () => {
    expect(textoMoedas({ pc: 3, pp: 0, pe: 0, po: 12, pl: 0 })).toBe("12 PO · 3 PC");
    expect(textoMoedas(moedasVazias())).toBe("—");
  });

  it("tirar moeda sem trocar tipo: falta de qualquer uma devolve null", () => {
    const m = { ...moedasVazias(), po: 10, pp: 5 };
    expect(tirarMoedas(m, { ...moedasVazias(), po: 4 })).toEqual({ ...moedasVazias(), po: 6, pp: 5 });
    expect(tirarMoedas(m, { ...moedasVazias(), pc: 1 })).toBeNull();
    expect(tirarMoedas(m, { ...moedasVazias(), po: 11 })).toBeNull();
  });

  it("somar", () => {
    expect(somarMoedas({ ...moedasVazias(), po: 2 }, { ...moedasVazias(), po: 3, pl: 1 })).toEqual({
      ...moedasVazias(),
      po: 5,
      pl: 1,
    });
  });

  it("dividir: o que não divide certo fica no baú", () => {
    const { cada, resto } = dividirMoedas({ pc: 0, pp: 7, pe: 0, po: 100, pl: 1 }, 3);
    expect(cada).toEqual({ pc: 0, pp: 2, pe: 0, po: 33, pl: 0 });
    expect(resto).toEqual({ pc: 0, pp: 1, pe: 0, po: 1, pl: 1 });
  });

  it("dividir por zero ou fração não explode: conta como uma pessoa", () => {
    expect(dividirMoedas({ ...moedasVazias(), po: 5 }, 0).cada.po).toBe(5);
    expect(dividirMoedas({ ...moedasVazias(), po: 5 }, 1.9).cada.po).toBe(5);
  });
});

describe("peso e carga", () => {
  it("soma itens (quantidade × peso) e moedas (50 por 0,5 kg)", () => {
    const inv = [item({ qtd: 2, peso: 5 }), item({ nome: "Pedra", qtd: 3, peso: 0.25 })];
    expect(pesoCarregado(inv, { ...moedasVazias(), po: 50 })).toBe(11.25);
  });

  it("capacidade é Força × 7,5 kg", () => {
    expect(capacidadeDeCarga(10)).toBe(75);
    expect(capacidadeDeCarga(18)).toBe(135);
    expect(capacidadeDeCarga(-4)).toBe(0);
  });

  it("formata com vírgula e sem zero sobrando", () => {
    expect(formatarKg(3.5)).toBe("3,5 kg");
    expect(formatarKg(12)).toBe("12 kg");
    expect(formatarKg(0.15)).toBe("0,15 kg");
  });
});

describe("sintonia", () => {
  it("conta só os sintonizados", () => {
    const inv = [
      item({ magico: true, sintonia: 2 }),
      item({ magico: true, sintonia: 1 }),
      item({ magico: true, sintonia: 2 }),
      item(),
    ];
    expect(sintonizados(inv)).toBe(2);
  });
});

describe("juntar e tirar item", () => {
  it("item comum repetido empilha, ignorando maiúscula e acento", () => {
    const inv = juntarItem([item({ nome: "Poção de cura", qtd: 2 })], item({ nome: "poçao de CURA", qtd: 3 }));
    expect(inv).toHaveLength(1);
    expect(inv[0].qtd).toBe(5);
  });

  it("item mágico nunca empilha (cada um tem a sua sintonia)", () => {
    const anel = item({ nome: "Anel", magico: true, sintonia: 1 });
    expect(juntarItem([anel], anel)).toHaveLength(2);
  });

  it("nome diferente entra como linha nova", () => {
    expect(juntarItem([item({ nome: "Corda" })], item({ nome: "Tocha" }))).toHaveLength(2);
  });

  it("tirar parte mantém a linha; tirar tudo (ou mais) some com ela", () => {
    const inv = [item({ nome: "Flecha", qtd: 10 }), item({ nome: "Tocha", qtd: 1 })];
    expect(tirarQuantidade(inv, 0, 4)[0].qtd).toBe(6);
    expect(tirarQuantidade(inv, 0, 10).map((x) => x.nome)).toEqual(["Tocha"]);
    expect(tirarQuantidade(inv, 0, 50).map((x) => x.nome)).toEqual(["Tocha"]);
  });
});

describe("baú do grupo", () => {
  const linha = (extra: Partial<ItemBau>): ItemBau => ({
    id: "1",
    room_code: "s",
    nome: "",
    qtd: 1,
    peso: 0,
    descricao: "",
    magico: false,
    raridade: "",
    moeda: null,
    created_at: "",
    ...extra,
  });

  it("o dinheiro vem das linhas de moeda; os objetos, das outras", () => {
    const itens = [
      linha({ id: "a", moeda: "po", qtd: 40 }),
      linha({ id: "b", moeda: "pp", qtd: 7 }),
      linha({ id: "c", nome: "Espada", qtd: 1 }),
      linha({ id: "d", nome: "Gasto", qtd: 0 }),
    ];
    expect(moedasDoBau(itens)).toEqual({ pc: 0, pp: 7, pe: 0, po: 40, pl: 0 });
    expect(objetosDoBau(itens).map((i) => i.nome)).toEqual(["Espada"]);
  });

  it("moeda de tipo inventado vira objeto comum (não some dinheiro nem quebra)", () => {
    expect(normalizarItemBau({ id: "x", nome: "Ficha", qtd: 2, moeda: "dolar" }).moeda).toBeNull();
  });

  it("peso do banco (numeric) pode chegar como texto", () => {
    expect(normalizarItemBau({ id: "x", nome: "Barra", peso: "2.50" }).peso).toBe(2.5);
  });

  it("pegar do baú leva só a quantidade pedida e nasce sem equipar nem sintonizar", () => {
    const i = itemDoBauParaInventario(linha({ nome: "Anel", qtd: 5, peso: 0.1, magico: true }), 2);
    expect(i).toMatchObject({ nome: "Anel", qtd: 2, peso: 0.1, magico: true, equipado: false, sintonia: 0 });
  });
});
