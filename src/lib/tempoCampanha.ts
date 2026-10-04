/**
 * Tempo da campanha — as regras puras: o dia em que a mesa está, a data (num calendário de
 * mundo, se a campanha usar um) e os efeitos que duram dias. A tela e o hook só chamam estas
 * funções (ver `TempoDaCampanha.tsx` e `useTempo.ts`).
 *
 * O que o banco guarda é um CONTADOR de dias (`dia`, começa em 1). A data de calendário é
 * derivada dele + de uma âncora (`inicio_dia_do_ano`/`inicio_ano`: em que dia do ano e em que
 * ano caiu o dia 1), então corrigir a data de hoje não mexe no contador nem nos efeitos.
 *
 * Calendários: `dias` (só "Dia N", o padrão) e `harptos` (Forgotten Realms: 12 meses de 30 dias
 * e 5 festivais, 365 dias; o dia extra de Shieldmeet, a cada 4 anos, não entra).
 */

export type Calendario = "dias" | "harptos";

export const DIA_MAXIMO = 100000;
export const MAX_EFEITOS = 100;
export const DURACAO_MAXIMA = 36500;
const DIAS_NO_ANO = 365;

/** O que a tela precisa do tempo da campanha (colunas de `campanha_tempo`, 0028). */
export type TempoCampanha = {
  dia: number;
  calendario: Calendario;
  inicio_dia_do_ano: number;
  inicio_ano: number;
};

export type LinhaTempo = TempoCampanha & { room_code: string; updated_at: string };

/** Um efeito que dura dias (colunas de `campanha_efeitos`, 0028). Vale `duracao` dias a partir
 *  do dia `inicio_dia`: no dia `inicio_dia + duracao` ele venceu. */
export type EfeitoDeTempo = {
  id: string;
  room_code: string;
  nome: string;
  alvo: string;
  inicio_dia: number;
  duracao: number;
  nota: string;
  created_at: string;
};

export type NovoEfeito = { nome: string; alvo?: string; duracao: number; nota?: string };

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function inteiro(v: unknown, min: number, max: number, padrao: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : padrao;
  return Math.max(min, Math.min(max, n));
}

/** Lê a linha de `campanha_tempo`. null = a sala ainda não começou a contar. */
export function normalizarTempo(v: unknown): TempoCampanha | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.dia !== "number") return null;
  return {
    dia: inteiro(o.dia, 1, DIA_MAXIMO, 1),
    calendario: o.calendario === "harptos" ? "harptos" : "dias",
    inicio_dia_do_ano: inteiro(o.inicio_dia_do_ano, 1, DIAS_NO_ANO, 1),
    inicio_ano: inteiro(o.inicio_ano, -10000, 100000, 1492),
  };
}

export function normalizarEfeito(v: unknown): EfeitoDeTempo {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    id: texto(o.id, 64),
    room_code: texto(o.room_code, 80),
    nome: texto(o.nome, 80),
    alvo: texto(o.alvo, 60),
    inicio_dia: inteiro(o.inicio_dia, 1, DIA_MAXIMO, 1),
    duracao: inteiro(o.duracao, 1, DURACAO_MAXIMA, 1),
    nota: texto(o.nota, 300),
    created_at: texto(o.created_at, 40),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendário de Harptos
// ─────────────────────────────────────────────────────────────────────────────

export const MESES_HARPTOS = [
  "Hammer",
  "Alturiak",
  "Ches",
  "Tarsakh",
  "Mirtul",
  "Kythorn",
  "Flamerule",
  "Eleasis",
  "Eleint",
  "Marpenoth",
  "Uktar",
  "Nightal",
] as const;

/** Festivais: o dia que cai DEPOIS do mês de número dado (1 = Hammer). */
const FESTIVAIS_HARPTOS: { depoisDoMes: number; nome: string }[] = [
  { depoisDoMes: 1, nome: "Midwinter" },
  { depoisDoMes: 4, nome: "Greengrass" },
  { depoisDoMes: 7, nome: "Midsummer" },
  { depoisDoMes: 9, nome: "Highharvestide" },
  { depoisDoMes: 11, nome: "Feast of the Moon" },
];

/** Um dia do ano de Harptos: um dia de mês (1 a 30) ou um festival. */
export type DiaHarptos = { tipo: "mes"; mes: number; dia: number } | { tipo: "festival"; nome: string };

/** Os 365 dias do ano, em ordem (índice 0 = 1º de Hammer). */
const ANO_HARPTOS: DiaHarptos[] = (() => {
  const dias: DiaHarptos[] = [];
  for (let mes = 1; mes <= 12; mes++) {
    for (let dia = 1; dia <= 30; dia++) dias.push({ tipo: "mes", mes, dia });
    const festival = FESTIVAIS_HARPTOS.find((f) => f.depoisDoMes === mes);
    if (festival) dias.push({ tipo: "festival", nome: festival.nome });
  }
  return dias;
})();

/** Os dias que a tela oferece pra escolher "hoje é...": cada festival e cada mês. */
export const FESTIVAIS = FESTIVAIS_HARPTOS.map((f) => f.nome);

export function indiceDoDiaHarptos(d: DiaHarptos): number {
  const i = ANO_HARPTOS.findIndex((x) => (d.tipo === "festival" ? x.tipo === "festival" && x.nome === d.nome : x.tipo === "mes" && x.mes === d.mes && x.dia === d.dia));
  return i < 0 ? 0 : i;
}

export type DataHarptos = { ano: number; dia: DiaHarptos; texto: string };

/** A data de Harptos do dia `dia` da campanha, pela âncora do tempo. */
export function dataHarptos(tempo: TempoCampanha, dia: number = tempo.dia): DataHarptos {
  const total = tempo.inicio_ano * DIAS_NO_ANO + (tempo.inicio_dia_do_ano - 1) + (dia - 1);
  const ano = Math.floor(total / DIAS_NO_ANO);
  const d = ANO_HARPTOS[total - ano * DIAS_NO_ANO];
  const rotulo = d.tipo === "festival" ? d.nome : `${d.dia} de ${MESES_HARPTOS[d.mes - 1]}`;
  return { ano, dia: d, texto: `${rotulo}, ${ano} CV` };
}

/** Âncora nova pra que o dia atual da campanha caia na data dada (corrigir "hoje é..." sem
 *  mexer no contador). */
export function ancorarHoje(diaDaCampanha: number, hoje: DiaHarptos, ano: number): Pick<TempoCampanha, "inicio_dia_do_ano" | "inicio_ano"> {
  const base = ano * DIAS_NO_ANO + indiceDoDiaHarptos(hoje) - (diaDaCampanha - 1);
  const inicioAno = Math.floor(base / DIAS_NO_ANO);
  return { inicio_ano: inicioAno, inicio_dia_do_ano: base - inicioAno * DIAS_NO_ANO + 1 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rótulos e efeitos
// ─────────────────────────────────────────────────────────────────────────────

export function plural(n: number, um: string, varios: string): string {
  return `${n} ${Math.abs(n) === 1 ? um : varios}`;
}

/** "Dia 14", ou "Dia 14 · 16 de Flamerule, 1492 CV" num calendário de mundo. */
export function rotuloDoDia(tempo: TempoCampanha, dia: number = tempo.dia): string {
  return tempo.calendario === "harptos" ? `Dia ${dia} · ${dataHarptos(tempo, dia).texto}` : `Dia ${dia}`;
}

/** Dias que faltam pro efeito vencer (0 = venceu hoje; negativo = já passou). */
export function diasRestantes(e: Pick<EfeitoDeTempo, "inicio_dia" | "duracao">, diaAtual: number): number {
  return e.inicio_dia + e.duracao - diaAtual;
}

export type SituacaoDoEfeito = "ativo" | "ultimo-dia" | "venceu";

export function situacaoDoEfeito(restante: number): SituacaoDoEfeito {
  if (restante <= 0) return "venceu";
  return restante === 1 ? "ultimo-dia" : "ativo";
}

/** "faltam 3 dias", "falta 1 dia", "venceu hoje", "venceu há 2 dias". */
export function textoDoRestante(restante: number): string {
  if (restante > 1) return `faltam ${restante} dias`;
  if (restante === 1) return "falta 1 dia";
  if (restante === 0) return "venceu hoje";
  return `venceu há ${plural(-restante, "dia", "dias")}`;
}

/** Os que vencem antes primeiro; os já vencidos no fim, dos mais recentes aos mais antigos. */
export function ordenarEfeitos(efeitos: EfeitoDeTempo[], diaAtual: number): EfeitoDeTempo[] {
  const r = (e: EfeitoDeTempo) => diasRestantes(e, diaAtual);
  return [...efeitos].sort((a, b) => {
    const ra = r(a);
    const rb = r(b);
    const va = ra <= 0;
    const vb = rb <= 0;
    if (va !== vb) return va ? 1 : -1;
    return va ? rb - ra : ra - rb || a.created_at.localeCompare(b.created_at);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Linhas do log
// ─────────────────────────────────────────────────────────────────────────────

/** Toda linha do log sobre o tempo começa com esta marca (o recap e o histórico reconhecem). */
export const MARCA_DE_TEMPO = "🗓";

export function ehLinhaDeTempo(textoDoLog: string): boolean {
  return textoDoLog.trimStart().startsWith(MARCA_DE_TEMPO);
}

/** "🗓 Passou 1 dia: Dia 14 → Dia 15 (16 de Flamerule, 1492 CV)" ou, com `descanso`, "🗓 Descanso longo do grupo: ...". */
export function linhaDeAvanco(antes: TempoCampanha, depois: TempoCampanha, descanso: boolean | string): string {
  const n = depois.dia - antes.dia;
  const quanto = n >= 0 ? `Passou ${plural(n, "dia", "dias")}` : `Voltou ${plural(-n, "dia", "dias")}`;
  const data = depois.calendario === "harptos" ? ` (${dataHarptos(depois).texto})` : "";
  const prefixo = descanso === true ? "Descanso longo do grupo. " : descanso ? `Descanso longo de ${descanso}. ` : "";
  return `${MARCA_DE_TEMPO} ${prefixo}${quanto}: Dia ${antes.dia} → Dia ${depois.dia}${data}`;
}

export function linhaDeEfeitoNovo(e: Pick<EfeitoDeTempo, "nome" | "alvo" | "duracao">): string {
  return `${MARCA_DE_TEMPO} Efeito de ${plural(e.duracao, "dia", "dias")}: ${e.nome}${e.alvo ? ` (${e.alvo})` : ""}`;
}

export function linhaDeEfeitoEncerrado(e: Pick<EfeitoDeTempo, "nome" | "alvo">, venceu: boolean): string {
  return `${MARCA_DE_TEMPO} ${venceu ? "Efeito venceu" : "Efeito encerrado"}: ${e.nome}${e.alvo ? ` (${e.alvo})` : ""}`;
}

/** Os efeitos que acabaram de vencer com a mudança de dia (tinham dias sobrando antes e não têm mais). */
export function efeitosQueVenceram(efeitos: EfeitoDeTempo[], diaAntes: number, diaDepois: number): EfeitoDeTempo[] {
  return efeitos.filter((e) => diasRestantes(e, diaAntes) > 0 && diasRestantes(e, diaDepois) <= 0);
}

/** As linhas do log de uma mudança de dia: o avanço e, uma por efeito, o que venceu com ele. */
export function linhasDoAvanco(efeitos: EfeitoDeTempo[], antes: TempoCampanha, depois: TempoCampanha, descanso: boolean | string): string[] {
  return [
    linhaDeAvanco(antes, depois, descanso),
    ...efeitosQueVenceram(efeitos, antes.dia, depois.dia).map((e) => linhaDeEfeitoEncerrado(e, true)),
  ];
}

/** O dia pro topo da tela e pro telão, curto: "Dia 14" ou "Dia 14 · 16 Flamerule" (sem o ano). */
export function rotuloCurtoDoDia(tempo: TempoCampanha, dia: number = tempo.dia): string {
  if (tempo.calendario !== "harptos") return `Dia ${dia}`;
  const d = dataHarptos(tempo, dia).dia;
  return `Dia ${dia} · ${d.tipo === "festival" ? d.nome : `${d.dia} ${MESES_HARPTOS[d.mes - 1]}`}`;
}

/** Efeitos no último dia ou que vencem hoje (os que a mesa deve ter na cabeça), os que vencem antes primeiro. */
export function efeitosPertoDeVencer(efeitos: EfeitoDeTempo[], diaAtual: number): EfeitoDeTempo[] {
  return ordenarEfeitos(efeitos, diaAtual).filter((e) => {
    const r = diasRestantes(e, diaAtual);
    return r === 0 || r === 1;
  });
}
