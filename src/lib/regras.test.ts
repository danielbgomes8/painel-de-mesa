import { describe, expect, it } from "vitest";
import {
  ajustarPV,
  aplicarCura,
  aplicarDano,
  aplicarDescansoCurto,
  aplicarDescansoLongo,
  alternarPips,
  descansoLongo,
  deslocamentoEfetivo,
  efeitoExaustao,
  eventoBastiaoPara,
  faixaPV,
  formatarMetros,
  gastarDadoDeVida,
  limitarExaustao,
  limitarPV,
  mensagemAjustePV,
  mensagemCondicao,
  mensagemDanoAbsorvido,
  nomeExibidoIniciativa,
  numerarNpcsNaOrdem,
  ordenarPorIniciativa,
  penalidadeD20,
  podeEditarPersonagem,
  proximoTurno,
  pvExibidoIniciativa,
  recuperarDadosDeVida,
  reducaoDeslocamento,
  reduzirPrazosCondicao,
  separarAtaques,
  situacaoMorte,
  turnoAposRemover,
  turnoAposTrocar,
  ataqueMagia,
  bonusPericia,
  bonusProficiencia,
  bonusResistencia,
  cdMagia,
  espacosDeMagia,
  modificador,
  nivelTotal,
  percepcaoPassiva,
  somaModificadores,
} from "./regras";
import type { Proficiencias } from "./tipos";

describe("PV", () => {
  it("trava entre 0 e o máximo", () => {
    expect(limitarPV(-5, 30)).toBe(0);
    expect(limitarPV(99, 30)).toBe(30);
    expect(limitarPV(12, 30)).toBe(12);
  });

  it("máximo negativo vira 0", () => {
    expect(limitarPV(10, -3)).toBe(0);
  });

  it("dano não deixa o PV negativo", () => {
    expect(ajustarPV({ hp: 4, hp_max: 20, dss: 0, dsf: 0 }, 4 - 10)).toEqual({ hp: 0 });
  });

  it("cura não passa do máximo", () => {
    expect(ajustarPV({ hp: 18, hp_max: 20, dss: 0, dsf: 0 }, 18 + 10)).toEqual({ hp: 20 });
  });

  it("recuperar PV acima de 0 zera os testes de morte", () => {
    expect(ajustarPV({ hp: 0, hp_max: 20, dss: 1, dsf: 2 }, 5)).toEqual({ hp: 5, dss: 0, dsf: 0 });
  });

  it("não mexe nos testes de morte se continuava acima de 0", () => {
    expect(ajustarPV({ hp: 10, hp_max: 20, dss: 0, dsf: 0 }, 15)).toEqual({ hp: 15 });
  });

  it("não zera testes de morte se o alvo continua a 0", () => {
    expect(ajustarPV({ hp: 0, hp_max: 20, dss: 1, dsf: 1 }, 0)).toEqual({ hp: 0 });
  });

  it("faixa da barra", () => {
    expect(faixaPV(20, 20)).toBe("cheio");
    expect(faixaPV(12, 20)).toBe("baixo");
    expect(faixaPV(6, 20)).toBe("critico");
    expect(faixaPV(0, 20)).toBe("critico");
  });
});

describe("PV temporário", () => {
  it("dano desconta do temporário antes do PV normal", () => {
    expect(aplicarDano({ hp: 20, hp_max: 20, dss: 0, dsf: 0, hp_temp: 5 }, 3)).toEqual({
      hp: 20,
      hp_temp: 2,
    });
  });

  it("dano que estoura o temporário passa o resto pro PV normal", () => {
    expect(aplicarDano({ hp: 20, hp_max: 20, dss: 0, dsf: 0, hp_temp: 5 }, 8)).toEqual({
      hp: 17,
      hp_temp: 0,
    });
  });

  it("cura não mexe no PV temporário", () => {
    expect(aplicarCura({ hp: 10, hp_max: 20, dss: 0, dsf: 0 }, 5)).toEqual({ hp: 15 });
  });

  it("mensagem de log usa a variação real de PV", () => {
    expect(mensagemAjustePV("Tibério", -5, 10, 20)).toBe("Tibério sofreu 5 de dano (10/20)");
    expect(mensagemAjustePV("Goblin", 3, 8, 8)).toBe("Goblin recuperou 3 PV (8/8)");
  });

  it("mensagem quando o dano some todo no PV temporário", () => {
    expect(mensagemDanoAbsorvido("Tibério", 3)).toBe(
      "Tibério sofreu 3 de dano, todo absorvido pelo PV temporário",
    );
  });

  it("mensagem de condição ligada/desligada", () => {
    expect(mensagemCondicao("Tibério", "Amedrontado", true)).toBe("Tibério ficou Amedrontado");
    expect(mensagemCondicao("Tibério", "Amedrontado", false)).toBe("Tibério não está mais Amedrontado");
  });
});

describe("exaustão 2024", () => {
  it("trilha 0–6", () => {
    expect(limitarExaustao(-2)).toBe(0);
    expect(limitarExaustao(9)).toBe(6);
  });

  it("-2 no D20 por nível", () => {
    expect(penalidadeD20(0)).toBe(0);
    expect(penalidadeD20(3)).toBe(6);
    expect(penalidadeD20(6)).toBe(12);
  });

  it("-1,5 m de deslocamento por nível", () => {
    expect(reducaoDeslocamento(2)).toBe(3);
    expect(deslocamentoEfetivo(9, 3)).toBe(4.5);
    expect(deslocamentoEfetivo(9, 6)).toBe(0);
  });

  it("descanso longo tira 1 nível, não zera", () => {
    expect(descansoLongo(5)).toBe(4);
    expect(descansoLongo(1)).toBe(0);
    expect(descansoLongo(0)).toBe(0);
  });

  it("formata metros com vírgula pt-BR", () => {
    expect(formatarMetros(4.5)).toBe("4,5 m");
    expect(formatarMetros(9)).toBe("9 m");
  });

  it("texto do efeito", () => {
    expect(efeitoExaustao(0)).toBe("Sem penalidade");
    expect(efeitoExaustao(2)).toContain("-4 em todos os testes de D20");
    expect(efeitoExaustao(2)).toContain("-3 m de deslocamento");
    expect(efeitoExaustao(6)).toContain("morte");
  });
});

describe("dados de vida e descanso", () => {
  it("descanso longo recupera metade dos dados, no mínimo 1", () => {
    expect(recuperarDadosDeVida(10, 4)).toBe(9);
    expect(recuperarDadosDeVida(10, 0)).toBe(5);
    expect(recuperarDadosDeVida(3, 0)).toBe(1);
  });

  it("recuperação não passa do máximo", () => {
    expect(recuperarDadosDeVida(4, 4)).toBe(4);
  });

  it("gastar dado de vida não fica negativo", () => {
    expect(gastarDadoDeVida(1)).toBe(0);
    expect(gastarDadoDeVida(0)).toBe(0);
  });

  it("descanso longo cura tudo, tira 1 exaustão, recupera dados e zera recursos", () => {
    const resultado = aplicarDescansoLongo({
      hp_max: 30,
      exh: 2,
      hd_max: 6,
      hd_cur: 1,
      resources: [{ name: "Fúria", max: 3, cur: 0, short_rest: false }],
    });
    expect(resultado).toEqual({
      hp: 30,
      exh: 1,
      hd_cur: 4,
      resources: [{ name: "Fúria", max: 3, cur: 3, short_rest: false }],
    });
  });

  it("descanso curto só recupera recursos marcados pra isso", () => {
    const resultado = aplicarDescansoCurto({
      resources: [
        { name: "Surto de Ação", max: 1, cur: 0, short_rest: true },
        { name: "Espaços de magia Nv.1", max: 4, cur: 1, short_rest: false },
      ],
    });
    expect(resultado.resources).toEqual([
      { name: "Surto de Ação", max: 1, cur: 1, short_rest: true },
      { name: "Espaços de magia Nv.1", max: 4, cur: 1, short_rest: false },
    ]);
  });
});

describe("testes de morte", () => {
  it("3 sucessos = estável, 3 falhas = morto", () => {
    expect(situacaoMorte(0, 0)).toBe("em-jogo");
    expect(situacaoMorte(3, 0)).toBe("estavel");
    expect(situacaoMorte(1, 3)).toBe("morto");
  });
});

describe("pips", () => {
  it("clicar num vazio preenche até ele", () => {
    expect(alternarPips(2, 0)).toBe(3);
  });
  it("clicar no último preenchido esvazia até ele", () => {
    expect(alternarPips(2, 3)).toBe(2);
  });
});

describe("nome na iniciativa (anti-spoiler de NPC)", () => {
  it("Mestre sempre vê o nome real", () => {
    expect(nomeExibidoIniciativa({ name: "Dragão Ancião", is_npc: true, revealed: false }, 1, true)).toBe(
      "Dragão Ancião",
    );
  });

  it("jogador vê personagem de jogador normalmente", () => {
    expect(nomeExibidoIniciativa({ name: "Tibério Vaz", is_npc: false, revealed: false }, 1, false)).toBe(
      "Tibério Vaz",
    );
  });

  it("jogador vê NPC não revelado como 'Inimigo N'", () => {
    expect(nomeExibidoIniciativa({ name: "Dragão Ancião", is_npc: true, revealed: false }, 2, false)).toBe(
      "Inimigo 2",
    );
  });

  it("jogador vê o nome real depois que o Mestre revela", () => {
    expect(nomeExibidoIniciativa({ name: "Dragão Ancião", is_npc: true, revealed: true }, 1, false)).toBe(
      "Dragão Ancião",
    );
  });

  it("numera só os NPC, na ordem, ignorando jogador no meio", () => {
    const ordem = [{ slug: "goblin-1" }, { slug: "tiberio" }, { slug: "goblin-2" }];
    const ehNpc = (slug: string) => slug.startsWith("goblin");
    expect(numerarNpcsNaOrdem(ordem, ehNpc)).toEqual([1, 1, 2]);
  });
});

describe("PV na iniciativa (anti-spoiler de NPC)", () => {
  it("Mestre sempre vê o PV", () => {
    expect(pvExibidoIniciativa({ is_npc: true, hp: 10, hp_max: 30 }, true)).toEqual({
      hp: 10,
      hp_max: 30,
    });
  });

  it("jogador vê PV de personagem de jogador normalmente", () => {
    expect(pvExibidoIniciativa({ is_npc: false, hp: 40, hp_max: 65 }, false)).toEqual({
      hp: 40,
      hp_max: 65,
    });
  });

  it("jogador nunca vê PV de NPC, mesmo revelado", () => {
    expect(pvExibidoIniciativa({ is_npc: true, hp: 10, hp_max: 30 }, false)).toBeNull();
  });
});

describe("permissão de editar ficha", () => {
  it("Mestre edita qualquer ficha", () => {
    expect(podeEditarPersonagem(true, false)).toBe(true);
  });

  it("jogador edita a própria", () => {
    expect(podeEditarPersonagem(false, true)).toBe(true);
  });

  it("jogador não edita ficha alheia", () => {
    expect(podeEditarPersonagem(false, false)).toBe(false);
  });
});

describe("condição com prazo", () => {
  it("desconta 1 rodada; ao chegar a 0, desliga e some do mapa", () => {
    const r = reduzirPrazosCondicao({ Amedrontado: true }, { Amedrontado: 1 });
    expect(r).toEqual({ cond: { Amedrontado: false }, cond_prazo: {}, expiraram: ["Amedrontado"] });
  });

  it("com mais de 1 rodada restante, só desconta e mantém ligada", () => {
    const r = reduzirPrazosCondicao({ Atordoado: true }, { Atordoado: 3 });
    expect(r).toEqual({ cond: { Atordoado: true }, cond_prazo: { Atordoado: 2 }, expiraram: [] });
  });

  it("condição sem prazo marcado não é mexida", () => {
    const r = reduzirPrazosCondicao({ Caído: true }, {});
    expect(r).toEqual({ cond: { Caído: true }, cond_prazo: {}, expiraram: [] });
  });
});

describe("combate", () => {
  it("próximo turno dá a volta e incrementa a rodada", () => {
    expect(proximoTurno({ round: 1, turn: 0, order: [1, 2, 3] })).toEqual({ round: 1, turn: 1 });
    expect(proximoTurno({ round: 1, turn: 2, order: [1, 2, 3] })).toEqual({ round: 2, turn: 0 });
  });

  it("próximo turno sem ninguém na ordem não faz nada", () => {
    expect(proximoTurno({ round: 3, turn: 0, order: [] })).toEqual({ round: 3, turn: 0 });
  });

  it("ordena por iniciativa mantendo empates estáveis", () => {
    const r = ordenarPorIniciativa([
      { init: 10, name: "a" },
      { init: 15, name: "b" },
      { init: 10, name: "c" },
    ]);
    expect(r.map((x) => x.name)).toEqual(["b", "a", "c"]);
  });

  it("turno acompanha remoção", () => {
    expect(turnoAposRemover(2, 0, 3)).toBe(1);
    expect(turnoAposRemover(2, 3, 3)).toBe(2);
    expect(turnoAposRemover(3, 1, 3)).toBe(2);
  });

  it("turno acompanha troca de posição", () => {
    expect(turnoAposTrocar(1, 1, 0)).toBe(0);
    expect(turnoAposTrocar(0, 1, 0)).toBe(1);
    expect(turnoAposTrocar(4, 1, 0)).toBe(4);
  });
});

describe("evento do Bastião (d100)", () => {
  const tabela = [
    { min: 1, max: 50, nome: "Tudo Bem" },
    { min: 51, max: 55, nome: "Ataque" },
    { min: 99, max: 100, nome: "Tesouro" },
  ];

  it("acha o evento da faixa que contém a rolagem", () => {
    expect(eventoBastiaoPara(1, tabela)).toBe("Tudo Bem");
    expect(eventoBastiaoPara(50, tabela)).toBe("Tudo Bem");
    expect(eventoBastiaoPara(51, tabela)).toBe("Ataque");
    expect(eventoBastiaoPara(100, tabela)).toBe("Tesouro");
  });

  it("devolve undefined se a rolagem não cai em nenhuma faixa", () => {
    expect(eventoBastiaoPara(60, tabela)).toBeUndefined();
  });
});

describe("ficha de classe: atributos, proficiência, CD de magia", () => {
  it("modificador segue a tabela padrão (score-10)/2 arredondado pra baixo", () => {
    expect(modificador(9)).toBe(-1);
    expect(modificador(10)).toBe(0);
    expect(modificador(13)).toBe(1);
    expect(modificador(19)).toBe(4);
  });

  it("bônus de proficiência: +2 (1-4), +3 (5-8), +4 (9-12), +5 (13-16), +6 (17-20)", () => {
    expect(bonusProficiencia(1)).toBe(2);
    expect(bonusProficiencia(4)).toBe(2);
    expect(bonusProficiencia(5)).toBe(3);
    expect(bonusProficiencia(8)).toBe(3);
    expect(bonusProficiencia(9)).toBe(4);
    expect(bonusProficiencia(12)).toBe(4);
    expect(bonusProficiencia(13)).toBe(5);
    expect(bonusProficiencia(17)).toBe(6);
    expect(bonusProficiencia(20)).toBe(6);
  });

  // Fixture real: Tibério Vaz, Feiticeiro 7 (ficha "Marca do Sétimo Raio").
  // Confere igual ao que a própria ficha mostra, sem o +1 de item que ela
  // soma nos saves — a calculadora dá o valor "de livro", ver FichaClasse.
  const atributosTiberio = { for: 9, des: 13, con: 14, int: 12, sab: 12, car: 19 };
  const proficienciasTiberio: Proficiencias = {
    saves: ["con", "car"],
    pericias: { arcanismo: "proficiente", religiao: "proficiente", persuasao: "proficiente", intimidacao: "proficiente" },
  };

  it("bônus de resistência (Tibério nível 7: CON +5, CAR +7, sem proficiência FOR -1)", () => {
    expect(bonusResistencia(atributosTiberio, proficienciasTiberio, 7, "con")).toBe(5);
    expect(bonusResistencia(atributosTiberio, proficienciasTiberio, 7, "car")).toBe(7);
    expect(bonusResistencia(atributosTiberio, proficienciasTiberio, 7, "for")).toBe(-1);
  });

  it("bônus de perícia (Tibério: Arcanismo +4, Persuasão +7, Atletismo -1 sem proficiência)", () => {
    expect(bonusPericia(atributosTiberio, proficienciasTiberio, 7, "arcanismo")).toBe(4);
    expect(bonusPericia(atributosTiberio, proficienciasTiberio, 7, "persuasao")).toBe(7);
    expect(bonusPericia(atributosTiberio, proficienciasTiberio, 7, "atletismo")).toBe(-1);
  });

  it("percepção passiva (Tibério, sem proficiência em Percepção: 10 + 1)", () => {
    expect(percepcaoPassiva(atributosTiberio, proficienciasTiberio, 7)).toBe(11);
  });

  it("CD e ataque de magia (Tibério, conjuração por Carisma: CD 15, ataque +7)", () => {
    expect(cdMagia(atributosTiberio, 7, "car")).toBe(15);
    expect(ataqueMagia(atributosTiberio, 7, "car")).toBe(7);
  });

  it("CD de magia é null sem atributo de conjuração", () => {
    expect(cdMagia(atributosTiberio, 7, null)).toBeNull();
  });

  it("soma só os modificadores ligados que afetam o campo (Feitiçaria Inata)", () => {
    const mods = [
      { nome: "Feitiçaria Inata", campo: "cd_magia" as const, delta: 1, ativo: true },
      { nome: "Aura desligada", campo: "cd_magia" as const, delta: 2, ativo: false },
      { nome: "Outro campo", campo: "pp" as const, delta: 5, ativo: true },
    ];
    expect(somaModificadores(mods, "cd_magia")).toBe(1);
    expect(somaModificadores(mods, "pp")).toBe(5);
  });

  it("espaços de magia: conjurador completo nível 7 bate com a ficha real do Tibério (4/3/3/1)", () => {
    expect(espacosDeMagia("completo", 7)).toEqual([
      { nivel: 1, max: 4 },
      { nivel: 2, max: 3 },
      { nivel: 3, max: 3 },
      { nivel: 4, max: 1 },
    ]);
  });

  it("espaços de magia: nenhum conjurador não tem espaço", () => {
    expect(espacosDeMagia("nenhum", 10)).toEqual([]);
  });

  it("espaços de magia: meio-conjurador já começa com 2 espaços de 1º no nível 1 (2024 mudou isso — 2014 começava vazio)", () => {
    expect(espacosDeMagia("meio", 1)).toEqual([{ nivel: 1, max: 2 }]);
  });

  it("espaços de magia: pacto (Bruxo) nível 11 é 3 espaços de 5º círculo", () => {
    expect(espacosDeMagia("pacto", 11)).toEqual([{ nivel: 5, max: 3 }]);
  });

  it("espaços de magia: terço-conjurador usa a tabela completa em 1/3 do nível", () => {
    expect(espacosDeMagia("terco", 2)).toEqual([]); // floor(2/3) = 0
    expect(espacosDeMagia("terco", 3)).toEqual([{ nivel: 1, max: 2 }]); // floor(3/3) = 1
  });

  it("nível total: soma o nível de todas as classes (multiclasse)", () => {
    expect(nivelTotal([{ nivel: 5 }, { nivel: 2 }])).toBe(7);
  });

  it("nível total: sem classe nenhuma cadastrada é 0", () => {
    expect(nivelTotal([])).toBe(0);
  });
});

describe("separarAtaques", () => {
  it("uma linha por ataque, com o nome antes do primeiro ':' separado", () => {
    expect(separarAtaques("Malho +1: +7, 2d6+9 contundente\nMachado Grande: +6, 1d12+8 cortante")).toEqual([
      { nome: "Malho +1", detalhe: "+7, 2d6+9 contundente" },
      { nome: "Machado Grande", detalhe: "+6, 1d12+8 cortante" },
    ]);
  });

  it("linha sem ':' volta inteira como detalhe (formato do NPC vindo do catálogo)", () => {
    expect(separarAtaques("Adaga +4, 1d4+2 perfurante")).toEqual([
      { nome: null, detalhe: "Adaga +4, 1d4+2 perfurante" },
    ]);
  });

  it("ignora linha em branco e espaço sobrando (Enter a mais no celular)", () => {
    expect(separarAtaques("\n  Arco: +7, 1d8+4  \n\n")).toEqual([{ nome: "Arco", detalhe: "+7, 1d8+4" }]);
  });

  it("':' na ponta não vira nome vazio nem detalhe vazio", () => {
    expect(separarAtaques(": +5, 1d6")).toEqual([{ nome: null, detalhe: ": +5, 1d6" }]);
    expect(separarAtaques("Rajada:")).toEqual([{ nome: null, detalhe: "Rajada:" }]);
  });

  it("só o primeiro ':' separa — o resto fica no detalhe", () => {
    expect(separarAtaques("Fúria Divina: extra: +1d6+3")).toEqual([
      { nome: "Fúria Divina", detalhe: "extra: +1d6+3" },
    ]);
  });

  it("campo vazio não tem ataque nenhum", () => {
    expect(separarAtaques("")).toEqual([]);
  });
});
