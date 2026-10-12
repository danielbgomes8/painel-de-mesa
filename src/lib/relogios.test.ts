import { describe, expect, it } from "vitest";
import {
  avancar,
  consequenciaVisivel,
  estaCheio,
  fatiasParaDesenho,
  fatiasValidas,
  linhaDeRelogio,
  nomeDoRelogio,
  normalizarRelogio,
  relogiosVisiveis,
  rotuloDoRelogio,
  type Relogio,
} from "./relogios";

const r = (extra: Partial<Relogio> = {}): Relogio => ({
  id: "r1",
  room_code: "s",
  nome: "Ritual",
  fatias: 6,
  cheias: 2,
  visivel: true,
  consequencia: "O portal se abre.",
  created_at: "2026-10-12T10:00:00Z",
  ...extra,
});

describe("ler o relógio do banco", () => {
  it("lê uma linha completa", () => {
    expect(normalizarRelogio({ ...r(), fatias: "8", cheias: "3" })).toMatchObject({ fatias: 8, cheias: 3, nome: "Ritual" });
  });

  it("ignora linha torta e aperta o que vem fora do limite", () => {
    expect(normalizarRelogio(null)).toBeNull();
    expect(normalizarRelogio({ nome: "sem id" })).toBeNull();
    expect(normalizarRelogio({ ...r(), fatias: 7 })?.fatias).toBe(6); // número que não existe vira 6
    expect(normalizarRelogio({ ...r(), cheias: 99 })?.cheias).toBe(6); // não passa do total
    expect(normalizarRelogio({ ...r(), cheias: -4 })?.cheias).toBe(0);
    expect(normalizarRelogio({ ...r(), visivel: undefined })?.visivel).toBe(true);
    expect(normalizarRelogio({ ...r(), nome: "x".repeat(200) })?.nome).toHaveLength(60);
  });

  it("só 4, 6, 8, 10 e 12 fatias valem", () => {
    expect([4, 6, 8, 10, 12].map(fatiasValidas)).toEqual([4, 6, 8, 10, 12]);
    expect(fatiasValidas(5)).toBe(6);
    expect(fatiasValidas("abc")).toBe(6);
    expect(fatiasValidas(null)).toBe(6);
  });
});

describe("avançar e fechar", () => {
  it("anda pra frente e pra trás sem sair de 0 e do total", () => {
    expect(avancar(r(), 1).cheias).toBe(3);
    expect(avancar(r(), -1).cheias).toBe(1);
    expect(avancar(r({ cheias: 0 }), -1).cheias).toBe(0);
    expect(avancar(r({ cheias: 6 }), 1).cheias).toBe(6);
    expect(avancar(r(), 50).cheias).toBe(6);
  });

  it("fecha quando todas as fatias estão cheias", () => {
    expect(estaCheio(r({ cheias: 5 }))).toBe(false);
    expect(estaCheio(r({ cheias: 6 }))).toBe(true);
  });

  it("nome vazio vira 'Relógio'; o rótulo diz quantas fatias", () => {
    expect(nomeDoRelogio(r({ nome: "  " }))).toBe("Relógio");
    expect(rotuloDoRelogio(r())).toBe("Ritual: 2 de 6");
  });
});

describe("quem enxerga o quê", () => {
  const lista = [r({ id: "b", visivel: false, created_at: "2026-10-12T12:00:00Z" }), r({ id: "a", created_at: "2026-10-12T11:00:00Z" })];

  it("o Mestre vê todos, a mesa só os liberados; mais antigo primeiro", () => {
    expect(relogiosVisiveis(lista, true).map((x) => x.id)).toEqual(["a", "b"]);
    expect(relogiosVisiveis(lista, false).map((x) => x.id)).toEqual(["a"]);
  });

  it("a consequência é segredo até fechar (o Mestre a lê sempre)", () => {
    expect(consequenciaVisivel(r({ cheias: 5 }), false)).toBe("");
    expect(consequenciaVisivel(r({ cheias: 6 }), false)).toBe("O portal se abre.");
    expect(consequenciaVisivel(r({ cheias: 1 }), true)).toBe("O portal se abre.");
    expect(consequenciaVisivel(r({ cheias: 6, consequencia: "  " }), false)).toBe("");
  });
});

describe("a linha do log", () => {
  it("conta o avanço, e o fechamento com a consequência", () => {
    expect(linhaDeRelogio(r(), avancar(r(), 1))).toBe("⏳ Ritual: 3 de 6");
    expect(linhaDeRelogio(r({ cheias: 5 }), r({ cheias: 6 }))).toBe("⏰ Ritual fechou (6 de 6)! O portal se abre.");
    expect(linhaDeRelogio(r({ cheias: 5, consequencia: "" }), r({ cheias: 6, consequencia: "" }))).toBe("⏰ Ritual fechou (6 de 6)!");
  });

  it("sem mudança, sem linha; voltar de cheio é um recuo comum, não um fechamento", () => {
    expect(linhaDeRelogio(r(), r())).toBeNull();
    expect(linhaDeRelogio(r({ cheias: 6 }), r({ cheias: 5 }))).toBe("⏳ Ritual: 5 de 6");
  });
});

describe("o desenho", () => {
  it("uma fatia por pedaço, as primeiras cheias", () => {
    const f = fatiasParaDesenho(6, 2, 50, 50, 40);
    expect(f).toHaveLength(6);
    expect(f.map((x) => x.cheia)).toEqual([true, true, false, false, false, false]);
    for (const x of f) expect(x.d).toMatch(/^M 50 50 L [\d.]+ [\d.]+ A 40 40 0 [01] 1 [\d.]+ [\d.]+ Z$/);
  });

  it("a primeira fatia começa em cima (12 horas) e vai pra direita", () => {
    const [primeira] = fatiasParaDesenho(4, 0, 50, 50, 40, 0);
    expect(primeira.d.startsWith("M 50 50 L 50.00 10.00")).toBe(true);
  });
});
