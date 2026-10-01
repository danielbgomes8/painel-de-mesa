import { describe, expect, it } from "vitest";
import { CONDICOES } from "./condicoes";
import {
  ajustarPV,
  ajustePVComLog,
  resolverTesteMorte,
  comPrazoCondicao,
  lerValorPV,
  metadeDoDano,
  PV_DIGITADO_MAX,
  aplicarCura,
  aplicarDano,
  aplicarDescansoCurto,
  aplicarDescansoLongo,
  cdConcentracao,
  condicaoComLog,
  CONDICOES_QUE_QUEBRAM_CONCENTRACAO,
  curaComLog,
  danoComLog,
  nomeNoLog,
  pvNoLog,
  entrarNaOrdem,
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
  proximosDaOrdem,
  pvAoSubir,
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
  adicionarAoEncontro,
  limitarQuantidade,
  nomesDoGrupo,
  npcsDoEncontro,
  QUANTIDADE_MAX_GRUPO,
  resumoEncontro,
  totalDoEncontro,
} from "./regras";
import type { FichaMonstro, GrupoEncontro, Proficiencias } from "./tipos";

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
      hp_temp: 0,
      dss: 0,
      dsf: 0,
      exh: 1,
      hd_cur: 4,
      resources: [{ name: "Fúria", max: 3, cur: 3, short_rest: false }],
    });
  });

  it("descanso longo limpa PV temporário e testes de morte de quem caiu", () => {
    const resultado = aplicarDescansoLongo({
      hp_max: 40,
      exh: 0,
      hd_max: 7,
      hd_cur: 7,
      resources: [],
    });
    // PV temporário dura até o próximo descanso longo; e quem acorda com PV
    // cheio não pode manter sucesso/falha de teste de morte marcados.
    expect(resultado.hp_temp).toBe(0);
    expect(resultado.dss).toBe(0);
    expect(resultado.dsf).toBe(0);
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

describe("concentração (D&D 2024)", () => {
  const tiberio = {
    name: "Tibério",
    is_npc: false,
    revealed: false,
    hp: 65,
    hp_max: 65,
    hp_temp: 0,
    dss: 0,
    dsf: 0,
    concentration: true,
    concentration_on: "Voo",
  };

  it("dificuldade: 10 ou metade do dano (pra baixo), o que for maior, no máximo 30", () => {
    expect(cdConcentracao(0)).toBe(10);
    expect(cdConcentracao(1)).toBe(10);
    expect(cdConcentracao(21)).toBe(10); // metade = 10,5 -> 10
    expect(cdConcentracao(22)).toBe(11);
    expect(cdConcentracao(45)).toBe(22);
    expect(cdConcentracao(61)).toBe(30);
    expect(cdConcentracao(200)).toBe(30);
  });

  it("dano em quem está concentrado: mesma linha do log já traz o teste de CON", () => {
    const r = danoComLog(tiberio, 30);
    expect(r.texto).toBe("Tibério sofreu 30 de dano (35/65) · 🔮 concentrado em Voo: teste de CON, CD 15");
    expect(r.patch).toEqual({ hp: 35, hp_temp: 0 });
  });

  it("dano em quem NÃO está concentrado: log igual ao de sempre", () => {
    const r = danoComLog({ ...tiberio, concentration: false, concentration_on: "" }, 14);
    expect(r.texto).toBe("Tibério sofreu 14 de dano (51/65)");
  });

  it("PV temporário absorvendo tudo ainda é dano — o teste continua valendo", () => {
    const r = danoComLog({ ...tiberio, hp_temp: 10 }, 6);
    expect(r.texto).toBe(
      "Tibério sofreu 6 de dano, todo absorvido pelo PV temporário · 🔮 concentrado em Voo: teste de CON, CD 10",
    );
    expect(r.patch).toEqual({ hp: 65, hp_temp: 4 });
  });

  it("a dificuldade usa o dano inteiro, inclusive a parte que o PV temporário segurou", () => {
    expect(danoComLog({ ...tiberio, hp_temp: 10 }, 40).texto).toContain("CD 20");
  });

  it("caiu a 0 PV concentrado: perde a concentração, sem teste", () => {
    const r = danoComLog(tiberio, 80);
    expect(r.patch).toEqual({ hp: 0, hp_temp: 0, concentration: false, concentration_on: "" });
    expect(r.texto).toBe("Tibério sofreu 65 de dano (0/65) · 🔮 perdeu a concentração em Voo");
  });

  it("concentrado sem dizer em quê: o aviso não fica com um 'em' solto", () => {
    expect(danoComLog({ ...tiberio, concentration_on: "  " }, 4).texto).toBe(
      "Tibério sofreu 4 de dano (61/65) · 🔮 concentrado: teste de CON, CD 10",
    );
  });

  it("PV digitado na mão até 0 também acaba com a concentração; cura não mexe nela", () => {
    expect(ajustarPV({ ...tiberio }, 0)).toEqual({ hp: 0, concentration: false, concentration_on: "" });
    expect(ajustarPV({ ...tiberio }, 20)).toEqual({ hp: 20 });
    expect(aplicarCura({ ...tiberio, hp: 10 }, 5)).toEqual({ hp: 15 });
  });

  it("condição que inclui Incapacitado acaba com a concentração", () => {
    const r = condicaoComLog({ ...tiberio, cond: {}, cond_prazo: {} }, "Atordoado", true);
    expect(r.patch).toEqual({ cond: { Atordoado: true }, cond_prazo: {}, concentration: false, concentration_on: "" });
    expect(r.texto).toBe("Tibério ficou Atordoado · 🔮 perdeu a concentração em Voo");
  });

  it("condição que NÃO inclui Incapacitado não mexe na concentração", () => {
    const r = condicaoComLog({ ...tiberio, cond: {}, cond_prazo: {} }, "Agarrado", true);
    expect(r.patch).toEqual({ cond: { Agarrado: true }, cond_prazo: {} });
    expect(r.texto).toBe("Tibério ficou Agarrado");
  });

  it("tirar uma condição limpa o prazo dela e não mexe na concentração", () => {
    const r = condicaoComLog(
      { ...tiberio, cond: { Paralisado: true, Cego: true }, cond_prazo: { Paralisado: 2, Cego: 1 } },
      "Paralisado",
      false,
    );
    expect(r.patch).toEqual({ cond: { Paralisado: false, Cego: true }, cond_prazo: { Cego: 1 } });
    expect(r.texto).toBe("Tibério não está mais Paralisado");
  });

  it("as condições que quebram concentração existem com esse nome na lista de condições", () => {
    for (const c of CONDICOES_QUE_QUEBRAM_CONCENTRACAO) {
      expect(CONDICOES as readonly string[]).toContain(c);
    }
    // Petrificado inclui Incapacitado no 2024 — o resumo automático da fonte errou isso.
    expect(CONDICOES_QUE_QUEBRAM_CONCENTRACAO).toContain("Petrificado");
  });
});

describe("log de combate é público (anti-spoiler de NPC)", () => {
  const dragao = {
    name: "Dragão Ancião",
    is_npc: true,
    revealed: false,
    hp: 300,
    hp_max: 367,
    hp_temp: 0,
    dss: 0,
    dsf: 0,
    concentration: false,
    concentration_on: "",
    cond: {},
    cond_prazo: {},
  };
  const tiberio = { ...dragao, name: "Tibério", is_npc: false, hp: 40, hp_max: 65 };

  it("NPC oculto não tem nome no log; revelado tem; jogador sempre tem", () => {
    expect(nomeNoLog(dragao)).toBe("Um inimigo");
    expect(nomeNoLog({ ...dragao, revealed: true })).toBe("Dragão Ancião");
    expect(nomeNoLog(tiberio)).toBe("Tibério");
  });

  it("dano em NPC não entrega nome nem PV — nem depois de revelado", () => {
    expect(danoComLog(dragao, 20).texto).toBe("Um inimigo sofreu 20 de dano");
    expect(danoComLog({ ...dragao, revealed: true }, 20).texto).toBe("Dragão Ancião sofreu 20 de dano");
  });

  it("cura em NPC também não entrega PV; em jogador continua com o PV", () => {
    expect(curaComLog(dragao, 10).texto).toBe("Um inimigo recuperou 10 PV");
    expect(curaComLog(tiberio, 10).texto).toBe("Tibério recuperou 10 PV (50/65)");
  });

  it("cura em quem já está cheio não loga nada", () => {
    expect(curaComLog({ ...tiberio, hp: 65 }, 10)).toEqual({ patch: { hp: 65 }, texto: null });
  });

  it("condição e concentração de NPC oculto saem sem o nome", () => {
    expect(condicaoComLog(dragao, "Amedrontado", true).texto).toBe("Um inimigo ficou Amedrontado");
    const concentrado = { ...dragao, concentration: true, concentration_on: "Voo", hp: 5 };
    expect(danoComLog(concentrado, 50).texto).toBe("Um inimigo sofreu 5 de dano · 🔮 perdeu a concentração em Voo");
  });

  it("jogador continua exatamente como era", () => {
    expect(danoComLog(tiberio, 5).texto).toBe("Tibério sofreu 5 de dano (35/65)");
    expect(pvNoLog(tiberio)).toBe(true);
    expect(pvNoLog(dragao)).toBe(false);
  });
});

describe("teste de resistência contra a morte (2024)", () => {
  it("10 ou mais é sucesso; 9 ou menos é falha", () => {
    expect(resolverTesteMorte("Tibério", 0, 0, 10)).toMatchObject({ dss: 1, dsf: 0 });
    expect(resolverTesteMorte("Tibério", 0, 0, 9)).toMatchObject({ dss: 0, dsf: 1 });
    expect(resolverTesteMorte("Tibério", 0, 0, 12).texto).toBe("Tibério passou no teste de morte (12): 1 de 3 sucessos");
  });

  it("1 natural conta duas falhas", () => {
    const r = resolverTesteMorte("Tibério", 1, 0, 1);
    expect(r).toMatchObject({ dss: 1, dsf: 2, morreu: false });
    expect(r.texto).toContain("1 natural: duas falhas");
  });

  it("20 natural acorda com 1 PV e zera a contagem", () => {
    expect(resolverTesteMorte("Tibério", 2, 2, 20)).toMatchObject({ acordou: true, dss: 0, dsf: 0 });
  });

  it("três sucessos estabiliza; três falhas mata", () => {
    expect(resolverTesteMorte("Tibério", 2, 1, 15)).toMatchObject({ estabilizou: true, dss: 3 });
    const morte = resolverTesteMorte("Tibério", 0, 2, 5);
    expect(morte).toMatchObject({ morreu: true, dsf: 3 });
    expect(morte.texto).toContain("morreu");
  });

  it("1 natural com uma falha já na conta mata (duas falhas de uma vez)", () => {
    expect(resolverTesteMorte("Tibério", 0, 1, 1)).toMatchObject({ dsf: 3, morreu: true });
  });
});

describe("prazo de condição", () => {
  it("põe, troca e tira o prazo sem mexer no das outras", () => {
    const antes = { Envenenado: 3 };
    expect(comPrazoCondicao(antes, "Atordoado", 2)).toEqual({ Envenenado: 3, Atordoado: 2 });
    expect(comPrazoCondicao({ ...antes, Atordoado: 2 }, "Atordoado", 0)).toEqual({ Envenenado: 3 });
    expect(comPrazoCondicao(antes, "Envenenado", -1)).toEqual({});
    expect(antes).toEqual({ Envenenado: 3 });
  });
});

describe("dano e cura na linha da iniciativa", () => {
  const kobold = {
    name: "Kobold",
    is_npc: true,
    revealed: false,
    hp: 10,
    hp_max: 12,
    hp_temp: 0,
    dss: 0,
    dsf: 0,
    concentration: false,
    concentration_on: "",
  };
  const tiberio = { ...kobold, name: "Tibério", is_npc: false, hp: 40, hp_max: 65 };

  it("campo aceita só inteiro positivo, com teto", () => {
    expect(lerValorPV("8")).toBe(8);
    expect(lerValorPV(" 12 ")).toBe(12);
    expect(lerValorPV("")).toBeNull();
    expect(lerValorPV("0")).toBeNull();
    expect(lerValorPV("-5")).toBeNull();
    expect(lerValorPV("abc")).toBeNull();
    expect(lerValorPV("50000")).toBe(PV_DIGITADO_MAX);
  });

  it("metade arredonda pra baixo (resistência, passou no teste)", () => {
    expect(metadeDoDano(9)).toBe(4);
    expect(metadeDoDano(8)).toBe(4);
    expect(metadeDoDano(1)).toBe(0);
  });

  it("o log continua escondendo o NPC; o retorno mostra ao Mestre qual e quanto sobrou", () => {
    const r = ajustePVComLog(kobold, -7);
    expect(r.patch).toEqual({ hp: 3, hp_temp: 0 });
    expect(r.texto).toBe("Um inimigo sofreu 7 de dano");
    expect(r.retorno).toBe("Kobold sofreu 7 de dano (3/12)");
  });

  it("cura: mesmo esquema, e cheio não loga mas avisa", () => {
    expect(ajustePVComLog(kobold, 2).retorno).toBe("Kobold recuperou 2 PV (12/12)");
    const cheio = ajustePVComLog({ ...tiberio, hp: 65 }, 5);
    expect(cheio.texto).toBeNull();
    expect(cheio.retorno).toBe("Tibério já está com o PV cheio");
  });

  it("o aviso de concentração aparece no retorno também", () => {
    const r = ajustePVComLog({ ...tiberio, concentration: true, concentration_on: "Voo" }, -30);
    expect(r.retorno).toBe("Tibério sofreu 30 de dano (10/65) · 🔮 concentrado em Voo: teste de CON, CD 15");
  });

  it("jogador já caído: não loga nada, lembra do teste de morte", () => {
    const r = ajustePVComLog({ ...tiberio, hp: 0 }, -5);
    expect(r.texto).toBeNull();
    expect(r.retorno).toBe("Tibério já está a 0 PV: dano agora é 1 falha no teste de morte (2 se for crítico)");
    expect(ajustePVComLog({ ...kobold, hp: 0 }, -5).retorno).toBe("Kobold já está a 0 PV");
  });
});

describe("entrarNaOrdem", () => {
  const maga = { slug: "maga", name: "Maga", init: 14 };
  const ladino = { slug: "ladino", name: "Ladino", init: 21 };
  const goblin = { slug: "goblin", name: "Goblin", init: 9 };

  it("põe vários de uma vez e devolve tudo ordenado, maior iniciativa primeiro", () => {
    const r = entrarNaOrdem([goblin], [maga, ladino]);
    expect(r.ordem).toEqual([ladino, maga, goblin]);
    expect(r.entraram).toEqual([maga, ladino]);
  });

  it("quem já estava na ordem não entra de novo (toque duplo, dois jogadores juntos)", () => {
    const r = entrarNaOrdem([maga], [{ ...maga, init: 3 }]);
    expect(r.ordem).toEqual([maga]);
    // Lista vazia é o que impede o log de dizer que ela entrou outra vez.
    expect(r.entraram).toEqual([]);
  });

  it("repetido dentro da própria leva também é ignorado", () => {
    const r = entrarNaOrdem([], [maga, { ...maga, init: 2 }, goblin]);
    expect(r.ordem).toEqual([maga, goblin]);
    expect(r.entraram).toEqual([maga, goblin]);
  });

  it("sem ninguém novo, a ordem continua igual", () => {
    expect(entrarNaOrdem([ladino, goblin], [])).toEqual({ ordem: [ladino, goblin], entraram: [] });
  });

  it("empate mantém quem já estava na frente de quem chegou agora", () => {
    const igual = { slug: "clerigo", name: "Clerigo", init: 14 };
    expect(entrarNaOrdem([maga], [igual]).ordem).toEqual([maga, igual]);
  });
});

describe("proximosDaOrdem", () => {
  it("devolve os próximos índices depois do turno atual", () => {
    expect(proximosDaOrdem(6, 0, 3)).toEqual([1, 2, 3]);
    expect(proximosDaOrdem(6, 2, 3)).toEqual([3, 4, 5]);
  });

  it("dá a volta no fim da ordem (a próxima rodada começa de novo no primeiro)", () => {
    expect(proximosDaOrdem(4, 3, 3)).toEqual([0, 1, 2]);
    expect(proximosDaOrdem(4, 2, 3)).toEqual([3, 0, 1]);
  });

  it("não repete quem está jogando agora, mesmo pedindo mais do que cabe", () => {
    expect(proximosDaOrdem(3, 0, 5)).toEqual([1, 2]);
    expect(proximosDaOrdem(2, 1, 3)).toEqual([0]);
  });

  it("ordem com uma pessoa só (ou vazia) não tem próximo", () => {
    expect(proximosDaOrdem(1, 0, 3)).toEqual([]);
    expect(proximosDaOrdem(0, 0, 3)).toEqual([]);
  });
});

describe("encontros preparados", () => {
  const goblin: FichaMonstro = {
    name: "Goblin",
    cls: "Fada pequena",
    ac: 15,
    hp_max: 10,
    speed: 9,
    init_mod: 2,
    ataque: "Cimitarra +4",
    notes: "",
  };
  const chefe: FichaMonstro = { ...goblin, name: "Chefe goblin", ac: 17, hp_max: 21, notes: "foge com 5 PV" };

  it("adicionar o mesmo monstro de novo soma no grupo em vez de abrir outro", () => {
    let grupos = adicionarAoEncontro([], goblin);
    grupos = adicionarAoEncontro(grupos, { ...goblin, name: " goblin " });
    grupos = adicionarAoEncontro(grupos, chefe);
    expect(grupos.map((g) => [g.name, g.quantidade])).toEqual([
      ["Goblin", 2],
      ["Chefe goblin", 1],
    ]);
    expect(totalDoEncontro(grupos)).toBe(3);
    expect(resumoEncontro(grupos)).toBe("2× Goblin · 1× Chefe goblin");
  });

  it("guarda só a ficha — id, sala e data do modelo da biblioteca ficam de fora", () => {
    const modelo = { ...goblin, id: "m-1", room_code: "sala", created_at: "2026-09-01" };
    const [grupo] = adicionarAoEncontro([], modelo);
    expect(Object.keys(grupo).sort()).toEqual(
      ["ac", "ataque", "cls", "hp_max", "init_mod", "name", "notes", "quantidade", "speed"],
    );
  });

  it("quantidade fica entre 1 e o teto, mesmo com lixo", () => {
    expect(limitarQuantidade(0)).toBe(1);
    expect(limitarQuantidade(-3)).toBe(1);
    expect(limitarQuantidade(999)).toBe(QUANTIDADE_MAX_GRUPO);
    expect(limitarQuantidade(Number.NaN)).toBe(1);
    expect(limitarQuantidade(2.6)).toBe(3);
  });

  it("um monstro sozinho fica com o nome puro; vários ganham número", () => {
    expect(nomesDoGrupo("Chefe goblin", 1, [])).toEqual(["Chefe goblin"]);
    expect(nomesDoGrupo("Goblin", 3, [])).toEqual(["Goblin 1", "Goblin 2", "Goblin 3"]);
  });

  it("rodar o mesmo encontro de novo continua a numeração, sem repetir nome", () => {
    expect(nomesDoGrupo("Goblin", 2, ["Goblin 1", "goblin 2", "Goblin 3"])).toEqual(["Goblin 4", "Goblin 5"]);
    // O xará sem número conta como o 1º da série.
    expect(nomesDoGrupo("Chefe goblin", 1, ["Chefe goblin"])).toEqual(["Chefe goblin 2"]);
  });

  it("um avulso entra na série que já existe, não fica 'Goblin' solto do lado de 'Goblin 1'", () => {
    expect(nomesDoGrupo("Goblin", 1, ["Goblin 1", "Goblin 2"])).toEqual(["Goblin 3"]);
    // "Goblin Chefe" não é série de "Goblin" — só número depois do espaço conta.
    expect(nomesDoGrupo("Goblin", 1, ["Goblin Chefe"])).toEqual(["Goblin"]);
  });

  it("cria uma ficha de NPC por monstro, com PV cheio e nomes que não colidem entre grupos", () => {
    const grupos: GrupoEncontro[] = [
      { ...goblin, quantidade: 2 },
      { ...goblin, quantidade: 1 },
      { ...chefe, quantidade: 1 },
    ];
    const npcs = npcsDoEncontro(grupos, ["Tibério Vaz"]);
    expect(npcs.map((n) => n.name)).toEqual(["Goblin 1", "Goblin 2", "Goblin 3", "Chefe goblin"]);
    expect(npcs.every((n) => n.is_npc)).toBe(true);
    expect(npcs[3]).toMatchObject({ hp: 21, hp_max: 21, ac: 17, notes: "foge com 5 PV" });
  });

  it("quantidade estragada no banco não vira dezenas de fichas", () => {
    expect(npcsDoEncontro([{ ...goblin, quantidade: 500 }], [])).toHaveLength(QUANTIDADE_MAX_GRUPO);
  });
});

describe("PV ao subir de nível (2024)", () => {
  it("é o valor fixo do dado (metade + 1) mais a Constituição", () => {
    expect(pvAoSubir("d6", 0)).toBe(4);
    expect(pvAoSubir("d8", 1)).toBe(6);
    expect(pvAoSubir("d10", 2)).toBe(8);
    expect(pvAoSubir("d12", -1)).toBe(6);
  });

  it("aceita maiúscula e espaço, e devolve null se o campo não for um dado", () => {
    expect(pvAoSubir(" D10 ", 0)).toBe(6);
    expect(pvAoSubir("", 2)).toBeNull();
    expect(pvAoSubir("1d10", 2)).toBeNull();
    expect(pvAoSubir("d1", 2)).toBeNull();
  });
});
