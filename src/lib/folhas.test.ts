import { describe, expect, it } from "vitest";
import {
  caminhoDaFolha,
  estaEntregue,
  folhasNovas,
  folhasVisiveis,
  guardarVistas,
  lerVistas,
  normalizarFolha,
  rotuloDoDestino,
  tituloDaFolha,
  type Folha,
} from "./folhas";

const f = (extra: Partial<Folha>): Folha => ({
  id: "f1",
  room_code: "s",
  titulo: "Carta do rei",
  texto: "Venham ao castelo.",
  foto: null,
  para: null,
  entregue_em: "2026-10-11T20:00:00Z",
  created_at: "2026-10-11T19:00:00Z",
  ...extra,
});

describe("ler a folha do banco", () => {
  it("lê uma linha completa e limita o tamanho dos textos", () => {
    const lida = normalizarFolha({ ...f({}), titulo: "x".repeat(200), texto: "y".repeat(5000) });
    expect(lida?.titulo).toHaveLength(80);
    expect(lida?.texto).toHaveLength(2000);
  });

  it("ignora linha torta; destino vazio é a mesa toda; sem entrega é rascunho", () => {
    expect(normalizarFolha(null)).toBeNull();
    expect(normalizarFolha({ titulo: "sem id" })).toBeNull();
    expect(normalizarFolha({ id: "a", para: "" })?.para).toBeNull();
    expect(estaEntregue(normalizarFolha({ id: "a", entregue_em: null })!)).toBe(false);
    expect(estaEntregue(normalizarFolha({ id: "a", entregue_em: "2026-10-11T20:00:00Z" })!)).toBe(true);
  });

  it("título vazio vira 'Folha sem título'", () => {
    expect(tituloDaFolha({ titulo: "  " })).toBe("Folha sem título");
  });
});

describe("quem enxerga o quê", () => {
  const todas = [
    f({ id: "rascunho", entregue_em: null }),
    f({ id: "mesa", para: null, entregue_em: "2026-10-11T20:00:00Z" }),
    f({ id: "ana", para: "ana", entregue_em: "2026-10-11T21:00:00Z" }),
    f({ id: "beto", para: "beto", entregue_em: "2026-10-11T22:00:00Z" }),
  ];

  it("o Mestre vê tudo, rascunho e carta secreta inclusive", () => {
    expect(folhasVisiveis(todas, { tipo: "mestre" }).map((x) => x.id).sort()).toEqual(["ana", "beto", "mesa", "rascunho"]);
  });

  it("o jogador vê só o entregue a ele e à mesa toda, nunca rascunho nem carta de outro", () => {
    expect(folhasVisiveis(todas, { tipo: "jogador", slug: "ana" }).map((x) => x.id)).toEqual(["ana", "mesa"]);
    expect(folhasVisiveis(todas, { tipo: "jogador", slug: "beto" }).map((x) => x.id)).toEqual(["beto", "mesa"]);
    expect(folhasVisiveis(todas, { tipo: "jogador", slug: "carla" }).map((x) => x.id)).toEqual(["mesa"]);
  });

  it("o telão e quem não escolheu quem é não veem nada", () => {
    expect(folhasVisiveis(todas, null)).toEqual([]);
  });

  it("a mais recente vem primeiro", () => {
    expect(folhasVisiveis(todas, { tipo: "jogador", slug: "ana" })[0].id).toBe("ana");
  });
});

describe("folhas novas", () => {
  const todas = [f({ id: "mesa" }), f({ id: "ana", para: "ana" }), f({ id: "rascunho", entregue_em: null })];

  it("são as entregues que o aparelho ainda não abriu", () => {
    expect(folhasNovas(todas, "ana", new Set()).map((x) => x.id).sort()).toEqual(["ana", "mesa"]);
    expect(folhasNovas(todas, "ana", new Set(["mesa"])).map((x) => x.id)).toEqual(["ana"]);
    expect(folhasNovas(todas, "ana", new Set(["mesa", "ana"]))).toEqual([]);
  });

  it("a carta de outro jogador nunca vira aviso", () => {
    expect(folhasNovas(todas, "beto", new Set()).map((x) => x.id)).toEqual(["mesa"]);
  });
});

describe("rótulos e caminho", () => {
  it("diz pra quem foi", () => {
    expect(rotuloDoDestino({ para: null }, () => "?")).toBe("a mesa toda");
    expect(rotuloDoDestino({ para: "ana" }, (s) => (s === "ana" ? "Ana" : "?"))).toBe("só Ana");
  });

  it("a foto fica numa pasta da sala e cada envio tem caminho novo", () => {
    expect(caminhoDaFolha("sala", "id1", "abc")).toBe("sala/folhas/id1-abc.jpg");
  });
});

describe("o que o aparelho já viu", () => {
  it("guarda e lê de volta; torto vira conjunto vazio", () => {
    const memoria: Record<string, string> = {};
    guardarVistas("s", new Set(["a", "b"]), (c, v) => void (memoria[c] = v));
    expect([...lerVistas("s", (c) => memoria[c] ?? null)].sort()).toEqual(["a", "b"]);
    expect(lerVistas("s", () => "{torto")).toEqual(new Set());
    expect(lerVistas("s", () => '{"a":1}')).toEqual(new Set());
    expect(lerVistas("s", () => null)).toEqual(new Set());
  });

  it("sem armazenamento (modo privado) não derruba", () => {
    expect(() =>
      guardarVistas("s", new Set(["a"]), () => {
        throw new Error("cheio");
      }),
    ).not.toThrow();
    expect(
      lerVistas("s", () => {
        throw new Error("bloqueado");
      }),
    ).toEqual(new Set());
  });
});
