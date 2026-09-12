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

/** Munição ou estado de equipamento (ex.: "Flechas" 14/20, "Espada longa"
 *  1/3 pra marcar desgaste) — nunca reseta em descanso, só muda na mão. */
export type ItemEquip = {
  name: string;
  max: number;
  cur: number;
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
  /** Acerto e dano em texto livre ("Garra +5, 2d6+3"). Só consulta; ninguém rola por ninguém. */
  ataque: string;
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
  /** Rodadas restantes por condição ativa; some da lista quando chega a 0. */
  cond_prazo: Record<string, number>;
  /** Percepção passiva e CD de magia — só consulta, ninguém calcula sozinho. */
  pp: number;
  spell_dc: number;
  /** Bônus de resistência de atributo (saves) — idem, só consulta. */
  save_str: number;
  save_dex: number;
  save_con: number;
  save_int: number;
  save_wis: number;
  save_cha: number;
  items: ItemEquip[];
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
  ataque?: string;
  is_npc?: boolean;
  notes?: string;
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
  ataque: string;
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
  ataque?: string;
};

/** Uma linha do log curto de combate (dano/cura, rodadas, entradas na ordem). */
export type LinhaLog = {
  id: string;
  room_code: string;
  text: string;
  created_at: string;
};

/** Uma entrada do diário da campanha — visível pra todo mundo, o Mestre escreve. */
export type EntradaDiario = {
  id: string;
  room_code: string;
  title: string;
  text: string;
  created_at: string;
};

export type NovaEntradaDiario = {
  title: string;
  text: string;
};

/** Estado do Bastião compartilhado (um por sala). */
export type Bastiao = {
  room_code: string;
  turno: number;
  tesouro_po: number;
  defensores: number;
  notes: string;
};

/** Uma instalação do Bastião — básica (só cenário) ou especial (dá ordem). */
export type InstalacaoBastiao = {
  id: string;
  room_code: string;
  name: string;
  categoria: "basica" | "especial";
  tamanho: "Apertado" | "Amplo" | "Vasto";
  nivel_min: number;
  ordem: string;
  contratado: string;
  ativa: boolean;
  /** Turno em que foi marcada "trabalhando" pela última vez (null = não está
   *  trabalhando). Comparar com bastiao.turno decide se é ESTE turno. */
  ultimo_turno_executado: number | null;
  notes: string;
  created_at: string;
};

export type NovaInstalacaoBastiao = {
  name: string;
  categoria: "basica" | "especial";
  tamanho?: "Apertado" | "Amplo" | "Vasto";
  nivel_min?: number;
  ordem?: string;
};

/** Uma linha do log do Bastião (eventos, turnos). */
export type LinhaLogBastiao = {
  id: string;
  room_code: string;
  text: string;
  created_at: string;
};
