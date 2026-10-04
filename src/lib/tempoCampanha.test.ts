import { describe, expect, it } from "vitest";
import {
  ancorarHoje,
  dataHarptos,
  diasRestantes,
  efeitosPertoDeVencer,
  efeitosQueVenceram,
  ehLinhaDeTempo,
  indiceDoDiaHarptos,
  linhaDeAvanco,
  linhaDeEfeitoEncerrado,
  linhaDeEfeitoNovo,
  linhasDoAvanco,
  normalizarEfeito,
  normalizarTempo,
  ordenarEfeitos,
  rotuloCurtoDoDia,
  rotuloDoDia,
  situacaoDoEfeito,
  textoDoRestante,
  type EfeitoDeTempo,
  type TempoCampanha,
} from "./tempoCampanha";

const harptos = (dia: number, inicio_dia_do_ano = 1, inicio_ano = 1492): TempoCampanha => ({ dia, calendario: "harptos", inicio_dia_do_ano, inicio_ano });
const dias = (dia: number): TempoCampanha => ({ dia, calendario: "dias", inicio_dia_do_ano: 1, inicio_ano: 1492 });

describe("calendário de Harptos", () => {
  it("começa em 1º de Hammer e anda mês a mês", () => {
    expect(dataHarptos(harptos(1)).texto).toBe("1 de Hammer, 1492 CV");
    expect(dataHarptos(harptos(30)).texto).toBe("30 de Hammer, 1492 CV");
  });

  it("os festivais caem entre os meses certos", () => {
    expect(dataHarptos(harptos(31)).texto).toBe("Midwinter, 1492 CV");
    expect(dataHarptos(harptos(32)).texto).toBe("1 de Alturiak, 1492 CV");
    // Greengrass: depois de Tarsakh (mês 4): 4 meses + 1 festival = 121 dias antes
    expect(dataHarptos(harptos(122)).texto).toBe("Greengrass, 1492 CV");
    expect(dataHarptos(harptos(123)).texto).toBe("1 de Mirtul, 1492 CV");
  });

  it("o ano tem 365 dias: 360 de mês mais 5 festivais", () => {
    expect(dataHarptos(harptos(365)).texto).toBe("30 de Nightal, 1492 CV");
    expect(dataHarptos(harptos(366)).texto).toBe("1 de Hammer, 1493 CV");
    expect(dataHarptos(harptos(365 * 3 + 1)).texto).toBe("1 de Hammer, 1495 CV");
  });

  it("âncora no meio do ano", () => {
    // O dia 1 caiu em 16 de Flamerule: 6 meses (180) + 2 festivais antes (Midwinter, Greengrass) + 15 = índice 197 -> dia do ano 198
    const t = harptos(1, 198);
    expect(dataHarptos(t).texto).toBe("16 de Flamerule, 1492 CV");
    expect(dataHarptos(harptos(3, 198)).texto).toBe("18 de Flamerule, 1492 CV");
  });

  it("ancorarHoje faz o dia atual cair na data escolhida, e a data seguinte anda sozinha", () => {
    const hoje = { tipo: "mes", mes: 7, dia: 16 } as const;
    const a = ancorarHoje(14, hoje, 1492);
    const t = harptos(14, a.inicio_dia_do_ano, a.inicio_ano);
    expect(dataHarptos(t).texto).toBe("16 de Flamerule, 1492 CV");
    expect(dataHarptos({ ...t, dia: 15 }).texto).toBe("17 de Flamerule, 1492 CV");
  });

  it("ancorarHoje atravessa o ano quando o contador já passou do início", () => {
    // Dia 400 da campanha ser 5 de Hammer de 1493 => o dia 1 caiu 399 dias antes: no fim de 1491.
    const a = ancorarHoje(400, { tipo: "mes", mes: 1, dia: 5 }, 1493);
    expect(dataHarptos(harptos(400, a.inicio_dia_do_ano, a.inicio_ano)).texto).toBe("5 de Hammer, 1493 CV");
    expect(dataHarptos(harptos(1, a.inicio_dia_do_ano, a.inicio_ano)).ano).toBe(1491);
  });

  it("ancorarHoje em festival", () => {
    const a = ancorarHoje(5, { tipo: "festival", nome: "Midsummer" }, 1492);
    expect(dataHarptos(harptos(5, a.inicio_dia_do_ano, a.inicio_ano)).texto).toBe("Midsummer, 1492 CV");
    expect(indiceDoDiaHarptos({ tipo: "festival", nome: "Midwinter" })).toBe(30);
  });

  it("volta no tempo: dia 1 é o menor, e a data recua pela âncora", () => {
    expect(dataHarptos(harptos(1, 1, 1492)).ano).toBe(1492);
    expect(dataHarptos(harptos(1, 1, 1))).toMatchObject({ ano: 1 });
  });
});

describe("rótulos e efeitos", () => {
  it("dia simples ou com data", () => {
    expect(rotuloDoDia(dias(14))).toBe("Dia 14");
    expect(rotuloDoDia(harptos(31))).toBe("Dia 31 · Midwinter, 1492 CV");
  });

  const efeito = (inicio_dia: number, duracao: number, extra: Partial<EfeitoDeTempo> = {}): EfeitoDeTempo => ({
    id: "e", room_code: "s", nome: "Maldição", alvo: "", inicio_dia, duracao, nota: "", created_at: "2026-10-04T00:00:00Z", ...extra,
  });

  it("dias restantes e o texto de cada situação", () => {
    expect(diasRestantes(efeito(10, 5), 12)).toBe(3);
    expect(textoDoRestante(3)).toBe("faltam 3 dias");
    expect(textoDoRestante(1)).toBe("falta 1 dia");
    expect(textoDoRestante(0)).toBe("venceu hoje");
    expect(textoDoRestante(-1)).toBe("venceu há 1 dia");
    expect(textoDoRestante(-4)).toBe("venceu há 4 dias");
  });

  it("situação do efeito", () => {
    expect(situacaoDoEfeito(5)).toBe("ativo");
    expect(situacaoDoEfeito(1)).toBe("ultimo-dia");
    expect(situacaoDoEfeito(0)).toBe("venceu");
    expect(situacaoDoEfeito(-3)).toBe("venceu");
  });

  it("ordena: quem vence primeiro vem antes, os vencidos vão pro fim (o mais recente primeiro)", () => {
    const a = efeito(10, 10, { id: "a" });
    const b = efeito(10, 5, { id: "b" });
    const c = efeito(1, 2, { id: "c" });
    const d = efeito(1, 12, { id: "d" });
    // dia 13: a falta 7, b falta 2, c venceu há 10, d venceu hoje
    expect(ordenarEfeitos([a, c, b, d], 13).map((e) => e.id)).toEqual(["b", "a", "d", "c"]);
  });
});

describe("rótulo curto e efeitos perto de vencer (topo e telão)", () => {
  it("dia simples, com mês, com festival", () => {
    expect(rotuloCurtoDoDia(dias(14))).toBe("Dia 14");
    expect(rotuloCurtoDoDia(harptos(14, 198))).toBe("Dia 14 · 29 Flamerule");
    expect(rotuloCurtoDoDia(harptos(31))).toBe("Dia 31 · Midwinter");
  });

  it("só os que estão no último dia ou vencem hoje, os de menos prazo primeiro", () => {
    const e = (id: string, inicio_dia: number, duracao: number): EfeitoDeTempo => ({ id, room_code: "s", nome: id, alvo: "", inicio_dia, duracao, nota: "", created_at: "" });
    const lista = [e("longe", 1, 20), e("amanha", 5, 6), e("hoje", 2, 8), e("velho", 1, 3)]; // no dia 10: restam 11, 1, 0 e -6
    expect(efeitosPertoDeVencer(lista, 10).map((x) => x.id)).toEqual(["amanha", "hoje"]);
    expect(efeitosPertoDeVencer([], 10)).toEqual([]);
  });
});

describe("normalizar do banco", () => {
  it("sem linha, o tempo não começou", () => {
    expect(normalizarTempo(null)).toBeNull();
    expect(normalizarTempo({})).toBeNull();
  });

  it("corrige o que veio estragado", () => {
    expect(normalizarTempo({ dia: 0, calendario: "x", inicio_dia_do_ano: 999, inicio_ano: 1492 })).toEqual({
      dia: 1,
      calendario: "dias",
      inicio_dia_do_ano: 365,
      inicio_ano: 1492,
    });
    expect(normalizarEfeito({ nome: 5, duracao: -3, inicio_dia: 4 })).toMatchObject({ nome: "", duracao: 1, inicio_dia: 4 });
  });
});

describe("linhas do log", () => {
  it("avanço, com e sem data de calendário", () => {
    expect(linhaDeAvanco(dias(14), dias(15), false)).toBe("🗓 Passou 1 dia: Dia 14 → Dia 15");
    expect(linhaDeAvanco(dias(14), dias(17), true)).toBe("🗓 Descanso longo do grupo. Passou 3 dias: Dia 14 → Dia 17");
    expect(linhaDeAvanco(harptos(30), harptos(31), false)).toBe("🗓 Passou 1 dia: Dia 30 → Dia 31 (Midwinter, 1492 CV)");
    expect(linhaDeAvanco(dias(14), dias(13), false)).toBe("🗓 Voltou 1 dia: Dia 14 → Dia 13");
  });

  it("descanso longo de quem o Mestre escolheu diz os nomes", () => {
    expect(linhaDeAvanco(dias(3), dias(4), "Ana, Beto")).toBe("🗓 Descanso longo de Ana, Beto. Passou 1 dia: Dia 3 → Dia 4");
  });

  it("o avanço leva junto uma linha pra cada efeito que acabou de vencer", () => {
    const e = (id: string, inicio_dia: number, duracao: number): EfeitoDeTempo => ({ id, room_code: "s", nome: `E${id}`, alvo: "", inicio_dia, duracao, nota: "", created_at: "" });
    const lista = [e("1", 1, 3), e("2", 1, 10), e("3", 1, 1)]; // vencem nos dias 4, 11 e 2
    expect(efeitosQueVenceram(lista, 3, 4).map((x) => x.id)).toEqual(["1"]);
    expect(efeitosQueVenceram(lista, 1, 4).map((x) => x.id)).toEqual(["1", "3"]);
    expect(linhasDoAvanco(lista, dias(3), dias(4), false)).toEqual(["🗓 Passou 1 dia: Dia 3 → Dia 4", "🗓 Efeito venceu: E1"]);
    // quem já tinha vencido antes não entra de novo
    expect(efeitosQueVenceram(lista, 4, 5)).toEqual([]);
  });

  it("efeitos", () => {
    expect(linhaDeEfeitoNovo({ nome: "Maldição", alvo: "Tibério", duracao: 7 })).toBe("🗓 Efeito de 7 dias: Maldição (Tibério)");
    expect(linhaDeEfeitoNovo({ nome: "Viagem", alvo: "", duracao: 1 })).toBe("🗓 Efeito de 1 dia: Viagem");
    expect(linhaDeEfeitoEncerrado({ nome: "Maldição", alvo: "Tibério" }, true)).toBe("🗓 Efeito venceu: Maldição (Tibério)");
    expect(linhaDeEfeitoEncerrado({ nome: "Maldição", alvo: "" }, false)).toBe("🗓 Efeito encerrado: Maldição");
  });

  it("reconhece a marca", () => {
    expect(ehLinhaDeTempo("🗓 Passou 1 dia: Dia 1 → Dia 2")).toBe(true);
    expect(ehLinhaDeTempo("Rodada 2 começou")).toBe(false);
  });
});
