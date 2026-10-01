import { describe, expect, it } from "vitest";
import type { Cena } from "./cenas";
import {
  COR_PECA_INIMIGO,
  COR_PECA_MARCADOR,
  acharPecaNoPonto,
  diametroDaPeca,
  encaixarNaGrade,
  iconesDaPeca,
  iconesVisiveis,
  iniciais,
  montarPecasNaTela,
  nomeDaPeca,
  normalizarPeca,
  pecasDosQueEntram,
  pecaVisivel,
  podeMoverPeca,
  posicoesDosIcones,
  posicoesIniciais,
  regiaoEmTornoDe,
  tamanhoPeloTipo,
  type Peca,
  type PecaNaTela,
} from "./pecas";
import { corDoJogador } from "./ping";

const cena: Pick<Cena, "grade_ligada" | "grade_px" | "grade_dx" | "grade_dy" | "largura" | "altura"> = {
  grade_ligada: true,
  grade_px: 100,
  grade_dx: 0,
  grade_dy: 0,
  largura: 3000,
  altura: 2000,
};

function peca(extra: Partial<Peca> = {}): Peca {
  return {
    id: "p1",
    cena_id: "c1",
    room_code: "s",
    slug: null,
    nome: "Marcador",
    x: 150,
    y: 150,
    tamanho: 1,
    cor: null,
    oculto: false,
    created_at: "",
    ...extra,
  };
}

describe("encaixe na grade", () => {
  it("peão pequeno vai pro centro do quadradinho", () => {
    expect(encaixarNaGrade(cena, 130, 20, 1)).toEqual([150, 50]);
    expect(encaixarNaGrade(cena, 0, 0, 1)).toEqual([50, 50]);
    expect(encaixarNaGrade(cena, 299, 199, 1)).toEqual([250, 150]);
  });

  it("peão grande (2×2) vai pro cruzamento das linhas, onde fica o centro dele", () => {
    expect(encaixarNaGrade(cena, 130, 20, 2)).toEqual([100, 0]);
    expect(encaixarNaGrade(cena, 160, 160, 2)).toEqual([200, 200]);
  });

  it("respeita onde a grade começa", () => {
    const deslocada = { ...cena, grade_dx: 30, grade_dy: 10 };
    expect(encaixarNaGrade(deslocada, 130, 20, 1)).toEqual([180, 60]);
    expect(encaixarNaGrade(deslocada, 130, 20, 2)).toEqual([130, 10]);
  });

  it("nunca deixa o peão sair da imagem", () => {
    expect(encaixarNaGrade(cena, -500, 99999, 1)[0]).toBeGreaterThanOrEqual(0);
    const [x, y] = encaixarNaGrade(cena, 99999, 99999, 1);
    expect(x).toBeLessThanOrEqual(3000);
    expect(y).toBeLessThanOrEqual(2000);
  });

  it("sem grade, só mantém dentro da imagem", () => {
    expect(encaixarNaGrade({ ...cena, grade_ligada: false }, 123.456, 78.9, 1)).toEqual([123.5, 78.9]);
    expect(encaixarNaGrade({ ...cena, grade_ligada: false }, -10, 5000, 1)).toEqual([0, 2000]);
  });

  it("o diâmetro acompanha o tamanho e fica um pouco menor que o quadradinho", () => {
    expect(diametroDaPeca(cena, 1)).toBeCloseTo(88, 5);
    expect(diametroDaPeca(cena, 2)).toBeCloseTo(176, 5);
    expect(diametroDaPeca(cena, 1)).toBeLessThan(cena.grade_px);
  });
});

describe("posição de partida", () => {
  it("o grupo entra numa fileira centrada no que se está vendo, um por quadradinho", () => {
    const regiao = { x: 1000, y: 500, w: 800, h: 600 };
    const ps = posicoesIniciais(cena, 4, regiao);
    expect(ps).toHaveLength(4);
    // cada um num quadradinho diferente, todos no centro de um quadradinho
    expect(new Set(ps.map(([x, y]) => `${x},${y}`)).size).toBe(4);
    for (const [x, y] of ps) {
      expect(x % 100).toBe(50);
      expect(y % 100).toBe(50);
    }
    const xs = ps.map((p) => p[0]);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(1000);
    expect(Math.max(...xs)).toBeLessThanOrEqual(1800);
  });

  it("muita gente quebra em fileiras em vez de sair da tela", () => {
    const regiao = { x: 0, y: 0, w: 500, h: 500 };
    const ps = posicoesIniciais(cena, 12, regiao);
    expect(new Set(ps.map(([x, y]) => `${x},${y}`)).size).toBe(12);
    expect(new Set(ps.map((p) => p[1])).size).toBeGreaterThan(1);
  });

  it("peão novo não cai em cima de peão que já está lá: a fileira desce até achar lugar livre", () => {
    const regiao = { x: 1000, y: 500, w: 800, h: 600 };
    const grupo = posicoesIniciais(cena, 3, regiao);
    const inimigos = posicoesIniciais(cena, 2, regiao, grupo);
    for (const [x, y] of inimigos) {
      expect(grupo.some(([gx, gy]) => Math.hypot(x - gx, y - gy) < 60)).toBe(false);
    }
    // continua centrado no que se vê, só uma fileira abaixo
    expect(new Set(inimigos.map((p) => p[1])).size).toBe(1);
    expect(Math.abs(inimigos[0][1] - grupo[0][1])).toBe(100);
  });

  it("uma terceira leva continua achando lugar, sem empilhar", () => {
    const regiao = { x: 1000, y: 500, w: 800, h: 600 };
    const a = posicoesIniciais(cena, 3, regiao);
    const b = posicoesIniciais(cena, 2, regiao, a);
    const c3 = posicoesIniciais(cena, 4, regiao, [...a, ...b]);
    const todos = [...a, ...b, ...c3];
    expect(new Set(todos.map(([x, y]) => `${x},${y}`)).size).toBe(todos.length);
  });

  it("sem região (tela ainda não medida), usa o meio do mapa", () => {
    const [[x, y]] = posicoesIniciais(cena, 1, null);
    expect(x).toBe(1550);
    expect(y).toBe(1050);
  });
});

describe("clicar num peão", () => {
  const p = (id: string, x: number): PecaNaTela => ({
    id,
    x,
    y: 100,
    tamanho: 1,
    diametro: 80,
    rotulo: "X",
    nome: "X",
    cor: "#fff",
    oculto: false,
    vez: false,
    selecionada: false,
    podeMover: true,
    deslocamento: null,
    semNevoa: true,
    icones: [],
    observa: true,
    inimigo: false,
  });

  it("acha o peão sob o ponto e ignora quem está fora do círculo", () => {
    const lista = [p("a", 100), p("b", 300)];
    expect(acharPecaNoPonto(lista, 110, 100)?.id).toBe("a");
    expect(acharPecaNoPonto(lista, 300, 139)?.id).toBe("b");
    expect(acharPecaNoPonto(lista, 300, 141)).toBeNull();
    expect(acharPecaNoPonto(lista, 200, 100)).toBeNull();
  });

  it("onde dois peões se sobrepõem, pega o de cima (o último desenhado)", () => {
    const lista = [p("embaixo", 100), p("em-cima", 120)];
    expect(acharPecaNoPonto(lista, 110, 100)?.id).toBe("em-cima");
  });
});

describe("quem mexe e quem vê", () => {
  it("o Mestre mexe em tudo; o jogador só no peão da própria ficha", () => {
    const meu = peca({ slug: "tiberio" });
    const doOutro = peca({ slug: "milo" });
    const avulso = peca({ slug: null });
    expect(podeMoverPeca(meu, { mestre: false, meuSlug: "tiberio" })).toBe(true);
    expect(podeMoverPeca(doOutro, { mestre: false, meuSlug: "tiberio" })).toBe(false);
    expect(podeMoverPeca(avulso, { mestre: false, meuSlug: "tiberio" })).toBe(false);
    expect(podeMoverPeca(avulso, { mestre: true, meuSlug: null })).toBe(true);
  });

  it("jogador não mexe em nada quando não escolheu personagem", () => {
    expect(podeMoverPeca(peca({ slug: "tiberio" }), { mestre: false, meuSlug: null })).toBe(false);
  });

  it("peão sob a névoa não aparece pra mesa, mas o Mestre e o próprio dono veem", () => {
    const p = peca({ slug: "tiberio" });
    expect(pecaVisivel(p, { mestre: false, meuSlug: "milo" }, true)).toBe(false);
    expect(pecaVisivel(p, { mestre: false, meuSlug: "milo" }, false)).toBe(true);
    expect(pecaVisivel(p, { mestre: false, meuSlug: "tiberio" }, true)).toBe(true);
    expect(pecaVisivel(p, { mestre: true, meuSlug: null }, true)).toBe(true);
  });

  it("peão oculto some pra mesa mesmo fora da névoa, mas o dono e o Mestre veem", () => {
    const p = peca({ slug: "goblin-1", oculto: true });
    expect(pecaVisivel(p, { mestre: false, meuSlug: "milo" }, false)).toBe(false);
    expect(pecaVisivel(p, { mestre: true, meuSlug: null }, false)).toBe(true);
    expect(pecaVisivel(peca({ slug: "milo", oculto: true }), { mestre: false, meuSlug: "milo" }, false)).toBe(true);
  });
});

describe("rótulo sem entregar inimigo", () => {
  it("iniciais de nomes comuns", () => {
    expect(iniciais("Tibério Vaz")).toBe("TV");
    expect(iniciais("Goblin 2")).toBe("G2");
    expect(iniciais("Chefe goblin 12")).toBe("C12");
    expect(iniciais("Milo")).toBe("Mi");
    expect(iniciais("x")).toBe("X");
    expect(iniciais("  ")).toBe("?");
    expect(iniciais("Mistery Grey")).toBe("MG");
  });

  it("jogador vê o nome do jogador e '?' do inimigo não revelado; revelado, vê o nome", () => {
    const jogador = { slug: "milo", name: "Milo", is_npc: false, revealed: false };
    const oculto = { slug: "dragao", name: "Dragão Vermelho", is_npc: true, revealed: false };
    const revelado = { ...oculto, revealed: true };
    expect(nomeDaPeca({ slug: "milo", nome: "" }, jogador, false)).toBe("Milo");
    expect(nomeDaPeca({ slug: "dragao", nome: "" }, oculto, false)).toBe("?");
    expect(nomeDaPeca({ slug: "dragao", nome: "" }, revelado, false)).toBe("Dragão Vermelho");
    expect(nomeDaPeca({ slug: "dragao", nome: "" }, oculto, true)).toBe("Dragão Vermelho");
  });

  it("marcador avulso mostra o nome que o Mestre deu; ficha apagada vira '?'", () => {
    expect(nomeDaPeca({ slug: null, nome: "Armadilha" }, undefined, false)).toBe("Armadilha");
    expect(nomeDaPeca({ slug: null, nome: "" }, undefined, false)).toBe("?");
  });
});

describe("o que o canvas desenha", () => {
  const fichas = [
    { slug: "tiberio", name: "Tibério Vaz", is_npc: false, revealed: false },
    { slug: "milo", name: "Milo", is_npc: false, revealed: false },
    { slug: "dragao", name: "Dragão Vermelho", is_npc: true, revealed: false },
  ];
  const pecas = [
    peca({ id: "a", slug: "tiberio" }),
    peca({ id: "b", slug: "milo" }),
    peca({ id: "c", slug: "dragao", oculto: true }),
    peca({ id: "d", slug: null, nome: "Armadilha", cor: "#112233" }),
  ];
  const base = { pecas, cena, fichas, slugsDosJogadores: ["tiberio", "milo"], selecionadaId: null };

  it("a mesa vê o jogador com a cor dele (a mesma do ping) e o inimigo como '?' vermelho", () => {
    const tela = montarPecasNaTela({ ...base, vezDe: null, visao: { mestre: false, meuSlug: "milo" } });
    const [a, , c, d] = tela;
    expect(a.cor).toBe(corDoJogador("tiberio", ["tiberio", "milo"]));
    expect(a.rotulo).toBe("TV");
    expect(c.rotulo).toBe("?");
    expect(c.nome).toBe("?");
    expect(c.cor).toBe(COR_PECA_INIMIGO);
    expect(d.cor).toBe("#112233");
    expect(d.rotulo).toBe("Ar");
  });

  it("o Mestre lê o nome verdadeiro do inimigo", () => {
    const tela = montarPecasNaTela({ ...base, vezDe: null, visao: { mestre: true, meuSlug: null } });
    expect(tela[2].nome).toBe("Dragão Vermelho");
    expect(tela[2].rotulo).toBe("DV");
    expect(tela.every((p) => p.podeMover && p.semNevoa)).toBe(true);
  });

  it("o jogador arrasta só o próprio e só ele fura a névoa", () => {
    const tela = montarPecasNaTela({ ...base, vezDe: null, visao: { mestre: false, meuSlug: "milo" } });
    expect(tela.map((p) => p.podeMover)).toEqual([false, true, false, false]);
    expect(tela.map((p) => p.semNevoa)).toEqual([false, true, false, false]);
  });

  it("o deslocamento da ficha vai pro peão só de quem pode mexer nele (o do inimigo é do Mestre)", () => {
    const comVelocidade = [
      { slug: "tiberio", name: "Tibério Vaz", is_npc: false, revealed: false, speed: 9 },
      { slug: "milo", name: "Milo", is_npc: false, revealed: false, speed: 7.5 },
      { slug: "dragao", name: "Dragão Vermelho", is_npc: true, revealed: false, speed: 18 },
    ];
    const jogador = montarPecasNaTela({ ...base, fichas: comVelocidade, vezDe: null, visao: { mestre: false, meuSlug: "milo" } });
    expect(jogador.map((p) => p.deslocamento)).toEqual([null, 7.5, null, null]);
    const mestre = montarPecasNaTela({ ...base, fichas: comVelocidade, vezDe: null, visao: { mestre: true, meuSlug: null } });
    expect(mestre.map((p) => p.deslocamento)).toEqual([9, 7.5, 18, null]);
  });

  it("marca de quem é a vez, e a seleção", () => {
    const tela = montarPecasNaTela({ ...base, vezDe: "milo", selecionadaId: "a", visao: { mestre: true, meuSlug: null } });
    expect(tela.map((p) => p.vez)).toEqual([false, true, false, false]);
    expect(tela.map((p) => p.selecionada)).toEqual([true, false, false, false]);
  });

  it("marcador sem cor e sem ficha fica cinza", () => {
    const tela = montarPecasNaTela({ ...base, pecas: [peca({ id: "x", slug: null })], vezDe: null, visao: { mestre: true, meuSlug: null } });
    expect(tela[0].cor).toBe(COR_PECA_MARCADOR);
  });
});

describe("o que vem do banco", () => {
  it("lê uma linha de peão (número em texto também)", () => {
    const p = normalizarPeca({ id: "a", cena_id: "c", slug: "milo", nome: "Milo", x: "120.5", y: 80, tamanho: 2, cor: "#aabbcc", oculto: true });
    expect(p).toMatchObject({ x: 120.5, y: 80, tamanho: 2, cor: "#aabbcc", oculto: true, slug: "milo" });
  });

  it("linha torta vira padrão sensato, ou é descartada se não dá pra desenhar", () => {
    expect(normalizarPeca({ id: "a", cena_id: "c", x: 1, y: 1, tamanho: 99, cor: "vermelho" })).toMatchObject({ tamanho: 1, cor: null, oculto: false, slug: null });
    expect(normalizarPeca({ id: "a", cena_id: "c", x: "abc", y: 1 })).toBeNull();
    expect(normalizarPeca({ id: "a", x: 1, y: 1 })).toBeNull();
    expect(normalizarPeca(null)).toBeNull();
  });
});

describe("condições no peão", () => {
  const ficha = (extra: Record<string, unknown> = {}) => ({
    slug: "milo",
    name: "Milo",
    is_npc: false,
    revealed: false,
    ...extra,
  });

  it("peão sem ficha (marcador) ou sem condição não leva ícone", () => {
    expect(iconesDaPeca(undefined)).toEqual([]);
    expect(iconesDaPeca(ficha())).toEqual([]);
    expect(iconesDaPeca(ficha({ cond: { Cego: false }, exh: 0, hp: 10 }))).toEqual([]);
  });

  it("cada condição ligada vira um ícone, na ordem dos chips", () => {
    const icones = iconesDaPeca(ficha({ cond: { Atordoado: true, Cego: true, Surdo: true }, hp: 10 }));
    expect(icones.map((i) => i.nome)).toEqual(["Cego", "Surdo", "Atordoado"]);
    expect(icones.every((i) => i.emoji.length > 0 && /^#[0-9a-f]{6}$/i.test(i.cor))).toBe(true);
  });

  it("nome estranho gravado no banco não vira ícone sem explicação", () => {
    expect(iconesDaPeca(ficha({ cond: { Teletransportado: true, Cego: true } })).map((i) => i.nome)).toEqual(["Cego"]);
  });

  it("jogador a 0 PV aparece Inconsciente, na frente; inimigo a 0 PV não (o PV dele é do Mestre)", () => {
    const jogador = iconesDaPeca(ficha({ cond: { Cego: true }, hp: 0 }));
    expect(jogador.map((i) => i.nome)).toEqual(["Inconsciente", "Cego"]);
    expect(iconesDaPeca(ficha({ is_npc: true, hp: 0 }))).toEqual([]);
  });

  it("Inconsciente ligado na mão e 0 PV não duplicam", () => {
    const icones = iconesDaPeca(ficha({ cond: { Inconsciente: true }, hp: 0 }));
    expect(icones.map((i) => i.nome)).toEqual(["Inconsciente"]);
  });

  it("a exaustão vai por último, com o nível (no máximo 6)", () => {
    const icones = iconesDaPeca(ficha({ cond: { Cego: true }, exh: 3 }));
    expect(icones.map((i) => i.nome)).toEqual(["Cego", "Exaustão"]);
    expect(icones[1].nivel).toBe(3);
    expect(iconesDaPeca(ficha({ exh: 9 }))[0].nivel).toBe(6);
  });

  it("até quatro cabem; com mais, mostra três e o resto vira +N", () => {
    const tres = iconesDaPeca(ficha({ cond: { Cego: true, Surdo: true, Caído: true } }));
    expect(iconesVisiveis(tres)).toEqual({ mostrar: tres, extras: 0 });
    const quatro = iconesDaPeca(ficha({ cond: { Cego: true, Surdo: true, Caído: true, Contido: true } }));
    expect(iconesVisiveis(quatro).extras).toBe(0);
    const seis = iconesDaPeca(ficha({ cond: { Cego: true, Surdo: true, Caído: true, Contido: true, Atordoado: true }, exh: 2 }));
    const { mostrar, extras } = iconesVisiveis(seis);
    expect(mostrar).toHaveLength(3);
    expect(extras).toBe(3);
  });

  it("os ícones ficam sobre a borda, começando no alto à direita, sem encostar um no outro", () => {
    const r = 40;
    const raio = 15;
    const lugares = posicoesDosIcones(4, r, raio);
    expect(lugares).toHaveLength(4);
    expect(lugares[0].dx).toBeGreaterThan(0);
    expect(lugares[0].dy).toBeLessThan(0);
    for (const l of lugares) expect(Math.hypot(l.dx, l.dy)).toBeCloseTo(r, 6);
    for (let i = 1; i < lugares.length; i++) {
      const d = Math.hypot(lugares[i].dx - lugares[i - 1].dx, lugares[i].dy - lugares[i - 1].dy);
      expect(d).toBeGreaterThanOrEqual(raio * 2 - 1e-6);
    }
    expect(posicoesDosIcones(0, r, raio)).toEqual([]);
  });

  it("o peão que o canvas desenha leva as condições da ficha, pra mesa inteira (inimigo oculto também)", () => {
    const fichas: { slug: string; name: string; is_npc: boolean; revealed: boolean; cond: Record<string, boolean>; hp: number }[] = [
      { slug: "milo", name: "Milo", is_npc: false, revealed: false, cond: { Cego: true }, hp: 5 },
      { slug: "orc", name: "Orc", is_npc: true, revealed: false, cond: { Atordoado: true }, hp: 0 },
    ];
    const tela = montarPecasNaTela({
      pecas: [peca({ id: "a", slug: "milo" }), peca({ id: "b", slug: "orc" }), peca({ id: "c", slug: null })],
      cena,
      fichas,
      vezDe: null,
      slugsDosJogadores: ["milo"],
      visao: { mestre: false, meuSlug: null },
      selecionadaId: null,
    });
    expect(tela.map((p) => p.icones.map((i) => i.nome))).toEqual([["Cego"], ["Atordoado"], []]);
  });
});

describe("quem enxerga", () => {
  const fichas = [
    { slug: "milo", name: "Milo", is_npc: false, revealed: false },
    { slug: "orc", name: "Orc", is_npc: true, revealed: false },
  ];
  const tela = montarPecasNaTela({
    pecas: [peca({ id: "a", slug: "milo" }), peca({ id: "b", slug: "orc" }), peca({ id: "c", slug: null, nome: "Armadilha" })],
    cena,
    fichas,
    vezDe: null,
    slugsDosJogadores: ["milo"],
    visao: { mestre: false, meuSlug: null },
    selecionadaId: null,
  });

  it("só o peão de jogador abre a névoa; o de inimigo e o marcador avulso não", () => {
    expect(tela.map((p) => p.observa)).toEqual([true, false, false]);
  });

  it("o peão de inimigo é marcado (o Mestre pode pedir pra ver a visão dele)", () => {
    expect(tela.map((p) => p.inimigo)).toEqual([false, true, false]);
  });
});

describe("pôr o grupo onde o Mestre tocou", () => {
  it("os peões se agrupam em volta do ponto tocado, não no meio do mapa", () => {
    const toque: [number, number] = [2000, 1500];
    const lugares = posicoesIniciais(cena, 4, regiaoEmTornoDe(cena, toque), []);
    expect(lugares).toHaveLength(4);
    for (const [x, y] of lugares) expect(Math.hypot(x - toque[0], y - toque[1])).toBeLessThan(cena.grade_px * 3);
    // Em cima de gente que já está lá, desce uma fileira (não empilha).
    const de_novo = posicoesIniciais(cena, 4, regiaoEmTornoDe(cena, toque), lugares);
    expect(de_novo.some(([x, y]) => lugares.some(([ox, oy]) => Math.hypot(x - ox, y - oy) < cena.grade_px * 0.6))).toBe(false);
  });

  it("a região é um quadrado em volta do ponto, do tamanho pedido", () => {
    expect(regiaoEmTornoDe(cena, [500, 400], 4)).toEqual({ x: 500 - 200, y: 400 - 200, w: 400, h: 400 });
  });
});

describe("inimigo que entra na iniciativa ganha peão", () => {
  const cenaComCamera = { ...cena, camera: { x: 1000, y: 500, w: 800, h: 600 } };
  const goblin = { slug: "goblin", is_npc: true, cls: "Fada pequena" };
  const ogro = { slug: "ogro", is_npc: true, cls: "Gigante grande" };
  const tiberio = { slug: "tiberio", is_npc: false, cls: "Paladino" };

  it("o tamanho vem do tipo da ficha, como o catálogo escreve", () => {
    expect(tamanhoPeloTipo("Fada pequena")).toBe(1);
    expect(tamanhoPeloTipo("Humanoide médio ou pequeno")).toBe(1);
    expect(tamanhoPeloTipo("Fera miúda")).toBe(1);
    expect(tamanhoPeloTipo("Fera grande")).toBe(2);
    expect(tamanhoPeloTipo("Dragão enorme")).toBe(3);
    expect(tamanhoPeloTipo("Dragão imenso")).toBe(4);
    expect(tamanhoPeloTipo("Large dragon")).toBe(2);
    // texto livre do Mestre, sem tamanho: um quadradinho
    expect(tamanhoPeloTipo("")).toBe(1);
    expect(tamanhoPeloTipo(undefined)).toBe(1);
    expect(tamanhoPeloTipo("Grandalhão")).toBe(1);
  });

  it("só inimigo ganha peão, oculto, e no pedaço que a mesa está vendo", () => {
    const novas = pecasDosQueEntram({ cena: cenaComCamera, fichas: [goblin, tiberio], existentes: [] });
    expect(novas).toHaveLength(1);
    expect(novas[0]).toMatchObject({ slug: "goblin", nome: "", oculto: true, tamanho: 1 });
    expect(novas[0].x).toBeGreaterThanOrEqual(1000);
    expect(novas[0].x).toBeLessThanOrEqual(1800);
    expect(novas[0].y).toBeGreaterThanOrEqual(500);
    expect(novas[0].y).toBeLessThanOrEqual(1100);
  });

  it("quem já tem peão nesta cena não ganha outro (nem se vier repetido)", () => {
    const existentes = [{ slug: "goblin", x: 1450, y: 750 }];
    expect(pecasDosQueEntram({ cena: cenaComCamera, fichas: [goblin], existentes })).toEqual([]);
    expect(pecasDosQueEntram({ cena: cenaComCamera, fichas: [ogro, ogro], existentes: [] })).toHaveLength(1);
  });

  it("não cai em cima de peão que já está no mapa", () => {
    const existentes = [{ slug: "tiberio", x: 1450, y: 850 }, { slug: null, x: 1550, y: 850 }];
    const novas = pecasDosQueEntram({ cena: cenaComCamera, fichas: [goblin, { ...goblin, slug: "goblin-2" }], existentes });
    for (const n of novas) {
      expect(existentes.some((e) => Math.hypot(n.x - e.x, n.y - e.y) < 60)).toBe(false);
    }
  });

  it("monstro grande encaixa no cruzamento das linhas, como ao arrastar", () => {
    const [p] = pecasDosQueEntram({ cena: cenaComCamera, fichas: [ogro], existentes: [] });
    expect(p.tamanho).toBe(2);
    expect(p.x % 100).toBe(0);
    expect(p.y % 100).toBe(0);
  });

  it("sem câmera (a mesa vê o mapa todo), entra no meio do mapa", () => {
    const [p] = pecasDosQueEntram({ cena: { ...cena, camera: null }, fichas: [goblin], existentes: [] });
    expect([p.x, p.y]).toEqual([1550, 1050]);
  });
});
