import { describe, expect, it } from "vitest";
import { ENCAIXE_DA_IMPORTACAO, TEXTO_MAXIMO_DA_IMPORTACAO, lerParedesDoTexto, pedidoDeParedes, soldarPontas } from "./importarParedes";
import { PAREDES_MAXIMAS, type NovaParede } from "./paredes";

const cena = { largura: 760, altura: 760 };

function ler(obj: unknown, c = cena, existentes: { x1: number; y1: number; x2: number; y2: number }[] = []) {
  return lerParedesDoTexto(JSON.stringify(obj), c, existentes);
}

/** Só pra os testes não repetirem o `if (!r.ok) throw`. */
function certo(r: ReturnType<typeof lerParedesDoTexto>) {
  if (!r.ok) throw new Error(r.erro);
  return r;
}

describe("entender o texto", () => {
  it("lê paredes e portas como listas de quatro números; porta entra fechada", () => {
    const r = certo(ler({ largura: 760, altura: 760, paredes: [[200, 38, 420, 38]], portas: [[297, 210, 328, 210]] }));
    expect(r.novas).toEqual([
      { tipo: "parede", x1: 200, y1: 38, x2: 420, y2: 38 },
      { tipo: "porta", x1: 297, y1: 210, x2: 328, y2: 210, aberta: false },
    ]);
    expect(r).toMatchObject({ paredes: 1, portas: 1, ignoradas: 0, semMedida: false });
  });

  it("aceita o item como objeto, e a porta que já vem aberta", () => {
    const r = certo(ler({ paredes: [{ x1: 0, y1: 0, x2: 100, y2: 0 }], portas: [{ x1: 300, y1: 300, x2: 340, y2: 300, aberta: true }] }));
    expect(r.novas[0]).toEqual({ tipo: "parede", x1: 0, y1: 0, x2: 100, y2: 0 });
    expect(r.novas[1]).toMatchObject({ tipo: "porta", aberta: true });
  });

  it("acha o JSON dentro da resposta da IA (frase antes, cerca de código em volta)", () => {
    const texto = "Aqui estão as paredes:\n```json\n" + JSON.stringify({ paredes: [[10, 10, 200, 10]] }) + "\n```\nQualquer coisa, avise.";
    expect(certo(lerParedesDoTexto(texto, cena, [])).paredes).toBe(1);
  });

  it("só portas também serve (o Mestre já desenhou as paredes)", () => {
    expect(certo(ler({ portas: [[10, 10, 60, 10]] })).portas).toBe(1);
  });

  it("explica o que faltou em vez de derrubar a tela", () => {
    expect(lerParedesDoTexto("   ", cena, [])).toMatchObject({ ok: false });
    expect(lerParedesDoTexto("não é json", cena, [])).toMatchObject({ ok: false });
    expect(lerParedesDoTexto("{ paredes: [ }", cena, [])).toMatchObject({ ok: false });
    expect(lerParedesDoTexto("[[1,2,3,4]]", cena, [])).toMatchObject({ ok: false });
    expect(ler({ paredes: [], portas: [] })).toMatchObject({ ok: false });
    expect(ler({ outra: 1 })).toMatchObject({ ok: false });
    expect(ler({ paredes: [["a", 1, 2, 3], [1, 2, 3]] })).toMatchObject({ ok: false });
    expect(lerParedesDoTexto("{" + " ".repeat(TEXTO_MAXIMO_DA_IMPORTACAO) + "}", cena, [])).toMatchObject({ ok: false });
    expect(ler({ paredes: [[0, 0, 100, 0]] }, { largura: 0, altura: 0 })).toMatchObject({ ok: false });
  });

  it("conta as linhas tortas e as curtas demais como ignoradas, e aproveita o resto", () => {
    const r = certo(ler({ paredes: [[0, 0, 100, 0], [5, 5, 6, 5], "torta", [1, 2, 3], { x1: 1 }, [0, 50, 100, 50]] }));
    expect(r.paredes).toBe(2);
    expect(r.ignoradas).toBe(4);
  });
});

describe("levar pro tamanho da cena", () => {
  it("coordenadas medidas numa imagem de outro tamanho mudam de escala (o app guarda a cena reduzida)", () => {
    const r = certo(ler({ largura: 760, altura: 760, paredes: [[200, 38, 420, 38]] }, { largura: 1520, altura: 380 }));
    expect(r.novas[0]).toMatchObject({ x1: 400, y1: 19, x2: 840, y2: 19 });
  });

  it("sem largura e altura no arquivo, vale como px da própria cena — e avisa", () => {
    const r = certo(ler({ paredes: [[200, 38, 420, 38]] }, { largura: 1520, altura: 1520 }));
    expect(r.novas[0]).toMatchObject({ x1: 200, y1: 38, x2: 420, y2: 38 });
    expect(r.semMedida).toBe(true);
  });

  it("medida pela metade ou torta é erro, não chute", () => {
    expect(ler({ largura: 760, paredes: [[0, 0, 100, 0]] })).toMatchObject({ ok: false });
    expect(ler({ largura: 760, altura: 0, paredes: [[0, 0, 100, 0]] })).toMatchObject({ ok: false });
    expect(ler({ largura: "760", altura: 760, paredes: [[0, 0, 100, 0]] })).toMatchObject({ ok: false });
  });

  it("o que passa da borda fica preso dentro do mapa", () => {
    const r = certo(ler({ largura: 760, altura: 760, paredes: [[-20, 100, 900, 100]] }));
    expect(r.novas[0]).toMatchObject({ x1: 0, y1: 100, x2: 760, y2: 100 });
  });
});

describe("fechar as frestas", () => {
  const tol = 760 * ENCAIXE_DA_IMPORTACAO; // 11,4 px
  const w = (x1: number, y1: number, x2: number, y2: number): NovaParede => ({ tipo: "parede", x1, y1, x2, y2 });

  it("canto em que as duas pontas quase se encontram ganha um trechinho ligando as duas", () => {
    const novas = [w(100, 100, 400, 100), w(404, 106, 404, 300)];
    const { paredes, emendadas } = soldarPontas(novas, [], tol);
    expect(paredes).toEqual([...novas, w(400, 100, 404, 106)]);
    expect(emendadas).toBe(1);
  });

  it("pontas longe uma da outra ficam onde estão", () => {
    const novas = [w(100, 100, 400, 100), w(430, 100, 430, 300)];
    expect(soldarPontas(novas, [], tol)).toEqual({ paredes: novas, emendadas: 0 });
  });

  it("liga na ponta de uma parede que o Mestre já tinha desenhado, sem mexer nela", () => {
    const existente = { x1: 0, y1: 0, x2: 100, y2: 0 };
    const { paredes } = soldarPontas([w(103, 4, 103, 200)], [existente], tol);
    expect(paredes).toEqual([w(103, 4, 103, 200), w(103, 4, 100, 0)]);
    expect(existente).toEqual({ x1: 0, y1: 0, x2: 100, y2: 0 });
  });

  it("não junta as duas pontas de uma porta estreita (ela sumiria)", () => {
    const novas = [w(100, 100, 109, 100)];
    expect(soldarPontas(novas, [], tol)).toEqual({ paredes: novas, emendadas: 0 });
  });

  it("parede que para pouco antes de outra é esticada até ela (o T fecha), reta e passando um tiquinho", () => {
    const { paredes, emendadas } = soldarPontas([w(462, 400, 462, 708), w(512, 538, 472, 538)], [], tol);
    expect(paredes).toEqual([w(462, 400, 462, 708), w(512, 538, 461.5, 538)]);
    expect(emendadas).toBe(1);
  });

  it("ponta que já encosta em outra parede fica como veio: canto fechado e T fechado não entortam", () => {
    // Achado com o mapa Stonefall: a parede de baixo começava em cima da parede
    // do lado (um T fechado) e era puxada 9 px pra ponta dela, ficando torta.
    const novas = [
      w(282, 352, 282, 388), // a porta que termina onde a parede de baixo começa
      w(282, 388, 282, 476),
      w(282, 397, 365, 397),
      w(0, 0, 100, 0),
      w(100, 0, 100, 100),
      w(50, 0, 50, 100),
    ];
    expect(soldarPontas(novas, [], tol)).toEqual({ paredes: novas, emendadas: 0 });
  });

  it("nenhuma linha do arquivo muda de lugar: a fresta fecha com um trechinho a mais", () => {
    // Também do Stonefall: a parede de cima do corredor parava 10 px acima do
    // canto. Puxar a ponta deixava 10 px de desnível em 50 px de parede — e
    // puxar a ponta de uma parede comprida abria o T de outra no meio dela.
    const novas = [w(438, 548, 462, 548), w(462, 548, 462, 708), w(512, 538, 462, 538)];
    const { paredes, emendadas } = soldarPontas(novas, [], tol);
    expect(paredes).toEqual([...novas, w(462, 538, 462, 548)]);
    expect(emendadas).toBe(1);
  });

  it("ponta solta rente ao meio de outra parede, sem estar apontada pra ela: o trechinho liga as duas", () => {
    const novas = [w(0, 100, 400, 100), w(100, 108, 300, 108)];
    const { paredes, emendadas } = soldarPontas(novas, [], tol);
    expect(paredes).toEqual([...novas, w(100, 108, 100, 100), w(300, 108, 300, 100)]);
    expect(emendadas).toBe(2);
  });

  it("guarda o que mais a parede trouxer (porta, aberta)", () => {
    const porta: NovaParede = { tipo: "porta", aberta: true, x1: 0, y1: 0, x2: 50, y2: 0 };
    expect(soldarPontas([porta], [], tol).paredes).toEqual([porta]);
  });

  it("a leitura do arquivo já devolve as frestas fechadas e diz quantas foram", () => {
    const r = certo(ler({ largura: 760, altura: 760, paredes: [[100, 100, 400, 100], [404, 106, 404, 300]] }));
    expect(r.novas).toHaveLength(3);
    expect(r).toMatchObject({ paredes: 3, emendadas: 1 });
  });
});

describe("o limite da cena", () => {
  // Longe umas das outras (e das que já existem): sem fresta pra fechar, a conta é só a do arquivo.
  const muitas = (n: number) => Array.from({ length: n }, (_, i) => [0, 100 + i * 50, 700, 100 + i * 50]);

  it("não importa pela metade: se não cabe, diz quantas cabem", () => {
    const existentes = Array.from({ length: PAREDES_MAXIMAS - 3 }, () => ({ x1: 0, y1: 0, x2: 10, y2: 0 }));
    const r = ler({ paredes: muitas(4) }, cena, existentes);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("só cabem mais 3");
  });

  it("o trechinho que fecha fresta conta no limite", () => {
    const existentes = Array.from({ length: PAREDES_MAXIMAS - 3 }, () => ({ x1: 700, y1: 700, x2: 750, y2: 700 }));
    const r = ler({ paredes: [[438, 548, 462, 548], [462, 548, 462, 708], [512, 538, 462, 538]] }, cena, existentes);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("dá 4 paredes e portas");
  });

  it("no limite exato, entra", () => {
    const existentes = Array.from({ length: PAREDES_MAXIMAS - 4 }, () => ({ x1: 0, y1: 0, x2: 10, y2: 0 }));
    expect(ler({ paredes: muitas(4) }, cena, existentes).ok).toBe(true);
  });
});

describe("o pedido pra IA", () => {
  it("leva o tamanho da cena, e a resposta no formato pedido é lida de volta", () => {
    const pedido = pedidoDeParedes({ largura: 1600, altura: 900 });
    expect(pedido).toContain("1600 de largura por 900 de altura");
    expect(pedido).toContain(`"largura": 1600, "altura": 900`);
    const exemplo = pedido.split("\n").at(-1)!.replaceAll("x1", "10").replaceAll("y1", "10").replaceAll("x2", "300").replaceAll("y2", "10");
    expect(certo(lerParedesDoTexto(exemplo, { largura: 1600, altura: 900 }, []))).toMatchObject({ paredes: 1, portas: 1, semMedida: false });
  });
});
