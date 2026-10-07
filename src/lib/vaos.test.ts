import { describe, expect, it } from "vitest";
import type { Parede } from "./paredes";
import { vaosDePorta } from "./vaos";

const cena = { grade_ligada: true, grade_px: 30, grade_dx: 0, grade_dy: 0, largura: 900, altura: 600 };

let n = 0;
function parede(x1: number, y1: number, x2: number, y2: number, extra: Partial<Parede> = {}): Parede {
  return { id: `p${n++}`, cena_id: "c", room_code: "s", tipo: "parede", x1, y1, x2, y2, aberta: false, created_at: "", ...extra };
}

describe("vãos que viram porta", () => {
  it("duas paredes na mesma linha com um quadradinho de abertura: uma porta aberta no vão", () => {
    const r = vaosDePorta([parede(0, 100, 120, 100), parede(150, 100, 300, 100)], cena);
    expect(r).toEqual([{ tipo: "porta", x1: 120, y1: 100, x2: 150, y2: 100, aberta: true }]);
  });

  it("serve na vertical e na diagonal", () => {
    expect(vaosDePorta([parede(100, 0, 100, 120), parede(100, 150, 100, 300)], cena)).toHaveLength(1);
    expect(vaosDePorta([parede(0, 0, 100, 100), parede(130, 130, 230, 230)], cena)).toHaveLength(1);
  });

  it("vão de mais de dois quadradinhos é rua, não porta", () => {
    expect(vaosDePorta([parede(0, 100, 120, 100), parede(210, 100, 300, 100)], cena)).toEqual([]);
  });

  it("ponta quase encostada (menos de meio quadradinho) não é vão", () => {
    expect(vaosDePorta([parede(0, 100, 120, 100), parede(130, 100, 300, 100)], cena)).toEqual([]);
  });

  it("canto (paredes em ângulo) não é porta", () => {
    expect(vaosDePorta([parede(0, 100, 120, 100), parede(150, 130, 150, 300)], cena)).toEqual([]);
  });

  it("paredes paralelas lado a lado, sem apontar uma pra outra, não formam vão", () => {
    expect(vaosDePorta([parede(0, 100, 120, 100), parede(0, 130, 120, 130)], cena)).toEqual([]);
  });

  it("outra parede cortando o vão cancela", () => {
    const r = vaosDePorta([parede(0, 100, 120, 100), parede(150, 100, 300, 100), parede(135, 40, 135, 160)], cena);
    expect(r).toEqual([]);
  });

  it("já tem porta no vão: não marca de novo", () => {
    const r = vaosDePorta([parede(0, 100, 120, 100), parede(150, 100, 300, 100), parede(120, 100, 150, 100, { tipo: "porta" })], cena);
    expect(r).toEqual([]);
  });

  it("cada ponta serve a um vão só: o mais curto ganha", () => {
    const r = vaosDePorta([parede(0, 100, 120, 100), parede(150, 100, 300, 100), parede(170, 100, 400, 100)], cena);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ x1: 120, x2: 150 });
  });

  it("sem grade, o vão máximo é uma fração do mapa", () => {
    const sem = { ...cena, grade_ligada: false };
    expect(vaosDePorta([parede(0, 100, 100, 100), parede(120, 100, 300, 100)], sem)).toHaveLength(1);
    expect(vaosDePorta([parede(0, 100, 100, 100), parede(200, 100, 300, 100)], sem)).toEqual([]);
  });
});
