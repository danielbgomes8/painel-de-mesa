/**
 * Desfazer a última ação — as regras, puras (ver desfazer.test.ts). Quem
 * guarda a pilha e grava no banco é o useSala.
 *
 * Cada aparelho desfaz o que ELE fez: a ação guarda o valor de antes e o de
 * depois de tudo o que escreveu, e só volta se o "depois" ainda for o que
 * está valendo. Se alguém mexeu na mesma ficha ou na ordem no meio tempo,
 * não desfaz — atropelar a jogada de outro celular seria pior que o erro.
 */

import type { EstadoCombate, Personagem } from "./tipos";
import type { Peca } from "./pecas";

/** Quantas ações ficam guardadas. Desfazer volta uma de cada vez, sempre a
 *  mais nova, e o botão diz qual é antes do toque. */
export const MAX_DESFAZER = 10;

export type MudancaPersonagem = {
  id: string;
  /** Nome de verdade, pro aviso de "mudou depois disso" — só aparece no
   *  aparelho de quem fez a ação, que já via esse nome. */
  nome: string;
  antes: Partial<Personagem>;
  depois: Partial<Personagem>;
};

export type MudancaCombate = { antes: EstadoCombate; depois: EstadoCombate };

/** Peões do mapa que a ação mexeu junto: o inimigo entrou na ordem e ganhou
 *  peão, ou saiu dela e o peão saiu do mapa (ver lib/pecasNoBanco.ts). */
export type PecasDaAcao = {
  /** Peões que a ação criou: desfazer apaga. */
  criadas: string[];
  /** Peões que a ação tirou do mapa: desfazer devolve no mesmo lugar. */
  tiradas: Peca[];
};

export type AcaoDesfazivel = {
  id: string;
  /** O que o botão mostra ("Goblin sofreu 5 de dano (2/7)"). Fica só neste
   *  aparelho, então vai com nome e PV de verdade. */
  rotulo: string;
  /** Linha que o desfazer grava no log, que é público — tem que seguir o
   *  anti-spoiler (ver `textoDesfeito`). null = não grava: a ação nem tinha
   *  ido pro log (tirar alguém da ordem, passar a vez sem virar a rodada). */
  textoLog: string | null;
  personagens: MudancaPersonagem[];
  combate: MudancaCombate | null;
  /** Fichas que a ação criou (NPC novo, encontro): desfazer apaga. */
  criados: string[];
  /** Peões que a ação pôs ou tirou do mapa. Ausente = nenhum (e é o que as
   *  pilhas guardadas antes dos peões têm). */
  pecas?: PecasDaAcao;
};

export type NovaAcaoDesfazivel = Omit<AcaoDesfazivel, "id">;

/** O que estava nos campos que `patch` vai sobrescrever. */
export function valoresAntes(atual: Personagem, patch: Partial<Personagem>): Partial<Personagem> {
  const antes: Record<string, unknown> = {};
  for (const chave of Object.keys(patch)) antes[chave] = atual[chave as keyof Personagem];
  return antes as Partial<Personagem>;
}

/** Mudança de uma ficha pronta pra guardar na ação. */
export function mudancaDe(atual: Personagem, patch: Partial<Personagem>): MudancaPersonagem {
  return { id: atual.id, nome: atual.name, antes: valoresAntes(atual, patch), depois: patch };
}

/** Mapas (condições, prazos) vêm do banco com as chaves em outra ordem. */
function comChavesOrdenadas(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(comChavesOrdenadas);
  if (valor && typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const chave of Object.keys(valor).sort()) saida[chave] = comChavesOrdenadas((valor as Record<string, unknown>)[chave]);
    return saida;
  }
  return valor;
}

/** Igualdade de valores que vão pro banco: números, textos, booleanos e os
 *  mapas de condição. */
export function mesmoValor(a: unknown, b: unknown): boolean {
  return JSON.stringify(comChavesOrdenadas(a)) === JSON.stringify(comChavesOrdenadas(b));
}

function mesmosCampos(atual: Partial<Personagem>, esperado: Partial<Personagem>): boolean {
  return Object.keys(esperado).every((chave) =>
    mesmoValor(atual[chave as keyof Personagem], esperado[chave as keyof Personagem]),
  );
}

export function mesmoCombate(a: EstadoCombate, b: EstadoCombate): boolean {
  return a.round === b.round && a.turn === b.turn && mesmoValor(a.order, b.order);
}

/** A ação mexeu em alguma coisa? Cura em quem já está cheio não mexe, e não
 *  deve ocupar o botão de desfazer. */
export function mudouAlgo(acao: NovaAcaoDesfazivel): boolean {
  return (
    acao.criados.length > 0 ||
    (acao.pecas !== undefined && acao.pecas.criadas.length + acao.pecas.tiradas.length > 0) ||
    (acao.combate !== null && !mesmoCombate(acao.combate.antes, acao.combate.depois)) ||
    acao.personagens.some((m) => !mesmosCampos(m.antes, m.depois))
  );
}

/** Põe a ação no topo da pilha; a mais velha cai quando passa do máximo. */
export function empilhar(pilha: AcaoDesfazivel[], acao: AcaoDesfazivel): AcaoDesfazivel[] {
  return [acao, ...pilha].slice(0, MAX_DESFAZER);
}

export type Veredito = { ok: true } | { ok: false; motivo: string };

/**
 * Dá pra desfazer? Só se tudo o que a ação escreveu continua exatamente
 * igual. Os motivos viram o aviso na tela, então dizem quem mudou.
 */
export function podeDesfazer(acao: AcaoDesfazivel, personagens: Personagem[], combate: EstadoCombate): Veredito {
  if (acao.combate && !mesmoCombate(combate, acao.combate.depois)) {
    return { ok: false, motivo: "a ordem de iniciativa mudou depois disso" };
  }
  for (const m of acao.personagens) {
    const atual = personagens.find((p) => p.id === m.id);
    if (!atual) return { ok: false, motivo: `${m.nome} não está mais na sala` };
    if (!mesmosCampos(atual, m.depois)) return { ok: false, motivo: `${m.nome} mudou depois disso — ajuste na ficha` };
  }
  return { ok: true };
}

/**
 * Linha do log pra quando uma ação é desfeita. Parte das linhas que a ação
 * gravou — que já passaram pelo anti-spoiler — em vez de montar outra: uma
 * linha só vira "↩ Desfeito: <ela>"; várias viram o `resumo` (que também
 * tem que ser público: contagem, sem nome de NPC). Nenhuma → null.
 */
export function textoDesfeito(linhas: string[], resumo: string): string | null {
  if (linhas.length === 0) return null;
  return `↩ Desfeito: ${linhas.length === 1 ? linhas[0] : resumo}`;
}

/** "1 alvo", "3 alvos" — pros rótulos das ações em massa. */
export function contarAlvos(n: number): string {
  return n === 1 ? "1 alvo" : `${n} alvos`;
}

/** Colunas que dá pra conferir no próprio UPDATE (`.eq`), fechando a janela
 *  entre a conferência local e a escrita. Texto e mapa ficam de fora: a
 *  conferência deles é a de `podeDesfazer`, contra o estado que o tempo real
 *  mantém em dia. */
export function camposConferiveis(depois: Partial<Personagem>): [string, number | boolean][] {
  return Object.entries(depois).filter(
    (par): par is [string, number | boolean] => typeof par[1] === "number" || typeof par[1] === "boolean",
  );
}

/** Pilha guardada no navegador (sessionStorage): confere o formato antes de
 *  usar — guardado por uma versão antiga do app, ou mexido, vira pilha vazia. */
export function lerPilhaGuardada(cru: string | null): AcaoDesfazivel[] {
  if (!cru) return [];
  try {
    const valor: unknown = JSON.parse(cru);
    if (!Array.isArray(valor)) return [];
    const validas = valor.filter(
      (a): a is AcaoDesfazivel =>
        a !== null &&
        typeof a === "object" &&
        typeof a.id === "string" &&
        typeof a.rotulo === "string" &&
        (a.textoLog === null || typeof a.textoLog === "string") &&
        Array.isArray(a.personagens) &&
        Array.isArray(a.criados) &&
        (a.pecas === undefined ||
          (a.pecas !== null && typeof a.pecas === "object" && Array.isArray(a.pecas.criadas) && Array.isArray(a.pecas.tiradas))) &&
        (a.combate === null || typeof a.combate === "object"),
    );
    return validas.slice(0, MAX_DESFAZER);
  } catch {
    return [];
  }
}
