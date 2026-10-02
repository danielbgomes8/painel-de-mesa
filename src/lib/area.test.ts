import { describe, expect, it } from "vitest";
import {
  AREAS_MAXIMAS,
  AREA_DURACAO_MS,
  FORMAS_AREA,
  LARGURA_PADRAO_DA_LINHA,
  METROS_MAXIMO,
  TAMANHOS_PRONTOS,
  TAMANHO_PADRAO,
  adicionarArea,
  areaToca,
  areasAtivas,
  contagemNaArea,
  cruzamentoMaisPerto,
  formaNoMapa,
  metrosParaPx,
  metrosValidos,
  opacidadeDaArea,
  quadradosDoTamanho,
  rotuloDaArea,
  rotuloDaContagem,
  trocarForma,
  validarArea,
  type AreaNaTela,
  type CenaParaArea,
  type FormaNoMapa,
} from "./area";
import type { Ponto } from "./cenas";
import { COR_PING_MESTRE, CORES_JOGADORES } from "./ping";

// 100 px por quadradinho, 1,5 m cada: 1 m = 66,67 px; 3000×2000 de mapa.
const cena: CenaParaArea = { grade_ligada: true, grade_px: 100, grade_dx: 0, grade_dy: 0, metros: 1.5, largura: 3000, altura: 2000 };

function poligono(f: FormaNoMapa) {
  if (f.tipo !== "poligono") throw new Error("era pra ser polígono");
  return f.pontos;
}
const dist = (a: Ponto, b: Ponto) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function areaDoPoligono(p: Ponto[]) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

describe("metros e quadradinhos", () => {
  it("converte pela grade da cena, não pela tela", () => {
    expect(metrosParaPx(cena, 1.5)).toBeCloseTo(100, 6);
    expect(metrosParaPx(cena, 6)).toBeCloseTo(400, 6);
    expect(metrosParaPx({ grade_px: 50, metros: 3 }, 6)).toBeCloseTo(100, 6);
    expect(metrosParaPx({ grade_px: 100, metros: 0 }, 6)).toBe(0);
  });

  it("diz quantos quadradinhos o tamanho tem", () => {
    expect(quadradosDoTamanho({ metros: 1.5 }, 9)).toBe(6);
    expect(quadradosDoTamanho({ metros: 1.5 }, 4.5)).toBe(3);
    expect(quadradosDoTamanho({ metros: 0 }, 4.5)).toBe(0);
  });
});

describe("a origem encaixa no cruzamento da grade", () => {
  it("vai pro canto de quadradinho mais perto", () => {
    expect(cruzamentoMaisPerto(cena, [149, 251])).toEqual([100, 300]);
    expect(cruzamentoMaisPerto(cena, [151, 249])).toEqual([200, 200]);
  });

  it("respeita o deslocamento da grade e não sai do mapa", () => {
    expect(cruzamentoMaisPerto({ ...cena, grade_dx: 30, grade_dy: 10 }, [128, 112])).toEqual([130, 110]);
    expect(cruzamentoMaisPerto(cena, [3100, -20])).toEqual([3000, 0]);
  });

  it("sem grade, fica onde está", () => {
    expect(cruzamentoMaisPerto({ ...cena, grade_ligada: false }, [149, 251])).toEqual([149, 251]);
  });
});

describe("as formas (Regras Gratuitas 2024)", () => {
  it("esfera: círculo no ponto, com o tamanho como RAIO", () => {
    const f = formaNoMapa(cena, { forma: "esfera", o: [500, 500], d: [900, 100], metros: 6, largura: 1.5 });
    expect(f).toEqual({ tipo: "circulo", centro: [500, 500], raio: 400 });
  });

  it("cone: a largura em qualquer ponto é a distância até a ponta (na extremidade, comprimento = largura)", () => {
    const p = poligono(formaNoMapa(cena, { forma: "cone", o: [100, 100], d: [900, 100], metros: 9, largura: 1.5 }));
    expect(p).toHaveLength(3);
    const [ponta, a, b] = p;
    expect(ponta).toEqual([100, 100]);
    // 9 m = 600 px de comprimento; a base tem 600 px de largura.
    expect(a[0]).toBeCloseTo(700, 6);
    expect(b[0]).toBeCloseTo(700, 6);
    expect(dist(a, b)).toBeCloseTo(600, 6);
    // Na metade do comprimento (300 px), a largura é 300 px.
    const metadeA: Ponto = [(ponta[0] + a[0]) / 2, (ponta[1] + a[1]) / 2];
    const metadeB: Ponto = [(ponta[0] + b[0]) / 2, (ponta[1] + b[1]) / 2];
    expect(dist(metadeA, metadeB)).toBeCloseTo(300, 6);
  });

  it("cone: aponta pra onde se arrasta, em qualquer direção", () => {
    const pra = (d: Ponto) => poligono(formaNoMapa(cena, { forma: "cone", o: [1000, 1000], d, metros: 4.5, largura: 1.5 }));
    const cima = pra([1000, 200]);
    expect(Math.max(...cima.map((q) => q[1]))).toBeCloseTo(1000, 6);
    expect(cima[1][1]).toBeCloseTo(700, 6);
    const diag = pra([1500, 1500]);
    // O centro da base está no eixo, a 300 px da ponta, a 45°.
    const centro: Ponto = [(diag[1][0] + diag[2][0]) / 2, (diag[1][1] + diag[2][1]) / 2];
    expect(dist([1000, 1000], centro)).toBeCloseTo(300, 6);
    expect(centro[0] - 1000).toBeCloseTo(centro[1] - 1000, 6);
  });

  it("cubo: a origem é o MEIO de uma face e o lado é o tamanho", () => {
    const p = poligono(formaNoMapa(cena, { forma: "cubo", o: [200, 300], d: [900, 300], metros: 4.5, largura: 1.5 }));
    // 4,5 m = 300 px de lado, saindo pra direita; a face da origem está em x = 200.
    expect(areaDoPoligono(p)).toBeCloseTo(300 * 300, 4);
    const xs = p.map((q) => q[0]);
    expect(Math.min(...xs)).toBeCloseTo(200, 6);
    expect(Math.max(...xs)).toBeCloseTo(500, 6);
    const ys = p.map((q) => q[1]);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(300, 6);
  });

  it("linha: comprimento e largura próprios (5 pés = 1,5 m de largura)", () => {
    const p = poligono(formaNoMapa(cena, { forma: "linha", o: [100, 100], d: [100, 900], metros: 30, largura: 1.5 }));
    // 30 m = 2000 px de comprimento, 100 px de largura, descendo.
    expect(areaDoPoligono(p)).toBeCloseTo(2000 * 100, 3);
    const ys = p.map((q) => q[1]);
    expect(Math.min(...ys)).toBeCloseTo(100, 6);
    expect(Math.max(...ys)).toBeCloseTo(2100, 6);
    const xs = p.map((q) => q[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 6);
  });

  it("sem direção (origem e destino no mesmo ponto), aponta pra direita em vez de quebrar", () => {
    const p = poligono(formaNoMapa(cena, { forma: "cone", o: [100, 100], d: [100, 100], metros: 4.5, largura: 1.5 }));
    expect(p.every((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]))).toBe(true);
    expect(p[1][0]).toBeGreaterThan(100);
  });
});

describe("o texto da figura", () => {
  it("diz a forma e o que o tamanho mede", () => {
    expect(rotuloDaArea({ forma: "cone", metros: 9, largura: 1.5 })).toBe("Cone · 9 m");
    expect(rotuloDaArea({ forma: "esfera", metros: 6, largura: 1.5 })).toBe("Esfera · raio 6 m");
    expect(rotuloDaArea({ forma: "cubo", metros: 4.5, largura: 1.5 })).toBe("Cubo · lado 4,5 m");
    expect(rotuloDaArea({ forma: "linha", metros: 30, largura: 1.5 })).toBe("Linha · 30 m × 1,5 m");
  });
});

describe("escolhas da tela", () => {
  it("cada forma tem tamanhos prontos e um padrão que está entre eles", () => {
    for (const f of FORMAS_AREA) {
      expect(TAMANHOS_PRONTOS[f].length, f).toBeGreaterThan(0);
      expect(TAMANHOS_PRONTOS[f], f).toContain(TAMANHO_PADRAO[f]);
    }
  });

  it("trocar de forma leva o tamanho que costuma servir pra ela e guarda a largura", () => {
    const antes = { forma: "esfera" as const, metros: 12, largura: 3 };
    expect(trocarForma(antes, "cone")).toEqual({ forma: "cone", metros: TAMANHO_PADRAO.cone, largura: 3 });
  });

  it("só aceita tamanho de verdade (número positivo, até o limite)", () => {
    expect(metrosValidos(4.5)).toBe(4.5);
    expect(metrosValidos(4.456)).toBe(4.46);
    for (const ruim of [0, -3, Number.NaN, Infinity, "9", null, undefined, METROS_MAXIMO + 1]) expect(metrosValidos(ruim)).toBeNull();
  });
});

describe("o que chega de outro aparelho", () => {
  const ok = { id: "a1", forma: "cone", o: [100, 200], d: [400, 200], metros: 9, de: "Tibério", cor: CORES_JOGADORES[1] };
  const mapa = { largura: 3000, altura: 2000 };

  it("aceita uma área de verdade", () => {
    expect(validarArea(ok, mapa)).toEqual({ ...ok, largura: LARGURA_PADRAO_DA_LINHA });
  });

  it("recusa forma desconhecida, tamanho torto, ponto fora do mapa e lixo", () => {
    expect(validarArea({ ...ok, forma: "estrela" }, mapa)).toBeNull();
    expect(validarArea({ ...ok, metros: 0 }, mapa)).toBeNull();
    expect(validarArea({ ...ok, metros: 99999 }, mapa)).toBeNull();
    expect(validarArea({ ...ok, metros: "9" }, mapa)).toBeNull();
    expect(validarArea({ ...ok, largura: -1 }, mapa)).toBeNull();
    expect(validarArea({ ...ok, o: [-1, 5] }, mapa)).toBeNull();
    expect(validarArea({ ...ok, d: [5, 9999] }, mapa)).toBeNull();
    expect(validarArea({ ...ok, o: [Number.NaN, 5] }, mapa)).toBeNull();
    expect(validarArea({ ...ok, id: "" }, mapa)).toBeNull();
    expect(validarArea(null, mapa)).toBeNull();
    expect(validarArea("area", mapa)).toBeNull();
  });

  it("cor fora da paleta é trocada (nada de CSS vindo de fora) e nome gigante é cortado", () => {
    const a = validarArea({ ...ok, cor: "url(javascript:alert(1))", de: "A".repeat(500) }, mapa);
    expect(a?.cor).toBe(COR_PING_MESTRE);
    expect(a?.de).toHaveLength(30);
    expect(validarArea({ ...ok, de: "  " }, mapa)?.de).toBe("alguém");
  });

  it("o tamanho em pixels não vem no pacote: quem recebe converte pela própria grade", () => {
    const a = validarArea({ ...ok, px: 99999, raio: 99999 }, mapa);
    expect(a).not.toBeNull();
    expect(Object.keys(a ?? {})).not.toContain("px");
    expect(Object.keys(a ?? {})).not.toContain("raio");
  });
});

describe("áreas na tela", () => {
  const area = (id: string, chegouEm: number, de = "Mestre"): AreaNaTela => ({
    id,
    forma: "esfera",
    o: [10, 10],
    d: [10, 10],
    metros: 6,
    largura: 1.5,
    de,
    cor: COR_PING_MESTRE,
    chegouEm,
  });

  it("dura 9 s e depois sai; a mesma mensagem chegando duas vezes não aparece em dobro", () => {
    expect(areasAtivas([area("a", 1000)], 1000 + AREA_DURACAO_MS - 1)).toHaveLength(1);
    expect(areasAtivas([area("a", 1000)], 1000 + AREA_DURACAO_MS)).toHaveLength(0);
    expect(adicionarArea(adicionarArea([], area("a", 100)), area("a", 150))).toHaveLength(1);
  });

  it("cada pessoa tem uma figura por vez: a nova substitui a anterior dela, e as dos outros ficam", () => {
    let lista = adicionarArea([], area("m1", 100, "Mestre"));
    lista = adicionarArea(lista, area("t1", 150, "Tibério"));
    lista = adicionarArea(lista, area("m2", 200, "Mestre"));
    expect(lista.map((a) => a.id)).toEqual(["t1", "m2"]);
  });

  it("passou do limite de pessoas, ficam as figuras mais novas", () => {
    let lista: AreaNaTela[] = [];
    for (let i = 0; i < AREAS_MAXIMAS + 3; i++) lista = adicionarArea(lista, area(`p${i}`, 100 + i, `Pessoa ${i}`));
    expect(lista).toHaveLength(AREAS_MAXIMAS);
    expect(lista[lista.length - 1].id).toBe(`p${AREAS_MAXIMAS + 2}`);
  });

  it("firme e some no último quarto", () => {
    expect(opacidadeDaArea(0)).toBe(1);
    expect(opacidadeDaArea(AREA_DURACAO_MS * 0.5)).toBe(1);
    expect(opacidadeDaArea(AREA_DURACAO_MS - 1)).toBeLessThan(0.01);
    expect(opacidadeDaArea(AREA_DURACAO_MS)).toBeNull();
    expect(opacidadeDaArea(-1)).toBeNull();
  });
});

describe("quem está dentro da área", () => {
  const esfera: FormaNoMapa = { tipo: "circulo", centro: [300, 300], raio: 120 };
  // Cubo de 100 px de lado, de (200,200) a (300,300).
  const cubo: FormaNoMapa = { tipo: "poligono", pontos: [[200, 200], [300, 200], [300, 300], [200, 300]] };
  const c = (x: number, y: number, raio = 15, naMesa = true) => ({ x, y, raio, naMesa });

  it("na esfera: o centro dentro conta, e o espaço que só encosta na borda também", () => {
    expect(areaToca(esfera, c(300, 300))).toBe(true);
    expect(areaToca(esfera, c(300 + 120, 300, 0))).toBe(true); // o centro na borda
    expect(areaToca(esfera, c(300 + 130, 300, 15))).toBe(true); // centro fora, mas o espaço (15) entra
    expect(areaToca(esfera, c(300 + 136, 300, 15))).toBe(false);
  });

  it("no polígono: dentro conta; fora conta só se o espaço da criatura chega no lado", () => {
    expect(areaToca(cubo, c(250, 250, 0))).toBe(true);
    expect(areaToca(cubo, c(312, 250, 15))).toBe(true); // 12 px fora do lado, raio 15
    expect(areaToca(cubo, c(320, 250, 15))).toBe(false);
    // quina: a distância é até o canto, não até a reta do lado
    expect(areaToca(cubo, c(310, 310, 15))).toBe(true); // ~14,1 do canto
    expect(areaToca(cubo, c(315, 315, 15))).toBe(false); // ~21,2 do canto
  });

  it("funciona num cone (triângulo)", () => {
    const cone: FormaNoMapa = { tipo: "poligono", pontos: [[0, 0], [200, 100], [200, -100]] };
    expect(areaToca(cone, c(100, 0, 0))).toBe(true);
    expect(areaToca(cone, c(100, 90, 0))).toBe(false);
    expect(areaToca(cone, c(-30, 0, 0))).toBe(false);
  });

  it("separa as que a mesa vê das que ela não vê (oculto ou sob a névoa)", () => {
    const r = contagemNaArea(esfera, [
      c(300, 300), // mesa vê, dentro
      c(320, 310), // mesa vê, dentro
      c(280, 290, 15, false), // oculto, dentro
      c(900, 900), // longe
      c(900, 900, 15, false), // longe e oculto
    ]);
    expect(r).toEqual({ mesa: 2, ocultos: 1 });
  });

  it("sem ninguém por perto, zeros", () => {
    expect(contagemNaArea(esfera, [])).toEqual({ mesa: 0, ocultos: 0 });
  });
});

describe("a contagem em texto", () => {
  it("fala no singular e no plural, e 'ninguém' quando a mesa não vê ninguém", () => {
    expect(rotuloDaContagem({ mesa: 3, ocultos: 0 }, false)).toBe("3 criaturas");
    expect(rotuloDaContagem({ mesa: 1, ocultos: 0 }, false)).toBe("1 criatura");
    expect(rotuloDaContagem({ mesa: 0, ocultos: 0 }, false)).toBe("ninguém");
  });
  it("só o Mestre vê os ocultos; quem não é Mestre nunca vê o '+'", () => {
    expect(rotuloDaContagem({ mesa: 2, ocultos: 1 }, true)).toBe("2 criaturas (+1 oculto)");
    expect(rotuloDaContagem({ mesa: 0, ocultos: 3 }, true)).toBe("ninguém (+3 ocultos)");
    for (const c of [{ mesa: 2, ocultos: 1 }, { mesa: 0, ocultos: 3 }]) expect(rotuloDaContagem(c, false)).not.toContain("+");
  });
});
