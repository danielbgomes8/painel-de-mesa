"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { prepararImagem, ErroDeImagem } from "@/lib/imagem";
import { caminhoDaImagem, ehTabelaAusente, gradePxParaQuadrados, normalizarCena, type Cena } from "@/lib/cenas";

const BUCKET = "mapas";
const AVISO_NAO_SALVOU = "Não salvou. Confira a conexão e tente de novo.";
/** De quanto em quanto tempo tenta ler os mapas de novo depois de uma falha. */
const INTERVALO_TENTATIVA_MS = 10_000;

export type ResultadoCriarCena = { ok: true; cena: Cena } | { ok: false; erro: string };

export type Cenas = {
  cenas: Cena[];
  carregando: boolean;
  /** As tabelas de mapa ainda não existem no banco (migration 0018 não rodada). */
  indisponivel: boolean;
  /** A cena que a mesa está vendo agora, se houver. */
  naMesa: Cena | null;
  /** Último aviso de escrita que falhou; some sozinho quando a próxima dá certo. */
  aviso: string | null;
  urlDaImagem: (c: Cena) => string | null;
  /** Reduz a imagem, sobe e cria a cena. `etapa` conta o que está fazendo. */
  criarCena: (arquivo: File, etapa?: (texto: string) => void) => Promise<ResultadoCriarCena>;
  atualizarCena: (id: string, mudanca: Partial<Omit<Cena, "id" | "room_code" | "created_at">>) => Promise<boolean>;
  apagarCena: (id: string) => Promise<boolean>;
  /** Põe a cena na tela da mesa (telão e celulares); `null` tira o mapa da mesa. */
  mandarParaMesa: (id: string | null) => Promise<boolean>;
};

/**
 * As cenas (mapas) da sala. Mora fora do `useSala` de propósito: canal próprio,
 * pra que um problema aqui — a migration ainda não rodada, uma imagem pesada —
 * nunca derrube o combate. Carrega só as linhas (pequenas); a névoa de cada
 * cena é lida à parte, por `useNevoa`, só de quem abre aquela cena.
 */
export function useCenas(codigo: string): Cenas {
  const [cenas, setCenas] = useState<Cena[]>([]);
  const [carregando, setCarregando] = useState(supabaseConfigurado);
  const [indisponivel, setIndisponivel] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const ref = useRef<Cena[]>([]);
  useEffect(() => {
    ref.current = cenas;
  }, [cenas]);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let vivo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;

    // Se a última leitura falhou (internet instável, banco acordando), o
    // relógio lá embaixo tenta de novo. Antes, uma falha na PRIMEIRA leitura
    // deixava o telão sem mapa até alguém recarregar a página: nem o canal de
    // tempo real nem os avisos de "voltou" chegavam a ser ligados.
    let falhou = false;

    // Devolve false só quando as tabelas de mapa não existem — aí não há o que esperar.
    async function carregar(): Promise<boolean> {
      const { data, error } = await supabase
        .from("cenas")
        .select("*")
        .eq("room_code", codigo)
        .order("created_at", { ascending: true });
      if (!vivo) return false;
      if (error) {
        setCarregando(false);
        if (ehTabelaAusente(error)) {
          setIndisponivel(true);
          return false;
        }
        relatarErro("lerCenas", error);
        falhou = true;
        return true;
      }
      falhou = false;
      setIndisponivel(false);
      setCenas((data ?? []).map(normalizarCena).filter((c): c is Cena => c !== null));
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
        .channel(`cenas:${codigo}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "cenas", filter: `room_code=eq.${codigo}` },
          (msg) => {
            if (msg.eventType === "DELETE") {
              const id = (msg.old as { id?: string }).id;
              setCenas((atual) => atual.filter((c) => c.id !== id));
              return;
            }
            const nova = normalizarCena(msg.new);
            if (!nova) return;
            setCenas((atual) =>
              atual.some((c) => c.id === nova.id) ? atual.map((c) => (c.id === nova.id ? nova : c)) : [...atual, nova],
            );
          },
        )
        // Cada reconexão do canal passa por aqui: o tempo real não repassa o
        // que mudou enquanto estava caído (mesma lição do useSala).
        .subscribe((status) => {
          if (vivo && status === "SUBSCRIBED") void carregar();
        });
    });

    // Mesmo ritmo do useSala: "conectado no wi-fi" sem internet não dispara
    // o aviso de "online", e o telão fica com a tela sempre visível.
    const relogio = window.setInterval(() => {
      if (falhou && navigator.onLine !== false) void carregar();
    }, INTERVALO_TENTATIVA_MS);

    return () => {
      vivo = false;
      window.clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", aoVoltar);
      if (canal) supabase.removeChannel(canal);
    };
  }, [codigo]);

  const urlDaImagem = useCallback((c: Cena): string | null => {
    if (!c.imagem) return null;
    return supabase.storage.from(BUCKET).getPublicUrl(c.imagem).data.publicUrl;
  }, []);

  const atualizarCena = useCallback<Cenas["atualizarCena"]>(async (id, mudanca) => {
    const antes = ref.current;
    setCenas((atual) => atual.map((c) => (c.id === id ? { ...c, ...mudanca } : c)));
    const { error } = await supabase.from("cenas").update(mudanca).eq("id", id);
    if (error) {
      relatarErro("atualizarCena", error);
      setCenas(antes);
      setAviso(AVISO_NAO_SALVOU);
      return false;
    }
    setAviso(null);
    return true;
  }, []);

  const mandarParaMesa = useCallback<Cenas["mandarParaMesa"]>(async (id) => {
    const antes = ref.current;
    const naMesaAgora = antes.find((c) => c.na_mesa);
    if (naMesaAgora?.id === id) return true;
    setCenas((atual) => atual.map((c) => ({ ...c, na_mesa: c.id === id })));
    // Duas escritas, nessa ordem: o banco só aceita UMA cena na mesa por sala,
    // então a antiga sai antes da nova entrar.
    if (naMesaAgora) {
      const { error } = await supabase.from("cenas").update({ na_mesa: false }).eq("id", naMesaAgora.id);
      if (error) {
        relatarErro("mandarParaMesa", error);
        setCenas(antes);
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
    }
    if (id) {
      const { error } = await supabase.from("cenas").update({ na_mesa: true }).eq("id", id);
      if (error) {
        relatarErro("mandarParaMesa", error);
        // A antiga já saiu: a mesa fica sem mapa, nunca com dois.
        setCenas((atual) => atual.map((c) => ({ ...c, na_mesa: false })));
        setAviso(AVISO_NAO_SALVOU);
        return false;
      }
    }
    setAviso(null);
    return true;
  }, []);

  const criarCena = useCallback<Cenas["criarCena"]>(
    async (arquivo, etapa) => {
      let pronta;
      try {
        etapa?.("Reduzindo a imagem…");
        pronta = await prepararImagem(arquivo);
      } catch (e) {
        return { ok: false, erro: e instanceof ErroDeImagem ? e.message : "Não deu pra preparar essa imagem." };
      }

      const id = crypto.randomUUID();
      const caminho = caminhoDaImagem(codigo, id);
      etapa?.("Enviando o mapa…");
      const envio = await supabase.storage
        .from(BUCKET)
        .upload(caminho, pronta.blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
      if (envio.error) {
        relatarErro("enviarMapa", envio.error);
        return { ok: false, erro: "Não deu pra enviar o mapa. Confira a conexão e tente de novo." };
      }

      etapa?.("Criando a cena…");
      const linha = {
        id,
        room_code: codigo,
        nome: "",
        imagem: caminho,
        largura: pronta.largura,
        altura: pronta.altura,
        // Ponto de partida: 30 quadradinhos na largura; o Mestre acerta depois.
        grade_px: gradePxParaQuadrados(pronta.largura, 30),
      };
      const { data, error } = await supabase.from("cenas").insert(linha).select().single();
      const nova = error ? null : normalizarCena(data);
      if (error || !nova) {
        if (error) relatarErro("criarCena", error);
        // Imagem sem cena é lixo no Storage: tira (se não der, fica — não atrapalha).
        await supabase.storage.from(BUCKET).remove([caminho]);
        return { ok: false, erro: "Subiu a imagem mas não deu pra criar a cena. Tente de novo." };
      }
      setCenas((atual) => (atual.some((c) => c.id === nova.id) ? atual : [...atual, nova]));
      setAviso(null);
      return { ok: true, cena: nova };
    },
    [codigo],
  );

  const apagarCena = useCallback<Cenas["apagarCena"]>(async (id) => {
    const antes = ref.current;
    const cena = antes.find((c) => c.id === id);
    setCenas((atual) => atual.filter((c) => c.id !== id));
    // A névoa dela some junto (on delete cascade).
    const { error } = await supabase.from("cenas").delete().eq("id", id);
    if (error) {
      relatarErro("apagarCena", error);
      setCenas(antes);
      setAviso(AVISO_NAO_SALVOU);
      return false;
    }
    if (cena?.imagem) await supabase.storage.from(BUCKET).remove([cena.imagem]);
    setAviso(null);
    return true;
  }, []);

  const naMesa = cenas.find((c) => c.na_mesa) ?? null;
  return { cenas, carregando, indisponivel, naMesa, aviso, urlDaImagem, criarCena, atualizarCena, apagarCena, mandarParaMesa };
}
