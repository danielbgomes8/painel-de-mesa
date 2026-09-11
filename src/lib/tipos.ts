/** Tipos do domínio. Os nomes das colunas seguem o banco (snake_case) de
 *  propósito — o que vem do Supabase entra direto, sem tradução no meio. */

/** Um recurso de classe com usos limitados — Fúria, Pontos de Foco, Surto de
 *  Ação, Canalizar Divindade, espaços de magia (um por nível)... Cada jogador
 *  cadastra o que a própria classe usa; o app não sabe as regras de cada uma. */
export type Recurso = {
  name: string;
  max: number;
  cur: number;
  short_rest: boolean;
};

export type Personagem = {
  id: string;
  room_code: string;
  slug: string;
  name: string;
  cls: string;
  ac: number;
  init_mod: number;
  speed: number;
  hp: number;
  hp_max: number;
  hp_temp: number;
  exh: number;
  dss: number;
  dsf: number;
  cond: Record<string, boolean>;
  notes: string;
  is_npc: boolean;
  /** Só importa pra NPC: enquanto false, jogador vê "Inimigo N" em vez do nome. */
  revealed: boolean;
  inspiration: boolean;
  concentration: boolean;
  concentration_on: string;
  hd_max: number;
  hd_cur: number;
  hd_die: string;
  resources: Recurso[];
  created_at: string;
  updated_at: string;
};

/** Campos que o app cria/edita — o resto o banco preenche. */
export type NovoPersonagem = {
  name: string;
  cls?: string;
  ac?: number;
  init_mod?: number;
  speed?: number;
  hp?: number;
  hp_max?: number;
  is_npc?: boolean;
};

export type ItemIniciativa = {
  slug: string;
  name: string;
  init: number;
};

export type EstadoCombate = {
  round: number;
  turn: number;
  order: ItemIniciativa[];
};

export const COMBATE_VAZIO: EstadoCombate = { round: 1, turn: 0, order: [] };

/** Modelo salvo de NPC/monstro — reaproveitável entre combates e sessões. */
export type ModeloNpc = {
  id: string;
  room_code: string;
  name: string;
  cls: string;
  ac: number;
  hp_max: number;
  speed: number;
  init_mod: number;
  notes: string;
  created_at: string;
};

export type NovoModeloNpc = {
  name: string;
  cls?: string;
  ac?: number;
  hp_max?: number;
  speed?: number;
  init_mod?: number;
  notes?: string;
};

/** Uma linha do log curto de combate (dano/cura, rodadas, entradas na ordem). */
export type LinhaLog = {
  id: string;
  room_code: string;
  text: string;
  created_at: string;
};
