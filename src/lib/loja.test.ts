import { describe, expect, it } from "vitest";
import {
  VALOR_EM_PC,
  itemComprado,
  itensDaLoja,
  moedaDoPreco,
  linhaDeCompra,
  lojasVisiveis,
  motivoDeNaoComprar,
  nomeDaLoja,
  normalizarItemDaLoja,
  normalizarLoja,
  pagar,
  precoEmPc,
  textoDoPreco,
  totalEmPc,
  type ItemDaLoja,
  type Loja,
} from "./loja";
import type { Moedas } from "./tipos";

const m = (extra: Partial<Moedas> = {}): Moedas => ({ pc: 0, pp: 0, pe: 0, po: 0, pl: 0, ...extra });
const item = (extra: Partial<ItemDaLoja> = {}): ItemDaLoja => ({
  id: "i1",
  loja_id: "l1",
  room_code: "s",
  nome: "Poção de cura",
  descricao: "Cura 2d4+2.",
  preco_pc: 5000,
  estoque: 3,
  peso: 0.25,
  magico: false,
  raridade: "",
  created_at: "2026-10-12T10:00:00Z",
  ...extra,
});

describe("ler do banco", () => {
  it("lê a loja e aperta o que vem torto", () => {
    expect(normalizarLoja({ id: "l", nome: "x".repeat(200), aberta: true })).toMatchObject({ aberta: true });
    expect(normalizarLoja({ id: "l", nome: "x".repeat(200) })?.nome).toHaveLength(60);
    expect(normalizarLoja({ id: "l" })?.aberta).toBe(false); // sem dizer, fica fechada
    expect(normalizarLoja(null)).toBeNull();
    expect(normalizarLoja({ nome: "sem id" })).toBeNull();
  });

  it("lê o item: preço em cobre inteiro, estoque nulo = sempre tem", () => {
    const lido = normalizarItemDaLoja({ id: "i", loja_id: "l", nome: "Corda", preco_pc: "100", estoque: null, peso: "5" });
    expect(lido).toMatchObject({ preco_pc: 100, estoque: null, peso: 5 });
    expect(normalizarItemDaLoja({ id: "i", loja_id: "l", preco_pc: -5 })?.preco_pc).toBe(0);
    expect(normalizarItemDaLoja({ id: "i", loja_id: "l", preco_pc: 1e12 })?.preco_pc).toBe(1_000_000_000);
    expect(normalizarItemDaLoja({ id: "i", loja_id: "l", estoque: -3 })?.estoque).toBe(0);
    expect(normalizarItemDaLoja({ id: "i" })).toBeNull(); // sem loja não é item
  });
});

describe("quem enxerga o quê", () => {
  const lojas: Loja[] = [
    { id: "a", room_code: "s", nome: "Aberta", aberta: true, created_at: "2026-10-12T10:00:00Z" },
    { id: "f", room_code: "s", nome: "Fechada", aberta: false, created_at: "2026-10-12T09:00:00Z" },
  ];

  it("a mesa só vê a loja aberta; o Mestre vê as duas", () => {
    expect(lojasVisiveis(lojas, false).map((l) => l.id)).toEqual(["a"]);
    expect(lojasVisiveis(lojas, true).map((l) => l.id)).toEqual(["f", "a"]);
  });

  it("os itens são os da loja pedida", () => {
    expect(itensDaLoja([item({ id: "1", loja_id: "a" }), item({ id: "2", loja_id: "f" })], "a").map((i) => i.id)).toEqual(["1"]);
  });

  it("nome vazio vira 'Loja'", () => {
    expect(nomeDaLoja({ nome: " " })).toBe("Loja");
  });
});

describe("preço", () => {
  it("escreve em cobre: 1 PO = 100, 1 PP = 10", () => {
    expect(precoEmPc("5", "po")).toBe(500);
    expect(precoEmPc("2,5", "po")).toBe(250);
    expect(precoEmPc("3", "pp")).toBe(30);
    expect(precoEmPc(7, "pc")).toBe(7);
    expect(precoEmPc("1", "pl")).toBe(1000);
  });

  it("recusa o que não vale", () => {
    expect(precoEmPc("-1", "po")).toBeNull();
    expect(precoEmPc("abc", "po")).toBeNull();
    expect(precoEmPc("", "po")).toBeNull();
    expect(precoEmPc("99999999999", "pl")).toBeNull();
  });

  it("mostra em moedas redondas", () => {
    expect(textoDoPreco(0)).toBe("grátis");
    expect(textoDoPreco(500)).toBe("5 PO");
    expect(textoDoPreco(30)).toBe("3 PP");
    expect(textoDoPreco(250)).toBe("2 PO · 5 PP");
    expect(textoDoPreco(7)).toBe("7 PC");
    expect(textoDoPreco(1000)).toBe("10 PO"); // platina não aparece: a mesa conta em ouro
  });

  it("a edição mostra o preço na moeda em que ele fica redondo", () => {
    expect(moedaDoPreco(500)).toBe("po");
    expect(moedaDoPreco(0)).toBe("po");
    expect(moedaDoPreco(250)).toBe("pp");
    expect(moedaDoPreco(7)).toBe("pc");
  });

  it("o valor de cada moeda confere com a tabela do livro", () => {
    expect(VALOR_EM_PC).toEqual({ pc: 1, pp: 10, pe: 50, po: 100, pl: 1000 });
    expect(totalEmPc(m({ po: 2, pp: 5, pc: 3 }))).toBe(253);
  });
});

describe("pagar com troco", () => {
  it("paga exato com a moeda que serve, sem tocar nas outras", () => {
    expect(pagar(m({ po: 10, pp: 4 }), 500)).toEqual(m({ po: 5, pp: 4 }));
  });

  it("gasta primeiro as moedas pequenas", () => {
    // 150 PC: gasta a prata (10) e o cobre antes de quebrar ouro.
    expect(pagar(m({ pc: 30, pp: 5, po: 2 }), 80)).toEqual(m({ pc: 0, pp: 0, po: 2 }));
  });

  it("quebra a menor moeda que cobre e devolve o troco em ouro, prata e cobre", () => {
    // 1 PL (1000 PC) pagando 150 PC: sobra 850 = 8 PO + 5 PP.
    expect(pagar(m({ pl: 1 }), 150)).toEqual(m({ po: 8, pp: 5 }));
    // 2 PO, 1 PP pagando 150: usa a prata, quebra 1 PO e volta 60 = 6 PP.
    expect(pagar(m({ po: 2, pp: 1 }), 150)).toEqual(m({ pp: 6 }));
  });

  it("nunca perde nem cria dinheiro", () => {
    const casos: [Moedas, number][] = [
      [m({ po: 3, pp: 7, pc: 9, pe: 1 }), 233],
      [m({ pl: 2, pc: 4 }), 1],
      [m({ pe: 3 }), 120],
      [m({ po: 1 }), 100],
      [m({ pp: 1, pc: 9 }), 19],
    ];
    for (const [moedas, custo] of casos) {
      const depois = pagar(moedas, custo);
      expect(depois, JSON.stringify(moedas)).not.toBeNull();
      expect(totalEmPc(depois!)).toBe(totalEmPc(moedas) - custo);
      for (const v of Object.values(depois!)) expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it("devolve null quando o dinheiro não chega, e custo zero não gasta nada", () => {
    expect(pagar(m({ po: 1 }), 101)).toBeNull();
    expect(pagar(m(), 1)).toBeNull();
    expect(pagar(m({ po: 5 }), 0)).toEqual(m({ po: 5 }));
    expect(pagar(m({ po: 5 }), -1)).toBeNull();
  });
});

describe("comprar", () => {
  it("diz por que não dá", () => {
    const dinheiro = m({ po: 10 });
    expect(motivoDeNaoComprar(item({ preco_pc: 500, estoque: 3 }), 1, dinheiro)).toBeNull();
    expect(motivoDeNaoComprar(item({ preco_pc: 500, estoque: 3 }), 0, dinheiro)).toBe("Escolha quantos quer.");
    expect(motivoDeNaoComprar(item({ preco_pc: 500, estoque: 3 }), 1.5, dinheiro)).toBe("Escolha quantos quer.");
    expect(motivoDeNaoComprar(item({ estoque: 0 }), 1, dinheiro)).toBe("Esgotado.");
    expect(motivoDeNaoComprar(item({ estoque: 2 }), 3, dinheiro)).toBe("Só restam 2.");
    expect(motivoDeNaoComprar(item({ preco_pc: 600, estoque: null }), 2, dinheiro)).toBe("Faltam 2 PO.");
    expect(motivoDeNaoComprar(item({ estoque: null, preco_pc: 0 }), 5, m())).toBeNull(); // de graça sempre dá
    expect(motivoDeNaoComprar(item({ estoque: null, preco_pc: 1 }), 5000, m({ pl: 9 }))).toBe("No máximo 999 de uma vez.");
  });

  it("estoque nulo não acaba", () => {
    expect(motivoDeNaoComprar(item({ estoque: null, preco_pc: 10 }), 50, m({ po: 100 }))).toBeNull();
  });

  it("o item vai pro inventário com tudo o que a loja descreveu", () => {
    expect(itemComprado(item({ magico: true, raridade: "incomum" }), 2)).toEqual({
      nome: "Poção de cura",
      qtd: 2,
      peso: 0.25,
      descricao: "Cura 2d4+2.",
      magico: true,
      raridade: "incomum",
      equipado: false,
      sintonia: 0,
    });
  });

  it("linha do log com quantidade e preço total", () => {
    expect(linhaDeCompra("Ana", item({ preco_pc: 5000 }), 2, { nome: "Loja da esquina" })).toBe("🛒 Ana comprou 2× Poção de cura por 100 PO (Loja da esquina)");
    expect(linhaDeCompra("Ana", item({ preco_pc: 5000 }), 1, { nome: "" })).toBe("🛒 Ana comprou Poção de cura por 50 PO (Loja)");
  });
});
