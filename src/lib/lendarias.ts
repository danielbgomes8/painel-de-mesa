/**
 * Ações lendárias, resistência lendária e ações de covil — as regras puras. A tela só chama estas
 * funções (ver `LendariasNaLinha.tsx` e `avancarTurno` em `RastreadorCombate.tsx`).
 *
 * Nada de coluna nova: as três coisas moram nos `resources` do monstro, que já existem, reconhecidos
 * pelo nome (mesmo desenho dos espaços de magia, `PREFIXO_ESPACO_MAGIA`):
 *  - "Ações lendárias": o que sobra de ações lendárias na rodada. Cada ação gasta 1 a 3. **Volta ao
 *    máximo sozinha quando chega o turno do monstro** (regra do livro: recupera no início do próprio turno).
 *  - "Resistência lendária": usos por dia pra passar num teste que falhou. Não volta sozinha (o descanso
 *    longo do Mestre zera todos os recursos).
 *  - "Ações de covil": só uma marca (máx. 1) de que o monstro age na contagem de iniciativa 20.
 */
import type { Recurso } from "./tipos";

export const NOME_ACOES_LENDARIAS = "Ações lendárias";
export const NOME_RESISTENCIA_LENDARIA = "Resistência lendária";
export const NOME_COVIL = "Ações de covil";

/** Contagem de iniciativa em que as ações de covil acontecem. */
export const CONTAGEM_DO_COVIL = 20;
export const LENDARIAS_PADRAO = 3;
export const RESISTENCIAS_PADRAO = 3;
export const MAX_LENDARIAS = 9;

export function acharRecurso(recursos: Recurso[], nome: string): Recurso | null {
  return recursos.find((r) => r.name === nome) ?? null;
}

export const temAcoesLendarias = (recursos: Recurso[]) => acharRecurso(recursos, NOME_ACOES_LENDARIAS) !== null;
export const temResistenciaLendaria = (recursos: Recurso[]) => acharRecurso(recursos, NOME_RESISTENCIA_LENDARIA) !== null;
export const temCovil = (recursos: Recurso[]) => acharRecurso(recursos, NOME_COVIL) !== null;
export const ehChefe = (recursos: Recurso[]) => temAcoesLendarias(recursos) || temResistenciaLendaria(recursos) || temCovil(recursos);

function trocar(recursos: Recurso[], nome: string, mudanca: (r: Recurso) => Recurso): Recurso[] {
  return recursos.map((r) => (r.name === nome ? mudanca(r) : r));
}

/** Põe (ou atualiza) um recurso de chefe sem mexer nos outros recursos do monstro. */
function garantir(recursos: Recurso[], nome: string, max: number): Recurso[] {
  const n = Math.max(1, Math.min(MAX_LENDARIAS, Math.round(max)));
  if (acharRecurso(recursos, nome)) return trocar(recursos, nome, (r) => ({ ...r, max: n, cur: Math.min(r.cur, n) }));
  return [...recursos, { name: nome, max: n, cur: n, short_rest: false }];
}

export function comAcoesLendarias(recursos: Recurso[], max = LENDARIAS_PADRAO): Recurso[] {
  return garantir(recursos, NOME_ACOES_LENDARIAS, max);
}

export function comResistenciaLendaria(recursos: Recurso[], max = RESISTENCIAS_PADRAO): Recurso[] {
  return garantir(recursos, NOME_RESISTENCIA_LENDARIA, max);
}

export function comCovil(recursos: Recurso[]): Recurso[] {
  return garantir(recursos, NOME_COVIL, 1);
}

/** Tira do monstro tudo que é de chefe, deixando o resto dos recursos como estava. */
export function semChefe(recursos: Recurso[]): Recurso[] {
  const nomes = [NOME_ACOES_LENDARIAS, NOME_RESISTENCIA_LENDARIA, NOME_COVIL];
  return recursos.filter((r) => !nomes.includes(r.name));
}

export type Gasto = { recursos: Recurso[]; restam: number; max: number };

function gastar(recursos: Recurso[], nome: string, custo: number): Gasto | null {
  const r = acharRecurso(recursos, nome);
  const c = Math.round(custo);
  if (!r || c < 1 || r.cur < c) return null;
  return { recursos: trocar(recursos, nome, (x) => ({ ...x, cur: x.cur - c })), restam: r.cur - c, max: r.max };
}

/** Gasta `custo` ações lendárias (1 a 3 no livro). null se não tem tudo isso. */
export function gastarAcoesLendarias(recursos: Recurso[], custo: number): Gasto | null {
  return gastar(recursos, NOME_ACOES_LENDARIAS, custo);
}

/** Usa uma resistência lendária. null se acabaram. */
export function usarResistenciaLendaria(recursos: Recurso[]): Gasto | null {
  return gastar(recursos, NOME_RESISTENCIA_LENDARIA, 1);
}

/** Devolve o que se gastou de ações lendárias, até o máximo (desfazer um gasto errado). */
export function devolverAcaoLendaria(recursos: Recurso[]): Recurso[] | null {
  const r = acharRecurso(recursos, NOME_ACOES_LENDARIAS);
  if (!r || r.cur >= r.max) return null;
  return trocar(recursos, NOME_ACOES_LENDARIAS, (x) => ({ ...x, cur: x.cur + 1 }));
}

/** No início do turno do monstro as ações lendárias voltam ao máximo. null = não tem ou já estava cheio
 *  (nada a gravar). */
export function recuperarAcoesLendarias(recursos: Recurso[]): Recurso[] | null {
  const r = acharRecurso(recursos, NOME_ACOES_LENDARIAS);
  if (!r || r.cur >= r.max) return null;
  return trocar(recursos, NOME_ACOES_LENDARIAS, (x) => ({ ...x, cur: x.max }));
}

/** Em que posição da ordem (índice) caem as ações de covil: antes do primeiro que tem menos de 20 (quem
 *  empata em 20 age antes do covil: "perde os empates"). Se todo mundo tem 20 ou mais, o covil é o último
 *  da rodada — o aviso aparece no primeiro da rodada seguinte, então devolve 0. */
export function posicaoDoCovil(ordem: { init: number }[]): number {
  const i = ordem.findIndex((c) => c.init < CONTAGEM_DO_COVIL);
  return i < 0 ? 0 : i;
}

/** É a hora das ações de covil? (o turno atual é o primeiro depois da contagem 20) */
export function horaDoCovil(ordem: { init: number }[], turno: number): boolean {
  return ordem.length > 0 && turno === posicaoDoCovil(ordem);
}

/** As linhas do log. A marca 👑 (lendárias) e 🏰 (covil) ficam fora do recap: são detalhe do combate. */
export function linhaDeAcaoLendaria(nome: string, custo: number, restam: number, max: number): string {
  return `👑 ${nome} usou ${custo === 1 ? "uma ação lendária" : `${custo} ações lendárias`} (restam ${restam}/${max})`;
}

export function linhaDeResistenciaLendaria(nome: string, restam: number, max: number): string {
  return `👑 ${nome} usou uma resistência lendária (restam ${restam}/${max})`;
}
