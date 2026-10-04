/**
 * Um Supabase de mentira, em memória, pro teste do `useSala` (useSala.test.ts).
 * Só serve pra teste: nada do app importa isto.
 *
 * Imita o que o `useSala` usa do cliente de verdade, e do jeito que o banco
 * responde: as consultas em cadeia (`from().select().eq()...`, `insert`,
 * `update`, `upsert`, `delete`, `in`, `order`, `limit`, `range`, `single`,
 * `maybeSingle`), as chaves únicas que o app trata (23505), e o canal de tempo
 * real filtrado por sala — inclusive avisando o próprio aparelho que escreveu,
 * como o Supabase faz.
 *
 * Pra montar as cenas difíceis de fazer no navegador:
 * - `comoOutroAparelho(...)`: alguém escreve no banco por fora — com ou sem o
 *   aviso de tempo real chegar (`avisar: false` = o aviso ainda não chegou);
 * - `semRede = true`: todo pedido falha com o MESMO erro que o supabase-js dá
 *   quando a internet cai (`{ message: "TypeError: Failed to fetch", code: "" }`,
 *   conferido no AGENTS.md) — é ele que o `ehFalhaDeRede` reconhece.
 */

type Linha = Record<string, unknown>;
export type ErroFalso = { message: string; code: string; details: string | null; hint: string | null };
type Resposta = { data: unknown; error: ErroFalso | null };
type Evento = "INSERT" | "UPDATE" | "DELETE";

/** Chaves únicas que o app conta que existem (ver supabase/migrations). */
const UNICAS: Record<string, string[][]> = {
  rooms: [["code"]],
  characters: [["room_code", "slug"]],
  combat_state: [["room_code"]],
  dm_notes: [["room_code"]],
  bastiao: [["room_code"]],
  // Parcial no banco (só com slug): marcador avulso (slug nulo) pode repetir.
  cena_pecas: [["cena_id", "slug"]],
};

/** Valores padrão das colunas, como as migrations definem. */
const PADROES: Record<string, () => Linha> = {
  combat_state: () => ({ round: 1, turn: 0, order_json: [], version: 0 }),
  dm_notes: () => ({ text: "" }),
  bastiao: () => ({ turno: 1, tesouro_po: 0, defensores: 0, notes: "", version: 0 }),
  characters: () => fichaPadrao(),
};

/** Uma ficha com todas as colunas no padrão do banco. */
export function fichaPadrao(): Linha {
  return {
    cls: "",
    ac: 12,
    init_mod: 0,
    speed: 9,
    hp: 10,
    hp_max: 10,
    hp_temp: 0,
    exh: 0,
    dss: 0,
    dsf: 0,
    cond: {},
    notes: "",
    vantagens_resistencias: "",
    ficha_epiteto: "",
    ficha_secoes: [],
    atributos: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
    proficiencias: { saves: [], pericias: {} },
    classes: [],
    modificadores: [],
    ataque: "",
    is_npc: false,
    revealed: false,
    inspiration: false,
    concentration: false,
    concentration_on: "",
    hd_max: 1,
    hd_cur: 1,
    hd_die: "d8",
    resources: [],
    cond_prazo: {},
    pp: 10,
    spell_dc: null,
    save_str: 0,
    save_dex: 0,
    save_con: 0,
    save_int: 0,
    save_wis: 0,
    save_cha: 0,
    items: [],
    moedas: { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 },
    inventario: [],
    magias: [],
    ataques: [],
  };
}

const ERRO_DE_REDE: ErroFalso = { message: "TypeError: Failed to fetch", code: "", details: null, hint: null };

function copia<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

function mesmo(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

type Inscricao = { tabela: string; evento: Evento | "*"; filtro: [string, string] | null; aoMudar: (msg: unknown) => void };

class CanalFalso {
  readonly inscricoes: Inscricao[] = [];
  constructor(
    private readonly banco: BancoFalso,
    readonly nome: string,
  ) {}
  on(_tipo: string, cfg: { event: string; table: string; filter?: string }, aoMudar: (msg: unknown) => void): this {
    const m = cfg.filter?.match(/^([a-z_]+)=eq\.(.+)$/);
    this.inscricoes.push({ tabela: cfg.table, evento: cfg.event as Evento | "*", filtro: m ? [m[1], m[2]] : null, aoMudar });
    return this;
  }
  subscribe(aoMudarStatus?: (status: string) => void): this {
    this.banco.canais.add(this);
    setTimeout(() => aoMudarStatus?.("SUBSCRIBED"), 0);
    return this;
  }
}

class ConsultaFalsa implements PromiseLike<Resposta> {
  op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  filtros: ((l: Linha) => boolean)[] = [];
  ordem: { coluna: string; crescente: boolean } | null = null;
  limite: number | null = null;
  faixa: [number, number] | null = null;
  modo: "lista" | "um" | "talvezUm" = "lista";
  devolver = false;
  carga: Linha | Linha[] | null = null;
  opcoes: { onConflict?: string; ignoreDuplicates?: boolean } = {};

  constructor(
    private readonly banco: BancoFalso,
    readonly tabela: string,
  ) {}

  select(): this {
    if (this.op !== "select") this.devolver = true;
    return this;
  }
  insert(linhas: Linha | Linha[]): this {
    this.op = "insert";
    this.carga = linhas;
    return this;
  }
  update(patch: Linha): this {
    this.op = "update";
    this.carga = patch;
    return this;
  }
  upsert(linhas: Linha | Linha[], opcoes: { onConflict?: string; ignoreDuplicates?: boolean } = {}): this {
    this.op = "upsert";
    this.carga = linhas;
    this.opcoes = opcoes;
    return this;
  }
  delete(): this {
    this.op = "delete";
    return this;
  }
  eq(coluna: string, valor: unknown): this {
    this.filtros.push((l) => mesmo(l[coluna], valor));
    return this;
  }
  in(coluna: string, valores: readonly unknown[]): this {
    this.filtros.push((l) => valores.some((v) => mesmo(l[coluna], v)));
    return this;
  }
  order(coluna: string, opcoes: { ascending?: boolean } = {}): this {
    this.ordem = { coluna, crescente: opcoes.ascending !== false };
    return this;
  }
  limit(n: number): this {
    this.limite = n;
    return this;
  }
  range(de: number, ate: number): this {
    this.faixa = [de, ate];
    return this;
  }
  single(): this {
    this.modo = "um";
    return this;
  }
  maybeSingle(): this {
    this.modo = "talvezUm";
    return this;
  }
  then<A = Resposta, B = never>(ok?: ((r: Resposta) => A | PromiseLike<A>) | null, falha?: ((e: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
    return this.banco.executar(this).then(ok, falha);
  }
}

export class BancoFalso {
  readonly tabelas = new Map<string, Linha[]>();
  readonly canais = new Set<CanalFalso>();
  /** Todo pedido falha como internet caída. */
  semRede = false;
  /** Pedidos feitos, na ordem (`tabela:operação`), pra conferir o que foi pro banco. */
  readonly pedidos: { tabela: string; op: string; carga: unknown }[] = [];
  private relogio = Date.parse("2026-10-01T20:00:00Z");

  /** O cliente que o `useSala` enxerga como `supabase`. */
  readonly cliente = {
    from: (tabela: string) => new ConsultaFalsa(this, tabela),
    channel: (nome: string) => new CanalFalso(this, nome),
    removeChannel: (canal: CanalFalso) => {
      this.canais.delete(canal);
      return Promise.resolve("ok");
    },
  };

  linhas(tabela: string): Linha[] {
    let t = this.tabelas.get(tabela);
    if (!t) {
      t = [];
      this.tabelas.set(tabela, t);
    }
    return t;
  }

  /** Põe linhas no banco direto (antes de abrir a sala), com os padrões da tabela. */
  semear(tabela: string, linhas: Linha[]): Linha[] {
    return linhas.map((l) => {
      const nova = this.completar(tabela, l);
      this.linhas(tabela).push(nova);
      return copia(nova);
    });
  }

  /** Outro aparelho mexendo no banco. `avisar: false` = o aviso de tempo real
   *  ainda não chegou neste aparelho (é a janela das corridas). */
  comoOutroAparelho(tabela: string, onde: (l: Linha) => boolean, patch: Linha, { avisar = true } = {}): void {
    for (const l of this.linhas(tabela)) {
      if (!onde(l)) continue;
      const velha = copia(l);
      Object.assign(l, copia(patch));
      if (avisar) this.anunciar(tabela, "UPDATE", l, velha);
    }
  }

  private agora(): string {
    this.relogio += 1000;
    return new Date(this.relogio).toISOString();
  }

  private completar(tabela: string, l: Linha): Linha {
    const base: Linha = { ...(PADROES[tabela]?.() ?? {}), ...copia(l) };
    if (tabela !== "rooms" && tabela !== "combat_state" && tabela !== "dm_notes" && tabela !== "bastiao" && base.id === undefined) {
      base.id = crypto.randomUUID();
    }
    if (base.created_at === undefined) base.created_at = this.agora();
    return base;
  }

  private conflito(tabela: string, nova: Linha, ignorar?: Linha): Linha | null {
    for (const chave of [["id"], ...(UNICAS[tabela] ?? [])]) {
      if (chave.some((c) => nova[c] === null || nova[c] === undefined)) continue;
      const achada = this.linhas(tabela).find((l) => l !== ignorar && chave.every((c) => mesmo(l[c], nova[c])));
      if (achada) return achada;
    }
    return null;
  }

  private anunciar(tabela: string, evento: Evento, nova: Linha | null, velha: Linha | null): void {
    const msg = { eventType: evento, new: copia(nova ?? {}), old: copia(velha ?? {}), table: tabela };
    const ref = nova ?? velha ?? {};
    for (const canal of this.canais) {
      for (const i of canal.inscricoes) {
        if (i.tabela !== tabela || (i.evento !== "*" && i.evento !== evento)) continue;
        if (i.filtro && String(ref[i.filtro[0]]) !== i.filtro[1]) continue;
        setTimeout(() => i.aoMudar(msg), 0);
      }
    }
  }

  async executar(q: ConsultaFalsa): Promise<Resposta> {
    // Resposta sempre depois, como na rede: o app nunca recebe na mesma volta.
    await new Promise((r) => setTimeout(r, 0));
    this.pedidos.push({ tabela: q.tabela, op: q.op, carga: copia(q.carga) });
    if (this.semRede) return { data: null, error: ERRO_DE_REDE };
    const tabela = this.linhas(q.tabela);
    const passa = (l: Linha) => q.filtros.every((f) => f(l));
    let saida: Linha[] = [];

    if (q.op === "select") {
      saida = tabela.filter(passa);
    } else if (q.op === "insert" || q.op === "upsert") {
      const originais = Array.isArray(q.carga) ? q.carga : [q.carga ?? {}];
      // Tudo ou nada, como o Postgres num INSERT de várias linhas.
      const resultado: Linha[] = [];
      const aceitas: Linha[] = [];
      for (const original of originais) {
        const nova = this.completar(q.tabela, original);
        const existe =
          this.conflito(q.tabela, nova) ??
          aceitas.find((a) => [["id"], ...(UNICAS[q.tabela] ?? [])].some((ch) => ch.every((c) => nova[c] != null && mesmo(a[c], nova[c]))));
        if (existe) {
          if (q.op === "upsert" && q.opcoes.ignoreDuplicates) continue;
          if (q.op === "upsert") {
            // Sem "ignorar": a linha que já existe fica com as colunas mandadas.
            const velha = copia(existe);
            Object.assign(existe, copia(original));
            this.anunciar(q.tabela, "UPDATE", existe, velha);
            resultado.push(existe);
            continue;
          }
          return { data: null, error: { message: "duplicate key value violates unique constraint", code: "23505", details: null, hint: null } };
        }
        aceitas.push(nova);
      }
      for (const nova of aceitas) {
        tabela.push(nova);
        this.anunciar(q.tabela, "INSERT", nova, null);
        resultado.push(nova);
      }
      saida = resultado;
    } else if (q.op === "update") {
      for (const l of tabela.filter(passa)) {
        const velha = copia(l);
        Object.assign(l, copia(q.carga as Linha));
        this.anunciar(q.tabela, "UPDATE", l, velha);
        saida.push(l);
      }
    } else {
      const saem = tabela.filter(passa);
      this.tabelas.set(q.tabela, tabela.filter((l) => !passa(l)));
      for (const l of saem) this.anunciar(q.tabela, "DELETE", null, l);
      saida = saem;
    }

    if (q.op !== "select" && !q.devolver) return { data: null, error: null };
    if (q.ordem) {
      const { coluna, crescente } = q.ordem;
      saida = [...saida].sort((a, b) => String(a[coluna]).localeCompare(String(b[coluna])) * (crescente ? 1 : -1));
    }
    if (q.faixa) saida = saida.slice(q.faixa[0], q.faixa[1] + 1);
    if (q.limite !== null) saida = saida.slice(0, q.limite);
    const dados = copia(saida);
    if (q.modo === "lista") return { data: dados, error: null };
    if (dados.length > 1) return { data: null, error: { message: "mais de uma linha", code: "PGRST116", details: null, hint: null } };
    if (dados.length === 0 && q.modo === "um") return { data: null, error: { message: "nenhuma linha", code: "PGRST116", details: null, hint: null } };
    return { data: dados[0] ?? null, error: null };
  }
}
