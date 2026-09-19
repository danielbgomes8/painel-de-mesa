import { COMBATE_VAZIO } from "./tipos";
import type {
  Bastiao,
  Encontro,
  EntradaDiario,
  EstadoCombate,
  InstalacaoBastiao,
  ItemIniciativa,
  LinhaLog,
  LinhaLogBastiao,
  ModeloNpc,
  Personagem,
} from "./tipos";

/** Formato do arquivo. 1 = o primeiro backup (sem Bastião, com só as últimas
 *  linhas do log); 2 = a sala inteira; 3 = mais os encontros preparados.
 *  Arquivo antigo continua sendo aceito na restauração — o que ele não tem
 *  fica como está (ver `lerBackup`). */
export const VERSAO_BACKUP = 3;

/** A sala inteira num objeto simples: é isto que vira arquivo. */
export type Backup = {
  versao: number;
  exportado_em: string;
  /** Nome bonito da sala, só pra quem lê o arquivo ("Salamina"). */
  sala: string;
  /** Código de verdade da sala ("setimo-raio") — é o que dá pra conferir. */
  sala_codigo: string;
  personagens: Personagem[];
  combate: EstadoCombate;
  notas_mestre: string;
  modelos_npc: ModeloNpc[];
  log: LinhaLog[];
  diario: EntradaDiario[];
  bastiao: Bastiao | null;
  bastiao_instalacoes: InstalacaoBastiao[];
  bastiao_log: LinhaLogBastiao[];
  /** null = arquivo de antes dos encontros existirem (não é o mesmo que uma
   *  lista vazia: nesse caso a restauração deixa os da sala em paz). */
  encontros: Encontro[] | null;
};

/** Junta tudo da sala num objeto simples — puro, testável. */
export function montarBackup(dados: {
  rotulo: string;
  codigo: string;
  personagens: Personagem[];
  combate: EstadoCombate;
  notasMestre: string;
  modelosNpc: ModeloNpc[];
  log: LinhaLog[];
  diario: EntradaDiario[];
  bastiao: Bastiao | null;
  instalacoesBastiao: InstalacaoBastiao[];
  logBastiao: LinhaLogBastiao[];
  encontros: Encontro[];
}): Backup {
  return {
    versao: VERSAO_BACKUP,
    exportado_em: new Date().toISOString(),
    sala: dados.rotulo,
    sala_codigo: dados.codigo,
    personagens: dados.personagens,
    combate: dados.combate,
    notas_mestre: dados.notasMestre,
    modelos_npc: dados.modelosNpc,
    log: dados.log,
    diario: dados.diario,
    bastiao: dados.bastiao,
    bastiao_instalacoes: dados.instalacoesBastiao,
    bastiao_log: dados.logBastiao,
    encontros: dados.encontros,
  };
}

/** Contagens pra tela perguntar "tem certeza?" com números na frente, em vez
 *  de um aviso genérico. */
export type ResumoBackup = {
  jogadores: number;
  npcs: number;
  naOrdem: number;
  rodada: number;
  log: number;
  diario: number;
  modelosNpc: number;
  instalacoes: number;
  temBastiao: boolean;
  turnoBastiao: number | null;
  /** null quando o arquivo é de antes dos encontros (ver `Backup.encontros`). */
  encontros: number | null;
};

export function resumirBackup(b: Backup): ResumoBackup {
  return {
    encontros: b.encontros === null ? null : b.encontros.length,
    jogadores: b.personagens.filter((p) => !p.is_npc).length,
    npcs: b.personagens.filter((p) => p.is_npc).length,
    naOrdem: b.combate.order.length,
    rodada: b.combate.round,
    log: b.log.length,
    diario: b.diario.length,
    modelosNpc: b.modelos_npc.length,
    instalacoes: b.bastiao_instalacoes.length,
    temBastiao: b.bastiao !== null,
    turnoBastiao: b.bastiao?.turno ?? null,
  };
}

export type LeituraBackup =
  | { ok: true; backup: Backup; resumo: ResumoBackup; avisos: string[] }
  | { ok: false; erro: string };

function lista(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];
}

function texto(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function numero(v: unknown, padrao: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : padrao;
}

function comoCombateDoArquivo(v: unknown): EstadoCombate {
  if (!v || typeof v !== "object") return COMBATE_VAZIO;
  const c = v as Record<string, unknown>;
  const order = lista(c.order)
    .map((i) => ({
      slug: texto(i.slug),
      name: texto(i.name),
      init: numero(i.init, 0),
    }))
    .filter((i) => i.slug !== "") as ItemIniciativa[];
  return {
    round: numero(c.round, 1),
    turn: numero(c.turn, 0),
    order,
  };
}

function comoBastiaoDoArquivo(v: unknown): Bastiao | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  return {
    room_code: texto(b.room_code),
    turno: numero(b.turno, 1),
    tesouro_po: numero(b.tesouro_po, 0),
    defensores: numero(b.defensores, 0),
    notes: texto(b.notes),
  };
}

/**
 * Lê o texto de um arquivo escolhido pela pessoa e devolve ou o backup
 * entendido (com resumo e avisos pra tela mostrar antes de confirmar) ou uma
 * frase explicando por que não dá. **Nunca lança** — arquivo vem de fora, e
 * a tela precisa de uma mensagem, não de uma exceção.
 */
export function lerBackup(conteudo: string, codigoAtual: string): LeituraBackup {
  let cru: unknown;
  try {
    cru = JSON.parse(conteudo);
  } catch {
    return { ok: false, erro: "Não consegui ler esse arquivo — ele não é um JSON válido." };
  }
  if (!cru || typeof cru !== "object" || Array.isArray(cru)) {
    return { ok: false, erro: "Esse arquivo não parece um backup do Painel de Mesa." };
  }
  const o = cru as Record<string, unknown>;
  // Assinatura mínima: um backup nosso sempre traz pelo menos uma destas
  // listas. Sem isto, um JSON qualquer (de outro app, de outra ferramenta)
  // viraria um "restaurar" que esvazia a sala.
  if (!Array.isArray(o.personagens) && !Array.isArray(o.diario) && !Array.isArray(o.log)) {
    return { ok: false, erro: "Esse arquivo não parece um backup do Painel de Mesa." };
  }

  const versao = numero(o.versao, 1);
  const backup: Backup = {
    versao,
    exportado_em: texto(o.exportado_em),
    sala: texto(o.sala),
    sala_codigo: texto(o.sala_codigo),
    personagens: lista(o.personagens) as unknown as Personagem[],
    combate: comoCombateDoArquivo(o.combate),
    notas_mestre: texto(o.notas_mestre),
    modelos_npc: lista(o.modelos_npc) as unknown as ModeloNpc[],
    log: lista(o.log) as unknown as LinhaLog[],
    diario: lista(o.diario) as unknown as EntradaDiario[],
    bastiao: comoBastiaoDoArquivo(o.bastiao),
    bastiao_instalacoes: lista(o.bastiao_instalacoes) as unknown as InstalacaoBastiao[],
    bastiao_log: lista(o.bastiao_log) as unknown as LinhaLogBastiao[],
    encontros: Array.isArray(o.encontros) ? (lista(o.encontros) as unknown as Encontro[]) : null,
  };

  const avisos: string[] = [];
  if (backup.bastiao === null) {
    avisos.push(
      "Esse backup é de uma versão antiga do painel e não tem o Bastião — o Bastião da sala vai ficar como está.",
    );
  }
  if (backup.encontros === null) {
    avisos.push("Esse backup é de antes dos encontros preparados — os encontros da sala vão ficar como estão.");
  }
  if (versao > VERSAO_BACKUP) {
    avisos.push("Esse arquivo foi feito por uma versão mais nova do painel; pode ter coisa que eu ainda não entendo.");
  }
  if (backup.sala_codigo && backup.sala_codigo !== codigoAtual) {
    avisos.push(`Esse backup é da sala "${backup.sala_codigo}" e você está na sala "${codigoAtual}".`);
  }

  return { ok: true, backup, resumo: resumirBackup(backup), avisos };
}

/**
 * Prepara linhas do arquivo pra voltar pro banco: tira o `id` (o Postgres
 * gera um novo, assim restaurar num lugar onde a linha antiga ainda existe
 * não bate de frente com a chave primária), força o `room_code` da sala de
 * agora e deixa **todas as linhas com as mesmas chaves** — o PostgREST
 * recusa um insert em lote com objetos de formatos diferentes ("All object
 * keys must match").
 *
 * As colunas saem do próprio arquivo, não de uma lista escrita aqui: assim
 * uma coluna nova (migration futura) volta junto sem ninguém lembrar de
 * mexer neste arquivo. O preço é que uma chave que não existe mais no banco
 * faz o insert falhar com a mensagem do Postgres — falha limpa, sem meia
 * restauração silenciosa.
 */
export function linhasParaInserir(linhas: unknown[], codigo: string): Record<string, unknown>[] {
  const objetos = lista(linhas);
  if (objetos.length === 0) return [];
  const colunas = new Set<string>();
  for (const linha of objetos) {
    for (const chave of Object.keys(linha)) {
      if (chave !== "id" && chave !== "room_code") colunas.add(chave);
    }
  }
  return objetos.map((linha) => {
    const saida: Record<string, unknown> = { room_code: codigo };
    for (const chave of colunas) {
      saida[chave] = chave in linha ? linha[chave] : null;
    }
    return saida;
  });
}

/** Dispara o download de um JSON no navegador — só roda no cliente. */
export function baixarJson(dados: unknown, nomeArquivo: string): void {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

/** Nome do arquivo de backup: sala + data (e "-antes-de-restaurar" na cópia
 *  de segurança que o próprio app baixa antes de trocar a sala). */
export function nomeArquivoBackup(codigo: string, sufixo = ""): string {
  const dia = new Date().toISOString().slice(0, 10);
  return `painel-de-mesa-${codigo}-${dia}${sufixo}.json`;
}
