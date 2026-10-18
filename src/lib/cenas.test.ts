import { describe, expect, it } from "vitest";
import {
  ajustarLadoDaGrade,
  cameraValida,
  deslocarGrade,
  ehTabelaAusente,
  celulaNoPonto,
  celulasNoSegmento,
  enquadrar,
  escalaMinima,
  gradePxParaQuadrados,
  limitarVista,
  misturarVistas,
  QUADRADOS_NO_FOCO,
  regiaoDeFoco,
  mapaParaTela,
  nomeDaCenaPeloArquivo,
  normalizarCena,
  normalizarRegra,
  ordenarRegras,
  quadradosNaLargura,
  raioDoPincel,
  regiaoVisivel,
  retanguloDaCelula,
  retanguloEntre,
  retangulosDasCelulas,
  simplificarTrilha,
  tamanhoReduzido,
  telaParaMapa,
  zoomEm,
  LADO_MAXIMO_IMAGEM,
  PONTOS_MAXIMOS_PINCEL,
  type Cena,
  type Ponto,
  type RegraNevoa,
} from "./cenas";

const cena: Cena = {
  id: "c1",
  room_code: "teste",
  nome: "Masmorra",
  imagem: "teste/c1.jpg",
  largura: 2100,
  altura: 1400,
  grade_ligada: true,
  grade_px: 70,
  grade_dx: 0,
  grade_dy: 0,
  metros: 1.5,
  nevoa_ligada: true,
  na_mesa: false,
  camera: null,
  visao_ligada: false,
  visao_alcance: null,
  escura: false,
  explorado: "",
  created_at: "2026-10-01T12:00:00Z",
};

describe("migration ainda não rodada", () => {
  it("reconhece tabela que não existe (Postgres e PostgREST), pra o app só esconder o mapa", () => {
    expect(ehTabelaAusente({ code: "42P01", message: 'relation "public.cenas" does not exist' })).toBe(true);
    expect(ehTabelaAusente({ code: "PGRST205", message: "Could not find the table 'public.cenas' in the schema cache" })).toBe(true);
    expect(ehTabelaAusente({ message: "Could not find the table 'public.cenas'" })).toBe(true);
  });

  it("erro de verdade (permissão, rede) continua sendo erro", () => {
    expect(ehTabelaAusente({ code: "42501", message: "permission denied for table cenas" })).toBe(false);
    expect(ehTabelaAusente({ message: "TypeError: Failed to fetch" })).toBe(false);
    expect(ehTabelaAusente(null)).toBe(false);
  });
});

describe("imagem", () => {
  it("reduz mantendo a proporção e nunca amplia", () => {
    expect(tamanhoReduzido(6000, 3000)).toEqual({ largura: 3000, altura: 1500 });
    expect(tamanhoReduzido(2000, 5000)).toEqual({ largura: 1200, altura: 3000 });
    expect(tamanhoReduzido(1200, 800)).toEqual({ largura: 1200, altura: 800 });
    expect(Math.max(...Object.values(tamanhoReduzido(9999, 9999)))).toBe(LADO_MAXIMO_IMAGEM);
  });

  it("sugere o nome da cena pelo arquivo", () => {
    expect(nomeDaCenaPeloArquivo("masmorra-do_lich.png")).toBe("masmorra do lich");
    expect(nomeDaCenaPeloArquivo("IMG_0042.JPG")).toBe("IMG 0042");
    expect(nomeDaCenaPeloArquivo(".png")).toBe("Mapa");
  });
});

describe("grade", () => {
  it("diz quantos quadrados cabem e faz a conta inversa", () => {
    expect(quadradosNaLargura(cena)).toBe(30);
    expect(gradePxParaQuadrados(2100, 30)).toBe(70);
    expect(gradePxParaQuadrados(2100, 0)).toBe(70);
    expect(gradePxParaQuadrados(100, 100)).toBe(8); // piso: quadradinho não some
  });

  it("acha o quadradinho de um ponto, respeitando onde a grade começa", () => {
    expect(celulaNoPonto(cena, 0, 0)).toEqual({ col: 0, row: 0 });
    expect(celulaNoPonto(cena, 139, 71)).toEqual({ col: 1, row: 1 });
    expect(celulaNoPonto({ ...cena, grade_dx: 30, grade_dy: 10 }, 29, 9)).toEqual({ col: -1, row: -1 });
    expect(celulaNoPonto({ ...cena, grade_dx: 30, grade_dy: 10 }, 100, 80)).toEqual({ col: 1, row: 1 });
  });

  it("corta o retângulo do quadradinho nas bordas e descarta o que cai fora", () => {
    expect(retanguloDaCelula(cena, 1, 1)).toEqual([70, 70, 70, 70]);
    expect(retanguloDaCelula(cena, 29, 19)).toEqual([2030, 1330, 70, 70]);
    expect(retanguloDaCelula({ ...cena, grade_dx: 30 }, -1, 0)).toEqual([0, 0, 30, 70]);
    expect(retanguloDaCelula(cena, 30, 0)).toBeNull();
    expect(retanguloDaCelula(cena, -1, 0)).toBeNull();
  });

  it("um arrasto rápido não pula quadradinho no meio do caminho", () => {
    const celulas = celulasNoSegmento(cena, [10, 10], [500, 10]);
    expect(celulas.map((c) => c.col)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(celulas.map((c) => c.row))).toEqual(new Set([0]));
    // sem sair do lugar, é só o quadradinho dele
    expect(celulasNoSegmento(cena, [10, 10], [10, 10])).toEqual([{ col: 0, row: 0 }]);
  });

  it("repetir o mesmo quadradinho não duplica retângulo", () => {
    const r = retangulosDasCelulas(cena, [
      { col: 0, row: 0 },
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 99, row: 99 },
    ]);
    expect(r).toEqual([
      [0, 0, 70, 70],
      [70, 0, 70, 70],
    ]);
  });

  it("o retângulo da névoa não depende da grade: mexer na grade depois não desloca nada", () => {
    const r = retangulosDasCelulas(cena, [{ col: 2, row: 2 }]);
    const recalibrada = { ...cena, grade_px: 50, grade_dx: 13 };
    expect(r).toEqual([[140, 140, 70, 70]]);
    expect(retanguloDaCelula(recalibrada, 2, 2)).not.toEqual(r[0]);
  });
});

describe("pincel e retângulo", () => {
  it("o raio do pincel é em quadradinhos; sem grade usa um trinta avos do mapa", () => {
    expect(raioDoPincel(cena, "p")).toBe(35);
    expect(raioDoPincel(cena, "m")).toBe(70);
    expect(raioDoPincel(cena, "g")).toBe(140);
    expect(raioDoPincel({ ...cena, grade_ligada: false }, "m")).toBe(70); // 2100 / 30
  });

  it("o retângulo vale em qualquer sentido de arrasto e é cortado na imagem", () => {
    expect(retanguloEntre(cena, [300, 200], [100, 50])).toEqual([100, 50, 200, 150]);
    expect(retanguloEntre(cena, [-50, -50], [100, 100])).toEqual([0, 0, 100, 100]);
    expect(retanguloEntre(cena, [2000, 1300], [3000, 2000])).toEqual([2000, 1300, 100, 100]);
  });

  it("um toque sem arrastar não vira retângulo", () => {
    expect(retanguloEntre(cena, [100, 100], [101, 101])).toBeNull();
  });

  it("simplifica o traço: tira ponto colado, guarda as pontas e respeita o teto", () => {
    const colados: Ponto[] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [30, 0],
      [31, 0],
      [100, 0],
    ];
    expect(simplificarTrilha(colados, 20)).toEqual([
      [0, 0],
      [30, 0],
      [100, 0],
    ]);
    const enorme: Ponto[] = Array.from({ length: 5000 }, (_, i) => [i * 10, 0]);
    const s = simplificarTrilha(enorme, 1);
    expect(s.length).toBe(PONTOS_MAXIMOS_PINCEL);
    expect(s[0]).toEqual([0, 0]);
    expect(s[s.length - 1]).toEqual([49990, 0]);
    expect(simplificarTrilha([[5.123, 6.987]], 10)).toEqual([[5.12, 6.99]]);
  });
});

describe("zoom e arrastar", () => {
  it("tela e mapa são o inverso um do outro", () => {
    const v = { escala: 0.5, tx: 40, ty: -20 };
    const [mx, my] = telaParaMapa(v, 140, 80);
    expect([mx, my]).toEqual([200, 200]);
    expect(mapaParaTela(v, mx, my)).toEqual([140, 80]);
  });

  it("enquadra o mapa inteiro centralizado, com folga nas bordas", () => {
    const v = enquadrar({ x: 0, y: 0, w: 2100, h: 1400 }, 700, 700);
    // largura manda: 700 / (2100 * 1.06)
    expect(v.escala).toBeCloseTo(700 / 2226, 5);
    const [cx, cy] = mapaParaTela(v, 1050, 700);
    expect(cx).toBeCloseTo(350, 5);
    expect(cy).toBeCloseTo(350, 5);
  });

  it("enquadrar um pedaço mostra aquele pedaço", () => {
    const regiao = { x: 500, y: 300, w: 400, h: 300 };
    const v = enquadrar(regiao, 800, 600, 0);
    expect(v.escala).toBe(2);
    expect(regiaoVisivel(v, 800, 600)).toEqual(regiao);
  });

  it("tela de tamanho zero não gera conta louca", () => {
    expect(enquadrar({ x: 0, y: 0, w: 100, h: 100 }, 0, 0)).toEqual({ escala: 1, tx: 0, ty: 0 });
  });

  it("o ponto embaixo do dedo fica embaixo do dedo ao dar zoom", () => {
    const v = { escala: 1, tx: 10, ty: 20 };
    const antes = telaParaMapa(v, 300, 200);
    const depois = zoomEm(v, 300, 200, 2, 0.1, 8);
    const [x, y] = telaParaMapa(depois, 300, 200);
    expect(x).toBeCloseTo(antes[0], 6);
    expect(y).toBeCloseTo(antes[1], 6);
    expect(depois.escala).toBe(2);
  });

  it("o zoom respeita o mínimo e o máximo", () => {
    const v = { escala: 1, tx: 0, ty: 0 };
    expect(zoomEm(v, 0, 0, 100, 0.2, 8).escala).toBe(8);
    expect(zoomEm(v, 0, 0, 0.001, 0.2, 8).escala).toBe(0.2);
  });

  it("o piso do zoom deixa afastar um pouco além do mapa inteiro", () => {
    const inteiro = enquadrar({ x: 0, y: 0, w: cena.largura, h: cena.altura }, 700, 700).escala;
    expect(escalaMinima(cena, 700, 700)).toBeCloseTo(inteiro * 0.6, 6);
  });

  it("arrastar demais não joga o mapa pra fora da tela", () => {
    const longe = limitarVista({ escala: 1, tx: 99999, ty: -99999 }, cena, 400, 300);
    const [x0, y0] = mapaParaTela(longe, 0, 0);
    expect(x0).toBeLessThan(400); // começa antes do fim da tela
    expect(y0 + cena.altura).toBeGreaterThan(0); // termina depois do começo
    const dentro = { escala: 1, tx: -100, ty: -100 };
    expect(limitarVista(dentro, cena, 400, 300)).toEqual(dentro);
  });
});

describe("câmera da mesa", () => {
  it("corta o que sai da imagem e descarta o que ficou pequeno demais", () => {
    expect(cameraValida({ x: -100, y: -100, w: 500, h: 400 }, cena)).toEqual({ x: 0, y: 0, w: 400, h: 300 });
    expect(cameraValida({ x: 2095, y: 10, w: 500, h: 500 }, cena)).toBeNull();
    expect(cameraValida({ x: 10, y: 10, w: 300, h: 200 }, cena)).toEqual({ x: 10, y: 10, w: 300, h: 200 });
  });
});

describe("o que vem do banco", () => {
  it("lê a linha de uma cena", () => {
    const c = normalizarCena({ ...cena, camera: { x: 1, y: 2, w: 3, h: 4 } });
    expect(c).toMatchObject({ id: "c1", largura: 2100, nevoa_ligada: true, camera: { x: 1, y: 2, w: 3, h: 4 } });
  });

  it("linha estragada vira padrão sensato, não erro", () => {
    const c = normalizarCena({ id: "x", room_code: "s", grade_px: "abc", metros: -3, camera: { x: 1 }, largura: null });
    expect(c).toMatchObject({ grade_px: 70, metros: 0.1, largura: 0, camera: null, nome: "", imagem: null });
    expect(normalizarCena(null)).toBeNull();
    expect(normalizarCena({ room_code: "s" })).toBeNull();
  });

  it("cena nasce coberta e fora da mesa, e grade ligada, quando o banco não diz", () => {
    const c = normalizarCena({ id: "x", room_code: "s" });
    expect(c).toMatchObject({ nevoa_ligada: true, na_mesa: false, grade_ligada: true });
  });

  it("lê pinceladas dos dois formatos e ignora lixo", () => {
    const retangulos = normalizarRegra({
      id: "a",
      seq: "7",
      modo: "revelar",
      forma: "retangulos",
      dados: { r: [[0, 0, 10, 10], [1, 2, 3], "x"] },
    });
    expect(retangulos).toEqual({ id: "a", seq: 7, modo: "revelar", forma: "retangulos", dados: { r: [[0, 0, 10, 10]] } });

    const pincel = normalizarRegra({ id: "b", seq: 8, modo: "esconder", forma: "pincel", dados: { r: 35, p: [[1, 2], [3], "z"] } });
    expect(pincel).toEqual({ id: "b", seq: 8, modo: "esconder", forma: "pincel", dados: { r: 35, p: [[1, 2]] } });

    expect(normalizarRegra({ id: "c", modo: "revelar", forma: "pincel", dados: { r: 0, p: [] } })).toBeNull();
    expect(normalizarRegra({ id: "d", modo: "tanto-faz", forma: "pincel", dados: {} })).toBeNull();
    expect(normalizarRegra({ id: "e", modo: "revelar", forma: "estrela", dados: {} })).toBeNull();
    expect(normalizarRegra({ modo: "revelar", forma: "pincel", dados: {} })).toBeNull();
  });

  it("as pinceladas valem na ordem em que foram feitas, não na ordem em que chegaram", () => {
    const mk = (id: string, seq: number): RegraNevoa => ({ id, seq, modo: "revelar", forma: "retangulos", dados: { r: [] } });
    expect(ordenarRegras([mk("c", 3), mk("a", 1), mk("b", 2)]).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("alinhar a grade arrastando", () => {
  const base = { grade_px: 70, grade_dx: 10, grade_dy: 20 };

  it("anda a grade o tanto que o dedo andou", () => {
    expect(deslocarGrade(base, 15, 5)).toEqual({ grade_dx: 25, grade_dy: 25 });
    expect(deslocarGrade(base, 0, 0)).toEqual({ grade_dx: 10, grade_dy: 20 });
  });

  it("passando de um quadradinho volta pro começo, nos dois sentidos", () => {
    expect(deslocarGrade(base, 65, 55)).toEqual({ grade_dx: 5, grade_dy: 5 });
    expect(deslocarGrade(base, -15, -30)).toEqual({ grade_dx: 65, grade_dy: 60 });
    expect(deslocarGrade(base, 70 * 40 + 3, -70 * 12)).toEqual({ grade_dx: 13, grade_dy: 20 });
  });

  it("arredonda em centésimos e nunca sai de [0, lado)", () => {
    const r = deslocarGrade({ grade_px: 70.5, grade_dx: 0, grade_dy: 0 }, -0.004, 70.499);
    expect(r.grade_dx).toBeGreaterThanOrEqual(0);
    expect(r.grade_dx).toBeLessThan(70.5);
    expect(r.grade_dy).toBeGreaterThanOrEqual(0);
    expect(r.grade_dy).toBeLessThan(70.5);
    expect(deslocarGrade(base, 0.123456, 0).grade_dx).toBe(10.12);
  });

  it("o lado do quadradinho muda em passos finos e respeita o limite do banco (8 a 2000)", () => {
    expect(ajustarLadoDaGrade(70, 0.1)).toBe(70.1);
    expect(ajustarLadoDaGrade(70.1, -1)).toBe(69.1);
    expect(ajustarLadoDaGrade(8.05, -1)).toBe(8);
    expect(ajustarLadoDaGrade(1999.95, 1)).toBe(2000);
  });
});

describe("foco do telão num peão", () => {
  const cena = { largura: 3000, altura: 2000, grade_ligada: true, grade_px: 50 };

  it("enquadra um quadrado de QUADRADOS_NO_FOCO casas centrado no peão", () => {
    const r = regiaoDeFoco(cena, 1000, 800);
    expect(r).toEqual({ x: 1000 - 300, y: 800 - 300, w: 600, h: 600 });
    expect(r.w / cena.grade_px).toBe(QUADRADOS_NO_FOCO);
  });

  it("sem grade usável, usa um terço do lado menor do mapa", () => {
    const r = regiaoDeFoco({ ...cena, grade_ligada: false }, 1500, 1000);
    expect(r.w).toBeCloseTo(2000 / 3);
    expect(r.x + r.w / 2).toBe(1500);
    expect(r.y + r.h / 2).toBe(1000);
  });

  it("misturarVistas vai de uma vista à outra e não passa dos extremos", () => {
    const a = { escala: 1, tx: 0, ty: 0 };
    const b = { escala: 3, tx: -200, ty: 100 };
    expect(misturarVistas(a, b, 0)).toEqual(a);
    expect(misturarVistas(a, b, 1)).toEqual(b);
    expect(misturarVistas(a, b, 0.5)).toEqual({ escala: 2, tx: -100, ty: 50 });
    expect(misturarVistas(a, b, 2)).toEqual(b);
  });
});
