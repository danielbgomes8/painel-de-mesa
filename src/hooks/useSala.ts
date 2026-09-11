"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { slugUnico } from "@/lib/sala";
import {
  COMBATE_VAZIO,
  type EstadoCombate,
  type ItemIniciativa,
  type NovoPersonagem,
  type Personagem,
} from "@/lib/tipos";

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
  criarPersonagem: (dados: NovoPersonagem) => Promise<Personagem | null>;
  atualizarPersonagem: (id: string, patch: Partial<Personagem>) => Promise<void>;
  removerPersonagem: (id: string) => Promise<void>;
  definirCombate: (patch: Partial<EstadoCombate>) => Promise<void>;
  definirNotasMestre: (texto: string) => Promise<void>;
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

      const [pc, cs, dn] = await Promise.all([
        supabase.from("characters").select("*").eq("room_code", codigo),
        supabase.from("combat_state").select("*").eq("room_code", codigo).maybeSingle(),
        supabase.from("dm_notes").select("*").eq("room_code", codigo).maybeSingle(),
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

  return {
    carregando: supabaseConfigurado && carregando,
    conectado,
    erro: supabaseConfigurado ? erro : MSG_SEM_CONFIG,
    personagens,
    combate,
    notasMestre,
    criarPersonagem,
    atualizarPersonagem,
    removerPersonagem,
    definirCombate,
    definirNotasMestre,
  };
}
