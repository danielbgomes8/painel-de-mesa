import { describe, expect, it } from "vitest";
import {
  LUZES_PRONTAS,
  RAIO_NO_ESCURO_M,
  acabandoLogo,
  alcanceValido,
  apagouAgora,
  colunasDaLuz,
  devolverLuz,
  gastarLuz,
  lerLuz,
  linhaDaLuz,
  luzAcesa,
  luzCompartilhadaPx,
  luzPessoal,
  luzDaPronta,
  minutosValidos,
  rotuloDoAlcance,
  rotuloDoTempo,
  visaoDoPortadorPx,
  type Luz,
} from "./luzes";

// Grade de 70 px, 1,5 m por quadradinho; mapa grande o bastante pra o alcance não ser cortado pela diagonal.
const cena = { escura: true, grade_px: 70, metros: 1.5, largura: 4000, altura: 3000, visao_alcance: null };
const tocha: Luz = { nome: "Tocha", alcance: 12, minutos: 60 };

describe("luzes prontas", () => {
  it("todas passam nas próprias regras (alcance e tempo válidos)", () => {
    for (const p of LUZES_PRONTAS) {
      expect(alcanceValido(p.alcance)).toBe(p.alcance);
      expect(p.minutos === null || minutosValidos(p.minutos) === p.minutos).toBe(true);
    }
  });

  it("a tocha é a do SRD 2024: 12 m (20 + 20 pés) por 1 hora", () => {
    const t = LUZES_PRONTAS.find((p) => p.nome === "Tocha");
    expect(t).toMatchObject({ alcance: 12, minutos: 60 });
  });

  it("a visão no escuro não acaba", () => {
    const v = luzDaPronta(LUZES_PRONTAS.find((p) => p.nome === "Visão no escuro")!);
    expect(v.minutos).toBeNull();
    expect(luzAcesa(v)).toBe(true);
    expect(gastarLuz(v, 600)).toEqual(v);
  });
});

describe("ler a luz do banco", () => {
  it("sem alcance não há luz", () => {
    expect(lerLuz({})).toBeNull();
    expect(lerLuz({ luz_alcance: null, luz_nome: "Tocha" })).toBeNull();
    expect(lerLuz({ luz_alcance: 0 })).toBeNull();
    expect(lerLuz({ luz_alcance: -3 })).toBeNull();
    expect(lerLuz({ luz_alcance: 500 })).toBeNull();
  });

  it("lê nome, alcance e tempo (o numeric do Postgres chega como texto)", () => {
    expect(lerLuz({ luz_nome: "Tocha", luz_alcance: "12", luz_minutos: 45 })).toEqual({ nome: "Tocha", alcance: 12, minutos: 45 });
  });

  it("nome vazio vira 'Luz' e tempo nulo é 'não acaba'", () => {
    expect(lerLuz({ luz_nome: "  ", luz_alcance: 6, luz_minutos: null })).toEqual({ nome: "Luz", alcance: 6, minutos: null });
  });

  it("tempo torto é corrigido pro limite certo, e texto que não é número vira 'não acaba'", () => {
    expect(minutosValidos(-5)).toBe(0);
    expect(minutosValidos(999999)).toBe(10080);
    expect(minutosValidos(12.6)).toBe(13);
    expect(minutosValidos("abc")).toBeNull();
  });

  it("grava e limpa as três colunas juntas", () => {
    expect(colunasDaLuz(tocha)).toEqual({ luz_nome: "Tocha", luz_alcance: 12, luz_minutos: 60 });
    expect(colunasDaLuz(null)).toEqual({ luz_nome: null, luz_alcance: null, luz_minutos: null });
  });
});

describe("o tempo gasta a luz", () => {
  it("desconta os minutos e para no zero", () => {
    expect(gastarLuz(tocha, 10).minutos).toBe(50);
    expect(gastarLuz(tocha, 60).minutos).toBe(0);
    expect(gastarLuz(tocha, 500).minutos).toBe(0);
  });

  it("devolver (desfazer) volta os minutos", () => {
    expect(devolverLuz(gastarLuz(tocha, 10), 10)).toEqual(tocha);
  });

  it("só diz que apagou quando estava acesa e acabou nesta passada", () => {
    expect(apagouAgora(tocha, gastarLuz(tocha, 60))).toBe(true);
    expect(apagouAgora(tocha, gastarLuz(tocha, 10))).toBe(false);
    const apagada = { ...tocha, minutos: 0 };
    expect(apagouAgora(apagada, gastarLuz(apagada, 10))).toBe(false);
    expect(apagouAgora(null, null)).toBe(false);
  });

  it("avisa quando faltam 10 minutos ou menos, e não depois de apagar", () => {
    expect(acabandoLogo({ ...tocha, minutos: 10 })).toBe(true);
    expect(acabandoLogo({ ...tocha, minutos: 11 })).toBe(false);
    expect(acabandoLogo({ ...tocha, minutos: 0 })).toBe(false);
    expect(acabandoLogo({ ...tocha, minutos: null })).toBe(false);
  });
});

describe("rótulos", () => {
  it("tempo em português", () => {
    expect(rotuloDoTempo({ ...tocha, minutos: 45 })).toBe("45 min");
    expect(rotuloDoTempo({ ...tocha, minutos: 60 })).toBe("1 h");
    expect(rotuloDoTempo({ ...tocha, minutos: 90 })).toBe("1 h 30");
    expect(rotuloDoTempo({ ...tocha, minutos: 125 })).toBe("2 h 05");
    expect(rotuloDoTempo({ ...tocha, minutos: 0 })).toBe("apagada");
    expect(rotuloDoTempo({ ...tocha, minutos: null })).toBe("não acaba");
  });

  it("alcance com vírgula", () => {
    expect(rotuloDoAlcance(12)).toBe("12 m");
    expect(rotuloDoAlcance(13.5)).toBe("13,5 m");
  });

  it("linha da luz pro painel e pro telão", () => {
    expect(linhaDaLuz("Ana", { ...tocha, minutos: 40 })).toBe("Tocha de Ana — faltam 40 min");
    expect(linhaDaLuz("Ana", { ...tocha, minutos: 0 })).toBe("Tocha de Ana — apagada");
  });
});

describe("a visão do portador em mapa escuro", () => {
  const px = (m: number) => (m * 70) / 1.5;
  const visaoNoEscuro: Luz = { nome: "Visão no escuro", alcance: 18, minutos: null };

  it("mapa claro: não mexe (null = como a cena manda)", () => {
    expect(visaoDoPortadorPx({ ...cena, escura: false }, tocha, true)).toBeNull();
    expect(luzCompartilhadaPx({ ...cena, escura: false }, tocha)).toBeNull();
  });

  it("a luz que gasta (tocha) é compartilhada: ilumina em volta, e a visão própria fica no quadradinho", () => {
    expect(luzCompartilhadaPx(cena, tocha)).toBeCloseTo(px(12), 6);
    expect(visaoDoPortadorPx(cena, tocha, true)).toBeCloseTo(px(RAIO_NO_ESCURO_M), 6);
  });

  it("luz apagada ou sem luz: não ilumina, e a visão própria é só o quadradinho em volta", () => {
    const apagada = { ...tocha, minutos: 0 };
    expect(luzCompartilhadaPx(cena, apagada)).toBeNull();
    expect(luzCompartilhadaPx(cena, null)).toBeNull();
    expect(visaoDoPortadorPx(cena, apagada, true)).toBeCloseTo(px(RAIO_NO_ESCURO_M), 6);
    expect(visaoDoPortadorPx(cena, null, true)).toBeCloseTo(px(RAIO_NO_ESCURO_M), 6);
  });

  it("a visão no escuro é pessoal: amplia a visão própria e não ilumina ninguém", () => {
    expect(luzPessoal(visaoNoEscuro)).toBe(true);
    expect(luzPessoal(tocha)).toBe(false);
    expect(visaoDoPortadorPx(cena, visaoNoEscuro, true)).toBeCloseTo(px(18), 6);
    expect(luzCompartilhadaPx(cena, visaoNoEscuro)).toBeNull();
  });

  it("a luz que apaga deixa de iluminar", () => {
    const antes = luzCompartilhadaPx(cena, tocha)!;
    expect(antes).toBeGreaterThan(0);
    expect(luzCompartilhadaPx(cena, gastarLuz(tocha, 60))).toBeNull();
  });

  it("inimigo enxerga como a cena manda, mesmo no escuro", () => {
    expect(visaoDoPortadorPx(cena, null, false)).toBeNull();
  });

  it("nunca passa da diagonal do mapa", () => {
    const pequeno = { ...cena, largura: 300, altura: 300 };
    expect(visaoDoPortadorPx(pequeno, visaoNoEscuro, true)).toBeLessThanOrEqual(Math.hypot(300, 300));
    expect(luzCompartilhadaPx(pequeno, { nome: "Sol", alcance: 120, minutos: 60 })).toBeLessThanOrEqual(Math.hypot(300, 300));
  });
});
