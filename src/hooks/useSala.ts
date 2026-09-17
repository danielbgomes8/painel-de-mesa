"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { slugUnico } from "@/lib/sala";
import { turnoAposRemover } from "@/lib/regras";
import {
  COMBATE_VAZIO,
  type Bastiao,
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

// Tentativas de definirCombate antes de desistir e avisar (ver migration
// 0010) — mais que suficiente pra qualquer contenção real numa mesa de RPG;
// existe só pra não tentar pra sempre num cenário patológico.
const MAX_TENTATIVAS_COMBATE = 5;

const BASTIAO_VAZIO: Bastiao = { room_code: "", turno: 1, tesouro_po: 0, defensores: 0, notes: "" };

type LinhaCombate = {
  room_code: string;
  round: number;
  turn: number;
  order_json: ItemIniciativa[] | null;
  version: number;
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
  personagens: Personagem[];
  combate: EstadoCombate;
  notasMestre: string;
  log: LinhaLog[];
  modelosNpc: ModeloNpc[];
  diario: EntradaDiario[];
  bastiao: Bastiao;
  instalacoesBastiao: InstalacaoBastiao[];
  logBastiao: LinhaLogBastiao[];
  criarPersonagem: (dados: NovoPersonagem) => Promise<Personagem | null>;
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
   *  `combate` de fora depois de um `await`, pode já estar velho. Devolve
   *  null quando a escrita falha (e já reverteu o estado local). */
  definirCombate: (
    patch: Partial<EstadoCombate> | ((atual: EstadoCombate) => Partial<EstadoCombate>),
  ) => Promise<EstadoCombate | null>;
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
};

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
  const [instalacoesBastiao, setInstalacoesBastiao] = useState<InstalacaoBastiao[]>([]);
  const [logBastiao, setLogBastiao] = useState<LinhaLogBastiao[]>([]);

  // Espelho síncrono do estado, pra montar patches e reverter uma escrita que
  // falhou sem depender do closure. Atualizado depois do commit (não durante
  // o render).
  const ref = useRef({
    personagens,
    combate,
    combateVersao,
    bastiao,
    notasMestre,
    modelosNpc,
    diario,
    instalacoesBastiao,
  });
  useEffect(() => {
    ref.current = {
      personagens,
      combate,
      combateVersao,
      bastiao,
      notasMestre,
      modelosNpc,
      diario,
      instalacoesBastiao,
    };
  });

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

    async function iniciar() {
      // Garante que a sala existe (deixa qualquer ?sala=novo-codigo funcionar).
      // Sem checar erro aqui, uma falha passava batido e todo update/insert
      // seguinte pra essa sala virava um "sucesso" de 0 linhas afetadas —
      // o painel resetava pro padrão a cada recarregamento sem avisar nada.
      const preparo = await supabase
        .from("rooms")
        .upsert({ code: codigo }, { onConflict: "code", ignoreDuplicates: true });
      if (!vivo) return;
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
      if (falhaDependente?.error) {
        setErro(`Não consegui preparar a sala: ${falhaDependente.error.message}`);
        setCarregando(false);
        return;
      }

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
      ]);

      if (!vivo || estaCarga !== ultimaCarga) return;
      if (eventosRecebidos !== eventosAntes && tentativa < 3) {
        return carregar(inicial, tentativa + 1);
      }

      const [pc, cs, dn, lg, mn, di, ba, bi, bl] = resultados;

      if (inicial) {
        if (pc.error) {
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
          console.error("recarregar sala", falha.error);
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
      setInstalacoesBastiao((bi.data ?? []) as InstalacaoBastiao[]);
      setLogBastiao((bl.data ?? []) as LinhaLogBastiao[]);
      setCarregando(false);

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
      carregar(false).catch((e) => console.error("recarregar sala", e));
    }

    function aoVoltarPraTela() {
      if (document.visibilityState === "visible") recarregar();
    }
    document.addEventListener("visibilitychange", aoVoltarPraTela);

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
          setBastiao(msg.new as Bastiao);
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
      document.removeEventListener("visibilitychange", aoVoltarPraTela);
      supabase.removeChannel(canal);
    };
  }, [codigo]);

  const atualizarPersonagem = useCallback(
    async (id: string, patch: Partial<Personagem>) => {
      const anterior = ref.current.personagens;
      setPersonagens((atual) => atual.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      const { error } = await supabase.from("characters").update(patch).eq("id", id);
      if (error) {
        console.error("atualizarPersonagem", error);
        setPersonagens(anterior);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
      }
    },
    [],
  );

  const atualizarVariosPersonagens = useCallback(
    async (alvos: { id: string; patch: Partial<Personagem> }[]): Promise<boolean> => {
      if (alvos.length === 0) return true;
      const anterior = ref.current.personagens;
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
      const respostas = await Promise.all(
        alvos.map(({ id, patch }) => supabase.from("characters").update(patch).eq("id", id)),
      );
      const erro = respostas.find((r) => r.error)?.error;
      if (erro) {
        console.error("atualizarVariosPersonagens", erro);
        // Volta ao estado de antes; quem gravou de verdade no meio do lote é
        // reposto pelo evento de tempo real da própria escrita.
        setPersonagens(anterior);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
        return false;
      }
      return true;
    },
    [],
  );

  const criarPersonagem = useCallback(
    async (dados: NovoPersonagem): Promise<Personagem | null> => {
      const existentes = ref.current.personagens.map((p) => p.slug);
      const linha = {
        room_code: codigo,
        slug: slugUnico(dados.name, existentes),
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
        console.error("criarPersonagem", resp.error);
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

  const definirCombate = useCallback(
    async (
      patch: Partial<EstadoCombate> | ((atual: EstadoCombate) => Partial<EstadoCombate>),
    ): Promise<EstadoCombate | null> => {
      const original = ref.current.combate;
      const versaoOriginal = ref.current.combateVersao;
      let anterior = original;
      let versao = versaoOriginal;

      // Resolver contra ref.current (em vez do `combate` de closure, que pode
      // já estar velho depois de um await) encurta a janela da corrida, mas
      // não fecha: dois clientes podem estar com o request em voo ao mesmo
      // tempo, cada um sem saber do outro. A trava de verdade é o UPDATE só
      // pegar se `version` ainda for a que este cliente leu — controle de
      // concorrência otimista (ver migration 0010). Quando não pega, ninguém
      // perdeu escrita: busca o estado de verdade e tenta de novo em cima
      // dele, até um número razoável de tentativas.
      for (let tentativa = 0; tentativa < MAX_TENTATIVAS_COMBATE; tentativa++) {
        const parcial = typeof patch === "function" ? patch(anterior) : patch;
        const proximo = { ...anterior, ...parcial };
        setCombate(proximo);

        const { data, error } = await supabase
          .from("combat_state")
          .update({ round: proximo.round, turn: proximo.turn, order_json: proximo.order, version: versao + 1 })
          .eq("room_code", codigo)
          .eq("version", versao)
          .select()
          .maybeSingle();

        if (error) {
          console.error("definirCombate", error);
          setCombate(original);
          setCombateVersao(versaoOriginal);
          setAvisoFalha(AVISO_FALHA_ESCRITA);
          return null;
        }

        if (data) {
          const linha = data as LinhaCombate;
          const atualizado = comoCombate(linha);
          setCombate(atualizado);
          setCombateVersao(linha.version);
          return atualizado;
        }

        // Zero linhas afetadas = outro cliente escreveu entre a leitura e
        // esta escrita. Releitura direta do banco, não confia em o realtime
        // já ter entregue a notícia a tempo.
        const { data: fresco, error: erroFresco } = await supabase
          .from("combat_state")
          .select("*")
          .eq("room_code", codigo)
          .maybeSingle();
        if (erroFresco || !fresco) {
          console.error("definirCombate (releitura)", erroFresco);
          setCombate(original);
          setCombateVersao(versaoOriginal);
          setAvisoFalha(AVISO_FALHA_ESCRITA);
          return null;
        }
        const linhaFresca = fresco as LinhaCombate;
        anterior = comoCombate(linhaFresca);
        versao = linhaFresca.version;
        setCombate(anterior);
        setCombateVersao(versao);
      }

      console.error("definirCombate: contenção demais, desisti depois de", MAX_TENTATIVAS_COMBATE, "tentativas");
      setAvisoFalha(AVISO_FALHA_ESCRITA);
      return null;
    },
    [codigo],
  );

  const removerPersonagem = useCallback(
    async (id: string) => {
      const anterior = ref.current.personagens;
      const removido = anterior.find((p) => p.id === id);
      setPersonagens((atual) => atual.filter((p) => p.id !== id));
      const { error } = await supabase.from("characters").delete().eq("id", id);
      if (error) {
        console.error("removerPersonagem", error);
        setPersonagens(anterior);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
        return;
      }
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
    [definirCombate],
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
        console.error("definirNotasMestre", error);
        setNotasMestre(anterior);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
      }
    },
    [codigo],
  );

  const registrarLog = useCallback(
    async (texto: string) => {
      const { data, error } = await supabase
        .from("combat_log")
        .insert({ room_code: codigo, text: texto })
        .select()
        .single();
      if (error) {
        console.error("registrarLog", error);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
        return;
      }
      const nova = data as LinhaLog;
      setLog((atual) => (atual.some((l) => l.id === nova.id) ? atual : [nova, ...atual].slice(0, TAMANHO_LOG)));
    },
    [codigo],
  );

  const registrarVariosLogs = useCallback(
    async (textos: string[]) => {
      if (textos.length === 0) return;
      const { data, error } = await supabase
        .from("combat_log")
        .insert(textos.map((text) => ({ room_code: codigo, text })))
        .select();
      if (error) {
        console.error("registrarVariosLogs", error);
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
    [codigo],
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
        console.error("criarModeloNpc", error);
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
      console.error("atualizarModeloNpc", error);
      setModelosNpc(anterior);
      setAvisoFalha(AVISO_FALHA_ESCRITA);
    }
  }, []);

  const removerModeloNpc = useCallback(async (id: string) => {
    const anterior = ref.current.modelosNpc;
    setModelosNpc((atual) => atual.filter((m) => m.id !== id));
    const { error } = await supabase.from("npc_templates").delete().eq("id", id);
    if (error) {
      console.error("removerModeloNpc", error);
      setModelosNpc(anterior);
      setAvisoFalha(AVISO_FALHA_ESCRITA);
    }
  }, []);

  const criarEntradaDiario = useCallback(
    async (dados: NovaEntradaDiario) => {
      const linha = { room_code: codigo, title: dados.title, text: dados.text };
      const { data, error } = await supabase.from("diario").insert(linha).select().single();
      if (error) {
        console.error("criarEntradaDiario", error);
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
      console.error("atualizarEntradaDiario", error);
      setDiario(anterior);
      setAvisoFalha(AVISO_FALHA_ESCRITA);
    }
  }, []);

  const removerEntradaDiario = useCallback(async (id: string) => {
    const anterior = ref.current.diario;
    setDiario((atual) => atual.filter((e) => e.id !== id));
    const { error } = await supabase.from("diario").delete().eq("id", id);
    if (error) {
      console.error("removerEntradaDiario", error);
      setDiario(anterior);
      setAvisoFalha(AVISO_FALHA_ESCRITA);
    }
  }, []);

  const definirBastiao = useCallback(
    async (patch: Partial<Bastiao> | ((atual: Bastiao) => Partial<Bastiao>)) => {
      const anterior = ref.current.bastiao;
      const parcial = typeof patch === "function" ? patch(anterior) : patch;
      const proximo = { ...anterior, ...parcial };
      setBastiao(proximo);
      const { error } = await supabase.from("bastiao").update(parcial).eq("room_code", codigo);
      if (error) {
        console.error("definirBastiao", error);
        setBastiao(anterior);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
        return null;
      }
      return proximo;
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
        console.error("criarInstalacaoBastiao", error);
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
      console.error("atualizarInstalacaoBastiao", error);
      setInstalacoesBastiao(anterior);
      setAvisoFalha(AVISO_FALHA_ESCRITA);
    }
  }, []);

  const removerInstalacaoBastiao = useCallback(async (id: string) => {
    const anterior = ref.current.instalacoesBastiao;
    setInstalacoesBastiao((atual) => atual.filter((i) => i.id !== id));
    const { error } = await supabase.from("bastiao_instalacoes").delete().eq("id", id);
    if (error) {
      console.error("removerInstalacaoBastiao", error);
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
        console.error("registrarLogBastiao", error);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
        return;
      }
      const nova = data as LinhaLogBastiao;
      setLogBastiao((atual) => (atual.some((l) => l.id === nova.id) ? atual : [nova, ...atual].slice(0, TAMANHO_LOG)));
    },
    [codigo],
  );

  return {
    carregando: supabaseConfigurado && carregando,
    conectado,
    erro: supabaseConfigurado ? erro : MSG_SEM_CONFIG,
    avisoFalha,
    limparAvisoFalha,
    personagens,
    combate,
    notasMestre,
    log,
    modelosNpc,
    diario,
    bastiao,
    instalacoesBastiao,
    logBastiao,
    criarPersonagem,
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
  };
}
