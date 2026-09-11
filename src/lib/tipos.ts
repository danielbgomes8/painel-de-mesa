/** Tipos do domínio. Os nomes das colunas seguem o banco (snake_case) de
 *  propósito — o que vem do Supabase entra direto, sem tradução no meio. */

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
  exh: number;
  dss: number;
  dsf: number;
  cond: Record<string, boolean>;
  notes: string;
  is_npc: boolean;
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
