"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { desfazerPecas, tirarPecasDasFichas } from "@/lib/pecasNoBanco";
import { slugUnico } from "@/lib/sala";
import { turnoAposRemover } from "@/lib/regras";
import { linhasParaInserir, type Backup } from "@/lib/backup";
import {
  camposConferiveis,
  empilhar,
  mudancaDe,
  lerPilhaGuardada,
  mesmoCombate,
  mudouAlgo,
  podeDesfazer,
  type AcaoDesfazivel,
  type MudancaCombate,
  type NovaAcaoDesfazivel,
} from "@/lib/desfazer";
import {
  combateSemConflito,
  conflitosDePersonagens,
  ehFalhaDeRede,
  enfileirar,
  lerFilaGuardada,
  lerFotoGuardada,
  linhasProvisorias,
  mudancasEsperando,
  type FotoSala,
  type OpOffline,
} from "@/lib/offline";
import {
  COMBATE_VAZIO,
  type Bastiao,
  type Encontro,
  type EntradaDiario,
  type EstadoCombate,
  type InstalacaoBastiao,
  type ItemIniciativa,
  type LinhaLog,
  type LinhaLogBastiao,
  type ModeloNpc,
  type NovaEntradaDiario,
  type NovaInstalacaoBastiao,
  type NovoModeloNpc,
  type NovoPersonagem,
  type Personagem,
} from "@/lib/tipos";

const TAMANHO_LOG = 40;

/** Quantas linhas por página ao ler uma tabela INTEIRA (backup). O PostgREST
 *  corta a resposta num teto próprio, então log de mesa antiga sairia pela
 *  metade sem paginar — e backup pela metade é pior que backup nenhum. */
const PAGINA_EXPORTACAO = 1000;

// Tentativas de uma escrita com versão antes de desistir e avisar (ver
// migrations 0010 e 0015) — mais que suficiente pra qualquer contenção real
// numa mesa de RPG; existe só pra não tentar pra sempre num cenário
// patológico.
const MAX_TENTATIVAS_VERSAO = 5;

const BASTIAO_VAZIO: Bastiao = { room_code: "", turno: 1, tesouro_po: 0, defensores: 0, notes: "" };

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

type ResultadoVersao<L> =
  | { tipo: "gravou"; linha: L }
  | { tipo: "conflito"; linha: L }
  // `causa`: o erro inteiro do banco (com o código), pro relato de erro.
  | { tipo: "erro"; mensagem: string; rede: boolean; causa: unknown };

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
  atualizarEncontro: (id: string, patch: Partial<Pick<Encontro, "name" | "grupos">>) => Promise<void>;
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

/** Lê uma tabela da sala INTEIRA, em páginas, da mais antiga pra mais nova. */
async function lerTudoDaTabela(
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
function pedacos<T>(lista: T[], tamanho: number): T[][] {
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
async function gravarSeVersaoBater<L extends { version: number }>(
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
function linhaDePersonagem(codigo: string, slug: string, dados: NovoPersonagem) {
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
  };
}

/** players primeiro, depois NPCs; dentro de cada grupo, por ordem de criação. */
function ordenar(lista: Personagem[]): Personagem[] {
  return [...lista].sort((a, b) => {
    if (a.is_npc !== b.is_npc) return a.is_npc ? 1 : -1;
    return a.created_at.localeCompare(b.created_at);
  });
}

function comoCombate(linha: LinhaCombate | null): EstadoCombate {
  if (!linha) return COMBATE_VAZIO;
  return {
    round: linha.round ?? 1,
    turn: linha.turn ?? 0,
    order: Array.isArray(linha.order_json) ? linha.order_json : [],
  };
}

const MSG_SEM_CONFIG =
  "Supabase não configurado. Crie o arquivo .env.local com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (veja o README).";

const AVISO_FALHA_ESCRITA = "Não salvou — confira a conexão e tente de novo.";

/** Chave da pilha de desfazer no sessionStorage (+ código da sala). */
const PREFIXO_PILHA_DESFAZER = "mesa-desfazer:";

/** Sem internet (ver lib/offline.ts): fila de mudanças e foto da sala, no
 *  localStorage (+ código da sala) — sobrevivem ao app fechar. */
const PREFIXO_FILA_OFFLINE = "mesa-fila:";
const PREFIXO_FOTO_SALA = "mesa-foto:";

/** De quanto em quanto tempo, sem internet, tenta mandar a fila de novo
 *  (além de quando o aparelho avisa que a conexão voltou). */
const INTERVALO_TENTATIVA_MS = 10_000;

function novoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type ResultadoDesfazer =
  | { ok: true; rotulo: string }
  | { ok: false; motivo: string };

export function useSala(codigo: string): Sala {
  const [carregando, setCarregando] = useState(supabaseConfigurado);
  const [conectado, setConectado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisoFalha, setAvisoFalha] = useState<string | null>(null);
  const limparAvisoFalha = useCallback(() => setAvisoFalha(null), []);
  const [personagens, setPersonagens] = useState<Personagem[]>([]);
  const [combate, setCombate] = useState<EstadoCombate>(COMBATE_VAZIO);
  // Versão da linha de combat_state no banco — não é exibida em lugar nenhum,
  // só serve pro controle de concorrência otimista de definirCombate (ver
  // migration 0010). Fica fora de EstadoCombate de propósito: é detalhe de
  // escrita, não estado de jogo.
  const [combateVersao, setCombateVersao] = useState(0);
  const [notasMestre, setNotasMestre] = useState("");
  const [log, setLog] = useState<LinhaLog[]>([]);
  const [modelosNpc, setModelosNpc] = useState<ModeloNpc[]>([]);
  const [diario, setDiario] = useState<EntradaDiario[]>([]);
  const [bastiao, setBastiao] = useState<Bastiao>(BASTIAO_VAZIO);
  // Mesmo papel do combateVersao acima, pro Bastião (ver migration 0015).
  const [bastiaoVersao, setBastiaoVersao] = useState(0);
  const [instalacoesBastiao, setInstalacoesBastiao] = useState<InstalacaoBastiao[]>([]);
  const [logBastiao, setLogBastiao] = useState<LinhaLogBastiao[]>([]);
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  // Ações deste aparelho que dá pra desfazer, a mais nova primeiro. Fica no
  // sessionStorage da aba (por sala): o celular recarrega a página quando a
  // pessoa troca de app no meio da luta, e o desfazer não pode sumir com isso.
  const chavePilha = `${PREFIXO_PILHA_DESFAZER}${codigo}`;
  const [pilhaDesfazer, setPilhaDesfazer] = useState<AcaoDesfazivel[]>(() => {
    try {
      return lerPilhaGuardada(sessionStorage.getItem(chavePilha));
    } catch {
      return [];
    }
  });
  const pilhaRef = useRef(pilhaDesfazer);
  useEffect(() => {
    pilhaRef.current = pilhaDesfazer;
    try {
      sessionStorage.setItem(chavePilha, JSON.stringify(pilhaDesfazer));
    } catch {
      /* aba privada / storage cheio — o desfazer segue só na memória */
    }
  }, [chavePilha, pilhaDesfazer]);

  // Sem internet (ver lib/offline.ts). A fila tem espelho em ref porque a
  // sincronização anda por ela uma operação por vez, sem esperar render.
  const chaveFila = `${PREFIXO_FILA_OFFLINE}${codigo}`;
  const [fila, setFila] = useState<OpOffline[]>(() => {
    try {
      return lerFilaGuardada(localStorage.getItem(chaveFila));
    } catch {
      return [];
    }
  });
  const filaRef = useRef(fila);
  const [semInternet, setSemInternet] = useState(false);
  const semInternetRef = useRef(false);
  const [fotoDe, setFotoDe] = useState<string | null>(null);
  // Última vez que a tela bateu com o banco — é a hora que vai na foto.
  const ultimaSincroniaRef = useRef<string | null>(null);

  const mudarFila = useCallback(
    (mudar: (atual: OpOffline[]) => OpOffline[]) => {
      const nova = mudar(filaRef.current);
      filaRef.current = nova;
      setFila(nova);
      try {
        localStorage.setItem(chaveFila, JSON.stringify(nova));
      } catch {
        /* storage cheio / bloqueado — a fila segue só na memória */
      }
    },
    [chaveFila],
  );

  const marcarSemInternet = useCallback((sem: boolean) => {
    semInternetRef.current = sem;
    setSemInternet(sem);
  }, []);

  // Ordem em que cada escrita foi FEITA (ver `seq` em lib/offline.ts):
  // pega na hora do toque, antes de esperar a rede.
  const ultimaSeqRef = useRef(0);
  const proximaSeq = useCallback(() => {
    const seq = Math.max(Date.now(), ultimaSeqRef.current + 1);
    ultimaSeqRef.current = seq;
    return seq;
  }, []);

  /** Escrita que não pôde ir pro banco agora: fica na tela e vai pra fila. */
  const guardarNaFila = useCallback(
    (op: Parameters<typeof enfileirar>[1], seq: number) => {
      marcarSemInternet(true);
      mudarFila((atual) => enfileirar(atual, op, novoId(), seq));
    },
    [marcarSemInternet, mudarFila],
  );

  // Espelho síncrono do estado, pra montar patches e reverter uma escrita que
  // falhou sem depender do closure. Atualizado depois do commit (não durante
  // o render).
  const ref = useRef({
    personagens,
    combate,
    combateVersao,
    bastiao,
    bastiaoVersao,
    notasMestre,
    modelosNpc,
    diario,
    instalacoesBastiao,
    encontros,
  });
  useEffect(() => {
    ref.current = {
      personagens,
      combate,
      combateVersao,
      bastiao,
      bastiaoVersao,
      notasMestre,
      modelosNpc,
      diario,
      instalacoesBastiao,
      encontros,
    };
  });

  // Ponte pro `recarregar` que mora dentro do efeito: quem restaura um backup
  // precisa reler a sala inteira depois de trocar o banco.
  const recarregarRef = useRef<() => void>(() => {});

  const sincronizandoRef = useRef<Promise<boolean> | null>(null);
  // Ponte pra `sincronizar` (definida logo abaixo, e que também chama a si
  // mesma por aqui); preenchida por efeito.
  const sincronizarRef = useRef<() => Promise<boolean>>(async () => false);

  /**
   * Manda a fila pro banco, na ordem, uma operação por vez. Cada uma só grava
   * se o banco ainda estiver como ela encontrou (ver lib/offline.ts); a que
   * não puder é deixada de fora, junto com as linhas de log dela, e o aviso
   * diz quem mudou. true = a fila acabou; false = a conexão caiu de novo no
   * meio e o resto espera a próxima tentativa.
   *
   * Não mexe na tela enquanto anda: ela já mostra o resultado da fila
   * inteira, e um estado do meio do caminho confundiria quem continua
   * jogando. Quem chama relê a sala quando acaba.
   */
  const sincronizar = useCallback((): Promise<boolean> => {
    // Já tem uma tentativa andando: espera ela. Se ela falhar, tenta de novo
    // uma vez — ela pode ter começado ainda sem internet (pelo relógio) e
    // quem chama agora sabe que a conexão acabou de voltar.
    const andando = sincronizandoRef.current;
    if (andando) return andando.then((acabou) => acabou || sincronizarRef.current());

    type Resultado = "ok" | "sem-internet" | { naoForam: string[] };

    async function gravar(op: OpOffline): Promise<Resultado> {
      if (op.tipo === "personagens") {
        if (op.mudancas.length === 0) return "ok";
        const lidos = await supabase
          .from("characters")
          .select("*")
          .in(
            "id",
            op.mudancas.map((m) => m.id),
          );
        if (lidos.error) return ehFalhaDeRede(lidos.error) ? "sem-internet" : { naoForam: op.mudancas.map((m) => m.nome) };
        const conflitos = conflitosDePersonagens(op.mudancas, (lidos.data ?? []) as Personagem[]);
        if (conflitos.length > 0) return { naoForam: conflitos };
        for (const m of op.mudancas) {
          let consulta = supabase.from("characters").update(m.depois).eq("id", m.id);
          for (const [coluna, valor] of camposConferiveis(m.antes)) consulta = consulta.eq(coluna, valor);
          const { data, error } = await consulta.select("id");
          if (error) return ehFalhaDeRede(error) ? "sem-internet" : { naoForam: [m.nome] };
          if (!data || data.length === 0) return { naoForam: [m.nome] };
          // Já foi: sai da operação, pra uma queda logo depois não fazer ela
          // parecer conflito na próxima tentativa.
          mudarFila((atual) =>
            atual.map((o) =>
              o.id === op.id && o.tipo === "personagens"
                ? { ...o, mudancas: o.mudancas.filter((x) => x.id !== m.id) }
                : o,
            ),
          );
        }
        return "ok";
      }

      if (op.tipo === "combate") {
        const ordem = "a ordem de iniciativa";
        for (let tentativa = 0; tentativa < MAX_TENTATIVAS_VERSAO; tentativa++) {
          const lida = await supabase.from("combat_state").select("*").eq("room_code", codigo).maybeSingle();
          if (lida.error) return ehFalhaDeRede(lida.error) ? "sem-internet" : { naoForam: [ordem] };
          const linha = lida.data as LinhaCombate | null;
          if (!linha || !combateSemConflito(op, comoCombate(linha))) return { naoForam: [ordem] };
          const r = await gravarSeVersaoBater<LinhaCombate>("combat_state", codigo, linha.version, {
            round: op.depois.round,
            turn: op.depois.turn,
            order_json: op.depois.order,
          });
          if (r.tipo === "gravou") return "ok";
          if (r.tipo === "erro") return r.rede ? "sem-internet" : { naoForam: [ordem] };
          // conflito: alguém gravou entre a leitura e a escrita — confere de novo
        }
        return { naoForam: [ordem] };
      }

      // Log: uma linha por vez, na ordem — linhas da mesma escrita sairiam
      // com o mesmo horário e o log não saberia qual veio antes.
      for (const text of op.textos) {
        const { error } = await supabase.from("combat_log").insert({ room_code: codigo, text });
        if (error) return ehFalhaDeRede(error) ? "sem-internet" : "ok"; // log recusado: segue sem ele
        mudarFila((atual) =>
          atual.map((o) => (o.id === op.id && o.tipo === "log" ? { ...o, textos: o.textos.slice(1) } : o)),
        );
      }
      return "ok";
    }

    const tarefa = (async (): Promise<boolean> => {
      const naoForam: string[] = [];
      try {
        while (filaRef.current.length > 0) {
          const op = filaRef.current[0];
          const r = await gravar(op);
          if (r === "sem-internet") return false;
          if (r === "ok") {
            mudarFila((atual) =>
              atual
                .filter((o) => o.id !== op.id)
                .map((o) => (o.tipo === "log" && o.dependeDe === op.id ? { ...o, dependeDe: null } : o)),
            );
          } else {
            naoForam.push(...r.naoForam);
            // A linha de log que contava essa mudança também fica de fora.
            mudarFila((atual) => atual.filter((o) => o.id !== op.id && !(o.tipo === "log" && o.dependeDe === op.id)));
          }
        }
      } catch (e) {
        relatarErro("sincronizar fila", e);
        return false;
      }
      marcarSemInternet(false);
      setFotoDe(null);
      if (naoForam.length > 0) {
        setAvisoFalha(
          `A internet voltou, mas isto ficou de fora porque mudou em outro aparelho enquanto este estava sem conexão: ${[
            ...new Set(naoForam),
          ].join(", ")}. Confira e refaça se precisar.`,
        );
      }
      return true;
    })();
    sincronizandoRef.current = tarefa;
    tarefa.finally(() => {
      sincronizandoRef.current = null;
    });
    return tarefa;
  }, [codigo, marcarSemInternet, mudarFila]);

  // O efeito principal chama por aqui (ele não depende de `sincronizar`).
  useEffect(() => {
    sincronizarRef.current = sincronizar;
  }, [sincronizar]);

  useEffect(() => {
    if (!supabaseConfigurado) return;

    // Sem reset manual de estado aqui: o componente que chama useSala(codigo)
    // usa `key={codigo}`, então uma troca de sala remonta do zero.
    let vivo = true;
    // Controle da recarga (ver `carregar`), tudo local a este efeito.
    let carregada = false;
    let recarregarQuandoCarregar = false;
    let ultimaCarga = 0;
    let eventosRecebidos = 0;

    /** Abriu sem internet: mostra a última foto da sala guardada neste
     *  aparelho. Sem foto, não há o que mostrar. */
    function usarFoto() {
      let foto: FotoSala | null = null;
      try {
        foto = lerFotoGuardada(localStorage.getItem(`${PREFIXO_FOTO_SALA}${codigo}`));
      } catch {
        foto = null;
      }
      if (!foto) {
        setErro("Sem internet, e este aparelho ainda não tinha aberto esta sala. Tente de novo quando a conexão voltar.");
        setCarregando(false);
        return;
      }
      const lista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
      setPersonagens(ordenar(foto.personagens));
      setCombate(foto.combate);
      setCombateVersao(foto.combateVersao);
      setNotasMestre(typeof foto.notasMestre === "string" ? foto.notasMestre : "");
      setLog(lista<LinhaLog>(foto.log));
      setModelosNpc(lista<ModeloNpc>(foto.modelosNpc));
      setDiario(lista<EntradaDiario>(foto.diario));
      if (foto.bastiao && typeof foto.bastiao === "object") setBastiao(foto.bastiao as Bastiao);
      setBastiaoVersao(Number(foto.bastiaoVersao) || 0);
      setInstalacoesBastiao(lista<InstalacaoBastiao>(foto.instalacoesBastiao));
      setLogBastiao(lista<LinhaLogBastiao>(foto.logBastiao));
      setEncontros(lista<Encontro>(foto.encontros));
      ultimaSincroniaRef.current = foto.quando;
      setFotoDe(foto.quando);
      marcarSemInternet(true);
      setCarregando(false);
      carregada = true;
    }

    async function iniciar() {
      // Garante que a sala existe (deixa qualquer ?sala=novo-codigo funcionar).
      // Sem checar erro aqui, uma falha passava batido e todo update/insert
      // seguinte pra essa sala virava um "sucesso" de 0 linhas afetadas —
      // o painel resetava pro padrão a cada recarregamento sem avisar nada.
      const preparo = await supabase
        .from("rooms")
        .upsert({ code: codigo }, { onConflict: "code", ignoreDuplicates: true });
      if (!vivo) return;
      if (preparo.error && ehFalhaDeRede(preparo.error)) return usarFoto();
      if (preparo.error) {
        setErro(`Não consegui preparar a sala: ${preparo.error.message}`);
        setCarregando(false);
        return;
      }

      const dependentes = await Promise.all([
        supabase
          .from("combat_state")
          .upsert({ room_code: codigo }, { onConflict: "room_code", ignoreDuplicates: true }),
        supabase
          .from("dm_notes")
          .upsert({ room_code: codigo }, { onConflict: "room_code", ignoreDuplicates: true }),
        supabase
          .from("bastiao")
          .upsert({ room_code: codigo }, { onConflict: "room_code", ignoreDuplicates: true }),
      ]);
      if (!vivo) return;
      const falhaDependente = dependentes.find((r) => r.error);
      if (falhaDependente?.error && ehFalhaDeRede(falhaDependente.error)) return usarFoto();
      if (falhaDependente?.error) {
        setErro(`Não consegui preparar a sala: ${falhaDependente.error.message}`);
        setCarregando(false);
        return;
      }

      // Sobrou fila de uma sessão sem internet (o app fechou antes de a
      // conexão voltar): vai pro banco antes de ler, senão a leitura apagaria
      // da tela o que ainda não foi. Se cair de novo, fica na foto.
      if (filaRef.current.length > 0 && !(await sincronizarRef.current())) {
        if (vivo) usarFoto();
        return;
      }
      if (!vivo) return;
      await carregar(true);
    }

    /** Lê a sala inteira do banco e troca o estado da tela por ela.
     *
     *  Roda na abertura e de novo toda vez que a tela pode ter perdido algo:
     *  quando o canal de tempo real (re)conecta e quando a pessoa volta pro
     *  app. O tempo real só entrega o que muda ENQUANTO está conectado — sem
     *  isso, o celular que apagou a tela e voltou ficava sem o turno que
     *  passou e o PV que caiu, mostrando "sincronizado" mesmo assim.
     *
     *  Dois cuidados de corrida:
     *  - duas cargas cruzadas (reconexão e volta pro app juntas): só a mais
     *    recente escreve, senão a mais lenta botava dado velho por cima;
     *  - evento de tempo real chegando no meio da carga: a foto do banco pode
     *    ser anterior a ele e apagaria o que ele acabou de mostrar na tela.
     *    Então lê de novo — até 3 vezes; na última aplica mesmo assim, pra
     *    uma mesa muito agitada não deixar a tela presa em "carregando". */
    async function carregar(inicial: boolean, tentativa = 1): Promise<void> {
      const estaCarga = ++ultimaCarga;
      const eventosAntes = eventosRecebidos;

      const resultados = await Promise.all([
        supabase.from("characters").select("*").eq("room_code", codigo),
        supabase.from("combat_state").select("*").eq("room_code", codigo).maybeSingle(),
        supabase.from("dm_notes").select("*").eq("room_code", codigo).maybeSingle(),
        supabase
          .from("combat_log")
          .select("*")
          .eq("room_code", codigo)
          .order("created_at", { ascending: false })
          .limit(TAMANHO_LOG),
        supabase.from("npc_templates").select("*").eq("room_code", codigo),
        supabase
          .from("diario")
          .select("*")
          .eq("room_code", codigo)
          .order("created_at", { ascending: false }),
        supabase.from("bastiao").select("*").eq("room_code", codigo).maybeSingle(),
        supabase.from("bastiao_instalacoes").select("*").eq("room_code", codigo),
        supabase
          .from("bastiao_log")
          .select("*")
          .eq("room_code", codigo)
          .order("created_at", { ascending: false })
          .limit(TAMANHO_LOG),
        supabase.from("encontros").select("*").eq("room_code", codigo).order("created_at", { ascending: true }),
      ]);

      if (!vivo || estaCarga !== ultimaCarga) return;
      if (eventosRecebidos !== eventosAntes && tentativa < 3) {
        return carregar(inicial, tentativa + 1);
      }

      const [pc, cs, dn, lg, mn, di, ba, bi, bl, en] = resultados;

      if (inicial) {
        if (pc.error && ehFalhaDeRede(pc.error)) return usarFoto();
        if (pc.error) {
          relatarErro("carregar sala", pc.error);
          setErro(`Não consegui carregar a sala: ${pc.error.message}`);
          setCarregando(false);
          return;
        }
      } else {
        // Recarga que falhou não troca a tela inteira pelo erro nem apaga
        // lista nenhuma: fica o que já estava, e a próxima reconexão ou volta
        // pro app tenta de novo.
        const falha = resultados.find((r) => r.error);
        if (falha?.error) {
          relatarErro("recarregar sala", falha.error);
          if (ehFalhaDeRede(falha.error)) marcarSemInternet(true);
          return;
        }
      }

      setPersonagens(ordenar((pc.data ?? []) as Personagem[]));
      setCombate(comoCombate((cs.data ?? null) as LinhaCombate | null));
      setCombateVersao((cs.data as LinhaCombate | null)?.version ?? 0);
      setNotasMestre((dn.data?.text ?? "") as string);
      setLog((lg.data ?? []) as LinhaLog[]);
      setModelosNpc((mn.data ?? []) as ModeloNpc[]);
      setDiario((di.data ?? []) as EntradaDiario[]);
      setBastiao((ba.data ?? { ...BASTIAO_VAZIO, room_code: codigo }) as Bastiao);
      setBastiaoVersao((ba.data as LinhaBastiao | null)?.version ?? 0);
      setInstalacoesBastiao((bi.data ?? []) as InstalacaoBastiao[]);
      setLogBastiao((bl.data ?? []) as LinhaLogBastiao[]);
      setEncontros((en.data ?? []) as Encontro[]);
      setCarregando(false);
      ultimaSincroniaRef.current = new Date().toISOString();
      // Releu o banco e não tem nada esperando: a conexão voltou.
      if (semInternetRef.current && filaRef.current.length === 0) {
        marcarSemInternet(false);
        setFotoDe(null);
      }

      carregada = true;
      if (recarregarQuandoCarregar) {
        recarregarQuandoCarregar = false;
        recarregar();
      }
    }

    function recarregar() {
      // Canal que conectou antes da primeira carga terminar: as leituras dela
      // podem ter saído antes da conexão, então relê logo depois.
      if (!carregada) {
        recarregarQuandoCarregar = true;
        return;
      }
      // Mudanças feitas sem internet vão pro banco antes de reler — senão a
      // releitura apagaria da tela o que ainda não foi.
      if (filaRef.current.length > 0) {
        sincronizarRef
          .current()
          .then((acabou) => {
            if (acabou && vivo) return carregar(false);
          })
          .catch((e) => relatarErro("recarregar sala", e));
        return;
      }
      carregar(false).catch((e) => relatarErro("recarregar sala", e));
    }

    recarregarRef.current = recarregar;

    function aoVoltarPraTela() {
      if (document.visibilityState === "visible") recarregar();
    }
    document.addEventListener("visibilitychange", aoVoltarPraTela);

    // Sem internet: tenta de novo quando o aparelho avisa que a conexão
    // voltou e, por garantia, a cada 10 segundos (wi-fi "conectado" mas sem
    // internet não dispara o aviso).
    function aoVoltarInternet() {
      if (semInternetRef.current) recarregar();
    }
    window.addEventListener("online", aoVoltarInternet);
    const relogio = window.setInterval(() => {
      if (semInternetRef.current && navigator.onLine !== false) recarregar();
    }, INTERVALO_TENTATIVA_MS);

    iniciar().catch((e) => {
      if (!vivo) return;
      setErro(`Falha ao iniciar: ${e instanceof Error ? e.message : String(e)}`);
      setCarregando(false);
    });

    const filtro = `room_code=eq.${codigo}`;
    const canal = supabase
      .channel(`sala:${codigo}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "characters", filter: filtro },
        (msg) => {
          eventosRecebidos++;
          setPersonagens((atual) => {
            if (msg.eventType === "DELETE") {
              const id = (msg.old as { id?: string }).id;
              return atual.filter((p) => p.id !== id);
            }
            const novo = msg.new as Personagem;
            const semEle = atual.filter((p) => p.id !== novo.id);
            return ordenar([...semEle, novo]);
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "combat_state", filter: filtro },
        (msg) => {
          eventosRecebidos++;
          if (msg.eventType === "DELETE") return;
          const linha = msg.new as LinhaCombate;
          setCombate(comoCombate(linha));
          setCombateVersao(linha.version ?? 0);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_notes", filter: filtro },
        (msg) => {
          eventosRecebidos++;
          if (msg.eventType === "DELETE") return;
          setNotasMestre(((msg.new as { text?: string }).text ?? "") as string);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "combat_log", filter: filtro },
        (msg) => {
          eventosRecebidos++;
          const nova = msg.new as LinhaLog;
          setLog((atual) =>
            atual.some((l) => l.id === nova.id) ? atual : [nova, ...atual].slice(0, TAMANHO_LOG),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "npc_templates", filter: filtro },
        (msg) => {
          eventosRecebidos++;
          setModelosNpc((atual) => {
            if (msg.eventType === "DELETE") {
              const id = (msg.old as { id?: string }).id;
              return atual.filter((m) => m.id !== id);
            }
            const novo = msg.new as ModeloNpc;
            const semEle = atual.filter((m) => m.id !== novo.id);
            return [...semEle, novo];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "diario", filter: filtro },
        (msg) => {
          eventosRecebidos++;
          setDiario((atual) => {
            if (msg.eventType === "DELETE") {
              const id = (msg.old as { id?: string }).id;
              return atual.filter((e) => e.id !== id);
            }
            const nova = msg.new as EntradaDiario;
            const semEla = atual.filter((e) => e.id !== nova.id);
            return [nova, ...semEla].sort((a, b) => b.created_at.localeCompare(a.created_at));
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bastiao", filter: filtro },
        (msg) => {
          eventosRecebidos++;
          if (msg.eventType === "DELETE") return;
          const linha = msg.new as LinhaBastiao;
          setBastiao(linha);
          setBastiaoVersao(linha.version ?? 0);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bastiao_instalacoes", filter: filtro },
        (msg) => {
          eventosRecebidos++;
          setInstalacoesBastiao((atual) => {
            if (msg.eventType === "DELETE") {
              const id = (msg.old as { id?: string }).id;
              return atual.filter((i) => i.id !== id);
            }
            const nova = msg.new as InstalacaoBastiao;
            const semEla = atual.filter((i) => i.id !== nova.id);
            return [...semEla, nova];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "encontros", filter: filtro },
        (msg) => {
          eventosRecebidos++;
          setEncontros((atual) => {
            if (msg.eventType === "DELETE") {
              const id = (msg.old as { id?: string }).id;
              return atual.filter((e) => e.id !== id);
            }
            const novo = msg.new as Encontro;
            // Mantém a posição de quem já estava: um encontro editado não pode
            // pular pro fim da lista a cada toque no "+".
            return atual.some((e) => e.id === novo.id)
              ? atual.map((e) => (e.id === novo.id ? novo : e))
              : [...atual, novo];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bastiao_log", filter: filtro },
        (msg) => {
          eventosRecebidos++;
          const nova = msg.new as LinhaLogBastiao;
          setLogBastiao((atual) =>
            atual.some((l) => l.id === nova.id) ? atual : [nova, ...atual].slice(0, TAMANHO_LOG),
          );
        },
      )
      .subscribe((status) => {
        if (!vivo) return;
        setConectado(status === "SUBSCRIBED");
        // Chamado de novo a cada reconexão (o canal refaz a inscrição
        // sozinho), não só na primeira — é quando dá pra recuperar o que
        // mudou enquanto estava desconectado.
        if (status === "SUBSCRIBED") recarregar();
      });

    return () => {
      vivo = false;
      recarregarRef.current = () => {};
      document.removeEventListener("visibilitychange", aoVoltarPraTela);
      window.removeEventListener("online", aoVoltarInternet);
      window.clearInterval(relogio);
      supabase.removeChannel(canal);
    };
  }, [codigo, marcarSemInternet]);

  // Foto da sala no aparelho, pra abrir sem internet. Espera a tela assentar
  // (1 s) em vez de gravar a cada toque.
  useEffect(() => {
    if (!supabaseConfigurado || carregando || erro) return;
    const t = window.setTimeout(() => {
      const foto = {
        quando: ultimaSincroniaRef.current ?? new Date().toISOString(),
        personagens,
        combate,
        combateVersao,
        notasMestre,
        log,
        modelosNpc,
        diario,
        bastiao,
        bastiaoVersao,
        instalacoesBastiao,
        logBastiao,
        encontros,
      };
      try {
        localStorage.setItem(`${PREFIXO_FOTO_SALA}${codigo}`, JSON.stringify(foto));
      } catch {
        /* storage cheio / bloqueado — segue sem foto */
      }
    }, 1000);
    return () => window.clearTimeout(t);
  }, [
    codigo,
    carregando,
    erro,
    personagens,
    combate,
    combateVersao,
    notasMestre,
    log,
    modelosNpc,
    diario,
    bastiao,
    bastiaoVersao,
    instalacoesBastiao,
    logBastiao,
    encontros,
  ]);

  const atualizarPersonagem = useCallback(
    async (id: string, patch: Partial<Personagem>) => {
      const seq = proximaSeq();
      const anterior = ref.current.personagens;
      const alvo = anterior.find((p) => p.id === id);
      // Espelho já com a mudança: duas escritas seguidas sem internet (antes
      // do próximo render) precisam partir uma da outra.
      ref.current = { ...ref.current, personagens: anterior.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
      setPersonagens((atual) => atual.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      if (semInternetRef.current) {
        if (alvo) guardarNaFila({ tipo: "personagens", mudancas: [mudancaDe(alvo, patch)] }, seq);
        return;
      }
      const { error } = await supabase.from("characters").update(patch).eq("id", id);
      if (error && ehFalhaDeRede(error) && alvo) {
        guardarNaFila({ tipo: "personagens", mudancas: [mudancaDe(alvo, patch)] }, seq);
        return;
      }
      if (error) {
        relatarErro("atualizarPersonagem", error);
        setPersonagens(anterior);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
      }
    },
    [guardarNaFila, proximaSeq],
  );

  const atualizarVariosPersonagens = useCallback(
    async (alvos: { id: string; patch: Partial<Personagem> }[]): Promise<boolean> => {
      if (alvos.length === 0) return true;
      const seq = proximaSeq();
      const anterior = ref.current.personagens;
      // Uma mudança por alvo, na mesma ordem de `alvos` (null = ficha que
      // não está na tela) — é o que vai pra fila se faltar internet.
      const mudancas = alvos.map(({ id, patch }) => {
        const p = anterior.find((x) => x.id === id);
        return p ? mudancaDe(p, patch) : null;
      });
      ref.current = {
        ...ref.current,
        personagens: anterior.map((p) => {
          const alvo = alvos.find((a) => a.id === p.id);
          return alvo ? { ...p, ...alvo.patch } : p;
        }),
      };
      setPersonagens((atual) =>
        atual.map((p) => {
          const alvo = alvos.find((a) => a.id === p.id);
          return alvo ? { ...p, ...alvo.patch } : p;
        }),
      );
      // Uma escrita por personagem, todas em paralelo, mandando SÓ as colunas
      // do patch. Já foi `upsert` em lote (uma requisição só), mas upsert
      // manda a LINHA INTEIRA — e a linha inteira vinha da cópia que este
      // aparelho tinha na memória. Resultado testado contra o banco: uma nota
      // gravada de outro celular 100ms antes voltava a ficar vazia quando o
      // Mestre aplicava dano em massa. Como isto aqui também serve o − e as
      // condições da ficha, era o caminho da maioria das escritas do app.
      // (Upsert parcial não resolve: o Postgres cobra as colunas "not null"
      // — room_code, name... — mesmo em quem já existe.)
      const naFila = (lista: (typeof mudancas)[number][]) =>
        guardarNaFila({ tipo: "personagens", mudancas: lista.filter((m) => m !== null) }, seq);
      if (semInternetRef.current) {
        naFila(mudancas);
        return true;
      }
      const respostas = await Promise.all(
        alvos.map(({ id, patch }) => supabase.from("characters").update(patch).eq("id", id)),
      );
      // Sem internet no meio: o que não foi fica na tela e vai pra fila.
      const erros = respostas.map((r) => r.error);
      if (erros.some((e) => e) && erros.every((e) => !e || ehFalhaDeRede(e))) {
        naFila(mudancas.filter((_, i) => erros[i]));
        return true;
      }
      const erro = erros.find((e) => e);
      if (erro) {
        relatarErro("atualizarVariosPersonagens", erro);
        // Volta ao estado de antes; quem gravou de verdade no meio do lote é
        // reposto pelo evento de tempo real da própria escrita.
        setPersonagens(anterior);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
        return false;
      }
      return true;
    },
    [guardarNaFila, proximaSeq],
  );

  const criarPersonagem = useCallback(
    async (dados: NovoPersonagem): Promise<Personagem | null> => {
      const existentes = ref.current.personagens.map((p) => p.slug);
      const linha = linhaDePersonagem(codigo, slugUnico(dados.name, existentes), dados);

      let resp = await supabase.from("characters").insert(linha).select().single();

      // Corrida: duas pessoas entrando ao mesmo tempo com nomes parecidos.
      // Casa por is_npc também: sem isso, criar um NPC de combate com o mesmo
      // nome de um jogador de verdade (ex.: "Guarda") devolvia a ficha do
      // jogador como se fosse o monstro criado.
      if (resp.error?.code === "23505") {
        const { data } = await supabase.from("characters").select("*").eq("room_code", codigo);
        const jaExiste = (data ?? []).find(
          (p) => p.name.toLowerCase() === dados.name.toLowerCase() && p.is_npc === (dados.is_npc ?? false),
        ) as Personagem | undefined;
        if (jaExiste) return jaExiste;
        linha.slug = slugUnico(dados.name + "-" + Date.now().toString(36), (data ?? []).map((p) => p.slug));
        resp = await supabase.from("characters").insert(linha).select().single();
      }

      if (resp.error) {
        relatarErro("criarPersonagem", resp.error);
        setErro(`Não consegui criar o personagem: ${resp.error.message}`);
        return null;
      }

      const criado = resp.data as Personagem;
      setPersonagens((atual) =>
        atual.some((p) => p.id === criado.id) ? atual : ordenar([...atual, criado]),
      );
      return criado;
    },
    [codigo],
  );

  const criarVariosPersonagens = useCallback(
    async (dados: NovoPersonagem[]): Promise<Personagem[] | null> => {
      if (dados.length === 0) return [];
      // Slug único dentro do lote também: sem somar os do próprio lote,
      // "Goblin 1" e "goblin 1" do mesmo encontro dariam o mesmo slug.
      const montar = (existentes: string[]) => {
        const usados = [...existentes];
        return dados.map((d) => {
          const slug = slugUnico(d.name, usados);
          usados.push(slug);
          return linhaDePersonagem(codigo, slug, d);
        });
      };

      // Um insert só com todas as linhas: o Postgres grava tudo ou nada.
      let resp = await supabase
        .from("characters")
        .insert(montar(ref.current.personagens.map((p) => p.slug)))
        .select();

      // Slug repetido = outro aparelho criou alguém com o mesmo nome entre a
      // leitura e esta escrita. Relê os slugs de verdade e tenta mais uma vez.
      if (resp.error?.code === "23505") {
        const { data } = await supabase.from("characters").select("slug").eq("room_code", codigo);
        resp = await supabase
          .from("characters")
          .insert(montar((data ?? []).map((p) => p.slug as string)))
          .select();
      }

      if (resp.error) {
        relatarErro("criarVariosPersonagens", resp.error);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
        return null;
      }

      const criados = (resp.data ?? []) as Personagem[];
      setPersonagens((atual) =>
        ordenar([...atual.filter((p) => !criados.some((c) => c.id === p.id)), ...criados]),
      );
      return criados;
    },
    [codigo],
  );

  const definirCombate = useCallback(
    async (
      patch: Partial<EstadoCombate> | ((atual: EstadoCombate) => Partial<EstadoCombate>),
    ): Promise<MudancaCombate | null> => {
      const seq = proximaSeq();
      const original = ref.current.combate;
      const versaoOriginal = ref.current.combateVersao;
      let anterior = original;
      let versao = versaoOriginal;

      if (semInternetRef.current) {
        const parcial = typeof patch === "function" ? patch(original) : patch;
        const depois = { ...original, ...parcial };
        ref.current = { ...ref.current, combate: depois };
        setCombate(depois);
        guardarNaFila({ tipo: "combate", antes: original, depois }, seq);
        return { antes: original, depois };
      }

      // Resolver contra ref.current (em vez do `combate` de closure, que pode
      // já estar velho depois de um await) encurta a janela da corrida, mas
      // não fecha: dois clientes podem estar com o request em voo ao mesmo
      // tempo, cada um sem saber do outro. A trava de verdade é o UPDATE só
      // pegar se `version` ainda for a que este cliente leu — ver
      // gravarSeVersaoBater e a migration 0010. Conflito não perde escrita:
      // refaz o patch em cima do estado de verdade e tenta de novo.
      for (let tentativa = 0; tentativa < MAX_TENTATIVAS_VERSAO; tentativa++) {
        const parcial = typeof patch === "function" ? patch(anterior) : patch;
        const proximo = { ...anterior, ...parcial };
        setCombate(proximo);

        const r = await gravarSeVersaoBater<LinhaCombate>("combat_state", codigo, versao, {
          round: proximo.round,
          turn: proximo.turn,
          order_json: proximo.order,
        });

        if (r.tipo === "erro" && r.rede) {
          // Sem internet no meio: a mudança fica na tela e vai pra fila.
          ref.current = { ...ref.current, combate: proximo };
          guardarNaFila({ tipo: "combate", antes: anterior, depois: proximo }, seq);
          return { antes: anterior, depois: proximo };
        }

        if (r.tipo === "erro") {
          relatarErro("definirCombate", r.causa);
          setCombate(original);
          setCombateVersao(versaoOriginal);
          setAvisoFalha(AVISO_FALHA_ESCRITA);
          return null;
        }

        if (r.tipo === "gravou") {
          const atualizado = comoCombate(r.linha);
          setCombate(atualizado);
          setCombateVersao(r.linha.version);
          return { antes: anterior, depois: atualizado };
        }

        anterior = comoCombate(r.linha);
        versao = r.linha.version;
        setCombate(anterior);
        setCombateVersao(versao);
      }

      relatarErro("definirCombate", `contenção demais: desisti depois de ${MAX_TENTATIVAS_VERSAO} tentativas`);
      setAvisoFalha(AVISO_FALHA_ESCRITA);
      return null;
    },
    [codigo, guardarNaFila, proximaSeq],
  );

  const removerPersonagem = useCallback(
    async (id: string) => {
      const anterior = ref.current.personagens;
      const removido = anterior.find((p) => p.id === id);
      setPersonagens((atual) => atual.filter((p) => p.id !== id));
      const { error } = await supabase.from("characters").delete().eq("id", id);
      if (error) {
        relatarErro("removerPersonagem", error);
        setPersonagens(anterior);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
        return;
      }
      // O peão dela sai de todos os mapas: sem a ficha, ele virava um "?"
      // cinza sem dono, parado lá até o Mestre tirar na mão.
      if (removido) void tirarPecasDasFichas(codigo, [removido.slug], null);
      // Se estava na ordem de iniciativa, tira o slot dali também — senão
      // fica um slug órfão apontando pra ninguém, e a numeração dos NPCs
      // seguintes na ordem desloca (numerarNpcsNaOrdem não acha mais o
      // is_npc de quem sumiu).
      if (removido && ref.current.combate.order.some((o) => o.slug === removido.slug)) {
        await definirCombate((atual) => {
          const i = atual.order.findIndex((o) => o.slug === removido.slug);
          if (i === -1) return {};
          const ordem = atual.order.filter((_, idx) => idx !== i);
          return { order: ordem, turn: turnoAposRemover(atual.turn, i, ordem.length) };
        });
      }
    },
    [codigo, definirCombate],
  );

  const definirNotasMestre = useCallback(
    async (texto: string) => {
      const anterior = ref.current.notasMestre;
      setNotasMestre(texto);
      const { error } = await supabase
        .from("dm_notes")
        .update({ text: texto })
        .eq("room_code", codigo);
      if (error) {
        relatarErro("definirNotasMestre", error);
        setNotasMestre(anterior);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
      }
    },
    [codigo],
  );

  const registrarLog = useCallback(
    async (texto: string) => {
      const seq = proximaSeq();
      const naFila = () => guardarNaFila({ tipo: "log", textos: [texto], quando: new Date().toISOString() }, seq);
      if (semInternetRef.current) return naFila();
      const { data, error } = await supabase
        .from("combat_log")
        .insert({ room_code: codigo, text: texto })
        .select()
        .single();
      if (error && ehFalhaDeRede(error)) return naFila();
      if (error) {
        relatarErro("registrarLog", error);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
        return;
      }
      const nova = data as LinhaLog;
      setLog((atual) => (atual.some((l) => l.id === nova.id) ? atual : [nova, ...atual].slice(0, TAMANHO_LOG)));
    },
    [codigo, guardarNaFila, proximaSeq],
  );

  const registrarVariosLogs = useCallback(
    async (textos: string[]) => {
      if (textos.length === 0) return;
      const seq = proximaSeq();
      const naFila = () => guardarNaFila({ tipo: "log", textos, quando: new Date().toISOString() }, seq);
      if (semInternetRef.current) return naFila();
      const { data, error } = await supabase
        .from("combat_log")
        .insert(textos.map((text) => ({ room_code: codigo, text })))
        .select();
      if (error && ehFalhaDeRede(error)) return naFila();
      if (error) {
        relatarErro("registrarVariosLogs", error);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
        return;
      }
      const novas = (data ?? []) as LinhaLog[];
      // Mesma ordem visual de quem chamasse registrarLog um por um: o
      // último texto do lote fica no topo.
      setLog((atual) => {
        const semElas = atual.filter((l) => !novas.some((n) => n.id === l.id));
        return [...novas].reverse().concat(semElas).slice(0, TAMANHO_LOG);
      });
    },
    [codigo, guardarNaFila, proximaSeq],
  );

  const criarModeloNpc = useCallback(
    async (dados: NovoModeloNpc) => {
      const linha = {
        room_code: codigo,
        name: dados.name,
        cls: dados.cls ?? "",
        ac: dados.ac ?? 12,
        hp_max: dados.hp_max ?? 10,
        speed: dados.speed ?? 9,
        init_mod: dados.init_mod ?? 0,
        notes: dados.notes ?? "",
        ataque: dados.ataque ?? "",
      };
      const { data, error } = await supabase.from("npc_templates").insert(linha).select().single();
      if (error) {
        relatarErro("criarModeloNpc", error);
        return false;
      }
      const criado = data as ModeloNpc;
      setModelosNpc((atual) => (atual.some((m) => m.id === criado.id) ? atual : [...atual, criado]));
      return true;
    },
    [codigo],
  );

  const atualizarModeloNpc = useCallback(async (id: string, patch: Partial<ModeloNpc>) => {
    const anterior = ref.current.modelosNpc;
    setModelosNpc((atual) => atual.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    const { error } = await supabase.from("npc_templates").update(patch).eq("id", id);
    if (error) {
      relatarErro("atualizarModeloNpc", error);
      setModelosNpc(anterior);
      setAvisoFalha(AVISO_FALHA_ESCRITA);
    }
  }, []);

  const removerModeloNpc = useCallback(async (id: string) => {
    const anterior = ref.current.modelosNpc;
    setModelosNpc((atual) => atual.filter((m) => m.id !== id));
    const { error } = await supabase.from("npc_templates").delete().eq("id", id);
    if (error) {
      relatarErro("removerModeloNpc", error);
      setModelosNpc(anterior);
      setAvisoFalha(AVISO_FALHA_ESCRITA);
    }
  }, []);

  const criarEntradaDiario = useCallback(
    async (dados: NovaEntradaDiario) => {
      const linha = { room_code: codigo, title: dados.title, text: dados.text };
      const { data, error } = await supabase.from("diario").insert(linha).select().single();
      if (error) {
        relatarErro("criarEntradaDiario", error);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
        return;
      }
      const criada = data as EntradaDiario;
      setDiario((atual) => (atual.some((e) => e.id === criada.id) ? atual : [criada, ...atual]));
    },
    [codigo],
  );

  const atualizarEntradaDiario = useCallback(async (id: string, patch: Partial<EntradaDiario>) => {
    const anterior = ref.current.diario;
    setDiario((atual) => atual.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const { error } = await supabase.from("diario").update(patch).eq("id", id);
    if (error) {
      relatarErro("atualizarEntradaDiario", error);
      setDiario(anterior);
      setAvisoFalha(AVISO_FALHA_ESCRITA);
    }
  }, []);

  const removerEntradaDiario = useCallback(async (id: string) => {
    const anterior = ref.current.diario;
    setDiario((atual) => atual.filter((e) => e.id !== id));
    const { error } = await supabase.from("diario").delete().eq("id", id);
    if (error) {
      relatarErro("removerEntradaDiario", error);
      setDiario(anterior);
      setAvisoFalha(AVISO_FALHA_ESCRITA);
    }
  }, []);

  const definirBastiao = useCallback(
    async (patch: Partial<Bastiao> | ((atual: Bastiao) => Partial<Bastiao>)): Promise<Bastiao | null> => {
      const original = ref.current.bastiao;
      const versaoOriginal = ref.current.bastiaoVersao;
      let anterior = original;
      let versao = versaoOriginal;

      // Mesma trava do definirCombate, pelo mesmo motivo — e aqui o caso comum
      // é justamente mais de um aparelho mexendo junto, porque o Bastião é do
      // grupo: "próximo turno" é turno+1 calculado aqui, então sem a versão
      // dois avanços simultâneos viravam um só (ver migration 0015).
      for (let tentativa = 0; tentativa < MAX_TENTATIVAS_VERSAO; tentativa++) {
        const parcial = typeof patch === "function" ? patch(anterior) : patch;
        const proximo = { ...anterior, ...parcial };
        setBastiao(proximo);

        // Manda só as colunas do patch, não a linha inteira: quem edita o
        // tesouro não reescreve as notas que o outro acabou de salvar.
        const r = await gravarSeVersaoBater<LinhaBastiao>("bastiao", codigo, versao, parcial);

        if (r.tipo === "erro") {
          relatarErro("definirBastiao", r.causa);
          setBastiao(original);
          setBastiaoVersao(versaoOriginal);
          setAvisoFalha(AVISO_FALHA_ESCRITA);
          return null;
        }

        if (r.tipo === "gravou") {
          setBastiao(r.linha);
          setBastiaoVersao(r.linha.version);
          return r.linha;
        }

        anterior = r.linha;
        versao = r.linha.version;
        setBastiao(anterior);
        setBastiaoVersao(versao);
      }

      relatarErro("definirBastiao", `contenção demais: desisti depois de ${MAX_TENTATIVAS_VERSAO} tentativas`);
      setAvisoFalha(AVISO_FALHA_ESCRITA);
      return null;
    },
    [codigo],
  );

  const criarInstalacaoBastiao = useCallback(
    async (dados: NovaInstalacaoBastiao) => {
      const linha = {
        room_code: codigo,
        name: dados.name,
        categoria: dados.categoria,
        tamanho: dados.tamanho ?? "Apertado",
        nivel_min: dados.nivel_min ?? 5,
        ordem: dados.ordem ?? "",
      };
      const { data, error } = await supabase.from("bastiao_instalacoes").insert(linha).select().single();
      if (error) {
        relatarErro("criarInstalacaoBastiao", error);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
        return;
      }
      const criada = data as InstalacaoBastiao;
      setInstalacoesBastiao((atual) => (atual.some((i) => i.id === criada.id) ? atual : [...atual, criada]));
    },
    [codigo],
  );

  const atualizarInstalacaoBastiao = useCallback(async (id: string, patch: Partial<InstalacaoBastiao>) => {
    const anterior = ref.current.instalacoesBastiao;
    setInstalacoesBastiao((atual) => atual.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const { error } = await supabase.from("bastiao_instalacoes").update(patch).eq("id", id);
    if (error) {
      relatarErro("atualizarInstalacaoBastiao", error);
      setInstalacoesBastiao(anterior);
      setAvisoFalha(AVISO_FALHA_ESCRITA);
    }
  }, []);

  const removerInstalacaoBastiao = useCallback(async (id: string) => {
    const anterior = ref.current.instalacoesBastiao;
    setInstalacoesBastiao((atual) => atual.filter((i) => i.id !== id));
    const { error } = await supabase.from("bastiao_instalacoes").delete().eq("id", id);
    if (error) {
      relatarErro("removerInstalacaoBastiao", error);
      setInstalacoesBastiao(anterior);
      setAvisoFalha(AVISO_FALHA_ESCRITA);
    }
  }, []);

  const registrarLogBastiao = useCallback(
    async (texto: string) => {
      const { data, error } = await supabase
        .from("bastiao_log")
        .insert({ room_code: codigo, text: texto })
        .select()
        .single();
      if (error) {
        relatarErro("registrarLogBastiao", error);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
        return;
      }
      const nova = data as LinhaLogBastiao;
      setLogBastiao((atual) => (atual.some((l) => l.id === nova.id) ? atual : [nova, ...atual].slice(0, TAMANHO_LOG)));
    },
    [codigo],
  );

  const criarEncontro = useCallback(
    async (nome: string): Promise<Encontro | null> => {
      const { data, error } = await supabase
        .from("encontros")
        .insert({ room_code: codigo, name: nome, grupos: [] })
        .select()
        .single();
      if (error) {
        relatarErro("criarEncontro", error);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
        return null;
      }
      const criado = data as Encontro;
      setEncontros((atual) => (atual.some((e) => e.id === criado.id) ? atual : [...atual, criado]));
      return criado;
    },
    [codigo],
  );

  const atualizarEncontro = useCallback(
    async (id: string, patch: Partial<Pick<Encontro, "name" | "grupos">>) => {
      const anterior = ref.current.encontros;
      setEncontros((atual) => atual.map((e) => (e.id === id ? { ...e, ...patch } : e)));
      const { error } = await supabase.from("encontros").update(patch).eq("id", id);
      if (error) {
        relatarErro("atualizarEncontro", error);
        setEncontros(anterior);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
      }
    },
    [],
  );

  const removerEncontro = useCallback(async (id: string) => {
    const anterior = ref.current.encontros;
    setEncontros((atual) => atual.filter((e) => e.id !== id));
    const { error } = await supabase.from("encontros").delete().eq("id", id);
    if (error) {
      relatarErro("removerEncontro", error);
      setEncontros(anterior);
      setAvisoFalha(AVISO_FALHA_ESCRITA);
    }
  }, []);

  const recarregarSala = useCallback(() => recarregarRef.current(), []);

  const exportarSala = useCallback(async (): Promise<SalaInteira | null> => {
    const [pc, mn, lg, di, bi, bl, en] = await Promise.all([
      lerTudoDaTabela("characters", codigo),
      lerTudoDaTabela("npc_templates", codigo),
      lerTudoDaTabela("combat_log", codigo),
      lerTudoDaTabela("diario", codigo),
      lerTudoDaTabela("bastiao_instalacoes", codigo),
      lerTudoDaTabela("bastiao_log", codigo),
      lerTudoDaTabela("encontros", codigo),
    ]);
    const [cs, dn, ba] = await Promise.all([
      supabase.from("combat_state").select("*").eq("room_code", codigo).maybeSingle(),
      supabase.from("dm_notes").select("*").eq("room_code", codigo).maybeSingle(),
      supabase.from("bastiao").select("*").eq("room_code", codigo).maybeSingle(),
    ]);

    const falha =
      [pc, mn, lg, di, bi, bl, en].find((r) => r.erro)?.erro ??
      [cs, dn, ba].find((r) => r.error)?.error?.message ??
      null;
    if (falha) {
      // Backup pela metade seria pior que nenhum: prefere não entregar
      // arquivo nenhum e avisar.
      relatarErro("exportarSala", falha);
      setAvisoFalha("Não consegui ler a sala inteira pro backup — confira a conexão e tente de novo.");
      return null;
    }

    return {
      personagens: pc.dados as unknown as Personagem[],
      combate: comoCombate((cs.data ?? null) as LinhaCombate | null),
      notasMestre: (dn.data?.text ?? "") as string,
      modelosNpc: mn.dados as unknown as ModeloNpc[],
      log: lg.dados as unknown as LinhaLog[],
      diario: di.dados as unknown as EntradaDiario[],
      bastiao: (ba.data ?? { ...BASTIAO_VAZIO, room_code: codigo }) as Bastiao,
      instalacoesBastiao: bi.dados as unknown as InstalacaoBastiao[],
      logBastiao: bl.dados as unknown as LinhaLogBastiao[],
      encontros: en.dados as unknown as Encontro[],
    };
  }, [codigo]);

  const lembrarDesfazer = useCallback((acao: NovaAcaoDesfazivel) => {
    if (!mudouAlgo(acao)) return;
    setPilhaDesfazer((pilha) => empilhar(pilha, { ...acao, id: novoId() }));
  }, []);

  const esquecerDesfazer = useCallback(() => setPilhaDesfazer([]), []);

  const desfazer = useCallback(async (): Promise<ResultadoDesfazer> => {
    const acao = pilhaRef.current[0];
    if (!acao) return { ok: false, motivo: "não há nada pra desfazer" };
    // Desfazer confere o banco antes de mexer: sem internet não dá pra
    // conferir. A pilha fica pra quando a conexão voltar.
    if (semInternetRef.current) return { ok: false, motivo: "sem internet — desfaça quando a conexão voltar" };
    // Desistir limpa a pilha inteira: se a ação mais nova não volta, as de
    // antes dela ficariam desfeitas fora de ordem.
    const desistir = (motivo: string): ResultadoDesfazer => {
      setPilhaDesfazer([]);
      return { ok: false, motivo };
    };

    const veredito = podeDesfazer(acao, ref.current.personagens, ref.current.combate);
    if (!veredito.ok) return desistir(veredito.motivo);

    // 1. Ordem de iniciativa: mesma trava de versão do definirCombate, mas
    //    em vez de refazer a conta em cima do que outro celular gravou, só
    //    volta se o que está lá ainda for exatamente o que a ação deixou.
    if (acao.combate) {
      let atual = ref.current.combate;
      let versao = ref.current.combateVersao;
      let voltou = false;
      for (let tentativa = 0; tentativa < MAX_TENTATIVAS_VERSAO && !voltou; tentativa++) {
        if (!mesmoCombate(atual, acao.combate.depois)) {
          return desistir("a ordem de iniciativa mudou depois disso");
        }
        const { antes } = acao.combate;
        const r = await gravarSeVersaoBater<LinhaCombate>("combat_state", codigo, versao, {
          round: antes.round,
          turn: antes.turn,
          order_json: antes.order,
        });
        if (r.tipo === "erro") {
          relatarErro("desfazer (combate)", r.causa);
          setAvisoFalha(AVISO_FALHA_ESCRITA);
          // A pilha fica: foi a conexão, dá pra tentar de novo.
          return { ok: false, motivo: "não salvou — confira a conexão e tente de novo" };
        }
        atual = comoCombate(r.linha);
        versao = r.linha.version;
        setCombate(atual);
        setCombateVersao(versao);
        voltou = r.tipo === "gravou";
      }
      if (!voltou) return desistir("a ordem de iniciativa não parou de mudar");
    }

    // 2. Fichas: o UPDATE só pega se os números e marcações ainda forem os
    //    que a ação gravou (texto e mapa de condições já foram conferidos em
    //    podeDesfazer, contra o estado que o tempo real mantém em dia).
    const naoVoltaram: string[] = [];
    for (const m of acao.personagens) {
      let consulta = supabase.from("characters").update(m.antes).eq("id", m.id);
      for (const [coluna, valor] of camposConferiveis(m.depois)) consulta = consulta.eq(coluna, valor);
      const { data, error } = await consulta.select("id");
      if (error || !data || data.length === 0) {
        if (error) relatarErro("desfazer (ficha)", error);
        naoVoltaram.push(m.nome);
        continue;
      }
      setPersonagens((lista) => lista.map((p) => (p.id === m.id ? { ...p, ...m.antes } : p)));
    }

    // 3. Fichas que a ação criou (NPC novo, encontro) — já saíram da ordem
    //    no passo 1.
    if (acao.criados.length > 0) {
      const slugsCriados = ref.current.personagens.filter((p) => acao.criados.includes(p.id)).map((p) => p.slug);
      const { error } = await supabase.from("characters").delete().in("id", acao.criados);
      if (error) {
        relatarErro("desfazer (criados)", error);
        naoVoltaram.push("as fichas criadas");
      } else {
        setPersonagens((lista) => lista.filter((p) => !acao.criados.includes(p.id)));
        // Ficha apagada não deixa peão órfão em mapa nenhum.
        void tirarPecasDasFichas(codigo, slugsCriados, null);
      }
    }

    // 4. Peões que a ação pôs ou tirou do mapa junto com a ordem. Como tudo do
    //    mapa, é melhor esforço: se um não voltar, aparece no mapa e o Mestre
    //    arruma na mão — não vira "desfeito em parte" do combate.
    if (acao.pecas) await desfazerPecas(acao.pecas);

    setPilhaDesfazer((pilha) => pilha.filter((a) => a.id !== acao.id));
    if (acao.textoLog) registrarLog(acao.textoLog);
    if (naoVoltaram.length > 0) {
      setPilhaDesfazer([]);
      return { ok: false, motivo: `desfeito em parte — ${naoVoltaram.join(", ")} mudou no meio, ajuste na ficha` };
    }
    return { ok: true, rotulo: acao.rotulo };
  }, [codigo, registrarLog]);

  const restaurarBackup = useCallback(
    async (backup: Backup): Promise<{ ok: boolean; erro?: string }> => {
      // Ordem: apaga tudo o que é lista, repõe do arquivo, depois arruma as
      // linhas únicas (combate, notas, Bastião) pelas mutações de sempre —
      // assim a versão de combat_state continua sendo respeitada.
      const tabelas: [string, unknown[]][] = [
        ["characters", backup.personagens],
        ["npc_templates", backup.modelos_npc],
        ["combat_log", backup.log],
        ["diario", backup.diario],
      ];
      // Arquivo antigo não TEM Bastião (é diferente de ter um Bastião vazio):
      // nesse caso ele não é apagado, é deixado como está — que é o que a tela
      // promete no aviso. Achado testando com um backup de antes da migration
      // 0006: as instalações sumiam sem ninguém pedir.
      if (backup.bastiao) {
        tabelas.push(["bastiao_instalacoes", backup.bastiao_instalacoes]);
        tabelas.push(["bastiao_log", backup.bastiao_log]);
      }
      // Mesma lógica pros encontros: arquivo de antes deles existirem não
      // apaga os encontros que a sala tem hoje.
      if (backup.encontros) tabelas.push(["encontros", backup.encontros]);

      for (const [tabela] of tabelas) {
        const { error } = await supabase.from(tabela).delete().eq("room_code", codigo);
        if (error) {
          relatarErro(`restaurarBackup (limpar) ${tabela}`, error);
          return { ok: false, erro: `Parei ao limpar ${tabela}: ${error.message}` };
        }
      }

      for (const [tabela, linhas] of tabelas) {
        for (const parte of pedacos(linhasParaInserir(linhas, codigo), 500)) {
          const { error } = await supabase.from(tabela).insert(parte);
          if (error) {
            relatarErro(`restaurarBackup (repor) ${tabela}`, error);
            return { ok: false, erro: `Parei ao repor ${tabela}: ${error.message}` };
          }
        }
      }

      const combate = await definirCombate({
        round: backup.combate.round,
        turn: backup.combate.turn,
        order: backup.combate.order,
      });
      if (!combate) return { ok: false, erro: "As fichas voltaram, mas não consegui repor o combate." };

      await definirNotasMestre(backup.notas_mestre);
      if (backup.bastiao) {
        await definirBastiao({
          turno: backup.bastiao.turno,
          tesouro_po: backup.bastiao.tesouro_po,
          defensores: backup.bastiao.defensores,
          notes: backup.bastiao.notes,
        });
      }

      // Relê do banco: o estado da tela foi virado do avesso por deletes e
      // inserts, e o tempo real pode ter entregue só parte deles.
      recarregarRef.current();
      // Nada do que estava na pilha se refere mais à sala que ficou.
      setPilhaDesfazer([]);
      return { ok: true };
    },
    [codigo, definirCombate, definirNotasMestre, definirBastiao],
  );

  // Log da tela: as linhas que ainda esperam conexão aparecem no topo.
  const logComFila = useMemo(() => {
    const provisorias = linhasProvisorias(fila).map((l) => ({ ...l, room_code: codigo }));
    return provisorias.length === 0 ? log : [...provisorias, ...log].slice(0, TAMANHO_LOG);
  }, [fila, log, codigo]);

  return {
    carregando: supabaseConfigurado && carregando,
    conectado,
    erro: supabaseConfigurado ? erro : MSG_SEM_CONFIG,
    avisoFalha,
    limparAvisoFalha,
    semInternet,
    esperando: mudancasEsperando(fila),
    fotoDe,
    personagens,
    combate,
    notasMestre,
    log: logComFila,
    modelosNpc,
    diario,
    bastiao,
    instalacoesBastiao,
    logBastiao,
    encontros,
    criarPersonagem,
    criarVariosPersonagens,
    atualizarPersonagem,
    atualizarVariosPersonagens,
    removerPersonagem,
    definirCombate,
    definirNotasMestre,
    registrarLog,
    registrarVariosLogs,
    criarModeloNpc,
    atualizarModeloNpc,
    removerModeloNpc,
    criarEntradaDiario,
    atualizarEntradaDiario,
    removerEntradaDiario,
    definirBastiao,
    criarInstalacaoBastiao,
    atualizarInstalacaoBastiao,
    removerInstalacaoBastiao,
    registrarLogBastiao,
    criarEncontro,
    atualizarEncontro,
    removerEncontro,
    recarregarSala,
    desfazivel: pilhaDesfazer[0] ?? null,
    lembrarDesfazer,
    desfazer,
    esquecerDesfazer,
    exportarSala,
    restaurarBackup,
  };
}
