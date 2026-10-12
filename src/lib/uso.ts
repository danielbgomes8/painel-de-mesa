/**
 * O que a mesa realmente usa (tabela `uso`, migration 0033) — as regras puras:
 * o catálogo de telas conhecidas, o freio de quem manda e a conta do resumo
 * que o Mestre lê. Quem manda de verdade é `lib/registrarUso.ts`.
 */

export type PapelDeUso = "mestre" | "jogador" | "telao";

/** O mesmo `check` da migration 0033. */
export const LIMITE_DA_TELA = 60;
/** No máximo isto por abertura do app: segura um laço e não deixa uma sessão longa encher a tabela. */
export const LIMITE_POR_ABERTURA = 80;
/** Quantos dias o resumo olha pra trás. */
export const DIAS_DO_RESUMO = 30;

/**
 * Toda tela ou ação que se marca, com o nome que o Mestre lê. Tela nova entra
 * aqui: sem isso o resumo não sabe dizer que ela "nunca foi aberta" (o teste
 * confere que cada chave segue o padrão e que não há rótulo repetido).
 */
export const TELAS_DE_USO: Record<string, string> = {
  "aba:campanha": "Aba Campanha",
  "aba:combate": "Aba Combate",
  "aba:mapa": "Aba Mapa",
  "aba:fichas": "Aba Fichas",
  "aba:mestre": "Aba Mestre",
  "campanha:quadro": "Campanha → Quadro",
  "campanha:bau": "Campanha → Baú",
  "campanha:tempo": "Campanha → Tempo",
  "campanha:folhas": "Campanha → Folhas",
  "campanha:relogios": "Campanha → Relógios",
  "campanha:loja": "Campanha → Loja",
  "campanha:sessoes": "Campanha → Sessões",
  "mestre:encontros": "Mestre → Encontros",
  "mestre:npcs": "Mestre → NPCs",
  "mestre:notas": "Mestre → Notas",
  "mestre:sala": "Mestre → Sala (telão e backup)",
  telao: "Telão",
  "mapa:mover": "Mapa → Mover",
  "mapa:nevoa": "Mapa → Névoa",
  "mapa:medir": "Mapa → Medir",
  "mapa:desenhar": "Mapa → Desenhar",
  "mapa:peoes": "Mapa → Peões",
  "mapa:luz": "Mapa → Escuridão e luzes",
  "mapa:armadilhas": "Mapa → Armadilhas",
  "mapa:paredes": "Mapa → Paredes e portas",
  "mapa:grade": "Mapa → Cena e grade",
  "mapa:ping": "Mapa → Ping",
  "mapa:mesa": "Mapa → A mesa (levar a visão)",
  "acao:desfazer": "Desfazer",
  "acao:rolar-ataque": "Rolar ataque na iniciativa",
  "acao:salvaguarda-massa": "Salvaguarda em massa",
  "acao:evento-combate": "Aviso de evento do combate (Feito)",
  "acao:simulador": "Simulador de encontro",
  "acao:recap": "Recap da sessão",
  "acao:subir-nivel": "Subir de nível",
  "acao:encerrar-combate": "Encerrar combate",
};

const PADRAO_DE_TELA = /^[a-z0-9-]+(:[a-z0-9-]+)?$/;

export function telaValida(tela: string): boolean {
  return tela.length <= LIMITE_DA_TELA && PADRAO_DE_TELA.test(tela);
}

/**
 * O freio de quem manda: cada tela vale UMA vez por abertura (voltar pra
 * mesma aba não conta de novo) e há um teto por abertura. Devolve `true` só
 * quando vale mandar.
 */
export function criarFreioDeUso(): (tela: string) => boolean {
  const vistas = new Set<string>();
  return (tela) => {
    if (!telaValida(tela) || vistas.has(tela) || vistas.size >= LIMITE_POR_ABERTURA) return false;
    vistas.add(tela);
    return true;
  };
}

/** Um sorteio curto por abertura do app (não identifica ninguém: muda a cada abertura). */
export function sortearAbertura(aleatorio: () => number = Math.random): string {
  let id = "";
  while (id.length < 12) id += Math.floor(aleatorio() * 36).toString(36);
  return id;
}

export type LinhaDeUso = { tela: string; papel: string; abertura: string; created_at: string };

export type ResumoDeTela = {
  tela: string;
  rotulo: string;
  /** Em quantas aberturas do app essa tela foi usada. */
  aberturas: number;
  porPapel: Record<PapelDeUso, number>;
  /** Hora da última vez (ISO), ou null se nunca. */
  ultimo: string | null;
};

export type ResumoDeUso = {
  /** Quantas aberturas do app (de qualquer papel) deixaram algum registro no período. */
  aberturasNoTotal: number;
  /** Das telas que apareceram, da mais usada pra menos. */
  usadas: ResumoDeTela[];
  /** Telas conhecidas que ninguém abriu no período. */
  nuncaUsadas: ResumoDeTela[];
};

const PAPEIS: PapelDeUso[] = ["mestre", "jogador", "telao"];

function vazio(tela: string): ResumoDeTela {
  return {
    tela,
    rotulo: TELAS_DE_USO[tela] ?? tela,
    aberturas: 0,
    porPapel: { mestre: 0, jogador: 0, telao: 0 },
    ultimo: null,
  };
}

/** Conta as linhas dos últimos `dias` dias. Linha de tela desconhecida (de uma versão futura) entra com o nome cru. */
export function resumirUso(linhas: LinhaDeUso[], agora: number, dias: number = DIAS_DO_RESUMO): ResumoDeUso {
  const desde = agora - dias * 24 * 60 * 60 * 1000;
  const porTela = new Map<string, { resumo: ResumoDeTela; aberturas: Set<string>; porPapel: Record<PapelDeUso, Set<string>> }>();
  const todas = new Set<string>();

  for (const l of linhas) {
    const t = Date.parse(l.created_at);
    if (!Number.isFinite(t) || t < desde || t > agora + 60_000) continue;
    const papel = PAPEIS.find((p) => p === l.papel);
    if (!papel) continue;
    let item = porTela.get(l.tela);
    if (!item) {
      item = { resumo: vazio(l.tela), aberturas: new Set(), porPapel: { mestre: new Set(), jogador: new Set(), telao: new Set() } };
      porTela.set(l.tela, item);
    }
    item.aberturas.add(l.abertura);
    item.porPapel[papel].add(l.abertura);
    todas.add(l.abertura);
    if (item.resumo.ultimo === null || t > Date.parse(item.resumo.ultimo)) item.resumo.ultimo = l.created_at;
  }

  const usadas = [...porTela.values()].map(({ resumo, aberturas, porPapel }) => ({
    ...resumo,
    aberturas: aberturas.size,
    porPapel: { mestre: porPapel.mestre.size, jogador: porPapel.jogador.size, telao: porPapel.telao.size },
  }));
  usadas.sort((a, b) => b.aberturas - a.aberturas || a.rotulo.localeCompare(b.rotulo, "pt-BR"));

  const nuncaUsadas = Object.keys(TELAS_DE_USO)
    .filter((tela) => !porTela.has(tela))
    .map(vazio);

  return { aberturasNoTotal: todas.size, usadas, nuncaUsadas };
}

/** "hoje", "ontem", "há 5 dias" — a conta é por dia do calendário de quem olha. */
export function quandoFoi(iso: string, agora: Date): string {
  const t = new Date(iso);
  const dia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dias = Math.round((dia(agora) - dia(t)) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}
