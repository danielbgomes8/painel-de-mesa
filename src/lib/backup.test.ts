import { describe, expect, it } from "vitest";
import { VERSAO_BACKUP, lerBackup, linhasParaInserir, montarBackup, nomeArquivoBackup } from "./backup";
import type {
  Bastiao,
  Encontro,
  EntradaDiario,
  InstalacaoBastiao,
  LinhaLog,
  LinhaLogBastiao,
  ModeloNpc,
  Personagem,
} from "./tipos";

const personagem = (extra: Partial<Personagem>): Personagem =>
  ({
    id: "id-1",
    room_code: "sala",
    slug: "tiberio",
    name: "Tibério",
    is_npc: false,
    hp: 10,
    hp_max: 10,
    ...extra,
  }) as Personagem;

const bastiao: Bastiao = { room_code: "sala", turno: 4, tesouro_po: 120, defensores: 3, notes: "torre" };

const salaCheia = {
  rotulo: "Sétimo Raio",
  codigo: "setimo-raio",
  personagens: [personagem({}), personagem({ id: "id-2", slug: "kobold", name: "Kobold", is_npc: true })],
  combate: { round: 11, turn: 2, order: [{ slug: "tiberio", name: "Tibério", init: 18 }] },
  notasMestre: "o vilão foge no turno 3",
  modelosNpc: [{ id: "m-1", room_code: "sala", name: "Kobold" } as ModeloNpc],
  log: [{ id: "l-1", room_code: "sala", text: "Tibério sofreu 3 de dano", created_at: "2026-09-01T00:00:00Z" } as LinhaLog],
  diario: [{ id: "d-1", room_code: "sala", title: "Sessão 1", text: "…", created_at: "2026-09-01T00:00:00Z" } as EntradaDiario],
  bastiao,
  instalacoesBastiao: [{ id: "i-1", room_code: "sala", name: "Forja" } as InstalacaoBastiao],
  logBastiao: [{ id: "b-1", room_code: "sala", text: "turno 4", created_at: "2026-09-01T00:00:00Z" } as LinhaLogBastiao],
  encontros: [
    {
      id: "e-1",
      room_code: "sala",
      name: "Emboscada na ponte",
      grupos: [{ name: "Goblin", quantidade: 3 }],
      created_at: "2026-09-01T00:00:00Z",
    } as Encontro,
  ],
};

describe("montarBackup", () => {
  it("leva a sala inteira, inclusive o Bastião e os encontros preparados", () => {
    const b = montarBackup(salaCheia);
    expect(b.versao).toBe(VERSAO_BACKUP);
    expect(b.sala_codigo).toBe("setimo-raio");
    expect(b.personagens).toHaveLength(2);
    expect(b.bastiao).toEqual(bastiao);
    expect(b.bastiao_instalacoes).toHaveLength(1);
    expect(b.bastiao_log).toHaveLength(1);
    expect(b.log).toHaveLength(1);
    expect(b.diario).toHaveLength(1);
    expect(b.encontros).toHaveLength(1);
  });
});

describe("lerBackup", () => {
  const texto = (v: unknown) => JSON.stringify(v);

  it("recusa arquivo que não é JSON", () => {
    const r = lerBackup("isto não é json", "setimo-raio");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/JSON/);
  });

  it("recusa JSON que não é backup nosso — senão restaurar esvaziaria a sala", () => {
    const r = lerBackup(texto({ qualquer: "coisa" }), "setimo-raio");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/não parece um backup/);
  });

  it("entende um backup completo e conta o que tem dentro", () => {
    const r = lerBackup(texto(montarBackup(salaCheia)), "setimo-raio");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resumo).toMatchObject({
      jogadores: 1,
      npcs: 1,
      naOrdem: 1,
      rodada: 11,
      log: 1,
      diario: 1,
      modelosNpc: 1,
      instalacoes: 1,
      temBastiao: true,
      turnoBastiao: 4,
      encontros: 1,
    });
    expect(r.backup.encontros?.[0].grupos).toEqual([{ name: "Goblin", quantidade: 3 }]);
    expect(r.avisos).toEqual([]);
  });

  it("aceita backup de antes dos encontros sem apagar os da sala (null, não lista vazia)", () => {
    const versao2: Record<string, unknown> = { ...montarBackup(salaCheia), versao: 2 };
    delete versao2.encontros;
    const r = lerBackup(texto(versao2), "setimo-raio");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.encontros).toBeNull();
    expect(r.resumo.encontros).toBeNull();
    expect(r.avisos.join(" ")).toMatch(/encontros/);
  });

  it("backup com lista de encontros vazia é diferente de backup sem encontros", () => {
    const r = lerBackup(texto(montarBackup({ ...salaCheia, encontros: [] })), "setimo-raio");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.encontros).toEqual([]);
    expect(r.avisos).toEqual([]);
  });

  it("aceita backup antigo (sem Bastião) avisando que o Bastião fica como está", () => {
    const antigo = {
      exportado_em: "2026-09-01T00:00:00Z",
      sala: "Sétimo Raio",
      personagens: [personagem({})],
      combate: { round: 2, turn: 0, order: [] },
      notas_mestre: "",
      modelos_npc: [],
      log: [],
      diario: [],
    };
    const r = lerBackup(texto(antigo), "setimo-raio");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.bastiao).toBeNull();
    expect(r.resumo.temBastiao).toBe(false);
    expect(r.avisos.join(" ")).toMatch(/Bastião/);
  });

  it("avisa quando o arquivo é de outra sala", () => {
    const r = lerBackup(texto(montarBackup(salaCheia)), "teste-ui");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.avisos.join(" ")).toMatch(/setimo-raio/);
  });

  it("não quebra com lixo no meio das listas nem com combate estragado", () => {
    const r = lerBackup(
      texto({ personagens: [null, "texto", personagem({})], combate: "nada disso", log: [] }),
      "setimo-raio",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.personagens).toHaveLength(1);
    expect(r.backup.combate).toEqual({ round: 1, turn: 0, order: [] });
  });
});

describe("linhasParaInserir", () => {
  it("tira o id e força a sala de agora", () => {
    const linhas = linhasParaInserir([{ id: "velho", room_code: "outra-sala", name: "Forja" }], "setimo-raio");
    expect(linhas).toEqual([{ room_code: "setimo-raio", name: "Forja" }]);
  });

  it("deixa todas as linhas com as mesmas chaves (o insert em lote exige)", () => {
    const linhas = linhasParaInserir([{ name: "A", notes: "x" }, { name: "B" }], "sala");
    expect(Object.keys(linhas[0]).sort()).toEqual(Object.keys(linhas[1]).sort());
    expect(linhas[1].notes).toBeNull();
  });

  it("devolve lista vazia quando não há o que inserir", () => {
    expect(linhasParaInserir([], "sala")).toEqual([]);
    expect(linhasParaInserir([null, 3], "sala")).toEqual([]);
  });
});

describe("nomeArquivoBackup", () => {
  it("usa o código da sala e a data, com sufixo opcional", () => {
    expect(nomeArquivoBackup("setimo-raio")).toMatch(/^painel-de-mesa-setimo-raio-\d{4}-\d{2}-\d{2}\.json$/);
    expect(nomeArquivoBackup("setimo-raio", "-antes-de-restaurar")).toMatch(/-antes-de-restaurar\.json$/);
  });
});
