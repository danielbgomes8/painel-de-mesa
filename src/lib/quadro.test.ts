import { describe, expect, it } from "vitest";
import {
  agruparPorColuna,
  cartoesVisiveis,
  filtrarPorTipo,
  normalizarCartao,
  ordenarColunas,
  podeEditarCartao,
  podeMoverCartao,
  podeVerSegredo,
  virouDestaque,
  destaqueEmSilhueta,
  visaoDoCartao,
  todasAsFotos,
  comAsFotos,
  semAFoto,
  FOTOS_MAXIMAS,
  type Cartao,
} from "./quadro";
import type { Identidade } from "./identidade";

const MESTRE: Identidade = { tipo: "mestre" };
const ANA: Identidade = { tipo: "jogador", slug: "ana" };
const BETO: Identidade = { tipo: "jogador", slug: "beto" };

function cartao(extra: Partial<Cartao> = {}): Cartao {
  return {
    id: "c1",
    room_code: "s",
    tipo: "npc",
    titulo: "Barão Vael",
    subtitulo: "",
    foto: null,
    fotos: [],
    texto: "um nobre",
    segredo: "serve ao culto",
    revelacao: "escondido",
    dono: null,
    coluna: "",
    destaque_em: null,
    created_at: "2026-10-02T10:00:00Z",
    ...extra,
  };
}

describe("visaoDoCartao — cartão da mesa", () => {
  it("o Mestre vê tudo, inclusive o escondido", () => {
    for (const revelacao of ["escondido", "silhueta", "revelado"] as const) {
      expect(visaoDoCartao(cartao({ revelacao }), MESTRE)).toBe("completo");
    }
  });
  it("o jogador não vê o escondido, vê a silhueta e vê o revelado", () => {
    expect(visaoDoCartao(cartao({ revelacao: "escondido" }), ANA)).toBeNull();
    expect(visaoDoCartao(cartao({ revelacao: "silhueta" }), ANA)).toBe("silhueta");
    expect(visaoDoCartao(cartao({ revelacao: "revelado" }), ANA)).toBe("completo");
  });
  it("o telão (sem identidade) vê como a mesa", () => {
    expect(visaoDoCartao(cartao({ revelacao: "escondido" }), null)).toBeNull();
    expect(visaoDoCartao(cartao({ revelacao: "silhueta" }), null)).toBe("silhueta");
    expect(visaoDoCartao(cartao({ revelacao: "revelado" }), null)).toBe("completo");
  });
});

describe("visaoDoCartao — cartão pessoal", () => {
  const dela = cartao({ dono: "ana", revelacao: "escondido" });
  it("só o dono vê enquanto não compartilha; nem o Mestre", () => {
    expect(visaoDoCartao(dela, ANA)).toBe("completo");
    expect(visaoDoCartao(dela, BETO)).toBeNull();
    expect(visaoDoCartao(dela, MESTRE)).toBeNull();
    expect(visaoDoCartao(dela, null)).toBeNull();
  });
  it("compartilhado, a mesa inteira vê", () => {
    const aberto = cartao({ dono: "ana", revelacao: "revelado" });
    expect(visaoDoCartao(aberto, BETO)).toBe("completo");
    expect(visaoDoCartao(aberto, MESTRE)).toBe("completo");
    expect(visaoDoCartao(aberto, null)).toBe("completo");
  });
  it("silhueta não existe em cartão pessoal: some pra quem não é dono", () => {
    expect(visaoDoCartao(cartao({ dono: "ana", revelacao: "silhueta" }), BETO)).toBeNull();
  });
});

describe("quem edita e quem lê o segredo", () => {
  it("o Mestre edita os da mesa; o jogador, só os próprios", () => {
    expect(podeEditarCartao(cartao(), MESTRE)).toBe(true);
    expect(podeEditarCartao(cartao(), ANA)).toBe(false);
    expect(podeEditarCartao(cartao({ dono: "ana" }), ANA)).toBe(true);
    expect(podeEditarCartao(cartao({ dono: "ana" }), BETO)).toBe(false);
    // Mestre vê o compartilhado do jogador, mas não escreve nele.
    expect(podeEditarCartao(cartao({ dono: "ana", revelacao: "revelado" }), MESTRE)).toBe(false);
    expect(podeEditarCartao(cartao(), null)).toBe(false);
  });
  it("o Mestre também move de coluna o cartão pessoal que o dono compartilhou", () => {
    const compartilhado = cartao({ dono: "ana", revelacao: "revelado" });
    expect(podeMoverCartao(compartilhado, MESTRE)).toBe(true);
    // Escondido ou em silhueta, o Mestre nem o enxerga por inteiro.
    expect(podeMoverCartao(cartao({ dono: "ana", revelacao: "escondido" }), MESTRE)).toBe(false);
    expect(podeMoverCartao(cartao({ dono: "ana", revelacao: "silhueta" }), MESTRE)).toBe(false);
    // Os outros jogadores seguem sem mexer; o dono e o cartão da mesa seguem como antes.
    expect(podeMoverCartao(compartilhado, BETO)).toBe(false);
    expect(podeMoverCartao(compartilhado, ANA)).toBe(true);
    expect(podeMoverCartao(cartao(), MESTRE)).toBe(true);
    expect(podeMoverCartao(compartilhado, null)).toBe(false);
    // Mover não dá o resto: editar continua sendo só do dono.
    expect(podeEditarCartao(compartilhado, MESTRE)).toBe(false);
  });
  it("segredo é só do Mestre, e só em cartão da mesa", () => {
    expect(podeVerSegredo(cartao(), MESTRE)).toBe(true);
    expect(podeVerSegredo(cartao(), ANA)).toBe(false);
    expect(podeVerSegredo(cartao(), null)).toBe(false);
    expect(podeVerSegredo(cartao({ dono: "ana" }), MESTRE)).toBe(false);
  });
});

describe("cartoesVisiveis e filtro", () => {
  const todos = [
    cartao({ id: "a", revelacao: "revelado", tipo: "vilao" }),
    cartao({ id: "b", revelacao: "escondido" }),
    cartao({ id: "c", revelacao: "silhueta", tipo: "vilao" }),
    cartao({ id: "d", dono: "beto" }),
  ];
  it("cada um recebe só o que pode ver", () => {
    expect(cartoesVisiveis(todos, ANA).map((v) => v.cartao.id)).toEqual(["a", "c"]);
    expect(cartoesVisiveis(todos, BETO).map((v) => v.cartao.id)).toEqual(["a", "c", "d"]);
    expect(cartoesVisiveis(todos, MESTRE).map((v) => v.cartao.id)).toEqual(["a", "b", "c"]);
  });
  it("filtra por tipo e null devolve todos", () => {
    const vistos = cartoesVisiveis(todos, ANA);
    expect(filtrarPorTipo(vistos, "vilao")).toHaveLength(2);
    expect(filtrarPorTipo(vistos, "local")).toHaveLength(0);
    expect(filtrarPorTipo(vistos, null)).toHaveLength(2);
  });
});

describe("colunas", () => {
  it("sugeridas na ordem delas, as do Mestre em ordem alfabética, sem coluna por último", () => {
    expect(ordenarColunas(["", "Zumbis", "Locais", "Ágio", "Conhecidos", "Suspeitos"])).toEqual([
      "Conhecidos",
      "Suspeitos",
      "Locais",
      "Ágio",
      "Zumbis",
      "",
    ]);
  });
  it("sugerida casa sem acento nem maiúscula", () => {
    expect(ordenarColunas(["locais", "missoes", "conhecidos"])).toEqual(["conhecidos", "missoes", "locais"]);
  });
  it("agrupa e nomeia a coluna vazia", () => {
    const vistos = cartoesVisiveis(
      [cartao({ id: "a", coluna: "Suspeitos", revelacao: "revelado" }), cartao({ id: "b", revelacao: "revelado" })],
      ANA,
    );
    const colunas = agruparPorColuna(vistos);
    expect(colunas.map((c) => c.nome)).toEqual(["Suspeitos", "Sem coluna"]);
    expect(colunas[0].cartoes[0].cartao.id).toBe("a");
  });
});

describe("virouDestaque", () => {
  const antes = cartao({ revelacao: "revelado", destaque_em: null });
  it("avisa quando o destaque muda e a pessoa vê o cartão inteiro", () => {
    const depois = cartao({ revelacao: "revelado", destaque_em: "2026-10-02T11:00:00Z" });
    expect(virouDestaque(antes, depois, ANA)).toBe(true);
    expect(virouDestaque(antes, depois, null)).toBe(true);
  });
  it("não avisa se nada mudou (releitura, outro campo editado)", () => {
    const igual = cartao({ revelacao: "revelado", destaque_em: "2026-10-02T11:00:00Z" });
    expect(virouDestaque(igual, { ...igual, titulo: "Outro" }, ANA)).toBe(false);
  });
  it("não avisa quando o cartão não tem destaque", () => {
    expect(virouDestaque(antes, cartao({ revelacao: "revelado" }), ANA)).toBe(false);
  });
  it("silhueta mostrada pelo Mestre avisa jogador e telão; cartão escondido não avisa ninguém", () => {
    const silhueta = cartao({ revelacao: "silhueta", destaque_em: "2026-10-02T11:00:00Z" });
    expect(virouDestaque(antes, silhueta, ANA)).toBe(true);
    expect(virouDestaque(antes, silhueta, null)).toBe(true);
    expect(virouDestaque(antes, cartao({ revelacao: "escondido", destaque_em: "x" }), null)).toBe(false);
  });
  it("destaque de cartão pessoal de outro jogador não vaza", () => {
    expect(virouDestaque(antes, cartao({ dono: "bia", revelacao: "escondido", destaque_em: "x" }), ANA)).toBe(false);
  });
  it("cartão que chega já com destaque (ainda não existia aqui) conta", () => {
    expect(virouDestaque(undefined, cartao({ revelacao: "revelado", destaque_em: "x" }), ANA)).toBe(true);
  });
});

describe("destaqueEmSilhueta", () => {
  it("só cartão da mesa em silhueta; revelado e pessoal mostram inteiro", () => {
    expect(destaqueEmSilhueta(cartao({ revelacao: "silhueta" }))).toBe(true);
    expect(destaqueEmSilhueta(cartao({ revelacao: "revelado" }))).toBe(false);
    expect(destaqueEmSilhueta(cartao({ dono: "ana", revelacao: "silhueta" }))).toBe(false);
  });
});

describe("normalizarCartao", () => {
  it("lê uma linha do banco e corta o que passa do limite", () => {
    const c = normalizarCartao({ id: "a", room_code: "s", tipo: "vilao", titulo: "x".repeat(200), revelacao: "silhueta", dono: "ana" });
    expect(c?.tipo).toBe("vilao");
    expect(c?.titulo).toHaveLength(80);
    expect(c?.revelacao).toBe("silhueta");
    expect(c?.dono).toBe("ana");
  });
  it("valor estranho vira o padrão seguro: tipo outro, escondido, da mesa", () => {
    const c = normalizarCartao({ id: "a", room_code: "s", tipo: "dragao", revelacao: "tudo", dono: "" });
    expect(c?.tipo).toBe("outro");
    expect(c?.revelacao).toBe("escondido");
    expect(c?.dono).toBeNull();
  });
  it("rejeita o que não é linha", () => {
    expect(normalizarCartao(null)).toBeNull();
    expect(normalizarCartao({ room_code: "s" })).toBeNull();
  });
});

import {
  alternarCartaoNaSessao,
  autorDaPessoa,
  cartoesDaSessao,
  ligacaoJaExiste,
  ligacoesDoCartao,
  normalizarLigacao,
  normalizarNota,
  notasDoCartao,
  podeAnotar,
  podeApagarNota,
  sessoesDoCartao,
  type Ligacao,
  type NotaDoCartao,
} from "./quadro";

function lig(id: string, de: string, para: string, rotulo = "serve a"): Ligacao {
  return { id, room_code: "s", de, para, rotulo, created_at: id };
}

describe("ligações", () => {
  const todos = [
    cartao({ id: "barao", revelacao: "revelado" }),
    cartao({ id: "culto", revelacao: "revelado" }),
    cartao({ id: "torre", revelacao: "escondido" }),
  ];
  const ligas = [lig("1", "barao", "culto"), lig("2", "barao", "torre", "mora em")];
  it("mostra nos dois sentidos", () => {
    const vistosAna = cartoesVisiveis(todos, ANA);
    const doBarao = ligacoesDoCartao("barao", ligas, vistosAna);
    expect(doBarao.map((l) => [l.outro.cartao.id, l.sentido])).toEqual([["culto", "saindo"]]);
    const doCulto = ligacoesDoCartao("culto", ligas, vistosAna);
    expect(doCulto.map((l) => [l.outro.cartao.id, l.sentido])).toEqual([["barao", "chegando"]]);
  });
  it("não entrega um cartão escondido pela ligação", () => {
    expect(ligacoesDoCartao("barao", ligas, cartoesVisiveis(todos, ANA)).some((l) => l.outro.cartao.id === "torre")).toBe(false);
    expect(ligacoesDoCartao("barao", ligas, cartoesVisiveis(todos, MESTRE))).toHaveLength(2);
  });
  it("detecta ligação repetida sem ligar pra maiúscula", () => {
    expect(ligacaoJaExiste(ligas, "barao", "culto", " Serve A ")).toBe(true);
    expect(ligacaoJaExiste(ligas, "culto", "barao", "serve a")).toBe(false);
  });
  it("normaliza e recusa ligação de um cartão com ele mesmo", () => {
    expect(normalizarLigacao({ id: "x", de: "a", para: "b", rotulo: "y".repeat(90) })?.rotulo).toHaveLength(40);
    expect(normalizarLigacao({ id: "x", de: "a", para: "a" })).toBeNull();
  });
});

describe("anotações", () => {
  const nota = (autor: string): NotaDoCartao => ({ id: "n", room_code: "s", cartao_id: "c1", autor, texto: "mente", created_at: "1" });
  it("todos anotam no que veem por inteiro; silhueta e telão não", () => {
    expect(podeAnotar("completo", ANA)).toBe(true);
    expect(podeAnotar("completo", MESTRE)).toBe(true);
    expect(podeAnotar("silhueta", ANA)).toBe(false);
    expect(podeAnotar("completo", null)).toBe(false);
  });
  it("cada um apaga a sua; o Mestre apaga qualquer uma", () => {
    expect(podeApagarNota(nota("ana"), ANA)).toBe(true);
    expect(podeApagarNota(nota("ana"), BETO)).toBe(false);
    expect(podeApagarNota(nota("ana"), MESTRE)).toBe(true);
    expect(podeApagarNota(nota("mestre"), ANA)).toBe(false);
  });
  it("autor e ordem", () => {
    expect(autorDaPessoa(MESTRE)).toBe("mestre");
    expect(autorDaPessoa(ANA)).toBe("ana");
    expect(autorDaPessoa(null)).toBeNull();
    const a = { ...nota("ana"), id: "a", created_at: "2" };
    const b = { ...nota("beto"), id: "b", created_at: "1" };
    expect(notasDoCartao("c1", [a, b, { ...b, cartao_id: "outro" }]).map((n) => n.id)).toEqual(["b", "a"]);
    expect(normalizarNota({ id: "a", cartao_id: "c", autor: "ana", texto: "x".repeat(400) })?.texto).toHaveLength(300);
    expect(normalizarNota({ id: "a", cartao_id: "c" })).toBeNull();
  });
});

describe("sessões e cartões", () => {
  const sessoes = [
    { id: "s1", title: "Sessão 1", created_at: "2026-09-01", cartoes: ["a", "b"] },
    { id: "s2", title: "Sessão 2", created_at: "2026-09-08", cartoes: ["a"] },
    { id: "s3", title: "Sessão 3", created_at: "2026-09-15" },
  ];
  it("sessões de um cartão, da mais nova pra mais velha", () => {
    expect(sessoesDoCartao("a", sessoes).map((s) => s.id)).toEqual(["s2", "s1"]);
    expect(sessoesDoCartao("zzz", sessoes)).toEqual([]);
  });
  it("só mostra os cartões da sessão que a pessoa vê", () => {
    const vistos = cartoesVisiveis([cartao({ id: "a", revelacao: "revelado" }), cartao({ id: "b", revelacao: "escondido" })], ANA);
    expect(cartoesDaSessao(sessoes[0], vistos).map((v) => v.cartao.id)).toEqual(["a"]);
    expect(cartoesDaSessao(sessoes[2], vistos)).toEqual([]);
  });
  it("liga e desliga sem repetir; aceita lista ausente", () => {
    expect(alternarCartaoNaSessao(["a"], "b")).toEqual(["a", "b"]);
    expect(alternarCartaoNaSessao(["a", "b"], "a")).toEqual(["b"]);
    expect(alternarCartaoNaSessao(undefined, "a")).toEqual(["a"]);
  });
});

import { colunasEmUso, comColunasVazias } from "./quadro";

describe("colunas vazias e em uso", () => {
  const vistos = cartoesVisiveis([cartao({ id: "a", coluna: "Suspeitos", revelacao: "revelado" }), cartao({ id: "b", revelacao: "revelado" })], ANA);
  it("a coluna nova aparece vazia, no lugar certo, sem tirar 'Sem coluna'", () => {
    const cols = comColunasVazias(agruparPorColuna(vistos), ["Aliados", "Conhecidos"]);
    expect(cols.map((c) => c.valor)).toEqual(["Conhecidos", "Suspeitos", "Aliados", ""]);
    expect(cols.find((c) => c.valor === "Aliados")?.cartoes).toEqual([]);
    expect(cols.find((c) => c.valor === "Suspeitos")?.cartoes).toHaveLength(1);
  });
  it("não duplica coluna que já existe (nem com outra caixa) e ignora vazio", () => {
    const cols = comColunasVazias(agruparPorColuna(vistos), ["suspeitos", "  ", ""]);
    expect(cols.map((c) => c.valor)).toEqual(["Suspeitos", ""]);
  });
  it("lista os nomes em uso", () => {
    expect(colunasEmUso(vistos)).toEqual(["Suspeitos"]);
  });
});

describe("várias fotos por cartão", () => {
  it("a capa vem primeiro e as extras seguem a ordem", () => {
    expect(todasAsFotos({ foto: "a", fotos: ["b", "c"] })).toEqual(["a", "b", "c"]);
    expect(todasAsFotos({ foto: null, fotos: [] })).toEqual([]);
  });

  it("a primeira foto posta vira capa e o limite é de 6 no total", () => {
    expect(comAsFotos({ foto: null, fotos: [] }, ["a", "b"])).toEqual({ foto: "a", fotos: ["b"] });
    const cheio = comAsFotos({ foto: "a", fotos: ["b", "c", "d"] }, ["e", "f", "g", "h"]);
    expect(todasAsFotos(cheio)).toHaveLength(FOTOS_MAXIMAS);
    expect(todasAsFotos(cheio)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("tirar a capa promove a próxima; tirar a última deixa o cartão sem foto", () => {
    expect(semAFoto({ foto: "a", fotos: ["b", "c"] }, "a")).toEqual({ foto: "b", fotos: ["c"] });
    expect(semAFoto({ foto: "a", fotos: ["b"] }, "b")).toEqual({ foto: "a", fotos: [] });
    expect(semAFoto({ foto: "a", fotos: [] }, "a")).toEqual({ foto: null, fotos: [] });
  });

  it("linha de antes da migration (sem a coluna) lê como lista vazia", () => {
    expect(normalizarCartao({ id: "x", room_code: "s", foto: "a" })?.fotos).toEqual([]);
    expect(normalizarCartao({ id: "x", room_code: "s", fotos: ["a", 3, ""] })?.fotos).toEqual(["a"]);
  });
});
