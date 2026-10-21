import { supabase } from "@/lib/supabase";
import { ehFalhaDeRede } from "@/lib/offline";
import { COMBATE_VAZIO, type Bastiao, type EstadoCombate, type NovoPersonagem, type Personagem } from "@/lib/tipos";
import type { LinhaCombate } from "./salaTipos";

export const TAMANHO_LOG = 40;

/** Quantas linhas por página ao ler uma tabela INTEIRA (backup). O PostgREST
 *  corta a resposta num teto próprio, então log de mesa antiga sairia pela
 *  metade sem paginar — e backup pela metade é pior que backup nenhum. */
export const PAGINA_EXPORTACAO = 1000;

// Tentativas de uma escrita com versão antes de desistir e avisar (ver
// migrations 0010 e 0015) — mais que suficiente pra qualquer contenção real
// numa mesa de RPG; existe só pra não tentar pra sempre num cenário
// patológico.
export const MAX_TENTATIVAS_VERSAO = 5;

export const BASTIAO_VAZIO: Bastiao = { room_code: "", turno: 1, tesouro_po: 0, defensores: 0, notes: "" };

export type ResultadoVersao<L> =
  | { tipo: "gravou"; linha: L }
  | { tipo: "conflito"; linha: L }
  // `causa`: o erro inteiro do banco (com o código), pro relato de erro.
  | { tipo: "erro"; mensagem: string; rede: boolean; causa: unknown };

/** Lê uma tabela da sala INTEIRA, em páginas, da mais antiga pra mais nova. */
export async function lerTudoDaTabela(
  tabela: string,
  codigo: string,
): Promise<{ dados: Record<string, unknown>[]; erro: string | null }> {
  const tudo: Record<string, unknown>[] = [];
  for (let inicio = 0; ; inicio += PAGINA_EXPORTACAO) {
    const { data, error } = await supabase
      .from(tabela)
      .select("*")
      .eq("room_code", codigo)
      .order("created_at", { ascending: true })
      .range(inicio, inicio + PAGINA_EXPORTACAO - 1);
    if (error) return { dados: [], erro: `${tabela}: ${error.message}` };
    const pagina = (data ?? []) as Record<string, unknown>[];
    tudo.push(...pagina);
    if (pagina.length < PAGINA_EXPORTACAO) return { dados: tudo, erro: null };
  }
}

/** Quebra uma lista em pedaços — insert de log de campanha inteira numa
 *  requisição só passaria do tamanho que o PostgREST aceita. */
export function pedacos<T>(lista: T[], tamanho: number): T[][] {
  const saida: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) saida.push(lista.slice(i, i + tamanho));
  return saida;
}

/**
 * UPDATE que só pega se `version` ainda for a que este cliente leu — o
 * controle de concorrência otimista das migrations 0010 (combate) e 0015
 * (Bastião). Uma instrução atômica no Postgres decide quem ganha: quem chegou
 * primeiro grava e incrementa a versão, quem chegou depois afeta zero linhas.
 *
 * "conflito" não é falha: vem com a linha de verdade que está no banco agora,
 * pra quem chamou refazer o cálculo em cima dela e tentar de novo. Relê
 * direto do banco de propósito — não dá pra confiar que o tempo real já
 * entregou a notícia a tempo.
 */
export async function gravarSeVersaoBater<L extends { version: number }>(
  tabela: string,
  codigo: string,
  versao: number,
  colunas: Record<string, unknown>,
): Promise<ResultadoVersao<L>> {
  const { data, error } = await supabase
    .from(tabela)
    .update({ ...colunas, version: versao + 1 })
    .eq("room_code", codigo)
    .eq("version", versao)
    .select()
    .maybeSingle();
  if (error) return { tipo: "erro", mensagem: error.message, rede: ehFalhaDeRede(error), causa: error };
  if (data) return { tipo: "gravou", linha: data as L };

  const releitura = await supabase.from(tabela).select("*").eq("room_code", codigo).maybeSingle();
  if (releitura.error)
    return { tipo: "erro", mensagem: releitura.error.message, rede: ehFalhaDeRede(releitura.error), causa: releitura.error };
  if (!releitura.data) {
    const mensagem = `${tabela}: linha da sala sumiu`;
    return { tipo: "erro", mensagem, rede: false, causa: mensagem };
  }
  return { tipo: "conflito", linha: releitura.data as L };
}

/** A linha de `characters` pra um personagem novo — um lugar só pros padrões,
 *  usado por quem cria um e por quem cria vários de uma vez. */
export function linhaDePersonagem(codigo: string, slug: string, dados: NovoPersonagem) {
  return {
    room_code: codigo,
    slug,
    name: dados.name,
    cls: dados.cls ?? "",
    ac: dados.ac ?? 12,
    init_mod: dados.init_mod ?? 0,
    speed: dados.speed ?? 9,
    hp: dados.hp ?? 10,
    hp_max: dados.hp_max ?? 10,
    ataque: dados.ataque ?? "",
    is_npc: dados.is_npc ?? false,
    notes: dados.notes ?? "",
    // Só se vierem: coluna nova não pode quebrar a criação de ninguém antes da migration 0031 rodar.
    ...(dados.dono ? { dono: dados.dono } : {}),
    ...(dados.revealed !== undefined ? { revealed: dados.revealed } : {}),
  };
}

/** players primeiro, depois NPCs; dentro de cada grupo, por ordem de criação. */
export function ordenar(lista: Personagem[]): Personagem[] {
  return [...lista].sort((a, b) => {
    if (a.is_npc !== b.is_npc) return a.is_npc ? 1 : -1;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function comoCombate(linha: LinhaCombate | null): EstadoCombate {
  if (!linha) return COMBATE_VAZIO;
  return {
    round: linha.round ?? 1,
    turn: linha.turn ?? 0,
    order: Array.isArray(linha.order_json) ? linha.order_json : [],
  };
}

export const MSG_SEM_CONFIG =
  "Supabase não configurado. Crie o arquivo .env.local com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (veja o README).";

export const AVISO_FALHA_ESCRITA = "Não salvou — confira a conexão e tente de novo.";

/** Chave da pilha de desfazer no sessionStorage (+ código da sala). */
export const PREFIXO_PILHA_DESFAZER = "mesa-desfazer:";

/** Sem internet (ver lib/offline.ts): fila de mudanças e foto da sala, no
 *  localStorage (+ código da sala) — sobrevivem ao app fechar. */
export const PREFIXO_FILA_OFFLINE = "mesa-fila:";
export const PREFIXO_FOTO_SALA = "mesa-foto:";

/** De quanto em quanto tempo, sem internet, tenta mandar a fila de novo
 *  (além de quando o aparelho avisa que a conexão voltou). */
export const INTERVALO_TENTATIVA_MS = 10_000;

export function novoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
