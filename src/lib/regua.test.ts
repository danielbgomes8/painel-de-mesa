import { describe, expect, it } from "vitest";
import {
  REGUAS_MAXIMAS,
  REGUA_DURACAO_MS,
  adicionarRegua,
  medirRegua,
  partesDoRotulo,
  opacidadeDaRegua,
  reguasAtivas,
  rotuloDaMedida,
  validarRegua,
  type CenaParaRegua,
  type ReguaNaTela,
} from "./regua";

const cena: CenaParaRegua = {
  grade_ligada: true,
  grade_px: 100,
  grade_dx: 0,
  grade_dy: 0,
  metros: 1.5,
  largura: 3000,
  altura: 2000,
};

describe("régua na grade (regra do jogo: diagonal vale 1 quadrado)", () => {
  it("em linha reta, conta os quadradinhos e multiplica pelos metros", () => {
    const m = medirRegua(cena, [50, 50], [450, 50], "grade");
    expect(m.quadrados).toBe(4);
    expect(m.metros).toBe(6);
    expect(m.modo).toBe("grade");
  });

  it("o exemplo da conversa: 30 quadrados na largura de 3000 px, arrastar 450 px = 4,5 quadrados na reta (6,75 m); na grade, quadrados inteiros", () => {
    const reta = medirRegua(cena, [0, 0], [450, 0], "reta");
    expect(reta.quadrados).toBe(4.5);
    expect(reta.metros).toBe(6.8); // 6,75 arredondado pra uma casa
    const grade = medirRegua(cena, [50, 50], [450, 50], "grade");
    expect(grade.metros).toBe(6);
  });

  it("a diagonal vale 1 quadrado: três quadrados na diagonal são 3, não 4,2", () => {
    const m = medirRegua(cena, [50, 50], [350, 350], "grade");
    expect(m.quadrados).toBe(3);
    expect(m.metros).toBe(4.5);
  });

  it("andar torto conta pela maior diferença (caminho mais curto na grade)", () => {
    // 5 colunas e 2 linhas: 5 quadrados
    expect(medirRegua(cena, [50, 50], [550, 250], "grade").quadrados).toBe(5);
    // 2 colunas e 7 linhas: 7 quadrados
    expect(medirRegua(cena, [50, 50], [250, 750], "grade").quadrados).toBe(7);
  });

  it("os pontos encaixam no centro do quadradinho, onde quer que o dedo caia", () => {
    const m = medirRegua(cena, [12, 99], [431, 12], "grade");
    expect(m.a).toEqual([50, 50]);
    expect(m.b).toEqual([450, 50]);
    expect(m.quadrados).toBe(4);
  });

  it("mesmo quadradinho = zero", () => {
    expect(medirRegua(cena, [10, 10], [90, 90], "grade").quadrados).toBe(0);
  });

  it("respeita onde a grade começa e os metros por quadrado da cena", () => {
    const deslocada = { ...cena, grade_dx: 30, grade_dy: 10, metros: 3 };
    const m = medirRegua(deslocada, [80, 60], [380, 60], "grade");
    expect(m.quadrados).toBe(3);
    expect(m.metros).toBe(9);
    expect(m.a).toEqual([80, 60]); // centro do quadradinho que começa em 30
  });

  it("o zoom não entra na conta: só pixels da imagem", () => {
    // mesmos pontos, mesma resposta — não há parâmetro de tela
    expect(medirRegua(cena, [50, 50], [450, 50], "grade")).toEqual(medirRegua(cena, [50, 50], [450, 50], "grade"));
  });
});

describe("régua em linha reta", () => {
  it("mede a distância de verdade, inclusive na diagonal (um quadrado na diagonal = 1,4)", () => {
    const m = medirRegua(cena, [0, 0], [100, 100], "reta");
    expect(m.quadrados).toBe(1.4);
    expect(m.metros).toBe(2.1);
  });

  it("não encaixa nada na grade: usa os pontos como vieram", () => {
    const m = medirRegua(cena, [10, 20], [310, 420], "reta");
    expect(m.a).toEqual([10, 20]);
    expect(m.b).toEqual([310, 420]);
  });

  it("com a grade desligada, o modo grade vira reta em vez de dar conta errada", () => {
    const m = medirRegua({ ...cena, grade_ligada: false }, [0, 0], [300, 0], "grade");
    expect(m.modo).toBe("reta");
    expect(m.quadrados).toBe(3);
    expect(m.metros).toBe(4.5);
  });
});

describe("o que a régua escreve", () => {
  it("plural, vírgula decimal e metros", () => {
    expect(rotuloDaMedida({ quadrados: 4, metros: 6 })).toBe("4 quadrados · 6 m");
    expect(rotuloDaMedida({ quadrados: 1, metros: 1.5 })).toBe("1 quadrado · 1,5 m");
    expect(rotuloDaMedida({ quadrados: 4.5, metros: 6.8 })).toBe("4,5 quadrados · 6,8 m");
  });

  it("com o deslocamento de quem anda, diz se cabe ou quanto passa", () => {
    expect(rotuloDaMedida({ quadrados: 4, metros: 6 }, 9)).toBe("4 quadrados · 6 m · cabe nos 9 m");
    expect(rotuloDaMedida({ quadrados: 6, metros: 9 }, 9)).toBe("6 quadrados · 9 m · cabe nos 9 m");
    expect(rotuloDaMedida({ quadrados: 8, metros: 12 }, 9)).toBe("8 quadrados · 12 m · passa 3 m dos 9 m");
    expect(rotuloDaMedida({ quadrados: 7, metros: 10.5 }, 9)).toBe("7 quadrados · 10,5 m · passa 1,5 m dos 9 m");
  });

  it("a etiqueta pode ir em duas linhas: a medida e o 'cabe/passa'", () => {
    expect(partesDoRotulo({ quadrados: 8, metros: 12 }, 9)).toEqual({ principal: "8 quadrados · 12 m", detalhe: "passa 3 m dos 9 m" });
    expect(partesDoRotulo({ quadrados: 4, metros: 6 }, 9)).toEqual({ principal: "4 quadrados · 6 m", detalhe: "cabe nos 9 m" });
    expect(partesDoRotulo({ quadrados: 4, metros: 6 })).toEqual({ principal: "4 quadrados · 6 m", detalhe: null });
  });

  it("deslocamento zero ou ausente não escreve nada a mais", () => {
    expect(rotuloDaMedida({ quadrados: 2, metros: 3 }, 0)).toBe("2 quadrados · 3 m");
    expect(rotuloDaMedida({ quadrados: 2, metros: 3 }, null)).toBe("2 quadrados · 3 m");
  });
});

describe("o que chega de outro aparelho", () => {
  const ok = { id: "r1", a: [10, 20], b: [300, 400], modo: "grade", de: "Tibério", cor: "#5fb0e8", desloc: 9 };
  const caixa = { largura: 3000, altura: 2000 };

  it("aceita uma régua de verdade; a distância não vem no pacote (cada um refaz a conta)", () => {
    const r = validarRegua(ok, caixa);
    expect(r).toEqual({ ...ok });
    expect(r && "metros" in r).toBe(false);
    // mesmo que alguém mande uma distância falsa, ela é ignorada
    const comMentira = validarRegua({ ...ok, metros: 999, quadrados: 999 }, caixa);
    expect(comMentira && ("metros" in comMentira || "quadrados" in comMentira)).toBe(false);
  });

  it("recusa ponto fora do mapa, número torto, modo inventado e lixo", () => {
    expect(validarRegua({ ...ok, a: [-1, 5] }, caixa)).toBeNull();
    expect(validarRegua({ ...ok, b: [3001, 5] }, caixa)).toBeNull();
    expect(validarRegua({ ...ok, b: [Number.NaN, 5] }, caixa)).toBeNull();
    expect(validarRegua({ ...ok, b: "x" }, caixa)).toBeNull();
    expect(validarRegua({ ...ok, modo: "teleporte" }, caixa)).toBeNull();
    expect(validarRegua({ ...ok, id: "" }, caixa)).toBeNull();
    expect(validarRegua(null, caixa)).toBeNull();
  });

  it("nome gigante é cortado, cor fora da paleta vira dourado, deslocamento absurdo some", () => {
    const r = validarRegua({ ...ok, de: "A".repeat(300), cor: "url(x)", desloc: 99999 }, caixa);
    expect(r?.de).toHaveLength(30);
    expect(r?.cor).toBe("#f0c24b");
    expect(r?.desloc).toBeNull();
  });
});

describe("a régua some sozinha", () => {
  const reg = (id: string, chegouEm: number): ReguaNaTela => ({
    id, a: [0, 0], b: [10, 10], modo: "grade", de: "x", cor: "#f0c24b", desloc: null, chegouEm,
  });

  it("fica 7 s e sai", () => {
    expect(reguasAtivas([reg("a", 100)], 100 + REGUA_DURACAO_MS - 1)).toHaveLength(1);
    expect(reguasAtivas([reg("a", 100)], 100 + REGUA_DURACAO_MS)).toHaveLength(0);
  });

  it("a mesma régua duas vezes não duplica, e passou do limite ficam as mais novas", () => {
    expect(adicionarRegua(adicionarRegua([], reg("a", 1)), reg("a", 2))).toHaveLength(1);
    let lista: ReguaNaTela[] = [];
    for (let i = 0; i < REGUAS_MAXIMAS + 3; i++) lista = adicionarRegua(lista, reg(`r${i}`, 100 + i));
    expect(lista).toHaveLength(REGUAS_MAXIMAS);
    expect(lista[lista.length - 1].id).toBe(`r${REGUAS_MAXIMAS + 2}`);
  });

  it("firme na maior parte do tempo e some no último quarto", () => {
    expect(opacidadeDaRegua(0)).toBe(1);
    expect(opacidadeDaRegua(REGUA_DURACAO_MS * 0.5)).toBe(1);
    expect(opacidadeDaRegua(REGUA_DURACAO_MS - 1)).toBeLessThan(0.01);
    expect(opacidadeDaRegua(REGUA_DURACAO_MS)).toBeNull();
    expect(opacidadeDaRegua(-1)).toBeNull();
  });
});
