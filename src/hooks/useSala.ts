"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { slugUnico } from "@/lib/sala";
import {
  COMBATE_VAZIO,
  type EntradaDiario,
  type EstadoCombate,
  type ItemIniciativa,
  type LinhaLog,
  type ModeloNpc,
  type NovaEntradaDiario,
  type NovoModeloNpc,
  type NovoPersonagem,
  type Personagem,
} from "@/lib/tipos";

const TAMANHO_LOG = 40;

type LinhaCombate = {
  room_code: string;
  round: number;
  turn: number;
  order_json: ItemIniciativa[] | null;
};

export type Sala = {
  carregando: boolean;
  conectado: boolean;
  erro: string | null;
  personagens: Personagem[];
  combate: EstadoCombate;
  notasMestre: string;
  log: LinhaLog[];
  modelosNpc: ModeloNpc[];
  diario: EntradaDiario[];
  criarPersonagem: (dados: NovoPersonagem) => Promise<Personagem | null>;
  atualizarPersonagem: (id: string, patch: Partial<Personagem>) => Promise<void>;
  removerPersonagem: (id: string) => Promise<void>;
  definirCombate: (patch: Partial<EstadoCombate>) => Promise<void>;
  definirNotasMestre: (texto: string) => Promise<void>;
  registrarLog: (texto: string) => Promise<void>;
  criarModeloNpc: (dados: NovoModeloNpc) => Promise<void>;
  atualizarModeloNpc: (id: string, patch: Partial<ModeloNpc>) => Promise<void>;
  removerModeloNpc: (id: string) => Promise<void>;
  criarEntradaDiario: (dados: NovaEntradaDiario) => Promise<void>;
  atualizarEntradaDiario: (id: string, patch: Partial<EntradaDiario>) => Promise<void>;
  removerEntradaDiario: (id: string) => Promise<void>;
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

export function useSala(codigo: string): Sala {
  const [carregando, setCarregando] = useState(supabaseConfigurado);
  const [conectado, setConectado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [personagens, setPersonagens] = useState<Personagem[]>([]);
  const [combate, setCombate] = useState<EstadoCombate>(COMBATE_VAZIO);
  const [notasMestre, setNotasMestre] = useState("");
  const [log, setLog] = useState<LinhaLog[]>([]);
  const [modelosNpc, setModelosNpc] = useState<ModeloNpc[]>([]);
  const [diario, setDiario] = useState<EntradaDiario[]>([]);

  // Espelho síncrono do estado, pra montar patches sem depender do closure.
  // Atualizado depois do commit (não durante o render).
  const ref = useRef({ personagens, combate });
  useEffect(() => {
    ref.current = { personagens, combate };
  });

  useEffect(() => {
    if (!supabaseConfigurado) return;

    // Sem reset manual de estado aqui: o componente que chama useSala(codigo)
    // usa `key={codigo}`, então uma troca de sala remonta do zero.
    let vivo = true;

    async function iniciar() {
      // Garante que a sala existe (deixa qualquer ?sala=novo-codigo funcionar).
      await supabase.from("rooms").upsert({ code: codigo }, { onConflict: "code", ignoreDuplicates: true });
      await Promise.all([
        supabase
          .from("combat_state")
          .upsert({ room_code: codigo }, { onConflict: "room_code", ignoreDuplicates: true }),
        supabase
          .from("dm_notes")
          .upsert({ room_code: codigo }, { onConflict: "room_code", ignoreDuplicates: true }),
      ]);

      const [pc, cs, dn, lg, mn, di] = await Promise.all([
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
      ]);

      if (!vivo) return;

      if (pc.error) {
        setErro(`Não consegui carregar a sala: ${pc.error.message}`);
        setCarregando(false);
        return;
      }

      setPersonagens(ordenar((pc.data ?? []) as Personagem[]));
      setCombate(comoCombate((cs.data ?? null) as LinhaCombate | null));
      setNotasMestre((dn.data?.text ?? "") as string);
      setLog((lg.data ?? []) as LinhaLog[]);
      setModelosNpc((mn.data ?? []) as ModeloNpc[]);
      setDiario((di.data ?? []) as EntradaDiario[]);
      setCarregando(false);
    }

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
          if (msg.eventType === "DELETE") return;
          setCombate(comoCombate(msg.new as LinhaCombate));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_notes", filter: filtro },
        (msg) => {
          if (msg.eventType === "DELETE") return;
          setNotasMestre(((msg.new as { text?: string }).text ?? "") as string);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "combat_log", filter: filtro },
        (msg) => {
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
      .subscribe((status) => {
        if (!vivo) return;
        setConectado(status === "SUBSCRIBED");
      });

    return () => {
      vivo = false;
      supabase.removeChannel(canal);
    };
  }, [codigo]);

  const atualizarPersonagem = useCallback(
    async (id: string, patch: Partial<Personagem>) => {
      setPersonagens((atual) => atual.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      const { error } = await supabase.from("characters").update(patch).eq("id", id);
      if (error) console.error("atualizarPersonagem", error);
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
        is_npc: dados.is_npc ?? false,
      };

      let resp = await supabase.from("characters").insert(linha).select().single();

      // Corrida: duas pessoas entrando ao mesmo tempo com nomes parecidos.
      if (resp.error?.code === "23505") {
        const { data } = await supabase.from("characters").select("*").eq("room_code", codigo);
        const jaExiste = (data ?? []).find(
          (p) => p.name.toLowerCase() === dados.name.toLowerCase(),
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

  const removerPersonagem = useCallback(async (id: string) => {
    setPersonagens((atual) => atual.filter((p) => p.id !== id));
    const { error } = await supabase.from("characters").delete().eq("id", id);
    if (error) console.error("removerPersonagem", error);
  }, []);

  const definirCombate = useCallback(
    async (patch: Partial<EstadoCombate>) => {
      const proximo = { ...ref.current.combate, ...patch };
      setCombate(proximo);
      const { error } = await supabase
        .from("combat_state")
        .update({ round: proximo.round, turn: proximo.turn, order_json: proximo.order })
        .eq("room_code", codigo);
      if (error) console.error("definirCombate", error);
    },
    [codigo],
  );

  const definirNotasMestre = useCallback(
    async (texto: string) => {
      setNotasMestre(texto);
      const { error } = await supabase
        .from("dm_notes")
        .update({ text: texto })
        .eq("room_code", codigo);
      if (error) console.error("definirNotasMestre", error);
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
        return;
      }
      const nova = data as LinhaLog;
      setLog((atual) => (atual.some((l) => l.id === nova.id) ? atual : [nova, ...atual].slice(0, TAMANHO_LOG)));
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
      };
      const { data, error } = await supabase.from("npc_templates").insert(linha).select().single();
      if (error) {
        console.error("criarModeloNpc", error);
        return;
      }
      const criado = data as ModeloNpc;
      setModelosNpc((atual) => (atual.some((m) => m.id === criado.id) ? atual : [...atual, criado]));
    },
    [codigo],
  );

  const atualizarModeloNpc = useCallback(async (id: string, patch: Partial<ModeloNpc>) => {
    setModelosNpc((atual) => atual.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    const { error } = await supabase.from("npc_templates").update(patch).eq("id", id);
    if (error) console.error("atualizarModeloNpc", error);
  }, []);

  const removerModeloNpc = useCallback(async (id: string) => {
    setModelosNpc((atual) => atual.filter((m) => m.id !== id));
    const { error } = await supabase.from("npc_templates").delete().eq("id", id);
    if (error) console.error("removerModeloNpc", error);
  }, []);

  const criarEntradaDiario = useCallback(
    async (dados: NovaEntradaDiario) => {
      const linha = { room_code: codigo, title: dados.title, text: dados.text };
      const { data, error } = await supabase.from("diario").insert(linha).select().single();
      if (error) {
        console.error("criarEntradaDiario", error);
        return;
      }
      const criada = data as EntradaDiario;
      setDiario((atual) => (atual.some((e) => e.id === criada.id) ? atual : [criada, ...atual]));
    },
    [codigo],
  );

  const atualizarEntradaDiario = useCallback(async (id: string, patch: Partial<EntradaDiario>) => {
    setDiario((atual) => atual.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const { error } = await supabase.from("diario").update(patch).eq("id", id);
    if (error) console.error("atualizarEntradaDiario", error);
  }, []);

  const removerEntradaDiario = useCallback(async (id: string) => {
    setDiario((atual) => atual.filter((e) => e.id !== id));
    const { error } = await supabase.from("diario").delete().eq("id", id);
    if (error) console.error("removerEntradaDiario", error);
  }, []);

  return {
    carregando: supabaseConfigurado && carregando,
    conectado,
    erro: supabaseConfigurado ? erro : MSG_SEM_CONFIG,
    personagens,
    combate,
    notasMestre,
    log,
    modelosNpc,
    diario,
    criarPersonagem,
    atualizarPersonagem,
    removerPersonagem,
    definirCombate,
    definirNotasMestre,
    registrarLog,
    criarModeloNpc,
    atualizarModeloNpc,
    removerModeloNpc,
    criarEntradaDiario,
    atualizarEntradaDiario,
    removerEntradaDiario,
  };
}
