import { describe, expect, it } from "vitest";
import {
  ARMADILHAS_PRONTAS,
  RAIO_PADRAO_M,
  armadilhasVisiveis,
  avaliarPisadas,
  cdValida,
  estaNaZona,
  linhaDeDesarme,
  linhaDePerigo,
  PERIGOS_PRONTOS,
  linhaDeDisparo,
  normalizarArmadilha,
  raioValido,
  rolarDanoDoTexto,
  rotuloDoEstado,
  sugestaoDaArmadilha,
  vigia,
  type Armadilha,
  type EstadoDePisadas,
} from "./armadilhas";

// Grade de 70 px, 1,5 m por quadradinho. O quadradinho (col 5, lin 5) tem centro em (385, 385).
const cena = { grade_ligada: true, grade_px: 70, largura: 2000, altura: 2000, metros: 1.5 };
const base: Armadilha = {
  id: "a1",
  cena_id: "c1",
  room_code: "s",
  nome: "Poço",
  x: 385,
  y: 385,
  raio: RAIO_PADRAO_M,
  salvaguarda: "DES",
  cd: 12,
  dano: "2d6 contundente",
  nota: "",
  estado: "armada",
  tipo: "armadilha",
  created_at: "",
};
const medio = (id: string, x: number, y: number, nome = "Ana") => ({ id, x, y, espacoPx: 35, nome });

describe("ler a armadilha do banco", () => {
  it("lê uma linha completa", () => {
    expect(normalizarArmadilha({ ...base, x: "385", raio: "3" })).toMatchObject({ x: 385, raio: 3, estado: "armada", cd: 12 });
  });

  it("ignora o que não dá pra desenhar", () => {
    expect(normalizarArmadilha(null)).toBeNull();
    expect(normalizarArmadilha({ ...base, id: undefined })).toBeNull();
    expect(normalizarArmadilha({ ...base, x: "abc" })).toBeNull();
    expect(normalizarArmadilha({ ...base, estado: "explodida" })).toBeNull();
  });

  it("raio torto vira o padrão; CD fora de 1 a 40 some", () => {
    expect(normalizarArmadilha({ ...base, raio: -2 })?.raio).toBe(RAIO_PADRAO_M);
    expect(normalizarArmadilha({ ...base, cd: 99 })?.cd).toBeNull();
    expect(cdValida("13")).toBe(13);
    expect(raioValido("1,5")).toBe(1.5);
    expect(raioValido(0)).toBeNull();
    expect(raioValido(61)).toBeNull();
  });

  it("as prontas passam nas próprias regras", () => {
    for (const p of ARMADILHAS_PRONTAS) {
      expect(raioValido(p.raio)).toBe(p.raio);
      expect(p.cd === null || cdValida(p.cd) === p.cd).toBe(true);
    }
  });
});

describe("quem enxerga o quê", () => {
  const lista = (["armada", "revelada", "disparada", "desarmada"] as const).map((estado, i) => ({ ...base, id: `a${i}`, estado }));

  it("o Mestre vê todas", () => {
    expect(armadilhasVisiveis(lista, true)).toHaveLength(4);
  });

  it("a mesa não vê a escondida (armada), e vê as outras", () => {
    expect(armadilhasVisiveis(lista, false).map((a) => a.estado)).toEqual(["revelada", "disparada", "desarmada"]);
  });

  it("só a escondida e a revelada vigiam", () => {
    expect(lista.map(vigia)).toEqual([true, true, false, false]);
  });
});

describe("a zona que dispara", () => {
  it("o peão no quadradinho da armadilha pisa; o do quadradinho do lado não", () => {
    expect(estaNaZona(cena, base, medio("p", 385, 385))).toBe(true);
    expect(estaNaZona(cena, base, medio("p", 455, 385))).toBe(false); // um quadradinho à direita
    expect(estaNaZona(cena, base, medio("p", 385, 315))).toBe(false); // um acima
    expect(estaNaZona(cena, base, medio("p", 455, 455))).toBe(false); // na diagonal
  });

  it("zona maior (3 m) pega os vizinhos, mas não quem está longe", () => {
    const zona = { ...base, raio: 3 }; // 3 m = 140 px
    expect(estaNaZona(cena, zona, medio("p", 455, 385))).toBe(true);
    expect(estaNaZona(cena, zona, medio("p", 385, 595))).toBe(false); // 210 px
  });

  it("criatura grande (2×2, centro no cruzamento) pisa no quadradinho que ocupa", () => {
    const grande = { id: "g", x: 420, y: 420, espacoPx: 70, nome: "Ogro" }; // cobre os quadradinhos (5..6, 5..6)
    expect(estaNaZona(cena, base, grande)).toBe(true);
    expect(estaNaZona(cena, { ...base, x: 735, y: 735 }, grande)).toBe(false);
  });
});

describe("avisar quando alguém pisa", () => {
  const vazio = (): EstadoDePisadas => avaliarPisadas(null, { cena, armadilhas: [base], pecas: [medio("p", 100, 100)] }).estado;

  it("a primeira conferência só aprende o terreno, mesmo com gente em cima da armadilha", () => {
    const r = avaliarPisadas(null, { cena, armadilhas: [base], pecas: [medio("p", 385, 385)] });
    expect(r.pisadas).toEqual([]);
  });

  it("entrar na zona avisa, uma vez só", () => {
    const e0 = vazio();
    const r1 = avaliarPisadas(e0, { cena, armadilhas: [base], pecas: [medio("p", 385, 385)] });
    expect(r1.pisadas).toEqual([{ pecaId: "p", peca: "Ana", armadilhaId: "a1", motivo: "entrou" }]);
    const r2 = avaliarPisadas(r1.estado, { cena, armadilhas: [base], pecas: [medio("p", 385, 385)] });
    expect(r2.pisadas).toEqual([]); // continuou lá: sem aviso repetido
  });

  it("sair e voltar avisa de novo", () => {
    const e0 = vazio();
    const dentro = avaliarPisadas(e0, { cena, armadilhas: [base], pecas: [medio("p", 385, 385)] });
    const fora = avaliarPisadas(dentro.estado, { cena, armadilhas: [base], pecas: [medio("p", 100, 100)] });
    const volta = avaliarPisadas(fora.estado, { cena, armadilhas: [base], pecas: [medio("p", 385, 385)] });
    expect(volta.pisadas).toHaveLength(1);
  });

  it("armadilha nova sob um peão não avisa (o Mestre acabou de pôr)", () => {
    const e0 = avaliarPisadas(null, { cena, armadilhas: [], pecas: [medio("p", 385, 385)] }).estado;
    const r = avaliarPisadas(e0, { cena, armadilhas: [base], pecas: [medio("p", 385, 385)] });
    expect(r.pisadas).toEqual([]);
  });

  it("peão novo posto em cima da armadilha não avisa; o que anda até ela, sim", () => {
    const e0 = vazio();
    const posto = avaliarPisadas(e0, { cena, armadilhas: [base], pecas: [medio("p", 100, 100), medio("q", 385, 385, "Beto")] });
    expect(posto.pisadas).toEqual([]);
    const anda = avaliarPisadas(posto.estado, { cena, armadilhas: [base], pecas: [medio("p", 385, 385), medio("q", 385, 385, "Beto")] });
    expect(anda.pisadas.map((p) => p.peca)).toEqual(["Ana"]);
  });

  it("dois peões entrando juntos avisam os dois", () => {
    const e0 = avaliarPisadas(null, { cena, armadilhas: [base], pecas: [medio("p", 100, 100), medio("q", 120, 100, "Beto")] }).estado;
    const r = avaliarPisadas(e0, { cena, armadilhas: [base], pecas: [medio("p", 385, 385), medio("q", 385, 385, "Beto")] });
    expect(r.pisadas.map((p) => p.peca).sort()).toEqual(["Ana", "Beto"]);
  });

  it("só quem vigia avisa: disparada e desarmada ficam quietas", () => {
    for (const estado of ["disparada", "desarmada"] as const) {
      const a = { ...base, estado };
      const e0 = avaliarPisadas(null, { cena, armadilhas: [a], pecas: [medio("p", 100, 100)] }).estado;
      expect(avaliarPisadas(e0, { cena, armadilhas: [a], pecas: [medio("p", 385, 385)] }).pisadas).toEqual([]);
    }
    const revelada = { ...base, estado: "revelada" as const };
    const e0 = avaliarPisadas(null, { cena, armadilhas: [revelada], pecas: [medio("p", 100, 100)] }).estado;
    expect(avaliarPisadas(e0, { cena, armadilhas: [revelada], pecas: [medio("p", 385, 385)] }).pisadas).toHaveLength(1);
  });

  it("rearmar (volta a vigiar) com o peão em cima não avisa até ele sair e voltar", () => {
    const gasta = { ...base, estado: "disparada" as const };
    const e0 = avaliarPisadas(null, { cena, armadilhas: [gasta], pecas: [medio("p", 385, 385)] }).estado;
    const rearmada = avaliarPisadas(e0, { cena, armadilhas: [base], pecas: [medio("p", 385, 385)] });
    expect(rearmada.pisadas).toEqual([]);
  });
});

describe("o aviso e o dano", () => {
  it("sugere salvaguarda e dano juntos", () => {
    expect(sugestaoDaArmadilha(base)).toBe("Salvaguarda DES CD 12 · 2d6 contundente");
    expect(sugestaoDaArmadilha({ salvaguarda: "", cd: null, dano: "" })).toBe("");
    expect(sugestaoDaArmadilha({ salvaguarda: "FOR", cd: null, dano: "" })).toBe("Salvaguarda FOR");
    expect(sugestaoDaArmadilha({ salvaguarda: "", cd: 14, dano: "3d6 fogo" })).toBe("Salvaguarda CD 14 · 3d6 fogo");
  });

  it("rola os dados do texto (dado injetado)", () => {
    const sempre4 = () => 4;
    expect(rolarDanoDoTexto("2d6 contundente", sempre4)).toEqual({ total: 8, conta: "2d6: 4+4" });
    expect(rolarDanoDoTexto("1d4+2 perfurante + 1d6 veneno", sempre4)).toEqual({ total: 10, conta: "1d4+2: 4+2 · 1d6: 4" });
    expect(rolarDanoDoTexto("1d4 - 9", sempre4)?.total).toBe(0); // nunca negativo
  });

  it("texto sem dado não rola nada", () => {
    expect(rolarDanoDoTexto("")).toBeNull();
    expect(rolarDanoDoTexto("fica preso")).toBeNull();
  });

  it("linhas do log", () => {
    expect(linhaDeDisparo("Ana", base)).toBe("⚠️ Ana caiu em Poço. Salvaguarda DES CD 12.");
    expect(linhaDeDisparo("Ana", { ...base, nome: "", salvaguarda: "", cd: null })).toBe("⚠️ Ana caiu em Armadilha.");
    expect(linhaDeDesarme("Beto", base)).toBe("🛠️ Poço foi desarmada (Beto).");
    expect(linhaDeDesarme(null, base)).toBe("🛠️ Poço foi desarmada.");
  });
});

describe("perigos contínuos (fogo, gás, ácido)", () => {
  const perigo: Armadilha = { ...base, id: "p1", nome: "Fogo", tipo: "perigo", estado: "revelada", raio: 3, salvaguarda: "DES", cd: 13, dano: "1d6 fogo" };
  const comSlug = (id: string, x: number, y: number, slug: string, nome = "Ana") => ({ id, x, y, espacoPx: 35, nome, slug });
  const longe = { x: 100, y: 100 };
  const dentro = { x: 385, y: 385 };

  it("lê o tipo do banco; sem a coluna (migration por rodar) é armadilha", () => {
    expect(normalizarArmadilha({ ...perigo })?.tipo).toBe("perigo");
    const semColuna = { ...base } as Record<string, unknown>;
    delete semColuna.tipo;
    expect(normalizarArmadilha(semColuna)?.tipo).toBe("armadilha");
  });

  it("os perigos prontos passam nas próprias regras", () => {
    for (const p of PERIGOS_PRONTOS) {
      expect(raioValido(p.raio)).toBe(p.raio);
      expect(p.cd === null || cdValida(p.cd) === p.cd).toBe(true);
    }
  });

  it("avisa quando alguém ENTRA, com o motivo 'entrou'", () => {
    const e0 = avaliarPisadas(null, { cena, armadilhas: [perigo], pecas: [comSlug("p", longe.x, longe.y, "ana")], vezDe: "beto" }).estado;
    const r = avaliarPisadas(e0, { cena, armadilhas: [perigo], pecas: [comSlug("p", dentro.x, dentro.y, "ana")], vezDe: "beto" });
    expect(r.pisadas).toEqual([{ pecaId: "p", peca: "Ana", armadilhaId: "p1", motivo: "entrou" }]);
  });

  it("avisa no INÍCIO DO TURNO de quem já estava dentro (motivo 'turno'), uma vez por turno", () => {
    const pecas = [comSlug("p", dentro.x, dentro.y, "ana"), comSlug("q", longe.x, longe.y, "beto", "Beto")];
    const e0 = avaliarPisadas(null, { cena, armadilhas: [perigo], pecas, vezDe: "beto" }).estado;
    // A vez passa pra Ana, que está dentro do fogo.
    const r1 = avaliarPisadas(e0, { cena, armadilhas: [perigo], pecas, vezDe: "ana" });
    expect(r1.pisadas).toEqual([{ pecaId: "p", peca: "Ana", armadilhaId: "p1", motivo: "turno" }]);
    // Ninguém mexeu e a vez continua nela: sem aviso repetido.
    expect(avaliarPisadas(r1.estado, { cena, armadilhas: [perigo], pecas, vezDe: "ana" }).pisadas).toEqual([]);
    // A vez vai pro Beto (fora do fogo): nada.
    expect(avaliarPisadas(r1.estado, { cena, armadilhas: [perigo], pecas, vezDe: "beto" }).pisadas).toEqual([]);
  });

  it("a primeira conferência não avisa de turno; e armadilha comum nunca avisa de turno", () => {
    const pecas = [comSlug("p", dentro.x, dentro.y, "ana")];
    expect(avaliarPisadas(null, { cena, armadilhas: [perigo], pecas, vezDe: "ana" }).pisadas).toEqual([]);
    const e0 = avaliarPisadas(null, { cena, armadilhas: [base], pecas, vezDe: "beto" }).estado;
    expect(avaliarPisadas(e0, { cena, armadilhas: [base], pecas, vezDe: "ana" }).pisadas).toEqual([]);
  });

  it("perigo extinto não avisa mais, nem ao entrar nem no turno", () => {
    const extinto = { ...perigo, estado: "desarmada" as const };
    const pecas = [comSlug("p", dentro.x, dentro.y, "ana")];
    const e0 = avaliarPisadas(null, { cena, armadilhas: [extinto], pecas, vezDe: "beto" }).estado;
    expect(avaliarPisadas(e0, { cena, armadilhas: [extinto], pecas, vezDe: "ana" }).pisadas).toEqual([]);
  });

  it("sem iniciativa (vez nula) não há início de turno", () => {
    const pecas = [comSlug("p", dentro.x, dentro.y, "ana")];
    const e0 = avaliarPisadas(null, { cena, armadilhas: [perigo], pecas, vezDe: "beto" }).estado;
    expect(avaliarPisadas(e0, { cena, armadilhas: [perigo], pecas, vezDe: null }).pisadas).toEqual([]);
  });

  it("rótulos e linhas do log falam de perigo, não de armadilha", () => {
    expect(rotuloDoEstado("revelada", "perigo")).toBe("ativo");
    expect(rotuloDoEstado("desarmada", "perigo")).toBe("extinto");
    expect(rotuloDoEstado("revelada", "armadilha")).toBe("revelada");
    expect(linhaDePerigo("Ana", perigo, "turno")).toBe("☠️ Ana começou o turno em Fogo. Salvaguarda DES CD 13.");
    expect(linhaDePerigo("Ana", perigo, "entrou")).toBe("☠️ Ana entrou em Fogo. Salvaguarda DES CD 13.");
    expect(linhaDeDesarme(null, perigo)).toBe("🧯 Fogo foi extinto.");
  });
});
