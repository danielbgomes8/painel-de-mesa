import { describe, expect, it } from "vitest";
import { MONSTROS_SRD } from "./monstrosSrd";
import { descreverAtaque, lerAtaquesRolaveis, resolverAtaque, type AtaqueRolavel } from "./regras";

/** Dado viciado: devolve os valores na ordem dada. */
const viciado = (...valores: number[]) => {
  let i = 0;
  return () => valores[i++];
};

describe("ler o ataque do texto livre", () => {
  it("todo monstro do catálogo tem pelo menos um ataque rolável, com acerto e dano", () => {
    for (const m of MONSTROS_SRD) {
      const { ataques } = lerAtaquesRolaveis(m.ataque);
      expect(ataques.length, m.name).toBeGreaterThan(0);
      for (const a of ataques) {
        expect(a.bonus, `${m.name}: ${a.nome}`).not.toBeNull();
        expect(a.partes.length, `${m.name}: ${a.nome}`).toBeGreaterThan(0);
      }
    }
  });

  it("dois ataques separados por ·", () => {
    expect(lerAtaquesRolaveis("Cimitarra +4, 1d6+2 cortante · Arco curto +4, 1d6+2 perfurante")).toEqual({
      multiataque: null,
      ataques: [
        { nome: "Cimitarra", bonus: 4, vezes: 1, partes: [{ qtd: 1, faces: 6, mod: 2, tipo: "cortante" }] },
        { nome: "Arco curto", bonus: 4, vezes: 1, partes: [{ qtd: 1, faces: 6, mod: 2, tipo: "perfurante" }] },
      ],
    });
  });

  it("'3x' vira três ataques num toque, e o dano extra entra junto", () => {
    const [a] = lerAtaquesRolaveis("3x Dilacerar +9, 2d6+5 cortante + 1d6 elétrico").ataques;
    expect(a.vezes).toBe(3);
    expect(a.partes).toEqual([
      { qtd: 2, faces: 6, mod: 5, tipo: "cortante" },
      { qtd: 1, faces: 6, mod: 0, tipo: "elétrico" },
    ]);
  });

  it("'de fogo', 'de trovão': o tipo vem depois do 'de'", () => {
    expect(lerAtaquesRolaveis("3x Dilacerar +10, 2d6+6 cortante + 1d6 de fogo").ataques[0].partes[1].tipo).toBe("fogo");
    expect(lerAtaquesRolaveis("2x Golpe Trovejante +8, 2d8+5 de trovão").ataques[0].partes[0].tipo).toBe("trovão");
  });

  it("'2 ataques:' é quantos por turno; observação entre parênteses não vira dano", () => {
    const leitura = lerAtaquesRolaveis(
      "2 ataques: Arranhão +5, 2d6+3 cortante · Arco longo +4, 2d8+2 perfurante (troca 1 por Mordida +5, 2d8+3)",
    );
    expect(leitura.multiataque).toBe(2);
    expect(leitura.ataques.map((a) => a.nome)).toEqual(["Arranhão", "Arco longo"]);
    expect(leitura.ataques[1].partes).toHaveLength(1);
  });

  it("'e' entre dois ataques separa; palavra solta depois do dano não vira tipo", () => {
    const leitura = lerAtaquesRolaveis("Machado de batalha +7, 2d8+5 cortante e Mangual +7, 2d8+5 perfurante");
    expect(leitura.ataques.map((a) => a.nome)).toEqual(["Machado de batalha", "Mangual"]);
    const garra = lerAtaquesRolaveis("2x Garra +6, 2d4+3 cortante, mais uma mordida").ataques[0];
    expect(garra.partes).toEqual([{ qtd: 2, faces: 4, mod: 3, tipo: "cortante" }]);
  });

  it("modificador não engole o próximo dado ('1d6 + 2d4')", () => {
    expect(lerAtaquesRolaveis("Golpe +3, 1d6 + 2d4 radiante").ataques[0].partes).toEqual([
      { qtd: 1, faces: 6, mod: 0, tipo: "" },
      { qtd: 2, faces: 4, mod: 0, tipo: "radiante" },
    ]);
  });

  it("formato da ficha do jogador: uma linha por ataque, nome antes do ':'", () => {
    expect(lerAtaquesRolaveis("Malho +1: +7, 2d6+9 contundente\nArco: +5, 1d8+3").ataques).toEqual([
      { nome: "Malho +1", bonus: 7, vezes: 1, partes: [{ qtd: 2, faces: 6, mod: 9, tipo: "contundente" }] },
      { nome: "Arco", bonus: 5, vezes: 1, partes: [{ qtd: 1, faces: 8, mod: 3, tipo: "" }] },
    ]);
  });

  it("sem bônus de acerto é só dano (o alvo é quem rola o teste)", () => {
    const [sopro] = lerAtaquesRolaveis("Sopro: CD 13, 4d6 fogo").ataques;
    expect(sopro.bonus).toBeNull();
    expect(sopro.partes[0]).toEqual({ qtd: 4, faces: 6, mod: 0, tipo: "fogo" });
  });

  it("texto sem dado nenhum não tem o que rolar", () => {
    expect(lerAtaquesRolaveis("").ataques).toEqual([]);
    expect(lerAtaquesRolaveis("foge com menos de 10 PV").ataques).toEqual([]);
  });
});

describe("rolar o ataque", () => {
  const cimitarra: AtaqueRolavel = { nome: "Cimitarra", bonus: 4, vezes: 1, partes: [{ qtd: 1, faces: 6, mod: 2, tipo: "cortante" }] };

  it("normal: um d20 + bônus, dano com modificador", () => {
    const r = resolverAtaque(cimitarra, "normal", viciado(15, 4));
    expect(r).toMatchObject({ d20s: [15], d20: 15, acerto: 19, critico: false, erroCritico: false, dano: 6 });
    expect(descreverAtaque(r, 4)).toEqual({ acerto: "🎲 15 +4 = 19", dano: "6 de dano cortante (4 +2)" });
  });

  it("vantagem fica com o maior d20; desvantagem com o menor", () => {
    expect(resolverAtaque(cimitarra, "vantagem", viciado(5, 17, 3)).d20).toBe(17);
    expect(resolverAtaque(cimitarra, "desvantagem", viciado(5, 17, 3)).d20).toBe(5);
    expect(descreverAtaque(resolverAtaque(cimitarra, "vantagem", viciado(5, 17, 3)), 4).acerto).toBe("🎲 17 (e 5) +4 = 21");
  });

  it("20 natural: crítico rola os dados de dano duas vezes, o modificador uma", () => {
    const r = resolverAtaque(cimitarra, "normal", viciado(20, 3, 5));
    expect(r.critico).toBe(true);
    expect(r.partes[0].dados).toEqual([3, 5]);
    expect(r.dano).toBe(10);
    expect(descreverAtaque(r, 4).acerto).toBe("🎲 20 +4 = 24 — 20 natural, CRÍTICO");
  });

  it("1 natural erra, não importa o bônus", () => {
    const r = resolverAtaque(cimitarra, "normal", viciado(1, 6));
    expect(r.erroCritico).toBe(true);
    expect(descreverAtaque(r, 4).acerto).toBe("🎲 1 +4 = 5 — 1 natural, erra");
  });

  it("vários pedaços de dano somam e aparecem separados", () => {
    const [a] = lerAtaquesRolaveis("Ferrão +5, 1d6+3 perfurante + 2d6 veneno").ataques;
    const r = resolverAtaque(a, "normal", viciado(12, 4, 2, 6));
    expect(r.dano).toBe(15);
    expect(descreverAtaque(r, 5).dano).toBe("15 de dano: 7 perfurante (4 +3) + 8 veneno (2+6)");
  });

  it("só dano: não gasta d20", () => {
    const [sopro] = lerAtaquesRolaveis("Sopro: CD 13, 2d6 fogo").ataques;
    const r = resolverAtaque(sopro, "vantagem", viciado(3, 4));
    expect(r.d20s).toEqual([]);
    expect(r.dano).toBe(7);
    expect(descreverAtaque(r, null).acerto).toBeNull();
  });

  it("dano não fica negativo", () => {
    const fraco: AtaqueRolavel = { nome: "Tapa", bonus: 0, vezes: 1, partes: [{ qtd: 1, faces: 4, mod: -3, tipo: "" }] };
    expect(resolverAtaque(fraco, "normal", viciado(10, 1)).dano).toBe(0);
  });
});
