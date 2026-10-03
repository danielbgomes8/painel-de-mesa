import { describe, expect, it } from "vitest";
import { agruparPorDia, ehLinhaDoBau, eventosDoBau, filtrarEventos, rotuloDoDia } from "./historicoBau";
import type { LinhaDoLog } from "./recap";

// Meio-dia local: longe da virada do dia, em qualquer fuso em que o teste rode.
const dia = (d: number, h = 12, min = 0) => new Date(2026, 9, d, h, min).toISOString();
const linha = (text: string, created_at: string): LinhaDoLog => ({ text, created_at });
const AGORA = new Date(2026, 9, 3, 15, 0);

describe("achar as trocas do baú no log", () => {
  it("só linhas de baú: 🎒 de item e 💰 de dinheiro; o resto do log fica de fora", () => {
    const e = eventosDoBau([
      linha("Rodada 2 começou", dia(2)),
      linha("🎒 Ana pegou 2× Poção de cura do baú", dia(2, 13)),
      linha("Ana sofreu 5 de dano (10/20)", dia(2, 14)),
      linha("💰 O Mestre guardou 41 PO no baú", dia(2, 15)),
    ]);
    expect(e.map((x) => x.tipo)).toEqual(["dinheiro", "item"]);
  });

  it("da mais nova pra mais velha, mesmo se o log chegar embaralhado", () => {
    const e = eventosDoBau([
      linha("🎒 B", dia(2, 10)),
      linha("🎒 C", dia(2, 12)),
      linha("🎒 A", dia(1, 9)),
    ]);
    expect(e.map((x) => x.texto)).toEqual(["🎒 C", "🎒 B", "🎒 A"]);
  });

  it("hora que não dá pra ler fica de fora, não derruba a lista", () => {
    expect(eventosDoBau([linha("🎒 X", "ontem"), linha("🎒 Y", dia(2))]).map((x) => x.texto)).toEqual(["🎒 Y"]);
  });

  it("espaço antes da marca ainda conta", () => {
    expect(ehLinhaDoBau("  🎒 Ana guardou")).toBe(true);
    expect(ehLinhaDoBau("Ana guardou 🎒")).toBe(false);
  });

  it("filtra por tipo", () => {
    const e = eventosDoBau([linha("🎒 A", dia(2)), linha("💰 B", dia(2, 13))]);
    expect(filtrarEventos(e, "tudo")).toHaveLength(2);
    expect(filtrarEventos(e, "item").map((x) => x.texto)).toEqual(["🎒 A"]);
    expect(filtrarEventos(e, "dinheiro").map((x) => x.texto)).toEqual(["💰 B"]);
  });
});

describe("agrupar por dia", () => {
  it("Hoje, Ontem e a data dos outros, na ordem", () => {
    const e = eventosDoBau([
      linha("🎒 hoje 2", dia(3, 14)),
      linha("🎒 hoje 1", dia(3, 9)),
      linha("🎒 ontem", dia(2)),
      linha("🎒 antes", dia(1)),
    ]);
    const g = agruparPorDia(e, AGORA);
    expect(g.map((x) => x.rotulo).slice(0, 2)).toEqual(["Hoje", "Ontem"]);
    expect(g[0].eventos.map((x) => x.texto)).toEqual(["🎒 hoje 2", "🎒 hoje 1"]);
    expect(g[2].rotulo).toMatch(/01\/10/);
  });

  it("11h da noite de ontem é ontem, não hoje (o dia é o do fuso de quem olha)", () => {
    expect(rotuloDoDia(dia(2, 23, 30), AGORA)).toBe("Ontem");
    expect(rotuloDoDia(dia(3, 0, 30), AGORA)).toBe("Hoje");
  });

  it("sem eventos, sem grupos", () => {
    expect(agruparPorDia([], AGORA)).toEqual([]);
  });
});
