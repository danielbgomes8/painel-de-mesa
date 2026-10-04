/**
 * Regras de negócio da mesa. Fechadas — não reinventar.
 * Cada função é pura pra poder testar sozinha (ver regras.test.ts).
 */

import type {
  Atributo,
  Atributos,
  CampoModificavel,
  FichaMonstro,
  GrupoEncontro,
  ItemIniciativa,
  Modificador,
  NovoPersonagem,
  Pericia,
  Proficiencias,
  Recurso,
  TipoConjurador,
} from "./tipos";

// ─────────────────────────────────────────────────────────────────────────────
// Pontos de vida
// ─────────────────────────────────────────────────────────────────────────────

/** PV nunca passa do máximo nem fica negativo (trava em 0). */
export function limitarPV(valor: number, maximo: number): number {
  const teto = Math.max(0, Math.round(maximo));
  return Math.max(0, Math.min(Math.round(valor), teto));
}

type EstadoVida = { hp: number; hp_max: number; dss: number; dsf: number; concentration?: boolean };
type PatchVida = { hp: number; dss?: number; dsf?: number; concentration?: boolean; concentration_on?: string };

/**
 * Monta o patch pra gravar quando o PV de alguém muda.
 * Regra: testes de resistência contra a morte zeram sozinhos assim que a
 * criatura recupera QUALQUER PV acima de 0.
 */
export function ajustarPV(alvo: EstadoVida, novoHp: number): PatchVida {
  const hp = limitarPV(novoHp, alvo.hp_max);
  const patch: PatchVida = { hp };
  const estava0 = alvo.hp <= 0;
  if (estava0 && hp > 0 && (alvo.dss > 0 || alvo.dsf > 0)) {
    patch.dss = 0;
    patch.dsf = 0;
  }
  // A 0 PV o jogador fica Inconsciente (que inclui Incapacitado) e o monstro
  // morre — nos dois casos a concentração acaba, sem teste (ver Concentração
  // mais abaixo). Vale pra qualquer caminho que muda PV: dano, − e o campo
  // "atual" digitado na mão.
  if (alvo.concentration && estaCaido(hp)) {
    patch.concentration = false;
    patch.concentration_on = "";
  }
  return patch;
}

export type FaixaPV = "cheio" | "baixo" | "critico";

/** Cor da barra de PV: verde acima de 60%, âmbar até 60%, vermelho até 1/3 ou a 0. */
export function faixaPV(hp: number, hpMax: number): FaixaPV {
  const pct = hpMax > 0 ? hp / hpMax : 0;
  if (hp <= 0) return "critico";
  if (pct <= 1 / 3) return "critico";
  if (pct <= 0.6) return "baixo";
  return "cheio";
}

/** PV a 0: jogador fica Inconsciente e faz os testes de morte (o nome da
 *  função é antigo — "Caído" nas condições é outra coisa, estar no chão). */
export function estaCaido(hp: number): boolean {
  return hp <= 0;
}

type EstadoVidaTemp = EstadoVida & { hp_temp: number };
type PatchVidaTemp = PatchVida & { hp_temp: number };

/** Dano desconta primeiro do PV temporário, só depois do PV normal. */
export function aplicarDano(alvo: EstadoVidaTemp, dano: number): PatchVidaTemp {
  const d = Math.max(0, Math.round(dano));
  const doTemp = Math.min(alvo.hp_temp, d);
  const doHp = d - doTemp;
  return { ...ajustarPV(alvo, alvo.hp - doHp), hp_temp: alvo.hp_temp - doTemp };
}

/** Cura não mexe no PV temporário (são coisas independentes). */
export function aplicarCura(alvo: EstadoVida, cura: number): PatchVida {
  return ajustarPV(alvo, alvo.hp + Math.max(0, Math.round(cura)));
}

/** Frase pro log de combate a partir da variação real de PV já aplicada.
 *  `mostrarPV` false tira o "(PV atual/máximo)" — ver `pvNoLog`. */
export function mensagemAjustePV(
  nome: string,
  delta: number,
  hpDepois: number,
  hpMax: number,
  mostrarPV = true,
): string {
  const verbo = delta >= 0 ? "recuperou" : "sofreu";
  const rotulo = delta >= 0 ? "PV" : "de dano";
  const pv = mostrarPV ? ` (${hpDepois}/${hpMax})` : "";
  return `${nome} ${verbo} ${Math.abs(delta)} ${rotulo}${pv}`;
}

/** Quem aparece numa linha do log de combate. */
export type QuemNoLog = { name: string; is_npc: boolean; revealed: boolean };

/**
 * Nome de alguém no log de combate. O log é **público** — cada jogador lê no
 * próprio celular —, então segue a mesma regra da ordem de iniciativa e do
 * telão: NPC ainda não revelado não tem nome. Sem isso, "Dragão Ancião entrou
 * no combate" entregava o chefão que a ordem esconde como "Inimigo 1"
 * (aconteceu de verdade na sala setimo-raio, com dois Kobolds ocultos).
 * Frase fixa, sem número: "Inimigo 2" no log deixaria de bater com a ordem
 * assim que alguém entrasse ou saísse dela.
 */
export function nomeNoLog(p: QuemNoLog): string {
  return p.is_npc && !p.revealed ? "Um inimigo" : p.name;
}

/** PV de NPC nunca vai pro log, nem depois de revelado — mesma regra de
 *  `pvExibidoIniciativa`: revelar mostra quem é, não o quanto falta pra cair. */
export function pvNoLog(p: { is_npc: boolean; dono?: string | null }): boolean {
  return !p.is_npc || Boolean(p.dono);
}

/** Cura e a linha pro log (null = PV já estava cheio, nada a logar). */
export function curaComLog(
  alvo: EstadoVida & QuemNoLog,
  cura: number,
): { patch: PatchVida; texto: string | null } {
  const patch = aplicarCura(alvo, cura);
  const delta = patch.hp - alvo.hp;
  if (delta === 0) return { patch, texto: null };
  return { patch, texto: mensagemAjustePV(nomeNoLog(alvo), delta, patch.hp, alvo.hp_max, pvNoLog(alvo)) };
}

/** Log pro caso em que o dano some inteiro no PV temporário (PV real não muda). */
export function mensagemDanoAbsorvido(nome: string, absorvidoPeloTemp: number): string {
  return `${nome} sofreu ${absorvidoPeloTemp} de dano, todo absorvido pelo PV temporário`;
}

/** Frase pro log quando uma condição é ligada/desligada (ações em massa ou card). */
export function mensagemCondicao(nome: string, condicao: string, ligou: boolean): string {
  return ligou ? `${nome} ficou ${condicao}` : `${nome} não está mais ${condicao}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Concentração (D&D 2024)
// Conferido no Rules Glossary das Regras Gratuitas 2024
// (dndbeyond.com/sources/dnd/free-rules/rules-glossary — verbete Concentration
// e o de cada condição) em 2026-09-17. Lido no texto bruto da página: o resumo
// automático dela dizia que Petrificado não inclui Incapacitado, e inclui.
// ─────────────────────────────────────────────────────────────────────────────

/** Condições que incluem Incapacitado — e Incapacitado quebra a concentração
 *  na hora, sem teste. Nomes iguais aos de `CONDICOES` (condicoes.ts). */
export const CONDICOES_QUE_QUEBRAM_CONCENTRACAO: readonly string[] = [
  "Incapacitado",
  "Paralisado",
  "Petrificado",
  "Atordoado",
  "Inconsciente",
];

/** Dificuldade do teste de Constituição pra manter a concentração depois de
 *  levar dano: 10 ou metade do dano (arredonda pra baixo), o que for maior,
 *  no máximo 30. */
export function cdConcentracao(dano: number): number {
  return Math.min(30, Math.max(10, Math.floor(Math.max(0, dano) / 2)));
}

function emQue(concentracaoEm: string): string {
  const alvo = concentracaoEm.trim();
  return alvo ? ` em ${alvo}` : "";
}

type AlvoDano = EstadoVida &
  QuemNoLog & {
    hp_temp: number;
    concentration: boolean;
    concentration_on: string;
  };

/**
 * Dano "de verdade" num alvo (desconta do PV temporário primeiro) e a linha
 * pro log. Se o alvo estava concentrado, a mesma linha já avisa o que fazer:
 * o teste de Constituição com a dificuldade calculada, ou que a concentração
 * acabou porque caiu a 0 PV. PV temporário absorvendo tudo ainda é dano — o
 * teste continua valendo. `texto` null = nada mudou, não loga.
 */
export function danoComLog(alvo: AlvoDano, dano: number): { patch: PatchVidaTemp; texto: string | null } {
  const d = Math.max(0, Math.round(dano));
  const patch = aplicarDano(alvo, d);
  const deltaReal = patch.hp - alvo.hp;
  const nome = nomeNoLog(alvo);
  let texto: string | null = null;
  if (deltaReal !== 0) {
    texto = mensagemAjustePV(nome, deltaReal, patch.hp, alvo.hp_max, pvNoLog(alvo));
  } else if (patch.hp_temp < alvo.hp_temp) {
    texto = mensagemDanoAbsorvido(nome, alvo.hp_temp - patch.hp_temp);
  }
  if (!alvo.concentration) return { patch, texto };

  if (patch.concentration === false) {
    const aviso = `perdeu a concentração${emQue(alvo.concentration_on)}`;
    return { patch, texto: texto ? `${texto} · 🔮 ${aviso}` : `${nome} ${aviso}` };
  }
  if (texto === null) return { patch, texto };
  return {
    patch,
    texto: `${texto} · 🔮 concentrado${emQue(alvo.concentration_on)}: teste de CON, CD ${cdConcentracao(d)}`,
  };
}

type AlvoCondicao = QuemNoLog & {
  cond: Record<string, boolean>;
  cond_prazo: Record<string, number>;
  concentration: boolean;
  concentration_on: string;
};

/**
 * Liga/desliga uma condição e monta a linha do log. Desligar também tira o
 * prazo (senão ele "expirava" uma rodada depois e logava o fim de uma
 * condição que já tinha saído). Ligar uma condição que inclui Incapacitado
 * em quem está concentrado acaba com a concentração, na mesma linha do log.
 */
export function condicaoComLog(
  alvo: AlvoCondicao,
  condicao: string,
  ligar: boolean,
): {
  patch: { cond: Record<string, boolean>; cond_prazo: Record<string, number>; concentration?: boolean; concentration_on?: string };
  texto: string;
} {
  const cond_prazo = { ...alvo.cond_prazo };
  if (!ligar) delete cond_prazo[condicao];
  const patch: ReturnType<typeof condicaoComLog>["patch"] = { cond: { ...alvo.cond, [condicao]: ligar }, cond_prazo };
  const texto = mensagemCondicao(nomeNoLog(alvo), condicao, ligar);
  if (ligar && alvo.concentration && CONDICOES_QUE_QUEBRAM_CONCENTRACAO.includes(condicao)) {
    patch.concentration = false;
    patch.concentration_on = "";
    return { patch, texto: `${texto} · 🔮 perdeu a concentração${emQue(alvo.concentration_on)}` };
  }
  return { patch, texto };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exaustão (D&D 2024: trilha única 0–6)
// ─────────────────────────────────────────────────────────────────────────────

export const EXAUSTAO_MAX = 6;

export function limitarExaustao(n: number): number {
  return Math.max(0, Math.min(EXAUSTAO_MAX, Math.round(n)));
}

/** Penalidade em TODO teste de D20 (perícia, ataque, resistência): -2 por nível. */
export function penalidadeD20(exh: number): number {
  return limitarExaustao(exh) * 2;
}

/** Redução de deslocamento: -1,5 m por nível (5 pés na régua imperial). */
export function reducaoDeslocamento(exh: number): number {
  return limitarExaustao(exh) * 1.5;
}

/** Deslocamento efetivo depois da exaustão, em metros, nunca abaixo de 0. */
export function deslocamentoEfetivo(base: number, exh: number): number {
  return Math.max(0, base - reducaoDeslocamento(exh));
}

/** Descanso longo tira 1 nível de exaustão — não zera tudo. */
export function descansoLongo(exh: number): number {
  return limitarExaustao(exh) - 1 < 0 ? 0 : limitarExaustao(exh) - 1;
}

/** Formata um número de metros no padrão pt-BR (vírgula decimal). */
export function formatarMetros(n: number): string {
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m`;
}

/** Texto do efeito da exaustão, já calculado, pra mostrar no card. */
export function efeitoExaustao(exh: number): string {
  const nivel = limitarExaustao(exh);
  if (nivel === 0) return "Sem penalidade";
  const partes = [
    `-${penalidadeD20(nivel)} em todos os testes de D20 (perícia, ataque, resistência)`,
    `-${formatarMetros(reducaoDeslocamento(nivel))} de deslocamento`,
  ];
  if (nivel >= EXAUSTAO_MAX) partes.push("morte");
  return partes.join(" · ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Testes de resistência contra a morte
// ─────────────────────────────────────────────────────────────────────────────

export const TESTES_MORTE_MAX = 3;

export function limitarTesteMorte(n: number): number {
  return Math.max(0, Math.min(TESTES_MORTE_MAX, Math.round(n)));
}

export type SituacaoMorte = "em-jogo" | "estavel" | "morto";

export function situacaoMorte(dss: number, dsf: number): SituacaoMorte {
  if (dsf >= TESTES_MORTE_MAX) return "morto";
  if (dss >= TESTES_MORTE_MAX) return "estavel";
  return "em-jogo";
}

export type ResultadoTesteMorte = {
  d20: number;
  dss: number;
  dsf: number;
  /** 20 natural: acordou com 1 PV. */
  acordou: boolean;
  estabilizou: boolean;
  morreu: boolean;
  /** Linha pro log — jogador tem nome no log (ver `nomeNoLog`). */
  texto: string;
};

/**
 * Um teste de resistência contra a morte (Regras 2024): 10 ou mais é
 * sucesso, 9 ou menos é falha; 20 natural acorda com 1 PV (e zera a
 * contagem); 1 natural conta DUAS falhas. Três sucessos estabiliza, três
 * falhas mata.
 */
export function resolverTesteMorte(
  nome: string,
  dss: number,
  dsf: number,
  d20: number,
): ResultadoTesteMorte {
  if (d20 === 20) {
    return {
      d20,
      dss: 0,
      dsf: 0,
      acordou: true,
      estabilizou: false,
      morreu: false,
      texto: `${nome} tirou 20 no teste de morte e voltou com 1 PV`,
    };
  }
  const passou = d20 >= 10;
  const sucessos = limitarTesteMorte(passou ? dss + 1 : dss);
  const falhas = limitarTesteMorte(passou ? dsf : dsf + (d20 === 1 ? 2 : 1));
  const situacao = situacaoMorte(sucessos, falhas);
  const morreu = situacao === "morto";
  const estabilizou = situacao === "estavel";
  const conta = passou ? `${sucessos} de ${TESTES_MORTE_MAX} sucessos` : `${falhas} de ${TESTES_MORTE_MAX} falhas`;
  const comoFoi = passou ? `passou no teste de morte (${d20})` : `falhou o teste de morte (${d20}${d20 === 1 ? ", 1 natural: duas falhas" : ""})`;
  const fim = morreu ? " — morreu" : estabilizou ? " — estabilizou" : "";
  return {
    d20,
    dss: sucessos,
    dsf: falhas,
    acordou: false,
    estabilizou,
    morreu,
    texto: `${nome} ${comoFoi}: ${conta}${fim}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dados de vida e descanso
// ─────────────────────────────────────────────────────────────────────────────

/** Descanso longo recupera metade dos dados de vida gastos, no mínimo 1. */
export function recuperarDadosDeVida(max: number, atual: number): number {
  const recuperar = Math.max(1, Math.floor(max / 2));
  return Math.min(max, atual + recuperar);
}

/** Gastar 1 dado de vida no descanso curto (a cura em si o jogador aplica à mão). */
export function gastarDadoDeVida(atual: number): number {
  return Math.max(0, atual - 1);
}

/**
 * Descanso longo: PV cheio, -1 nível de exaustão, recupera dados de vida e
 * zera todos os recursos de classe (voltam ao máximo).
 *
 * Também limpa o que sobra de quando a criatura caiu: **PV temporário**
 * (dura até o próximo descanso longo, regra explícita de 2024) e os
 * **testes de morte** (o próprio `ajustarPV` já zera ao recuperar qualquer PV
 * acima de 0 — sem isto aqui o personagem levantava do descanso com uma
 * falha marcada e morria mais cedo no combate seguinte).
 */
export function aplicarDescansoLongo(p: {
  hp_max: number;
  exh: number;
  hd_max: number;
  hd_cur: number;
  resources: Recurso[];
}): {
  hp: number;
  hp_temp: number;
  dss: number;
  dsf: number;
  exh: number;
  hd_cur: number;
  resources: Recurso[];
} {
  return {
    hp: p.hp_max,
    hp_temp: 0,
    dss: 0,
    dsf: 0,
    exh: descansoLongo(p.exh),
    hd_cur: recuperarDadosDeVida(p.hd_max, p.hd_cur),
    resources: p.resources.map((r) => ({ ...r, cur: r.max })),
  };
}

/** Descanso curto: só os recursos marcados como "recupera no descanso curto". */
export function aplicarDescansoCurto(p: { resources: Recurso[] }): { resources: Recurso[] } {
  return { resources: p.resources.map((r) => (r.short_rest ? { ...r, cur: r.max } : r)) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pips clicáveis (exaustão, testes de morte e recursos usam a mesma lógica)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clicar num pip: se o pip clicado é o último preenchido, esvazia até ele
 * (fica com `indice`); senão, preenche até ele (fica com `indice + 1`).
 */
export function alternarPips(indiceClicado: number, preenchidosAgora: number): number {
  return indiceClicado + 1 === preenchidosAgora ? indiceClicado : indiceClicado + 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Iniciativa / combate
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Dano e cura direto na linha da iniciativa
// ─────────────────────────────────────────────────────────────────────────────

/** Teto do campo de dano/cura: nenhum golpe do jogo chega perto, e um zero a
 *  mais digitado sem querer não apaga o dragão. */
export const PV_DIGITADO_MAX = 999;

/** Valor do campo de dano/cura: inteiro positivo, ou null (vazio, zero,
 *  negativo, lixo) — null deixa os botões desligados. */
export function lerValorPV(texto: string): number | null {
  const n = Number.parseInt(texto, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, PV_DIGITADO_MAX);
}

/** Metade do dano, arredondada pra baixo: é a regra da Resistência e do
 *  "metade do dano se passar no teste" (Regras 2024, Rules Glossary —
 *  verbetes Resistance e Round Down). */
export function metadeDoDano(dano: number): number {
  return Math.floor(Math.max(0, dano) / 2);
}

/**
 * Dano (`delta` < 0) ou cura (`delta` > 0), com a linha pro log e o
 * `retorno`: o que aparece na hora, embaixo da linha da iniciativa, pra quem
 * aplicou. O log é público e esconde nome e PV de NPC (`nomeNoLog`/`pvNoLog`);
 * o retorno não precisa — quem aplica é o Mestre ou o dono da ficha, que já
 * veem os dois — e com "Um inimigo" o Mestre não saberia em qual dos três
 * goblins acertou. `texto` null = nada mudou, não loga.
 */
export function ajustePVComLog(
  alvo: AlvoDano,
  delta: number,
): { patch: PatchVida | PatchVidaTemp; texto: string | null; retorno: string } {
  const semSegredo = { ...alvo, is_npc: false, revealed: true };
  if (delta >= 0) {
    const r = curaComLog(alvo, delta);
    return { ...r, retorno: curaComLog(semSegredo, delta).texto ?? `${alvo.name} já está com o PV cheio` };
  }
  const r = danoComLog(alvo, -delta);
  const retorno =
    danoComLog(semSegredo, -delta).texto ??
    // Só chega aqui quem já estava a 0 PV e sem PV temporário. Jogador a 0 PV
    // que leva dano falha um teste de morte (dois se for crítico) — fica o
    // lembrete, sem marcar sozinho: daqui não dá pra saber se foi crítico.
    (alvo.is_npc
      ? `${alvo.name} já está a 0 PV`
      : `${alvo.name} já está a 0 PV: dano agora é 1 falha no teste de morte (2 se for crítico)`);
  return { ...r, retorno };
}

/**
 * Nome exibido na ordem de iniciativa: o Mestre e o próprio nome de
 * personagem de jogador sempre veem o nome real. NPC ainda não revelado
 * aparece como "Inimigo N" pra jogador — evita entregar o monstro antes da
 * hora (ex.: nome do chefão na lista assim que o combate começa).
 */
export function nomeExibidoIniciativa(
  item: { name: string; is_npc: boolean; revealed: boolean },
  numeroDoNpc: number,
  souMestre: boolean,
): string {
  if (souMestre || !item.is_npc || item.revealed) return item.name;
  return `Inimigo ${numeroDoNpc}`;
}

/**
 * PV exibido na ordem de iniciativa (e no telão): PV de NPC é informação só
 * do Mestre, sempre — diferente do nome, revelar o NPC não mostra o PV pro
 * jogador (ele continua sem saber o quão perto da morte o monstro está).
 * Exceção: o companheiro de um jogador (`dono`: familiar, montaria...) é aliado, então o PV dele aparece
 * pra mesa como o de qualquer personagem de jogador.
 */
export function pvExibidoIniciativa(
  item: { is_npc: boolean; hp: number; hp_max: number; dono?: string | null },
  souMestre: boolean,
): { hp: number; hp_max: number } | null {
  if (souMestre || !item.is_npc || item.dono) return { hp: item.hp, hp_max: item.hp_max };
  return null;
}

/**
 * Numeração estável de NPC ao longo da ordem de iniciativa (1, 2, 3...),
 * pra virar "Inimigo N" — construída sem mutar variável durante o render
 * (regra do compilador do React).
 */
export function numerarNpcsNaOrdem(
  order: { slug: string }[],
  ehNpc: (slug: string) => boolean,
): number[] {
  return order.reduce<number[]>((acc, c) => {
    const anterior = acc.length > 0 ? acc[acc.length - 1] : 0;
    return [...acc, ehNpc(c.slug) ? anterior + 1 : anterior];
  }, []);
}

/** Próximo turno: anda na ordem; ao dar a volta, incrementa a rodada. */
export function proximoTurno(
  estado: { round: number; turn: number; order: unknown[] },
): { round: number; turn: number } {
  if (estado.order.length === 0) return { round: estado.round, turn: estado.turn };
  let turn = estado.turn + 1;
  let round = estado.round;
  if (turn >= estado.order.length) {
    turn = 0;
    round += 1;
  }
  return { round, turn };
}

/**
 * Quem vem depois na ordem, pra mostrar no telão: os `quantos` próximos
 * índices depois do turno atual, dando a volta quando chega no fim (a ordem é
 * um ciclo — quem estava no começo joga de novo na rodada seguinte). Nunca
 * repete quem está jogando agora, então com 3 na ordem só dá 2 "próximos",
 * mesmo pedindo mais.
 */
export function proximosDaOrdem(tamanho: number, turnoAtual: number, quantos: number): number[] {
  const total = Math.min(Math.max(0, quantos), Math.max(0, tamanho - 1));
  return Array.from({ length: total }, (_, k) => (turnoAtual + 1 + k) % tamanho);
}

/** Ordena por iniciativa, maior primeiro (empates ficam na ordem de entrada). */
export function ordenarPorIniciativa<T extends { init: number }>(itens: T[]): T[] {
  return itens
    .map((item, i) => ({ item, i }))
    .sort((a, b) => b.item.init - a.item.init || a.i - b.i)
    .map(({ item }) => item);
}

/**
 * Entra na ordem de iniciativa: junta os novos com quem já está, ignora quem
 * já estava (mesmo `slug`) e devolve tudo ordenado.
 *
 * O filtro de repetido não é frescura: dois jogadores tocando "entrar no
 * combate" quase juntos — ou um toque duplo no celular — faziam a mesma
 * pessoa aparecer duas vezes na ordem, e aí ela jogava dois turnos.
 *
 * Devolve junto quem REALMENTE entrou, pra tela só logar isso: no toque duplo,
 * a segunda escrita também dá certo (ela só não muda nada), e sem isso o log
 * dizia duas vezes que a mesma pessoa entrou no combate.
 */
export function entrarNaOrdem(
  ordemAtual: ItemIniciativa[],
  novos: ItemIniciativa[],
): { ordem: ItemIniciativa[]; entraram: ItemIniciativa[] } {
  const jaEstao = new Set(ordemAtual.map((o) => o.slug));
  const entraram = novos.filter((n) => {
    if (jaEstao.has(n.slug)) return false;
    jaEstao.add(n.slug);
    return true;
  });
  return { ordem: ordenarPorIniciativa([...ordemAtual, ...entraram]), entraram };
}

/**
 * Índice do turno depois de remover a posição `removida` da ordem.
 * Mantém o turno apontando pra mesma pessoa quando possível.
 */
export function turnoAposRemover(turnoAtual: number, removida: number, tamanhoNovo: number): number {
  let turno = turnoAtual;
  if (removida < turnoAtual) turno -= 1;
  if (turno >= tamanhoNovo) turno = Math.max(0, tamanhoNovo - 1);
  return Math.max(0, turno);
}

/** Índice do turno depois de trocar `i` e `j` de lugar. */
export function turnoAposTrocar(turnoAtual: number, i: number, j: number): number {
  if (turnoAtual === i) return j;
  if (turnoAtual === j) return i;
  return turnoAtual;
}

// ─────────────────────────────────────────────────────────────────────────────
// Encontros preparados (grupo inimigo montado antes da sessão)
// ─────────────────────────────────────────────────────────────────────────────

/** Teto de monstros iguais num grupo: um dedo escorregando no "+" (ou 50
 *  digitado no lugar de 5) não pode criar dezenas de fichas de uma vez. */
export const QUANTIDADE_MAX_GRUPO = 20;

export function limitarQuantidade(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(QUANTIDADE_MAX_GRUPO, Math.max(1, Math.round(n)));
}

/** Só a ficha de um modelo da biblioteca ou do catálogo — sem id, sala nem
 *  data, que não fazem sentido dentro de um encontro. */
export function fichaDeMonstro(m: FichaMonstro): FichaMonstro {
  return {
    name: m.name,
    cls: m.cls,
    ac: m.ac,
    hp_max: m.hp_max,
    speed: m.speed,
    init_mod: m.init_mod,
    ataque: m.ataque,
    notes: m.notes,
  };
}

/** Põe um monstro no encontro: se já tem um grupo com o mesmo nome, soma 1
 *  nele em vez de abrir outro — tocar "Goblin" três vezes vira "3× Goblin". */
export function adicionarAoEncontro(grupos: GrupoEncontro[], ficha: FichaMonstro): GrupoEncontro[] {
  const chave = ficha.name.trim().toLowerCase();
  const i = grupos.findIndex((g) => g.name.trim().toLowerCase() === chave);
  if (i === -1) return [...grupos, { ...fichaDeMonstro(ficha), quantidade: 1 }];
  return grupos.map((g, idx) => (idx === i ? { ...g, quantidade: limitarQuantidade(g.quantidade + 1) } : g));
}

export function totalDoEncontro(grupos: GrupoEncontro[]): number {
  return grupos.reduce((soma, g) => soma + limitarQuantidade(g.quantidade), 0);
}

/** "3× Goblin · 1× Chefe goblin" — sem plural, que em português não dá pra
 *  acertar automático ("Chefe goblins"?). */
export function resumoEncontro(grupos: GrupoEncontro[]): string {
  return grupos.map((g) => `${limitarQuantidade(g.quantidade)}× ${g.name}`).join(" · ");
}

/**
 * Nomes pros monstros de um grupo, sem repetir nome de quem já está na sala.
 * Um sozinho fica com o nome puro ("Chefe goblin"); vários — ou um que já tem
 * xará na sala — ganham número, e o número continua de onde parou: rodar o
 * mesmo encontro duas vezes dá Goblin 4, 5, 6, em vez de um segundo "Goblin 1"
 * que o Mestre não consegue distinguir do primeiro.
 */
export function nomesDoGrupo(base: string, quantidade: number, nomesUsados: Iterable<string>): string[] {
  const usados = new Set([...nomesUsados].map((n) => n.trim().toLowerCase()));
  const nome = base.trim() || "Monstro";
  const chave = nome.toLowerCase();
  // Um avulso só fica com o nome puro se não houver série daquele monstro na
  // sala — senão aparecia um "Goblin" solto do lado de "Goblin 1" e "Goblin 2".
  const temSerie = [...usados].some(
    (u) => u.startsWith(`${chave} `) && /^\d+$/.test(u.slice(chave.length + 1)),
  );
  if (quantidade === 1 && !usados.has(chave) && !temSerie) return [nome];
  const saida: string[] = [];
  // O nome puro que já está na sala conta como o 1º da série.
  let k = usados.has(chave) ? 2 : 1;
  while (saida.length < quantidade) {
    const candidato = `${nome} ${k}`;
    if (!usados.has(candidato.toLowerCase())) saida.push(candidato);
    k++;
  }
  return saida;
}

/**
 * As fichas de NPC que um encontro cria: cada monstro de cada grupo, com nome
 * único na sala e PV cheio. Os nomes de um grupo entram na conta do seguinte,
 * então dois grupos com o mesmo monstro também não colidem entre si.
 */
export function npcsDoEncontro(grupos: GrupoEncontro[], nomesUsados: Iterable<string>): NovoPersonagem[] {
  const usados = [...nomesUsados];
  const saida: NovoPersonagem[] = [];
  for (const g of grupos) {
    for (const name of nomesDoGrupo(g.name, limitarQuantidade(g.quantidade), usados)) {
      usados.push(name);
      saida.push({
        name,
        cls: g.cls,
        ac: g.ac,
        hp: g.hp_max,
        hp_max: g.hp_max,
        speed: g.speed,
        init_mod: g.init_mod,
        ataque: g.ataque,
        notes: g.notes,
        is_npc: true,
      });
    }
  }
  return saida;
}

// ─────────────────────────────────────────────────────────────────────────────
// Permissões
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quem pode editar a ficha de um personagem: o Mestre edita qualquer uma
 * (jogador ou NPC), e o jogador edita a sua própria. Central pra não decidir
 * de novo em cada tela que abre uma ficha — quem manda renderizar já escolhe
 * qual ficha mostrar pra cada pessoa, mas a permissão de mexer nela é da
 * própria ficha, não do chamador.
 */
export function podeEditarPersonagem(souMestre: boolean, ehMinha: boolean): boolean {
  return souMestre || ehMinha;
}

// ─────────────────────────────────────────────────────────────────────────────
// Condição com prazo (some sozinha depois de N rodadas)
// ─────────────────────────────────────────────────────────────────────────────

/** Prazo de uma condição, em rodadas; 0 (ou menos) = sem prazo, sai à mão. */
export function comPrazoCondicao(
  prazos: Record<string, number>,
  condicao: string,
  rodadas: number,
): Record<string, number> {
  const novo = { ...prazos };
  if (rodadas <= 0) delete novo[condicao];
  else novo[condicao] = Math.round(rodadas);
  return novo;
}

/**
 * A cada rodada nova, desconta 1 de cada condição com prazo marcado; ao
 * chegar a 0, desliga a condição e tira ela do mapa de prazos. Devolve
 * também quais condições expiraram agora, pra registrar no log.
 */
export function reduzirPrazosCondicao(
  cond: Record<string, boolean>,
  prazo: Record<string, number>,
): { cond: Record<string, boolean>; cond_prazo: Record<string, number>; expiraram: string[] } {
  const novoCond = { ...cond };
  const novoPrazo: Record<string, number> = {};
  const expiraram: string[] = [];
  for (const [nome, restante] of Object.entries(prazo)) {
    const restanteNovo = restante - 1;
    if (restanteNovo <= 0) {
      novoCond[nome] = false;
      expiraram.push(nome);
    } else {
      novoPrazo[nome] = restanteNovo;
    }
  }
  return { cond: novoCond, cond_prazo: novoPrazo, expiraram };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ficha de classe: atributos, proficiências, CD de magia, espaços
// Fórmulas e tabelas conferidas contra o SRD 2024 (api.open5e.com/v2/classes,
// mesma fonte/disciplina do catálogo de monstros — ver AGENTS.md) em 2026-09-15.
// ─────────────────────────────────────────────────────────────────────────────

/** Modificador de um atributo — regra fixa, sem exceção de subclasse. */
export function modificador(atributo: number): number {
  return Math.floor((atributo - 10) / 2);
}

/** Nível total do personagem — soma de todas as classes (multiclasse).
 *  Bônus de proficiência, resistência, perícia e PP sempre usam este total,
 *  nunca o nível de uma classe isolada. */
export function nivelTotal(classes: { nivel: number }[]): number {
  return classes.reduce((soma, c) => soma + c.nivel, 0);
}

/** Bônus de proficiência por nível: +2 (1–4), +3 (5–8), +4 (9–12), +5
 *  (13–16), +6 (17–20) — igual pra toda classe. */
export function bonusProficiencia(nivel: number): number {
  return 2 + Math.floor((Math.max(1, nivel) - 1) / 4);
}

/** PV que o personagem ganha ao subir de nível pela regra de 2024: o valor
 *  fixo do dado de vida (metade do dado + 1: d6→4, d8→5, d10→6, d12→7) mais o
 *  modificador de Constituição. É sugestão — quem soma é o jogador, e quem
 *  prefere rolar o dado rola. `null` quando o campo do dado não é "dN". */
export function pvAoSubir(dadoDeVida: string, modCon: number): number | null {
  const faces = Number.parseInt(/^d(\d+)$/i.exec(dadoDeVida.trim())?.[1] ?? "", 10);
  if (!Number.isFinite(faces) || faces < 2) return null;
  return Math.floor(faces / 2) + 1 + modCon;
}

/** As dezoito perícias do SRD 2024 e o atributo de cada uma. */
export const PERICIAS: { chave: Pericia; nome: string; atributo: Atributo }[] = [
  { chave: "atletismo", nome: "Atletismo", atributo: "for" },
  { chave: "acrobacia", nome: "Acrobacia", atributo: "des" },
  { chave: "furtividade", nome: "Furtividade", atributo: "des" },
  { chave: "prestidigitacao", nome: "Prestidigitação", atributo: "des" },
  { chave: "arcanismo", nome: "Arcanismo", atributo: "int" },
  { chave: "historia", nome: "História", atributo: "int" },
  { chave: "investigacao", nome: "Investigação", atributo: "int" },
  { chave: "natureza", nome: "Natureza", atributo: "int" },
  { chave: "religiao", nome: "Religião", atributo: "int" },
  { chave: "lidar_com_animais", nome: "Lidar com Animais", atributo: "sab" },
  { chave: "intuicao", nome: "Intuição", atributo: "sab" },
  { chave: "medicina", nome: "Medicina", atributo: "sab" },
  { chave: "percepcao", nome: "Percepção", atributo: "sab" },
  { chave: "sobrevivencia", nome: "Sobrevivência", atributo: "sab" },
  { chave: "atuacao", nome: "Atuação", atributo: "car" },
  { chave: "enganacao", nome: "Enganação", atributo: "car" },
  { chave: "intimidacao", nome: "Intimidação", atributo: "car" },
  { chave: "persuasao", nome: "Persuasão", atributo: "car" },
];

/** Bônus de resistência (save) de um atributo. */
export function bonusResistencia(
  atributos: Atributos,
  proficiencias: Proficiencias,
  nivel: number,
  atributo: Atributo,
): number {
  const mod = modificador(atributos[atributo]);
  return proficiencias.saves.includes(atributo) ? mod + bonusProficiencia(nivel) : mod;
}

/** Bônus de uma perícia (especialista dobra o bônus de proficiência). */
export function bonusPericia(atributos: Atributos, proficiencias: Proficiencias, nivel: number, pericia: Pericia): number {
  const info = PERICIAS.find((p) => p.chave === pericia);
  if (!info) return 0;
  const mod = modificador(atributos[info.atributo]);
  const prof = proficiencias.pericias[pericia] ?? "nenhuma";
  const bp = bonusProficiencia(nivel);
  if (prof === "especialista") return mod + bp * 2;
  if (prof === "proficiente") return mod + bp;
  return mod;
}

/** Percepção passiva = 10 + bônus de Percepção. */
export function percepcaoPassiva(atributos: Atributos, proficiencias: Proficiencias, nivel: number): number {
  return 10 + bonusPericia(atributos, proficiencias, nivel, "percepcao");
}

/** CD de magia = 8 + proficiência + modificador do atributo de conjuração.
 *  null enquanto não tem conjuração (nenhum atributo escolhido). */
export function cdMagia(atributos: Atributos, nivel: number, atributoConjuracao: Atributo | null): number | null {
  if (!atributoConjuracao) return null;
  return 8 + bonusProficiencia(nivel) + modificador(atributos[atributoConjuracao]);
}

/** Bônus de ataque de magia = proficiência + modificador do atributo de conjuração. */
export function ataqueMagia(atributos: Atributos, nivel: number, atributoConjuracao: Atributo | null): number | null {
  if (!atributoConjuracao) return null;
  return bonusProficiencia(nivel) + modificador(atributos[atributoConjuracao]);
}

/** Espaços de magia por nível de personagem (índice 0 = nível 1), um valor
 *  por nível de espaço 1º–9º — conjurador completo (Bardo, Clérigo, Druida,
 *  Feiticeiro, Mago). */
const ESPACOS_COMPLETO: number[][] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Idem, meio-conjurador (Paladino, Patrulheiro) — só até espaço 5º. */
const ESPACOS_MEIO: number[][] = [
  [2, 0, 0, 0, 0],
  [2, 0, 0, 0, 0],
  [3, 0, 0, 0, 0],
  [3, 0, 0, 0, 0],
  [4, 2, 0, 0, 0],
  [4, 2, 0, 0, 0],
  [4, 3, 0, 0, 0],
  [4, 3, 0, 0, 0],
  [4, 3, 2, 0, 0],
  [4, 3, 2, 0, 0],
  [4, 3, 3, 0, 0],
  [4, 3, 3, 0, 0],
  [4, 3, 3, 1, 0],
  [4, 3, 3, 1, 0],
  [4, 3, 3, 2, 0],
  [4, 3, 3, 2, 0],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2],
];

/** Pacto de magia do Bruxo: todo espaço é do mesmo nível, e o nível do
 *  espaço sobe sozinho — tabela própria, não é fatia da tabela normal. */
const PACTO: { slots: number; espacoNivel: number }[] = [
  { slots: 1, espacoNivel: 1 },
  { slots: 2, espacoNivel: 1 },
  { slots: 2, espacoNivel: 2 },
  { slots: 2, espacoNivel: 2 },
  { slots: 2, espacoNivel: 3 },
  { slots: 2, espacoNivel: 3 },
  { slots: 2, espacoNivel: 4 },
  { slots: 2, espacoNivel: 4 },
  { slots: 2, espacoNivel: 5 },
  { slots: 2, espacoNivel: 5 },
  { slots: 3, espacoNivel: 5 },
  { slots: 3, espacoNivel: 5 },
  { slots: 3, espacoNivel: 5 },
  { slots: 3, espacoNivel: 5 },
  { slots: 3, espacoNivel: 5 },
  { slots: 3, espacoNivel: 5 },
  { slots: 4, espacoNivel: 5 },
  { slots: 4, espacoNivel: 5 },
  { slots: 4, espacoNivel: 5 },
  { slots: 4, espacoNivel: 5 },
];

/** Espaços de magia pro nível/tipo de conjurador dados — só as entradas com
 *  algum espaço (max > 0). Terço-conjurador (Cavaleiro Arcano, Trapaceiro
 *  Arcano) não tem tabela própria: conta como conjurador completo num terço
 *  do nível, arredondado pra baixo — regra oficial de multiclasse (cap. 6),
 *  reaproveitando a tabela já conferida em vez de outra tabela nova. */
export function espacosDeMagia(conjurador: TipoConjurador, nivel: number): { nivel: number; max: number }[] {
  const n = Math.max(1, Math.min(20, Math.round(nivel)));
  if (conjurador === "nenhum") return [];
  if (conjurador === "pacto") {
    const { slots, espacoNivel } = PACTO[n - 1];
    return [{ nivel: espacoNivel, max: slots }];
  }
  if (conjurador === "terco") {
    const nivelEfetivo = Math.floor(n / 3);
    if (nivelEfetivo < 1) return [];
    return ESPACOS_COMPLETO[nivelEfetivo - 1]
      .map((max, i) => ({ nivel: i + 1, max }))
      .filter((e) => e.max > 0);
  }
  const tabela = conjurador === "meio" ? ESPACOS_MEIO : ESPACOS_COMPLETO;
  return tabela[n - 1].map((max, i) => ({ nivel: i + 1, max })).filter((e) => e.max > 0);
}

/** Prefixo dos recursos gerados por espacosDeMagia, pra achar e substituir
 *  só esses ao regenerar (preserva Fúria, Ki etc. cadastrados à mão). */
export const PREFIXO_ESPACO_MAGIA = "Espaço de magia Nv. ";

/** Soma os modificadores ligados que afetam um campo (ex.: Feitiçaria Inata
 *  ativa somando +1 na CD de magia) — a calculadora usa em cima da fórmula
 *  fixa, pra cobrir bônus situacional sem virar regra embutida. */
export function somaModificadores(modificadores: Modificador[], campo: CampoModificavel): number {
  return modificadores
    .filter((m) => m.ativo && m.campo === campo)
    .reduce((acc, m) => acc + m.delta, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bastião — evento do turno (d100)
// ─────────────────────────────────────────────────────────────────────────────

export type FaixaEventoBastiao = { min: number; max: number; nome: string };

/** Acha o nome do evento cuja faixa (min–max, inclusive) contém a rolagem de
 *  d100; undefined se não cair em nenhuma faixa da tabela. */
export function eventoBastiaoPara(rolagem: number, tabela: FaixaEventoBastiao[]): string | undefined {
  return tabela.find((e) => rolagem >= e.min && rolagem <= e.max)?.nome;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ataques do personagem de jogador — leitura no meio do combate
// ─────────────────────────────────────────────────────────────────────────────

export type LinhaAtaque = { nome: string | null; detalhe: string };

/** Quebra o campo `ataque` (texto livre) em uma linha por ataque, com o nome
 *  separado do resto quando a linha vem no formato "Nome: acerto, dano" — só
 *  pra destacar o nome na tela. Não entende acerto nem dano de propósito:
 *  item mágico e feito mudam os números, e quem sabe é o jogador. Linha sem
 *  ":" (ou com ":" na ponta) volta inteira como detalhe. */
export function separarAtaques(texto: string): LinhaAtaque[] {
  return texto
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const i = linha.indexOf(":");
      if (i <= 0 || i === linha.length - 1) return { nome: null, detalhe: linha };
      return { nome: linha.slice(0, i).trim(), detalhe: linha.slice(i + 1).trim() };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Ataques rolados na linha da iniciativa
// ─────────────────────────────────────────────────────────────────────────────

/** Um pedaço do dano: "1d6+2 cortante" ou o extra "+ 1d6 elétrico". */
export type ParteDano = { qtd: number; faces: number; mod: number; tipo: string };

/** Ataque que deu pra entender no texto livre do campo `ataque`. `bonus`
 *  null = só dano (ex.: "Sopro: CD 13, 4d6 fogo" — quem rola é o alvo). */
export type AtaqueRolavel = {
  nome: string;
  bonus: number | null;
  /** "2x Dilacerar": quantos ataques iguais saem de um toque. */
  vezes: number;
  partes: ParteDano[];
};

export type LeituraAtaques = {
  ataques: AtaqueRolavel[];
  /** "2 ataques: A · B" — quantos ataques por turno, escolhendo entre eles. */
  multiataque: number | null;
};

// Tipo de dano só é aceito se for um destes — palavra solta depois do dado
// ("mais uma mordida") não vira tipo.
const TIPOS_DANO = new Set([
  "ácido", "acido", "contundente", "cortante", "elétrico", "eletrico", "energia", "fogo", "força", "forca",
  "frio", "necrótico", "necrotico", "perfurante", "psíquico", "psiquico", "radiante", "trovão", "trovao",
  "trovejante", "veneno",
]);

// "2d6+9", "1d6 elétrico", "2d8+5 de trovão". O modificador não pode ser o
// começo do próximo dado ("1d6 + 2d4").
const DADO = /(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+)(?!\s*d\s*\d))?(?:\s+(?:de\s+)?([a-zà-ÿ]+))?/gi;

function lerSegmentoAtaque(bruto: string): AtaqueRolavel | null {
  // Observação entre parênteses ("(troca 1 por Mordida +5, 2d8+3)") não é
  // dano deste ataque.
  let s = bruto.replace(/\([^)]*\)/g, " ").trim();
  let vezes = 1;
  const mVezes = s.match(/^(\d+)\s*[x×]\s+/i);
  if (mVezes) {
    vezes = Math.max(1, Number(mVezes[1]));
    s = s.slice(mVezes[0].length);
  }
  const fixo = lerDanoFixo(s, vezes);
  if (fixo) return fixo;
  const inicioDano = s.search(/\d+\s*d\s*\d+/i);
  if (inicioDano < 0) return null;

  const cabeca = s.slice(0, inicioDano);
  // Jogador escreve "Malho +1: +7, 2d6+9" (nome antes do ":"); o catálogo
  // escreve "Cimitarra +4, 1d6+2".
  const doisPontos = cabeca.indexOf(":");
  let nome = doisPontos >= 0 ? cabeca.slice(0, doisPontos) : cabeca;
  const resto = doisPontos >= 0 ? cabeca.slice(doisPontos + 1) : cabeca;
  const mBonus = resto.match(/([+-]\d+)\s*,?\s*$/);
  const bonus = mBonus ? Number(mBonus[1]) : null;
  if (mBonus && doisPontos < 0) nome = resto.slice(0, mBonus.index);

  const partes: ParteDano[] = [];
  for (const m of s.slice(inicioDano).matchAll(DADO)) {
    const tipo = (m[5] ?? "").toLowerCase();
    partes.push({
      qtd: Number(m[1]),
      faces: Number(m[2]),
      mod: m[4] ? Number(m[4]) * (m[3] === "-" ? -1 : 1) : 0,
      tipo: TIPOS_DANO.has(tipo) ? tipo : "",
    });
  }
  if (partes.length === 0) return null;
  return { nome: nome.replace(/[\s,:]+$/, "").trim() || "Ataque", bonus, vezes, partes };
}

/** Bicho miúdo tem dano fixo, sem dado: "Arranhão +4, 1 cortante" (gato,
 *  morcego, rã do catálogo), às vezes com dado extra depois ("Mordida +4, 1
 *  perfurante + 1d4 veneno", da aranha). Só vale com bônus de acerto e tipo
 *  de dano conhecido — "Espada +1, 3 vezes por dia" não vira ataque. */
function lerDanoFixo(s: string, vezes: number): AtaqueRolavel | null {
  const m = s.match(/^(.*?)([+-]\d+)\s*,\s*(\d+)\s+(?:de\s+)?([a-zà-ÿ]+)/i);
  if (!m || !TIPOS_DANO.has(m[4].toLowerCase())) return null;
  const nome = m[1].replace(/[\s,:]+$/, "").trim() || "Ataque";
  const partes: ParteDano[] = [{ qtd: 0, faces: 0, mod: Number(m[3]), tipo: m[4].toLowerCase() }];
  for (const extra of s.slice(m[0].length).matchAll(DADO)) {
    const tipo = (extra[5] ?? "").toLowerCase();
    partes.push({
      qtd: Number(extra[1]),
      faces: Number(extra[2]),
      mod: extra[4] ? Number(extra[4]) * (extra[3] === "-" ? -1 : 1) : 0,
      tipo: TIPOS_DANO.has(tipo) ? tipo : "",
    });
  }
  return { nome, bonus: Number(m[2]), vezes, partes };
}

/**
 * Lê o campo `ataque` (texto livre) atrás do que dá pra rolar: nome, bônus
 * de acerto e dano. Entende o formato do catálogo ("Cimitarra +4, 1d6+2
 * cortante · Arco curto +4, 1d6+2 perfurante", "2x Dilacerar…", "2 ataques:
 * A · B", dano extra "+ 1d6 elétrico") e o da ficha do jogador (uma linha
 * por ataque, "Malho +1: +7, 2d6+9 contundente"). O que não tiver dado fica
 * de fora — o texto inteiro continua na ficha.
 */
export function lerAtaquesRolaveis(texto: string): LeituraAtaques {
  const ataques: AtaqueRolavel[] = [];
  let multiataque: number | null = null;
  for (const linhaBruta of (texto ?? "").split("\n")) {
    let linha = linhaBruta.trim();
    if (!linha) continue;
    const mMulti = linha.match(/^(\d+)\s+ataques?\s*:\s*/i);
    if (mMulti) {
      multiataque ??= Number(mMulti[1]);
      linha = linha.slice(mMulti[0].length);
    }
    for (const segmento of linha.split(/\s+·\s+|\s*;\s*|\s+e\s+(?=[A-ZÀ-Ý])/)) {
      const ataque = lerSegmentoAtaque(segmento);
      if (ataque) ataques.push(ataque);
    }
  }
  return { ataques, multiataque };
}

export type ModoRolagem = "normal" | "vantagem" | "desvantagem";

export type ResultadoAtaque = {
  nome: string;
  /** Os d20 que saíram (dois com vantagem/desvantagem); vazio = só dano. */
  d20s: number[];
  d20: number | null;
  acerto: number | null;
  critico: boolean;
  /** 1 natural: erra, não importa o bônus. */
  erroCritico: boolean;
  partes: { dados: number[]; mod: number; tipo: string; total: number }[];
  dano: number;
};

/**
 * Rola um ataque. `rolar(faces)` vem de fora (dados.ts) pra dar pra testar
 * com dado viciado. Regras 2024: vantagem/desvantagem rola dois d20 e fica
 * com o maior/menor; 20 natural é crítico e rola os DADOS de dano duas vezes
 * (o modificador entra uma vez só); dano não fica negativo.
 */
export function resolverAtaque(
  ataque: AtaqueRolavel,
  modo: ModoRolagem,
  rolar: (faces: number) => number,
): ResultadoAtaque {
  const d20s = ataque.bonus === null ? [] : modo === "normal" ? [rolar(20)] : [rolar(20), rolar(20)];
  const d20 =
    d20s.length === 0 ? null : modo === "vantagem" ? Math.max(...d20s) : modo === "desvantagem" ? Math.min(...d20s) : d20s[0];
  const critico = d20 === 20;
  const partes = ataque.partes.map((p) => {
    const dados = Array.from({ length: critico ? p.qtd * 2 : p.qtd }, () => rolar(p.faces));
    const total = Math.max(0, dados.reduce((soma, x) => soma + x, 0) + p.mod);
    return { dados, mod: p.mod, tipo: p.tipo, total };
  });
  return {
    nome: ataque.nome,
    d20s,
    d20,
    acerto: d20 === null ? null : d20 + (ataque.bonus ?? 0),
    critico,
    erroCritico: d20 === 1,
    partes,
    dano: partes.reduce((soma, p) => soma + p.total, 0),
  };
}

function comSinal(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** O resultado em duas frases curtas, pro painel da linha. */
export function descreverAtaque(r: ResultadoAtaque, bonus: number | null): { acerto: string | null; dano: string } {
  let acerto: string | null = null;
  if (r.d20 !== null) {
    const outro = r.d20s.length > 1 ? ` (e ${r.d20s.find((x, i) => i !== r.d20s.indexOf(r.d20 as number))})` : "";
    const conta = `🎲 ${r.d20}${outro} ${comSinal(bonus ?? 0)} = ${r.acerto}`;
    acerto = r.critico ? `${conta} — 20 natural, CRÍTICO` : r.erroCritico ? `${conta} — 1 natural, erra` : conta;
  }
  const detalhe = (p: ResultadoAtaque["partes"][number]) =>
    p.dados.length === 0 ? "fixo" : `${p.dados.join("+")}${p.mod ? ` ${comSinal(p.mod)}` : ""}`;
  const partes = r.partes.map((p) => `${p.total}${p.tipo ? ` ${p.tipo}` : ""} (${detalhe(p)})`);
  const dano = partes.length === 1 ? `${partes[0].replace(/^(\d+)/, "$1 de dano")}` : `${r.dano} de dano: ${partes.join(" + ")}`;
  return { acerto, dano };
}
