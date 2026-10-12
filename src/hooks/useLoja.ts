"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { ehTabelaAusente } from "@/lib/cenas";
import {
  ITENS_MAXIMOS_POR_LOJA,
  LOJAS_MAXIMAS,
  normalizarItemDaLoja,
  normalizarLoja,
  type ItemDaLoja,
  type Loja,
  type NovoItemDaLoja,
} from "@/lib/loja";

const TENTATIVAS = 6;
const AVISO_NAO_SALVOU = "Não salvou. Confira a conexão e tente de novo.";

export type LojaHook = {
  lojas: Loja[];
  itens: ItemDaLoja[];
  carregando: boolean;
  /** As tabelas ainda não existem (migration 0038 não rodada): o resto do app funciona. */
  indisponivel: boolean;
  aviso: string | null;
  criarLoja: (nome: string) => Promise<boolean>;
  atualizarLoja: (id: string, mudanca: Partial<Pick<Loja, "nome" | "aberta">>) => Promise<boolean>;
  apagarLoja: (id: string) => Promise<boolean>;
  adicionarItem: (lojaId: string, novo: NovoItemDaLoja) => Promise<boolean>;
  atualizarItem: (id: string, mudanca: Partial<Pick<ItemDaLoja, "nome" | "descricao" | "preco_pc" | "estoque" | "peso" | "magico" | "raridade">>) => Promise<boolean>;
  apagarItem: (id: string) => Promise<boolean>;
  /** Tira `qtd` do estoque se ainda houver (estoque nulo nunca acaba). false = não tinha, ou falhou. */
  tirarEstoque: (id: string, qtd: number) => Promise<boolean>;
  /** Devolve `qtd` ao estoque (desfaz uma compra que não terminou). */
  devolverEstoque: (id: string, qtd: number) => Promise<boolean>;
};

function juntar<T extends { id: string }>(atual: T[], nova: T): T[] {
  return atual.some((x) => x.id === nova.id) ? atual.map((x) => (x.id === nova.id ? nova : x)) : [...atual, nova];
}

/**
 * As lojas da sala e os itens delas, ao vivo. Canal próprio, fora do `useSala`, e tolera as tabelas não existirem (o
 * código vai ao ar antes do SQL; mesmo desenho do `useBau`). Entrega TODAS as linhas: quem vê o quê é `lojasVisiveis`
 * (lib/loja.ts), porque o banco é aberto.
 *
 * O estoque baixa como o baú: "troco só se ninguém mexeu antes" — o `update` leva o estoque lido no filtro, então dois
 * celulares comprando a última unidade ao mesmo tempo não levam as duas; o que perdeu a corrida lê de novo.
 */
export function useLoja(codigo: string): LojaHook {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [itens, setItens] = useState<ItemDaLoja[]>([]);
  const [carregando, setCarregando] = useState(supabaseConfigurado);
  const [indisponivel, setIndisponivel] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const refLojas = useRef<Loja[]>([]);
  const refItens = useRef<ItemDaLoja[]>([]);
  useEffect(() => {
    refLojas.current = lojas;
    refItens.current = itens;
  }, [lojas, itens]);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let vivo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;

    async function carregar(): Promise<boolean> {
      const [l, i] = await Promise.all([
        supabase.from("lojas").select("*").eq("room_code", codigo).order("created_at", { ascending: true }),
        supabase.from("loja_itens").select("*").eq("room_code", codigo).order("created_at", { ascending: true }),
      ]);
      if (!vivo) return false;
      const erro = l.error ?? i.error;
      if (erro) {
        if (ehTabelaAusente(erro)) setIndisponivel(true);
        else relatarErro("lerLoja", erro);
        setCarregando(false);
        return false;
      }
      setIndisponivel(false);
      setLojas((l.data ?? []).map(normalizarLoja).filter((x): x is Loja => x !== null));
      setItens((i.data ?? []).map(normalizarItemDaLoja).filter((x): x is ItemDaLoja => x !== null));
      setCarregando(false);
      return true;
    }

    const aoVoltar = () => {
      if (document.visibilityState === "visible") void carregar();
    };

    void carregar().then((ok) => {
      if (!vivo || !ok) return;
      document.addEventListener("visibilitychange", aoVoltar);
      window.addEventListener("online", aoVoltar);
      canal = supabase
        .channel(`loja:${codigo}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "lojas", filter: `room_code=eq.${codigo}` }, (msg) => {
          if (msg.eventType === "DELETE") {
            const id = (msg.old as { id?: string }).id;
            setLojas((atual) => atual.filter((x) => x.id !== id));
            setItens((atual) => atual.filter((x) => x.loja_id !== id));
            return;
          }
          const nova = normalizarLoja(msg.new);
          if (nova) setLojas((atual) => juntar(atual, nova));
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "loja_itens", filter: `room_code=eq.${codigo}` }, (msg) => {
          if (msg.eventType === "DELETE") {
            const id = (msg.old as { id?: string }).id;
            setItens((atual) => atual.filter((x) => x.id !== id));
            return;
          }
          const nova = normalizarItemDaLoja(msg.new);
          if (nova) setItens((atual) => juntar(atual, nova));
        })
        .subscribe((status) => {
          if (vivo && status === "SUBSCRIBED") void carregar();
        });
    });

    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", aoVoltar);
      if (canal) supabase.removeChannel(canal);
    };
  }, [codigo]);

  const falhou = useCallback((onde: string, erro: unknown) => {
    relatarErro(onde, erro);
    setAviso(AVISO_NAO_SALVOU);
    return false;
  }, []);

  const criarLoja = useCallback<LojaHook["criarLoja"]>(
    async (nome) => {
      if (refLojas.current.length >= LOJAS_MAXIMAS) {
        setAviso(`Já existem ${LOJAS_MAXIMAS} lojas, que é o máximo.`);
        return false;
      }
      const { data, error } = await supabase.from("lojas").insert({ id: crypto.randomUUID(), room_code: codigo, nome, aberta: false }).select();
      if (error) return falhou("criarLoja", error);
      const criada = (data ?? []).map(normalizarLoja).find((x): x is Loja => x !== null);
      if (criada) setLojas((atual) => juntar(atual, criada));
      setAviso(null);
      return true;
    },
    [codigo, falhou],
  );

  const atualizarLoja = useCallback<LojaHook["atualizarLoja"]>(
    async (id, mudanca) => {
      const antes = refLojas.current;
      setLojas((atual) => atual.map((x) => (x.id === id ? { ...x, ...mudanca } : x)));
      const { error } = await supabase.from("lojas").update(mudanca).eq("id", id);
      if (error) {
        setLojas(antes);
        return falhou("atualizarLoja", error);
      }
      setAviso(null);
      return true;
    },
    [falhou],
  );

  const apagarLoja = useCallback<LojaHook["apagarLoja"]>(
    async (id) => {
      const antesL = refLojas.current;
      const antesI = refItens.current;
      setLojas((atual) => atual.filter((x) => x.id !== id));
      setItens((atual) => atual.filter((x) => x.loja_id !== id));
      const { error } = await supabase.from("lojas").delete().eq("id", id);
      if (error) {
        setLojas(antesL);
        setItens(antesI);
        return falhou("apagarLoja", error);
      }
      setAviso(null);
      return true;
    },
    [falhou],
  );

  const adicionarItem = useCallback<LojaHook["adicionarItem"]>(
    async (lojaId, novo) => {
      if (refItens.current.filter((i) => i.loja_id === lojaId).length >= ITENS_MAXIMOS_POR_LOJA) {
        setAviso(`Esta loja já tem ${ITENS_MAXIMOS_POR_LOJA} itens, que é o máximo.`);
        return false;
      }
      const linha = {
        id: crypto.randomUUID(),
        loja_id: lojaId,
        room_code: codigo,
        nome: novo.nome,
        descricao: novo.descricao ?? "",
        preco_pc: novo.preco_pc,
        estoque: novo.estoque ?? null,
        peso: novo.peso ?? 0,
        magico: novo.magico ?? false,
        raridade: novo.raridade ?? "",
      };
      const { data, error } = await supabase.from("loja_itens").insert(linha).select();
      if (error) return falhou("adicionarItemDaLoja", error);
      const criado = (data ?? []).map(normalizarItemDaLoja).find((x): x is ItemDaLoja => x !== null);
      if (criado) setItens((atual) => juntar(atual, criado));
      setAviso(null);
      return true;
    },
    [codigo, falhou],
  );

  const atualizarItem = useCallback<LojaHook["atualizarItem"]>(
    async (id, mudanca) => {
      const antes = refItens.current;
      setItens((atual) => atual.map((x) => (x.id === id ? { ...x, ...mudanca } : x)));
      const { error } = await supabase.from("loja_itens").update(mudanca).eq("id", id);
      if (error) {
        setItens(antes);
        return falhou("atualizarItemDaLoja", error);
      }
      setAviso(null);
      return true;
    },
    [falhou],
  );

  const apagarItem = useCallback<LojaHook["apagarItem"]>(
    async (id) => {
      const antes = refItens.current;
      setItens((atual) => atual.filter((x) => x.id !== id));
      const { error } = await supabase.from("loja_itens").delete().eq("id", id);
      if (error) {
        setItens(antes);
        return falhou("apagarItemDaLoja", error);
      }
      setAviso(null);
      return true;
    },
    [falhou],
  );

  /** Muda o estoque por `delta` só se ele ainda for o que li; repete se alguém mexeu junto. */
  const ajustarEstoque = useCallback(async (id: string, delta: number): Promise<boolean> => {
    for (let t = 0; t < TENTATIVAS; t++) {
      const lida = await supabase.from("loja_itens").select("estoque").eq("id", id).maybeSingle();
      if (lida.error) {
        relatarErro("lerEstoqueDaLoja", lida.error);
        return false;
      }
      if (!lida.data) return false; // o Mestre tirou o item da loja
      const atual = lida.data.estoque as number | null;
      if (atual === null) return true; // sempre tem: nada a descontar
      const novo = atual + delta;
      if (novo < 0) return false;
      const r = await supabase.from("loja_itens").update({ estoque: novo }).eq("id", id).eq("estoque", atual).select("id");
      if (r.error) {
        relatarErro("ajustarEstoqueDaLoja", r.error);
        return false;
      }
      if ((r.data ?? []).length > 0) {
        setItens((lista) => lista.map((x) => (x.id === id ? { ...x, estoque: novo } : x)));
        return true;
      }
      // Alguém mexeu entre a leitura e a escrita: lê de novo e tenta outra vez.
    }
    return false;
  }, []);

  const tirarEstoque = useCallback<LojaHook["tirarEstoque"]>((id, qtd) => ajustarEstoque(id, -qtd), [ajustarEstoque]);
  const devolverEstoque = useCallback<LojaHook["devolverEstoque"]>((id, qtd) => ajustarEstoque(id, qtd), [ajustarEstoque]);

  return { lojas, itens, carregando, indisponivel, aviso, criarLoja, atualizarLoja, apagarLoja, adicionarItem, atualizarItem, apagarItem, tirarEstoque, devolverEstoque };
}
