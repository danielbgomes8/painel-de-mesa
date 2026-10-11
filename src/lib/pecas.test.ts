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
  AURA_MAXIMA_M,
  auraValida,
  iniciais,
  montarPecasNaTela,
  nomeDaPeca,
  normalizarPeca,
  pecasDosCompanheiros,
  pecasDosQueEntram,
  pecasQueAcompanham,
  pecaVisivel,
  podeMoverPeca,
  posicoesDosIcones,
  posicoesIniciais,
  raioDaAuraPx,
  regiaoEmTornoDe,
  tamanhoPeloTipo,
  type Peca,
  type PecaNaTela,
} from "./pecas";
import { corDoJogador } from "./ping";

const cena: Pick<Cena, "grade_ligada" | "grade_px" | "grade_dx" | "grade_dy" | "largura" | "altura" | "metros"> = {
  grade_ligada: true,
  grade_px: 100,
  grade_dx: 0,
  grade_dy: 0,
  largura: 3000,
  altura: 2000,
  metros: 1.5,
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
    aura: null,
    luz: null,
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
    aura: null,
    auraPx: 0,
    espacoPx: 40,
    semNevoa: true,
    icones: [],
    observa: true,
    inimigo: false,
    visaoPx: null,
    luzPx: null,
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

describe("aura (emanação) no peão", () => {
  it("só aceita raio positivo até o máximo, com uma casa decimal; o resto é 'sem aura'", () => {
    expect(auraValida(4.5)).toBe(4.5);
    expect(auraValida("3")).toBe(3);
    expect(auraValida(1.26)).toBe(1.3);
    expect(auraValida(AURA_MAXIMA_M)).toBe(AURA_MAXIMA_M);
    for (const ruim of [0, -2, AURA_MAXIMA_M + 1, NaN, Infinity, null, undefined, "abc", 0.04, {}]) expect(auraValida(ruim)).toBeNull();
  });

  it("lê a aura do banco (numeric vem como texto) e ignora lixo", () => {
    const base = { id: "p", cena_id: "c", x: 1, y: 1 };
    expect(normalizarPeca({ ...base, aura: "4.5" })?.aura).toBe(4.5);
    expect(normalizarPeca({ ...base, aura: null })?.aura).toBeNull();
    expect(normalizarPeca({ ...base })?.aura).toBeNull();
    expect(normalizarPeca({ ...base, aura: -3 })?.aura).toBeNull();
  });

  it("o raio conta da BORDA do espaço da criatura: lado/2 + a distância da aura", () => {
    // quadradinho de 100 px = 1,5 m. Peão médio: borda a 50 px; aura de 3 m = 200 px.
    expect(raioDaAuraPx(cena, 1, 3)).toBe(250);
    // Grande (2×2): borda a 100 px do centro.
    expect(raioDaAuraPx(cena, 2, 3)).toBe(300);
    expect(raioDaAuraPx(cena, 1, null)).toBe(0);
    // O valor do quadradinho em metros é da cena: 3 m por quadrado, a mesma aura vale metade.
    expect(raioDaAuraPx({ ...cena, metros: 3 }, 1, 3)).toBe(150);
  });

  it("vai pro peão na tela com o raio em px, pra mesa e pro Mestre", () => {
    const [a] = montarPecasNaTela({
      pecas: [peca({ id: "a", slug: "tiberio", aura: 4.5 })],
      cena,
      fichas: [{ slug: "tiberio", name: "Tibério Vaz", is_npc: false, revealed: true, speed: 9 }],
      vezDe: null,
      slugsDosJogadores: ["tiberio"],
      visao: { mestre: false, meuSlug: null },
      selecionadaId: null,
    });
    expect(a.aura).toBe(4.5);
    expect(a.auraPx).toBe(50 + 300);
  });
});

describe("companheiro que entra com o dono ganha peão encostado nele", () => {
  const cenaComCamera = { ...cena, camera: { x: 1000, y: 500, w: 800, h: 600 } };
  const dono = { slug: "ana", x: 250, y: 250, tamanho: 1 as const };
  const pip = { slug: "pip", cls: "Fera miúda", dono: "ana" };
  const lobo = { slug: "lobo", cls: "Fera média", dono: "ana" };

  it("nasce visível, no quadradinho do lado do dono", () => {
    const [p] = pecasDosCompanheiros({ cena: cenaComCamera, companheiros: [pip], existentes: [dono] });
    expect(p).toMatchObject({ slug: "pip", oculto: false, tamanho: 1, x: 350, y: 250 });
  });

  it("se o lado está ocupado, vai pro próximo quadradinho livre em volta", () => {
    const [p] = pecasDosCompanheiros({ cena: cenaComCamera, companheiros: [pip], existentes: [dono, { slug: "x", x: 350, y: 250, tamanho: 1 }] });
    expect([p.x, p.y]).toEqual([250, 350]);
  });

  it("vários companheiros do mesmo dono não caem um em cima do outro", () => {
    const r = pecasDosCompanheiros({ cena: cenaComCamera, companheiros: [pip, lobo], existentes: [dono] });
    expect(r).toHaveLength(2);
    expect(r[0].x === r[1].x && r[0].y === r[1].y).toBe(false);
    for (const p of r) expect(Math.hypot(p.x - 250, p.y - 250)).toBeLessThanOrEqual(100 * Math.SQRT2 + 1);
  });

  it("quem já tem peão nesta cena não ganha outro", () => {
    const r = pecasDosCompanheiros({ cena: cenaComCamera, companheiros: [pip], existentes: [dono, { slug: "pip", x: 900, y: 900, tamanho: 1 }] });
    expect(r).toEqual([]);
  });

  it("companheiro grande encosta na borda do peão do dono, sem sobrepor", () => {
    const [p] = pecasDosCompanheiros({ cena: cenaComCamera, companheiros: [{ slug: "urso", cls: "Fera grande", dono: "ana" }], existentes: [dono] });
    expect(p.tamanho).toBe(2);
    expect(Math.hypot(p.x - 250, p.y - 250)).toBeGreaterThanOrEqual(100 * 1.5 * 0.7);
  });

  it("dono sem peão neste mapa: cai no meio do que a mesa vê, visível", () => {
    const [p] = pecasDosCompanheiros({ cena: cenaComCamera, companheiros: [pip], existentes: [] });
    expect(p.oculto).toBe(false);
    expect(p.x).toBeGreaterThanOrEqual(1000);
    expect(p.x).toBeLessThanOrEqual(1800);
  });
});


describe("pecasQueAcompanham", () => {
  const grade = { grade_ligada: true, grade_px: 100, grade_dx: 0, grade_dy: 0, largura: 3000, altura: 2000 };
  const pecas = [
    { id: "d", slug: "ana", x: 250, y: 250, tamanho: 1 as const },
    { id: "c", slug: "pip", x: 350, y: 250, tamanho: 1 as const },
    { id: "o", slug: "bia", x: 650, y: 250, tamanho: 1 as const },
    { id: "m", slug: null, x: 450, y: 250, tamanho: 1 as const },
  ];
  const donos = { pip: "ana" };

  it("o companheiro anda o mesmo tanto que o dono", () => {
    const r = pecasQueAcompanham({ cena: grade, pecas, movida: { id: "d", x: 450, y: 350 }, donos });
    expect(r).toEqual([{ id: "c", x: 550, y: 350 }]);
  });

  it("quem não é companheiro dele não se mexe", () => {
    const r = pecasQueAcompanham({ cena: grade, pecas, movida: { id: "d", x: 450, y: 250 }, donos });
    expect(r.map((p) => p.id)).toEqual(["c"]);
  });

  it("mexer no companheiro não arrasta o dono", () => {
    expect(pecasQueAcompanham({ cena: grade, pecas, movida: { id: "c", x: 550, y: 250 }, donos })).toEqual([]);
  });

  it("peão que ficou no mesmo lugar não gera escrita", () => {
    expect(pecasQueAcompanham({ cena: grade, pecas, movida: { id: "d", x: 250, y: 250 }, donos })).toEqual([]);
  });

  it("fica dentro do mapa", () => {
    const r = pecasQueAcompanham({ cena: grade, pecas, movida: { id: "d", x: 250, y: 250 - 200 }, donos });
    expect(r[0].y).toBeGreaterThanOrEqual(0);
  });

  it("parede entre o companheiro e o destino: ele encosta e não atravessa", () => {
    // Parede vertical em x = 400; o Pip (350) tentaria ir pra 550 junto com a Ana (250 → 450).
    const r = pecasQueAcompanham({ cena: grade, pecas, movida: { id: "d", x: 450, y: 250 }, donos, bloqueios: [[400, 0, 400, 600]] });
    expect(r).toEqual([]);
  });

  it("porta aberta não segura (só o que entra em `bloqueios`)", () => {
    const r = pecasQueAcompanham({ cena: grade, pecas, movida: { id: "d", x: 450, y: 250 }, donos, bloqueios: [] });
    expect(r).toEqual([{ id: "c", x: 550, y: 250 }]);
  });

  it("parede que corta o caminho na diagonal: o companheiro fica do mesmo lado em que estava", () => {
    const r = pecasQueAcompanham({ cena: grade, pecas, movida: { id: "d", x: 250, y: 450 }, donos, bloqueios: [[0, 300, 900, 300]] });
    for (const p of r) expect(p.y).toBeLessThan(300);
  });
});

describe("a luz que o peão carrega", () => {
  const tocha = { nome: "Tocha", alcance: 12, minutos: 60 };
  const fichas = [
    { slug: "tiberio", name: "Tibério Vaz", is_npc: false, revealed: false },
    { slug: "dragao", name: "Dragão Vermelho", is_npc: true, revealed: false },
  ];
  const escura = { ...cena, escura: true, visao_alcance: null };
  const montar = (pecas: Peca[], c: typeof escura | typeof cena) =>
    montarPecasNaTela({ pecas, cena: c, fichas, vezDe: null, slugsDosJogadores: ["tiberio"], visao: { mestre: false, meuSlug: "tiberio" }, selecionadaId: null });

  it("lê a luz das três colunas do banco; sem alcance, sem luz", () => {
    expect(normalizarPeca({ id: "p", cena_id: "c", x: 1, y: 2, luz_nome: "Tocha", luz_alcance: "12", luz_minutos: 40 })?.luz).toEqual({ nome: "Tocha", alcance: 12, minutos: 40 });
    expect(normalizarPeca({ id: "p", cena_id: "c", x: 1, y: 2 })?.luz).toBeNull();
    expect(normalizarPeca({ id: "p", cena_id: "c", x: 1, y: 2, luz_nome: "Tocha", luz_alcance: null })?.luz).toBeNull();
  });

  it("mapa claro: a visão do jogador é a da cena (visaoPx nulo), com ou sem luz", () => {
    const [a] = montar([peca({ id: "a", slug: "tiberio", luz: tocha })], { ...cena, escura: false, visao_alcance: null });
    expect(a.visaoPx).toBeNull();
  });

  it("mapa escuro: a tocha acesa ilumina 12 m em volta; a visão PRÓPRIA continua sendo o quadradinho", () => {
    // 100 px por quadradinho de 1,5 m.
    const [acesa] = montar([peca({ id: "a", slug: "tiberio", luz: tocha })], escura);
    const [apagada] = montar([peca({ id: "a", slug: "tiberio", luz: { ...tocha, minutos: 0 } })], escura);
    const [semLuz] = montar([peca({ id: "a", slug: "tiberio" })], escura);
    expect(acesa.luzPx).toBeCloseTo(800, 6);
    expect(acesa.visaoPx).toBeCloseTo(100, 6);
    expect(apagada.luzPx).toBeNull();
    expect(apagada.visaoPx).toBeCloseTo(100, 6);
    expect(semLuz.luzPx).toBeNull();
    expect(semLuz.visaoPx).toBeCloseTo(100, 6);
  });

  it("visão no escuro é pessoal: amplia a visão própria e não ilumina ninguém", () => {
    const [p] = montar([peca({ id: "a", slug: "tiberio", luz: { nome: "Visão no escuro", alcance: 18, minutos: null } })], escura);
    expect(p.visaoPx).toBeCloseTo(1200, 6);
    expect(p.luzPx).toBeNull();
  });

  it("marcador avulso com tocha (tocha no chão) ilumina, mas não enxerga; oculto, não ilumina", () => {
    const [tocha1, tocha2] = montar(
      [peca({ id: "m", slug: null, nome: "Tocha na parede", luz: tocha }), peca({ id: "n", slug: null, nome: "Escondida", oculto: true, luz: tocha })],
      escura,
    );
    expect(tocha1.luzPx).toBeCloseTo(800, 6);
    expect(tocha1.visaoPx).toBeNull();
    expect(tocha1.observa).toBe(false);
    expect(tocha2.luzPx).toBeNull();
  });

  it("inimigo no escuro enxerga como a cena manda, mesmo carregando luz", () => {
    const [d] = montar([peca({ id: "d", slug: "dragao", luz: tocha })], escura);
    expect(d.visaoPx).toBeNull();
    expect(d.luzPx).toBeCloseTo(800, 6); // mas a tocha dele ilumina pra quem estiver vendo
  });
});
