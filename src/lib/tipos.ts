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

/** Uma entrada de uma seção "lista" da ficha completa — uma característica,
 *  uma magia, um item mágico, um trejeito... título + uma tag curta opcional
 *  (nível, custo, raridade) + descrição livre. */
export type ItemSecaoFicha = {
  titulo: string;
  tag?: string;
  descricao: string;
};

/** Uma seção da ficha completa (ver migration 0012) — texto corrido (história)
 *  ou lista de itens (características, magias, itens mágicos, trejeitos...).
 *  Genérico de propósito: o app não sabe nada sobre o que tem dentro, quem
 *  decide a forma é o jogador preenchendo a própria ficha. */
export type SecaoFicha = {
  titulo: string;
  subtitulo?: string;
  tipo: "texto" | "lista";
  texto?: string;
  itens?: ItemSecaoFicha[];
};

/** As cinco moedas do jogo: cobre, prata, electro, ouro e platina. */
export type MoedaId = "pc" | "pp" | "pe" | "po" | "pl";

export type Moedas = Record<MoedaId, number>;

/** Sintonização de um item mágico: 0 = não precisa, 1 = precisa e não está
 *  sintonizado, 2 = sintonizado (limite de três por personagem, ver
 *  LIMITE_SINTONIA em inventario.ts). */
export type Sintonia = 0 | 1 | 2;

/** Um item do inventário do personagem (ver migration 0026). `peso` é em kg,
 *  por unidade. Genérico de propósito, igual `ItemSecaoFicha`: o app soma
 *  peso e conta sintonia, e o resto é texto do jogador. */
export type ItemInventario = {
  nome: string;
  qtd: number;
  peso: number;
  descricao: string;
  magico: boolean;
  raridade: string;
  equipado: boolean;
  sintonia: Sintonia;
};

/** Uma magia na lista do personagem (ver migration 0026). Os campos de
 *  consulta (escola, tempo, alcance...) vêm preenchidos quando a magia é
 *  escolhida do catálogo do SRD, e ficam vazios numa magia cadastrada à mão.
 *  `preparada` não vale pra truque (nível 0), que sempre pode ser conjurado. */
export type MagiaPersonagem = {
  nome: string;
  nivel: number;
  preparada: boolean;
  concentracao: boolean;
  ritual: boolean;
  escola: string;
  tempo: string;
  alcance: string;
  duracao: string;
  componentes: string;
  descricao: string;
};

export type Atributo = "for" | "des" | "con" | "int" | "sab" | "car";

export type Atributos = Record<Atributo, number>;

/** As dezoito perícias do SRD 2024 (conferidas contra a fonte — ver
 *  PERICIAS em regras.ts). Nomeadas em português, chave sem acento. */
export type Pericia =
  | "acrobacia"
  | "arcanismo"
  | "atletismo"
  | "atuacao"
  | "enganacao"
  | "furtividade"
  | "historia"
  | "intimidacao"
  | "intuicao"
  | "investigacao"
  | "lidar_com_animais"
  | "medicina"
  | "natureza"
  | "percepcao"
  | "persuasao"
  | "prestidigitacao"
  | "religiao"
  | "sobrevivencia";

export type NivelProficiencia = "nenhuma" | "proficiente" | "especialista";

export type Proficiencias = {
  saves: Atributo[];
  pericias: Partial<Record<Pericia, NivelProficiencia>>;
};

/** Progressão de espaços de magia: nenhum (Bárbaro, Guerreiro comum...),
 *  terço (Cavaleiro Arcano, Trapaceiro Arcano), meio (Paladino, Patrulheiro),
 *  completo (Bardo, Clérigo, Druida, Feiticeiro, Mago) ou pacto (Bruxo,
 *  tabela própria — ver espacosDeMagia em regras.ts). */
export type TipoConjurador = "nenhum" | "terco" | "meio" | "completo" | "pacto";

/** As doze classes base do SRD 2024 — usada só pra achar as habilidades por
 *  nível no catálogo (ver classesSrd.ts). Não é a mesma coisa que `cls`
 *  (texto livre, pra rótulo); essa aqui alimenta busca, então tem forma fixa. */
export type ClasseBase =
  | "barbaro"
  | "bardo"
  | "bruxo"
  | "clerigo"
  | "druida"
  | "feiticeiro"
  | "guerreiro"
  | "ladino"
  | "mago"
  | "monge"
  | "paladino"
  | "patrulheiro";

/** Campo que um modificador condicional pode afetar — as seis resistências,
 *  CD de magia, ataque de magia ou percepção passiva.
 *  CD e ataque são campos separados de propósito: há habilidade que sobe só
 *  a CD (Feitiçaria Inata) e item que sobe os dois (varinha do mago de
 *  guerra) — quem sobe os dois cadastra duas linhas. */
export type CampoModificavel = Atributo | "cd_magia" | "ataque_magia" | "pp";

/** Uma entrada de classe do personagem — multiclasse é uma lista destas.
 *  `nivel` é só daquela classe (bônus de proficiência usa a soma de todas,
 *  ver nivelTotal em regras.ts); `conjurador`/`atributo_conjuracao` também
 *  são por classe, porque cada classe conjuradora usa o próprio atributo. */
export type ClassePersonagem = {
  classe: ClasseBase;
  nivel: number;
  conjurador: TipoConjurador;
  atributo_conjuracao: Atributo | null;
};

/** Um bônus/penalidade que liga e desliga (ex.: "Feitiçaria Inata: CD +1,
 *  enquanto ativa") — o jogador cadastra quando a habilidade aparece; a
 *  calculadora soma os que estão ativos. Sem regra de classe embutida, igual
 *  Recurso e ItemEquip. */
export type Modificador = {
  nome: string;
  campo: CampoModificavel;
  delta: number;
  ativo: boolean;
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
  /** Vantagem em teste / resistência a dano em texto livre (ex.: "Vantagem
   *  em Testes de Destreza", "Resistência a Fogo") — separado das notas pra
   *  não se perder no meio de lembretes soltos. Só pra personagem de jogador
   *  (ver migration 0011). */
  vantagens_resistencias: string;
  /** Epígrafe curta sob o nome na ficha completa (ex.: uma frase de efeito).
   *  Só pra personagem de jogador (ver migration 0012). */
  ficha_epiteto: string;
  /** Seções da ficha completa — história, características, magias, itens
   *  mágicos, trejeitos... (ver migration 0012). */
  ficha_secoes: SecaoFicha[];
  /** Atributos e proficiências do personagem — base pra calcular
   *  resistência/perícia/CD de magia/espaços (ver migration 0013/0014 e a
   *  calculadora em FichaClasse.tsx). Só pra personagem de jogador, igual
   *  ficha_secoes. */
  atributos: Atributos;
  proficiencias: Proficiencias;
  /** Classes do personagem — uma entrada por classe (multiclasse é lista
   *  com mais de uma). Nível total pro bônus de proficiência é a soma
   *  (ver nivelTotal em regras.ts); cada classe guarda o próprio
   *  conjurador/atributo de conjuração e alimenta o catálogo de
   *  habilidades por classe+nível (ver classesSrd.ts) — independente de
   *  `cls`, que é só rótulo em texto livre. */
  classes: ClassePersonagem[];
  /** Bônus/penalidade que liga e desliga, soma no cálculo quando ativo. */
  modificadores: Modificador[];
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
  /** Percepção passiva e CD de magia — só consulta, ninguém calcula sozinho.
   *  spell_dc é null até o Mestre preencher (ver migration 0009) — não usar
   *  10 como sinal de "vazio", um NPC pode ter CD de magia 10 de verdade. */
  pp: number;
  spell_dc: number | null;
  /** Bônus de resistência de atributo (saves) — idem, só consulta. */
  save_str: number;
  save_dex: number;
  save_con: number;
  save_int: number;
  save_wis: number;
  save_cha: number;
  items: ItemEquip[];
  /** Moedas, inventário e magias do personagem (ver migration 0026). Só pra
   *  personagem de jogador, igual ficha_secoes. */
  moedas: Moedas;
  inventario: ItemInventario[];
  magias: MagiaPersonagem[];
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

/** A ficha de um monstro como ela entra num encontro: cópia, não link (ver
 *  migration 0016) — mexer na biblioteca depois não muda o encontro. */
export type FichaMonstro = {
  name: string;
  cls: string;
  ac: number;
  hp_max: number;
  speed: number;
  init_mod: number;
  ataque: string;
  notes: string;
};

/** Monstros iguais dentro de um encontro: a ficha e quantos entram. */
export type GrupoEncontro = FichaMonstro & { quantidade: number };

/** Grupo inimigo preparado antes da sessão, pronto pra jogar na iniciativa
 *  de uma vez. */
export type Encontro = {
  id: string;
  room_code: string;
  name: string;
  grupos: GrupoEncontro[];
  created_at: string;
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
  /** Ids dos cartões do Quadro que apareceram nesta sessão. */
  cartoes: string[];
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
