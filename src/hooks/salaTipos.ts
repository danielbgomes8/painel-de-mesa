import type { Backup } from "@/lib/backup";
import type { AcaoDesfazivel, MudancaCombate, NovaAcaoDesfazivel } from "@/lib/desfazer";
import type {
  Bastiao,
  Encontro,
  EntradaDiario,
  EstadoCombate,
  InstalacaoBastiao,
  ItemIniciativa,
  LinhaLog,
  LinhaLogBastiao,
  ModeloNpc,
  NovaEntradaDiario,
  NovaInstalacaoBastiao,
  NovoModeloNpc,
  NovoPersonagem,
  Personagem,
} from "@/lib/tipos";

/** A linha de `combat_state` como está no banco (o robô do esquema confere as colunas). */
export type LinhaCombate = {
  room_code: string;
  round: number;
  turn: number;
  order_json: ItemIniciativa[] | null;
  version: number;
  /** Preenchida pelo banco (gatilho da migration 0001); o app não lê. */
  updated_at: string;
};

/** A linha de `bastiao` no banco: o que a tela usa, mais o contador de versão
 *  (que é detalhe de escrita e por isso fica fora do tipo `Bastiao`). */
export type LinhaBastiao = Bastiao & { version: number };

/** A sala inteira lida do banco na hora (não o que está na tela): o log vai
 *  completo, não só as últimas linhas. É o que vira arquivo de backup. */
export type SalaInteira = {
  personagens: Personagem[];
  combate: EstadoCombate;
  notasMestre: string;
  modelosNpc: ModeloNpc[];
  log: LinhaLog[];
  diario: EntradaDiario[];
  bastiao: Bastiao;
  instalacoesBastiao: InstalacaoBastiao[];
  logBastiao: LinhaLogBastiao[];
  encontros: Encontro[];
};

export type Sala = {
  carregando: boolean;
  conectado: boolean;
  erro: string | null;
  /** Aviso curto e não-bloqueante de que a ÚLTIMA escrita falhou (a tela já
   *  reverteu pro valor anterior). Diferente de `erro`, que é fatal e troca a
   *  tela inteira. Fica até a próxima falha ou até `limparAvisoFalha()`. */
  avisoFalha: string | null;
  limparAvisoFalha: () => void;
  /** Sem internet: o combate continua e as mudanças esperam numa fila neste
   *  aparelho (ver lib/offline.ts). */
  semInternet: boolean;
  /** Quantas mudanças esperam conexão pra ir pro banco. */
  esperando: number;
  /** Abriu sem internet: hora da foto guardada que está na tela. null = a
   *  tela veio do banco. */
  fotoDe: string | null;
  personagens: Personagem[];
  combate: EstadoCombate;
  notasMestre: string;
  log: LinhaLog[];
  modelosNpc: ModeloNpc[];
  diario: EntradaDiario[];
  bastiao: Bastiao;
  instalacoesBastiao: InstalacaoBastiao[];
  logBastiao: LinhaLogBastiao[];
  encontros: Encontro[];
  criarPersonagem: (dados: NovoPersonagem) => Promise<Personagem | null>;
  /** Cria várias fichas numa escrita só — ou todas, ou nenhuma. É o que o
   *  "começar encontro" usa: metade dos goblins criada e a outra metade não
   *  deixaria o Mestre caçando quem faltou no meio da luta. null quando falha
   *  (já avisa na tela). */
  criarVariosPersonagens: (dados: NovoPersonagem[]) => Promise<Personagem[] | null>;
  atualizarPersonagem: (id: string, patch: Partial<Personagem>) => Promise<void>;
  /** Escrita das listas da ficha (inventário, magias, moedas) com trava de versão (migration 0032):
   *  `fazer` recebe a ficha como está AGORA e devolve o patch, ou null se o que a pessoa tocou já
   *  não existe mais ("mudou"). Se outro aparelho mexeu nas listas no meio tempo, relê a ficha e
   *  chama `fazer` de novo em cima dela, em vez de gravar por cima. */
  alterarListasDoPersonagem: (
    id: string,
    fazer: (atual: Personagem) => Partial<Personagem> | null,
  ) => Promise<"ok" | "mudou" | "erro">;
  /** Igual a atualizarPersonagem, só que pra vários de uma vez em uma única
   *  escrita (Ações em Massa) — usado quando o patch de cada um pode ter um
   *  formato diferente (ex.: cura zera dss/dsf só de quem estava caído).
   *  Devolve false quando a escrita falha (e já reverteu o estado local) —
   *  quem chama não deve logar o que não aconteceu. */
  atualizarVariosPersonagens: (alvos: { id: string; patch: Partial<Personagem> }[]) => Promise<boolean>;
  removerPersonagem: (id: string) => Promise<void>;
  /** Aceita um patch pronto ou uma função (atual) => patch, resolvida contra o
   *  estado mais recente conhecido — evite montar o patch a partir do
   *  `combate` de fora depois de um `await`, pode já estar velho. Devolve o
   *  estado de antes (o que a escrita que pegou usou de base) e o de depois —
   *  o par que o desfazer precisa. null quando a escrita falha (e já reverteu
   *  o estado local). */
  definirCombate: (
    patch: Partial<EstadoCombate> | ((atual: EstadoCombate) => Partial<EstadoCombate>),
  ) => Promise<MudancaCombate | null>;
  definirNotasMestre: (texto: string) => Promise<void>;
  registrarLog: (texto: string) => Promise<void>;
  /** Igual a registrarLog, várias linhas numa só escrita. */
  registrarVariosLogs: (textos: string[]) => Promise<void>;
  /** Devolve false quando a escrita falha, pra tela não confirmar o que não aconteceu. */
  criarModeloNpc: (dados: NovoModeloNpc) => Promise<boolean>;
  atualizarModeloNpc: (id: string, patch: Partial<ModeloNpc>) => Promise<void>;
  removerModeloNpc: (id: string) => Promise<void>;
  criarEntradaDiario: (dados: NovaEntradaDiario) => Promise<void>;
  atualizarEntradaDiario: (id: string, patch: Partial<EntradaDiario>) => Promise<void>;
  removerEntradaDiario: (id: string) => Promise<void>;
  /** Devolve null quando a escrita falha (e já reverteu o estado local),
   *  pra quem chama não anunciar um avanço que não aconteceu de verdade. */
  definirBastiao: (patch: Partial<Bastiao> | ((atual: Bastiao) => Partial<Bastiao>)) => Promise<Bastiao | null>;
  criarInstalacaoBastiao: (dados: NovaInstalacaoBastiao) => Promise<void>;
  atualizarInstalacaoBastiao: (id: string, patch: Partial<InstalacaoBastiao>) => Promise<void>;
  removerInstalacaoBastiao: (id: string) => Promise<void>;
  registrarLogBastiao: (texto: string) => Promise<void>;
  /** Devolve o encontro criado, ou null quando a escrita falha. */
  criarEncontro: (nome: string) => Promise<Encontro | null>;
  atualizarEncontro: (id: string, patch: Partial<Pick<Encontro, "name" | "grupos" | "eventos">>) => Promise<void>;
  removerEncontro: (id: string) => Promise<void>;
  /** Relê a sala inteira do banco agora (o mesmo que acontece quando o app
   *  volta pra tela). Serve pra quem precisa comparar com o banco de verdade
   *  e não com o que sobrou na memória — o tempo real, por exemplo, não
   *  entrega apagamentos feitos em outro aparelho. */
  recarregarSala: () => void;
  /** A ação mais nova DESTE aparelho que dá pra desfazer (null = nenhuma). */
  desfazivel: AcaoDesfazivel | null;
  /** Guarda uma ação feita agora pra poder desfazer (ver lib/desfazer.ts).
   *  Chamar só depois que a escrita confirmou. Ação que não mudou nada é
   *  ignorada. */
  lembrarDesfazer: (acao: NovaAcaoDesfazivel) => void;
  /** Desfaz a ação mais nova, se nada do que ela mexeu mudou depois. */
  desfazer: () => Promise<ResultadoDesfazer>;
  /** Esvazia a pilha — quem trocou de identidade no aparelho não desfaz o
   *  que a pessoa anterior fez. */
  esquecerDesfazer: () => void;
  /** Lê a sala inteira do banco pro arquivo de backup. null quando falha. */
  exportarSala: () => Promise<SalaInteira | null>;
  /** Apaga o conteúdo da sala e põe o do arquivo no lugar. Devolve a frase do
   *  erro quando não deu — a tela precisa dizer o que aconteceu, não só que
   *  "falhou". */
  restaurarBackup: (backup: Backup) => Promise<{ ok: boolean; erro?: string }>;
};

export type ResultadoDesfazer =
  | { ok: true; rotulo: string }
  | { ok: false; motivo: string };
