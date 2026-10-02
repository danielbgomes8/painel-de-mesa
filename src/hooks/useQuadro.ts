"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { ehTabelaAusente } from "@/lib/cenas";
import { prepararImagem, ErroDeImagem } from "@/lib/imagem";
import type { Identidade } from "@/lib/identidade";
import {
  CARTOES_MAXIMOS,
  LADO_MAXIMO_FOTO,
  caminhoDaFoto,
  normalizarCartao,
  virouDestaque,
  type Cartao,
  type NovoCartao,
} from "@/lib/quadro";

const BUCKET = "mapas";
const AVISO_NAO_SALVOU = "Não salvou. Confira a conexão e tente de novo.";
const AVISO_LIMITE = `A mesa já tem ${CARTOES_MAXIMOS} cartões, que é o máximo.`;

export type ResultadoCartao = { ok: true; cartao: Cartao } | { ok: false; erro: string };
export type ResultadoFoto = { ok: true } | { ok: false; erro: string };

type Mudanca = Partial<Pick<Cartao, "tipo" | "titulo" | "subtitulo" | "texto" | "segredo" | "revelacao" | "coluna">>;

export type Quadro = {
  cartoes: Cartao[];
  carregando: boolean;
  /** A tabela ainda não existe (migration 0024 não rodada): o resto do app funciona. */
  indisponivel: boolean;
  aviso: string | null;
  /** O cartão que o Mestre acabou de mostrar à mesa (tela cheia), se houver. */
  destaque: Cartao | null;
  dispensarDestaque: () => void;
  urlDaFoto: (c: Cartao) => string | null;
  criar: (novo: NovoCartao, foto?: File | null) => Promise<ResultadoCartao>;
  /** Escreve só as colunas pedidas: nunca a linha inteira. */
  atualizar: (id: string, mudanca: Mudanca) => Promise<boolean>;
  trocarFoto: (id: string, arquivo: File) => Promise<ResultadoFoto>;
  tirarFoto: (id: string) => Promise<boolean>;
  remover: (id: string) => Promise<boolean>;
  /** Revela o cartão e manda a foto em tela cheia pra mesa. */
  mostrarAMesa: (id: string) => Promise<boolean>;
};

/**
 * Os cartões do Quadro da Campanha, ao vivo. Canal próprio, fora do `useSala`
 * (um problema aqui nunca derruba o combate), e tolera a tabela não existir —
 * o código vai ao ar antes do SQL. `quem` decide quem recebe o destaque em
 * tela cheia (telão = `null`).
 */
export function useQuadro(codigo: string, quem: Identidade | null): Quadro {
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [carregando, setCarregando] = useState(supabaseConfigurado);
  const [indisponivel, setIndisponivel] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [destaque, setDestaque] = useState<Cartao | null>(null);
  const ref = useRef<Cartao[]>([]);
  const quemRef = useRef(quem);
  useEffect(() => {
    ref.current = cartoes;
    quemRef.current = quem;
  }, [cartoes, quem]);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let vivo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;

    async function carregar(): Promise<boolean> {
      const { data, error } = await supabase
        .from("quadro_cartoes")
        .select("*")
        .eq("room_code", codigo)
        .order("created_at", { ascending: true });
      if (!vivo) return false;
      if (error) {
        if (ehTabelaAusente(error)) setIndisponivel(true);
        else relatarErro("lerQuadro", error);
        setCarregando(false);
        return false;
      }
      setIndisponivel(false);
      // A releitura NÃO dispara destaque: quem estava com a tela apagada não
      // leva um susto com um cartão de minutos atrás.
      setCartoes((data ?? []).map(normalizarCartao).filter((c): c is Cartao => c !== null));
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
        .channel(`quadro:${codigo}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "quadro_cartoes", filter: `room_code=eq.${codigo}` },
          (msg) => {
            if (msg.eventType === "DELETE") {
              const id = (msg.old as { id?: string }).id;
              setCartoes((atual) => atual.filter((c) => c.id !== id));
              setDestaque((d) => (d && d.id === id ? null : d));
              return;
            }
            const nova = normalizarCartao(msg.new);
            if (!nova) return;
            // Quem mandou (o Mestre) não precisa ver a própria revelação em tela cheia.
            if (
              quemRef.current?.tipo !== "mestre" &&
              virouDestaque(ref.current.find((c) => c.id === nova.id), nova, quemRef.current)
            ) {
              setDestaque(nova);
            }
            setCartoes((atual) =>
              atual.some((c) => c.id === nova.id) ? atual.map((c) => (c.id === nova.id ? nova : c)) : [...atual, nova],
            );
          },
        )
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

  const urlDaFoto = useCallback((c: Cartao): string | null => {
    if (!c.foto) return null;
    return supabase.storage.from(BUCKET).getPublicUrl(c.foto).data.publicUrl;
  }, []);

  /** Reduz e sobe a foto; devolve o caminho ou a mensagem pronta pra tela. */
  const subirFoto = useCallback(
    async (idCartao: string, arquivo: File): Promise<{ caminho: string } | { erro: string }> => {
      let pronta;
      try {
        pronta = await prepararImagem(arquivo, LADO_MAXIMO_FOTO);
      } catch (e) {
        return { erro: e instanceof ErroDeImagem ? e.message : "Não deu pra preparar essa imagem." };
      }
      const caminho = caminhoDaFoto(codigo, idCartao, Date.now().toString(36));
      const envio = await supabase.storage
        .from(BUCKET)
        .upload(caminho, pronta.blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
      if (envio.error) {
        relatarErro("enviarFotoDoCartao", envio.error);
        return { erro: "Não deu pra enviar a foto. Confira a conexão e tente de novo." };
      }
      return { caminho };
    },
    [codigo],
  );

  const atualizar = useCallback<Quadro["atualizar"]>(async (id, mudanca) => {
    const antes = ref.current;
    setCartoes((atual) => atual.map((c) => (c.id === id ? { ...c, ...mudanca } : c)));
    const { error } = await supabase.from("quadro_cartoes").update(mudanca).eq("id", id);
    if (error) {
      relatarErro("atualizarCartao", error);
      setCartoes(antes);
      setAviso(AVISO_NAO_SALVOU);
      return false;
    }
    setAviso(null);
    return true;
  }, []);

  const criar = useCallback<Quadro["criar"]>(
    async (novo, foto) => {
      if (ref.current.length >= CARTOES_MAXIMOS) {
        setAviso(AVISO_LIMITE);
        return { ok: false, erro: AVISO_LIMITE };
      }
      const id = crypto.randomUUID();
      let caminho: string | null = null;
      if (foto) {
        const r = await subirFoto(id, foto);
        if ("erro" in r) return { ok: false, erro: r.erro };
        caminho = r.caminho;
      }
      const linha = {
        id,
        room_code: codigo,
        tipo: novo.tipo,
        titulo: novo.titulo,
        subtitulo: novo.subtitulo ?? "",
        texto: novo.texto ?? "",
        segredo: novo.segredo ?? "",
        revelacao: novo.revelacao ?? "escondido",
        dono: novo.dono,
        coluna: novo.coluna ?? "",
        foto: caminho,
      };
      const { data, error } = await supabase.from("quadro_cartoes").insert(linha).select().single();
      const criado = error ? null : normalizarCartao(data);
      if (error || !criado) {
        if (error) relatarErro("criarCartao", error);
        if (caminho) await supabase.storage.from(BUCKET).remove([caminho]);
        return { ok: false, erro: "Não deu pra criar o cartão. Confira a conexão e tente de novo." };
      }
      setCartoes((atual) => (atual.some((c) => c.id === criado.id) ? atual : [...atual, criado]));
      setAviso(null);
      return { ok: true, cartao: criado };
    },
    [codigo, subirFoto],
  );

  const trocarFoto = useCallback<Quadro["trocarFoto"]>(
    async (id, arquivo) => {
      const antiga = ref.current.find((c) => c.id === id)?.foto ?? null;
      const r = await subirFoto(id, arquivo);
      if ("erro" in r) return { ok: false, erro: r.erro };
      const { error } = await supabase.from("quadro_cartoes").update({ foto: r.caminho }).eq("id", id);
      if (error) {
        relatarErro("trocarFotoDoCartao", error);
        await supabase.storage.from(BUCKET).remove([r.caminho]);
        return { ok: false, erro: AVISO_NAO_SALVOU };
      }
      setCartoes((atual) => atual.map((c) => (c.id === id ? { ...c, foto: r.caminho } : c)));
      if (antiga) await supabase.storage.from(BUCKET).remove([antiga]);
      return { ok: true };
    },
    [subirFoto],
  );

  const tirarFoto = useCallback<Quadro["tirarFoto"]>(async (id) => {
    const antiga = ref.current.find((c) => c.id === id)?.foto ?? null;
    if (!antiga) return true;
    const { error } = await supabase.from("quadro_cartoes").update({ foto: null }).eq("id", id);
    if (error) {
      relatarErro("tirarFotoDoCartao", error);
      setAviso(AVISO_NAO_SALVOU);
      return false;
    }
    setCartoes((atual) => atual.map((c) => (c.id === id ? { ...c, foto: null } : c)));
    await supabase.storage.from(BUCKET).remove([antiga]);
    return true;
  }, []);

  const remover = useCallback<Quadro["remover"]>(async (id) => {
    const antes = ref.current;
    const foto = antes.find((c) => c.id === id)?.foto ?? null;
    setCartoes((atual) => atual.filter((c) => c.id !== id));
    const { error } = await supabase.from("quadro_cartoes").delete().eq("id", id);
    if (error) {
      relatarErro("removerCartao", error);
      setCartoes(antes);
      setAviso(AVISO_NAO_SALVOU);
      return false;
    }
    if (foto) await supabase.storage.from(BUCKET).remove([foto]);
    setAviso(null);
    return true;
  }, []);

  const mostrarAMesa = useCallback<Quadro["mostrarAMesa"]>(async (id) => {
    const antes = ref.current;
    const agora = new Date().toISOString();
    // Revelar e destacar numa escrita só: ninguém recebe o destaque de um
    // cartão que ainda estaria escondido pra ele.
    const mudanca = { revelacao: "revelado" as const, destaque_em: agora };
    setCartoes((atual) => atual.map((c) => (c.id === id ? { ...c, ...mudanca } : c)));
    const { error } = await supabase.from("quadro_cartoes").update(mudanca).eq("id", id);
    if (error) {
      relatarErro("mostrarCartaoAMesa", error);
      setCartoes(antes);
      setAviso(AVISO_NAO_SALVOU);
      return false;
    }
    setAviso(null);
    return true;
  }, []);

  const dispensarDestaque = useCallback(() => setDestaque(null), []);

  return {
    cartoes,
    carregando,
    indisponivel,
    aviso,
    destaque,
    dispensarDestaque,
    urlDaFoto,
    criar,
    atualizar,
    trocarFoto,
    tirarFoto,
    remover,
    mostrarAMesa,
  };
}
