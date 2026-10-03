import { describe, expect, it } from "vitest";
import { ecoAtrasado } from "./ecoAtrasado";

const em = (iso: string) => ({ updated_at: iso });

describe("eco atrasado do tempo real", () => {
  it("evento mais velho que a linha da tela é descartado", () => {
    expect(ecoAtrasado(em("2026-10-02T22:00:02.000Z"), em("2026-10-02T22:00:01.000Z"))).toBe(true);
  });

  it("evento mais novo passa", () => {
    expect(ecoAtrasado(em("2026-10-02T22:00:01.000Z"), em("2026-10-02T22:00:02.000Z"))).toBe(false);
  });

  it("mesmo carimbo passa (reentrega do mesmo evento, ou duas escritas no mesmo instante)", () => {
    expect(ecoAtrasado(em("2026-10-02T22:00:01.000Z"), em("2026-10-02T22:00:01.000Z"))).toBe(false);
  });

  it("formatos diferentes do mesmo instante contam como iguais (o banco devolve horário em formatos diferentes)", () => {
    expect(ecoAtrasado(em("2026-10-02T22:00:01+00:00"), em("2026-10-02T22:00:01.000Z"))).toBe(false);
    expect(ecoAtrasado(em("2026-10-02T19:00:02-03:00"), em("2026-10-02T22:00:01.000Z"))).toBe(true);
  });

  it("linha que a tela ainda não tem: passa", () => {
    expect(ecoAtrasado(undefined, em("2026-10-02T22:00:01.000Z"))).toBe(false);
  });

  it("sem carimbo legível não dá pra afirmar nada: passa", () => {
    expect(ecoAtrasado({}, em("2026-10-02T22:00:01.000Z"))).toBe(false);
    expect(ecoAtrasado(em("2026-10-02T22:00:01.000Z"), {})).toBe(false);
    expect(ecoAtrasado(em("ontem"), em("2026-10-02T22:00:01.000Z"))).toBe(false);
    expect(ecoAtrasado(em("2026-10-02T22:00:01.000Z"), { updated_at: 5 })).toBe(false);
  });
});
