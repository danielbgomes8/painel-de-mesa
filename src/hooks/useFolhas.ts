"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { ehTabelaAusente } from "@/lib/cenas";
import { ErroDeImagem, prepararImagem } from "@/lib/imagem";
import { FOLHAS_MAXIMAS, LADO_MAXIMO_DA_FOLHA, caminhoDaFolha, normalizarFolha, type Folha, type NovaFolha } from "@/lib/folhas";

const BUCKET = "mapas";
const AVISO_NAO_SALVOU = "Não salvou a folha. Confira a conexão e tente de novo.";
const AVISO_LIMITE = `Já existem ${FOLHAS_MAXIMAS} folhas, que é o máximo. Apague alguma antiga.`;

export type Folhas = {
  folhas: Folha[];
  carregando: boolean;
  /** A tabela ainda não existe (migration 0037 não rodada): o resto do app funciona. */
  indisponivel: boolean;
  aviso: string | null;
  urlDaFoto: (f: Pick<Folha, "foto">) => string | null;
  /** Cria como rascunho (só o Mestre vê); `foto` é reduzida e enviada junto. */
  criar: (nova: NovaFolha, foto?: File | null) => Promise<{ ok: true } | { ok: false; erro: string }>;
  /** Muda o texto, o destino e/ou a foto (`foto`: arquivo novo, null = tirar, undefined = deixar). */
  editar: (id: string, mudanca: Partial<NovaFolha>, foto?: File | null) => Promise<{ ok: true } | { ok: false; erro: string }>;
  /** Entrega (quem recebeu passa a ver) ou recolhe de volta pra rascunho. */
  entregar: (id: string, entregue: boolean) => Promise<boolean>;
  remover: (id: string) => Promise<boolean>;
};

function juntar(atual: Folha[], nova: Folha): Folha[] {
  return atual.some((f) => f.id === nova.id) ? atual.map((f) => (f.id === nova.id ? nova : f)) : [...atual, nova];
}

/**
 * As folhas de entrega da sala, ao vivo. Canal próprio, fora do `useSala`, e tolera a tabela não existir (o código
 * vai ao ar antes do SQL; mesmo desenho do `useBau` e do `useQuadro`). Este hook entrega TODAS as linhas: quem vê o
 * quê é `folhasVisiveis` (lib/folhas.ts), porque o banco é aberto.
 */
export function useFolhas(codigo: string): Folhas {
  const [folhas, setFolhas] = useState<Folha[]>([]);
  const [carregando, setCarregando] = useState(supabaseConfigurado);
  const [indisponivel, setIndisponivel] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const ref = useRef<Folha[]>([]);
  useEffect(() => {
    ref.current = folhas;
  }, [folhas]);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let vivo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;

    async function carregar(): Promise<boolean> {
      const { data, error } = await supabase.from("folhas").select("*").eq("room_code", codigo).order("created_at", { ascending: true });
      if (!vivo) return false;
      if (error) {
        if (ehTabelaAusente(error)) setIndisponivel(true);
        else relatarErro("lerFolhas", error);
        setCarregando(false);
        return false;
      }
      setIndisponivel(false);
      setFolhas((data ?? []).map(normalizarFolha).filter((f): f is Folha => f !== null));
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
        .channel(`folhas:${codigo}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "folhas", filter: `room_code=eq.${codigo}` }, (msg) => {
          if (msg.eventType === "DELETE") {
            const id = (msg.old as { id?: string }).id;
            setFolhas((atual) => atual.filter((f) => f.id !== id));
            return;
          }
          const nova = normalizarFolha(msg.new);
          if (nova) setFolhas((atual) => juntar(atual, nova));
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

  const urlDaFoto = useCallback((f: Pick<Folha, "foto">): string | null => {
    if (!f.foto) return null;
    return supabase.storage.from(BUCKET).getPublicUrl(f.foto).data.publicUrl;
  }, []);

  /** Reduz e sobe a foto; devolve o caminho ou a mensagem pronta pra tela. */
  const subirFoto = useCallback(
    async (idFolha: string, arquivo: File): Promise<{ caminho: string } | { erro: string }> => {
      let pronta;
      try {
        pronta = await prepararImagem(arquivo, LADO_MAXIMO_DA_FOLHA);
      } catch (e) {
        return { erro: e instanceof ErroDeImagem ? e.message : "Não deu pra preparar essa imagem." };
      }
      const caminho = caminhoDaFolha(codigo, idFolha, Date.now().toString(36));
      const envio = await supabase.storage.from(BUCKET).upload(caminho, pronta.blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
      if (envio.error) {
        relatarErro("enviarFotoDaFolha", envio.error);
        return { erro: "Não deu pra enviar a foto. Confira a conexão e tente de novo." };
      }
      return { caminho };
    },
    [codigo],
  );

  const criar = useCallback<Folhas["criar"]>(
    async (nova, foto) => {
      if (ref.current.length >= FOLHAS_MAXIMAS) {
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
      const linha = { id, room_code: codigo, titulo: nova.titulo, texto: nova.texto, para: nova.para, foto: caminho };
      const { data, error } = await supabase.from("folhas").insert(linha).select();
      if (error) {
        relatarErro("criarFolha", error);
        if (caminho) await supabase.storage.from(BUCKET).remove([caminho]);
        setAviso(AVISO_NAO_SALVOU);
        return { ok: false, erro: AVISO_NAO_SALVOU };
      }
      const criada = (data ?? []).map(normalizarFolha).find((f): f is Folha => f !== null);
      if (criada) setFolhas((atual) => juntar(atual, criada));
      setAviso(null);
      return { ok: true };
    },
    [codigo, subirFoto],
  );

  const editar = useCallback<Folhas["editar"]>(
    async (id, mudanca, foto) => {
      const antiga = ref.current.find((f) => f.id === id);
      if (!antiga) return { ok: false, erro: "Essa folha não existe mais." };
      const patch: Record<string, unknown> = { ...mudanca };
      let novoCaminho: string | null | undefined;
      if (foto) {
        const r = await subirFoto(id, foto);
        if ("erro" in r) return { ok: false, erro: r.erro };
        novoCaminho = r.caminho;
        patch.foto = novoCaminho;
      } else if (foto === null) {
        novoCaminho = null;
        patch.foto = null;
      }
      const { error } = await supabase.from("folhas").update(patch).eq("id", id);
      if (error) {
        relatarErro("editarFolha", error);
        if (novoCaminho) await supabase.storage.from(BUCKET).remove([novoCaminho]);
        setAviso(AVISO_NAO_SALVOU);
        return { ok: false, erro: AVISO_NAO_SALVOU };
      }
      setFolhas((atual) => atual.map((f) => (f.id === id ? { ...f, ...mudanca, ...(novoCaminho !== undefined ? { foto: novoCaminho } : {}) } : f)));
      if (novoCaminho !== undefined && antiga.foto) await supabase.storage.from(BUCKET).remove([antiga.foto]);
      setAviso(null);
      return { ok: true };
    },
    [subirFoto],
  );

  const entregar = useCallback<Folhas["entregar"]>(async (id, entregue) => {
    const antes = ref.current;
    const quando = entregue ? new Date().toISOString() : null;
    setFolhas((atual) => atual.map((f) => (f.id === id ? { ...f, entregue_em: quando } : f)));
    const { error } = await supabase.from("folhas").update({ entregue_em: quando }).eq("id", id);
    if (error) {
      relatarErro("entregarFolha", error);
      setFolhas(antes);
      setAviso(AVISO_NAO_SALVOU);
      return false;
    }
    setAviso(null);
    return true;
  }, []);

  const remover = useCallback<Folhas["remover"]>(async (id) => {
    const antes = ref.current;
    const foto = antes.find((f) => f.id === id)?.foto;
    setFolhas((atual) => atual.filter((f) => f.id !== id));
    const { error } = await supabase.from("folhas").delete().eq("id", id);
    if (error) {
      relatarErro("removerFolha", error);
      setFolhas(antes);
      setAviso(AVISO_NAO_SALVOU);
      return false;
    }
    if (foto) await supabase.storage.from(BUCKET).remove([foto]);
    setAviso(null);
    return true;
  }, []);

  return { folhas, carregando, indisponivel, aviso, urlDaFoto, criar, editar, entregar, remover };
}
