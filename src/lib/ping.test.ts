import { describe, expect, it } from "vitest";
import {
  COR_PING_MESTRE,
  CORES_JOGADORES,
  PINGS_MAXIMOS,
  PING_DURACAO_MS,
  PING_INTERVALO_MIN_MS,
  adicionarPing,
  animacaoDoPing,
  corDoJogador,
  corDoPing,
  pingsAtivos,
  podePingar,
  pontoNaBorda,
  validarPing,
  type PingNaTela,
} from "./ping";

const cena = { largura: 3000, altura: 2000 };

function ping(id: string, chegouEm: number): PingNaTela {
  return { id, x: 10, y: 10, de: "Tibério", cor: COR_PING_MESTRE, chegouEm };
}

describe("cor de quem pingou", () => {
  it("o Mestre é sempre dourado e os jogadores nunca", () => {
    expect(corDoPing("Maeta", true)).toBe(COR_PING_MESTRE);
    for (const nome of ["Tibério", "Milo", "Sigha", "Mistery Grey", "Mordecai", "Massaranduba", "x"]) {
      expect(corDoPing(nome, false)).not.toBe(COR_PING_MESTRE);
    }
  });

  it("a mesma pessoa pinga sempre com a mesma cor", () => {
    expect(corDoPing("Tibério", false)).toBe(corDoPing("Tibério", false));
  });
});

describe("cor própria de cada jogador", () => {
  const grupo = ["tiberio", "sigha", "milo", "mistery-grey", "mordecai", "massaranduba"];

  it("cada jogador do grupo tem uma cor diferente, e nenhuma é a do Mestre", () => {
    const cores = grupo.map((slug) => corDoJogador(slug, grupo));
    expect(new Set(cores).size).toBe(grupo.length);
    expect(cores).not.toContain(COR_PING_MESTRE);
  });

  it("a cor de um jogador não muda quando outro entra depois dele", () => {
    const antes = corDoJogador("milo", grupo);
    expect(corDoJogador("milo", [...grupo, "novato"])).toBe(antes);
  });

  it("ficha que sumiu da lista cai no plano B, sem quebrar", () => {
    expect(CORES_JOGADORES).toContain(corDoJogador("fantasma", grupo, "Fantasma"));
  });

  it("passou de nove jogadores, as cores se repetem em vez de acabar", () => {
    const muitos = Array.from({ length: 12 }, (_, i) => `j${i}`);
    expect(corDoJogador("j9", muitos)).toBe(corDoJogador("j0", muitos));
  });

  it("a cor da paleta vale como cor de ping vindo de outro aparelho", () => {
    for (const cor of CORES_JOGADORES) {
      expect(validarPing({ id: "a", x: 1, y: 1, de: "x", cor }, { largura: 10, altura: 10 })?.cor).toBe(cor);
    }
  });
});

describe("o que chega de outro aparelho", () => {
  it("aceita um ping de verdade", () => {
    expect(validarPing({ id: "a1", x: 100, y: 200, de: "Tibério", cor: "#5fb0e8" }, cena)).toEqual({
      id: "a1",
      x: 100,
      y: 200,
      de: "Tibério",
      cor: "#5fb0e8",
    });
  });

  it("recusa ponto fora do mapa, número torto e lixo", () => {
    expect(validarPing({ id: "a", x: -1, y: 5, de: "x", cor: "#fff" }, cena)).toBeNull();
    expect(validarPing({ id: "a", x: 3001, y: 5, de: "x", cor: "#fff" }, cena)).toBeNull();
    expect(validarPing({ id: "a", x: Number.NaN, y: 5 }, cena)).toBeNull();
    expect(validarPing({ id: "a", x: "10", y: 5 }, cena)).toBeNull();
    expect(validarPing({ x: 1, y: 1 }, cena)).toBeNull();
    expect(validarPing({ id: "", x: 1, y: 1 }, cena)).toBeNull();
    expect(validarPing(null, cena)).toBeNull();
    expect(validarPing("ping", cena)).toBeNull();
  });

  it("nome gigante é cortado e nome vazio vira 'alguém'", () => {
    const longo = validarPing({ id: "a", x: 1, y: 1, de: "A".repeat(500) }, cena);
    expect(longo?.de).toHaveLength(30);
    expect(validarPing({ id: "a", x: 1, y: 1, de: "   " }, cena)?.de).toBe("alguém");
    expect(validarPing({ id: "a", x: 1, y: 1 }, cena)?.de).toBe("alguém");
  });

  it("cor que não é da paleta é trocada, nunca desenhada (nada de CSS vindo de fora)", () => {
    const p = validarPing({ id: "a", x: 1, y: 1, de: "Milo", cor: "url(javascript:alert(1))" }, cena);
    expect(p?.cor).toBe(corDoPing("Milo", false));
    expect(p?.cor).not.toContain("url");
  });
});

describe("lista de pings na tela", () => {
  it("o ping vive por 3,6 s e depois sai", () => {
    const lista = [ping("a", 1000)];
    expect(pingsAtivos(lista, 1000 + PING_DURACAO_MS - 1)).toHaveLength(1);
    expect(pingsAtivos(lista, 1000 + PING_DURACAO_MS)).toHaveLength(0);
  });

  it("o mesmo ping chegando duas vezes não aparece em dobro", () => {
    const um = adicionarPing([], ping("a", 100));
    expect(adicionarPing(um, ping("a", 150))).toHaveLength(1);
  });

  it("ao chegar ping novo, os vencidos saem", () => {
    const lista = adicionarPing([ping("velho", 0)], ping("novo", PING_DURACAO_MS + 10));
    expect(lista.map((p) => p.id)).toEqual(["novo"]);
  });

  it("passou do limite, ficam só os mais novos", () => {
    let lista: PingNaTela[] = [];
    for (let i = 0; i < PINGS_MAXIMOS + 5; i++) lista = adicionarPing(lista, ping(`p${i}`, 100 + i));
    expect(lista).toHaveLength(PINGS_MAXIMOS);
    expect(lista[lista.length - 1].id).toBe(`p${PINGS_MAXIMOS + 4}`);
    expect(lista[0].id).toBe("p5");
  });

  it("o freio deixa o primeiro ping passar e segura quem pinga sem parar", () => {
    expect(podePingar(null, 1000)).toBe(true);
    expect(podePingar(1000, 1000 + PING_INTERVALO_MIN_MS - 1)).toBe(false);
    expect(podePingar(1000, 1000 + PING_INTERVALO_MIN_MS)).toBe(true);
  });
});

describe("animação", () => {
  it("começa com o primeiro anel nascendo e termina sem nada", () => {
    const comeco = animacaoDoPing(0);
    expect(comeco?.aneis).toEqual([{ raio: 0, alfa: 1 }]);
    expect(comeco?.ponto).toBe(1);
    expect(animacaoDoPing(PING_DURACAO_MS)).toBeNull();
    expect(animacaoDoPing(-5)).toBeNull();
  });

  it("os anéis nascem escalonados: três pulsos, um depois do outro", () => {
    expect(animacaoDoPing(1000)?.aneis).toHaveLength(2);
    expect(animacaoDoPing(1900)?.aneis).toHaveLength(2);
    expect(animacaoDoPing(2800)?.aneis.length).toBeGreaterThanOrEqual(1);
  });

  it("o anel cresce e some: o raio sobe e a opacidade desce", () => {
    const meio = animacaoDoPing(650)?.aneis[0];
    const fim = animacaoDoPing(1200)?.aneis[0];
    expect(meio && fim && fim.raio > meio.raio).toBe(true);
    expect(meio && fim && fim.alfa < meio.alfa).toBe(true);
  });

  it("o ponto e o nome ficam firmes e somem no último quarto", () => {
    expect(animacaoDoPing(PING_DURACAO_MS * 0.5)?.ponto).toBe(1);
    const quase = animacaoDoPing(PING_DURACAO_MS - 1)?.ponto ?? 1;
    expect(quase).toBeLessThan(0.01);
  });
});

describe("ping fora da tela", () => {
  it("dentro da tela não precisa de seta", () => {
    expect(pontoNaBorda(100, 100, 400, 300)).toBeNull();
    expect(pontoNaBorda(0, 300, 400, 300)).toBeNull();
  });

  it("fora da tela, a seta fica na borda apontando pro ping", () => {
    const direita = pontoNaBorda(900, 150, 400, 300, 20);
    expect(direita?.x).toBe(380);
    expect(direita?.y).toBe(150);
    expect(direita?.angulo).toBeCloseTo(0, 5);

    const cima = pontoNaBorda(200, -500, 400, 300, 20);
    expect(cima?.y).toBe(20);
    expect(cima?.angulo).toBeCloseTo(-Math.PI / 2, 1);

    const canto = pontoNaBorda(-100, 900, 400, 300, 20);
    expect(canto?.x).toBe(20);
    expect(canto?.y).toBe(280);
  });
});
