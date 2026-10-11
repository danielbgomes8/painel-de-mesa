"use client";
/* eslint-disable @next/next/no-img-element -- as fotos vêm do Storage do Supabase, já reduzidas no envio */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Folhas } from "@/hooks/useFolhas";
import type { Identidade } from "@/lib/identidade";
import {
  FOLHAS_MAXIMAS,
  TEXTO_MAXIMO,
  TITULO_MAXIMO,
  estaEntregue,
  folhasVisiveis,
  rotuloDoDestino,
  tituloDaFolha,
  type Folha,
} from "@/lib/folhas";
import { BotaoRemover } from "@/components/BotaoRemover";

/**
 * A aba "Folhas" da Campanha. O Mestre escreve, escolhe pra quem vai (um jogador ou a mesa toda) e entrega; o jogador
 * lê o que recebeu. Mesmo desenho do baú e do Quadro: canal próprio, tolera a tabela não existir.
 */
export function FolhasDaCampanha({
  folhas,
  sala,
  identidade,
  aoVer,
}: {
  folhas: Folhas;
  sala: Sala;
  identidade: Identidade | null;
  /** O jogador abriu a lista: estas folhas contam como vistas (some o aviso de "folha nova"). */
  aoVer: (ids: string[]) => void;
}) {
  const souMestre = identidade?.tipo === "mestre";
  const visiveis = useMemo(() => folhasVisiveis(folhas.folhas, identidade), [folhas.folhas, identidade]);
  const nomeDe = (slug: string) => sala.personagens.find((p) => p.slug === slug)?.name ?? "alguém";
  const idsVisiveis = visiveis.map((f) => f.id).join(",");
  useEffect(() => {
    if (!souMestre && idsVisiveis) aoVer(idsVisiveis.split(","));
  }, [souMestre, idsVisiveis, aoVer]);

  if (folhas.indisponivel) {
    return (
      <p className="bkpexplica">
        {souMestre
          ? "As folhas ainda não estão ligadas no banco: falta rodar a migration 0037_perigos_e_folhas.sql no SQL Editor do Supabase. O resto do app funciona sem elas."
          : "O Mestre ainda não ligou as folhas."}
      </p>
    );
  }
  if (folhas.carregando) return <p className="empty-note">Carregando as folhas…</p>;

  return (
    <div className="fol">
      {souMestre && <NovaOuEditarFolha folhas={folhas} sala={sala} aberta={null} aoTerminar={() => undefined} />}
      {folhas.aviso && (
        <p className="mapa-erro" role="alert">
          {folhas.aviso}
        </p>
      )}
      {visiveis.length === 0 ? (
        <p className="empty-note">{souMestre ? `Nenhuma folha ainda (cabem ${FOLHAS_MAXIMAS}). Escreva a primeira acima.` : "Nenhuma folha pra você por enquanto."}</p>
      ) : (
        <ul className="fol-lista">
          {visiveis.map((f) => (
            <ItemDaFolha key={f.id} f={f} folhas={folhas} sala={sala} souMestre={souMestre} nomeDe={nomeDe} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemDaFolha({ f, folhas, sala, souMestre, nomeDe }: { f: Folha; folhas: Folhas; sala: Sala; souMestre: boolean; nomeDe: (slug: string) => string }) {
  const [editando, setEditando] = useState(false);
  const url = folhas.urlDaFoto(f);
  const entregue = estaEntregue(f);
  if (editando) {
    return (
      <li className="fol-item">
        <NovaOuEditarFolha folhas={folhas} sala={sala} aberta={f} aoTerminar={() => setEditando(false)} />
      </li>
    );
  }
  return (
    <li className={entregue ? "fol-item" : "fol-item fol-item--rascunho"}>
      <div className="fol-cabeca">
        <h4 className="fol-titulo">📜 {tituloDaFolha(f)}</h4>
        {souMestre ? (
          <span className="fol-etiqueta">{entregue ? `entregue — ${rotuloDoDestino(f, nomeDe)}` : `rascunho — ${rotuloDoDestino(f, nomeDe)}`}</span>
        ) : (
          <span className="fol-etiqueta">{f.para === null ? "pra mesa toda" : "só pra você"}</span>
        )}
      </div>
      {url && (
        <div className="fol-foto">
          <img src={url} alt={f.titulo ? `Foto da folha ${f.titulo}` : "Foto da folha"} loading="lazy" />
        </div>
      )}
      {f.texto && <p className="fol-texto">{f.texto}</p>}
      {souMestre && (
        <div className="mapa-ferr">
          <button type="button" className={entregue ? "btn" : "btn primary"} onClick={() => void folhas.entregar(f.id, !entregue)}>
            {entregue ? "recolher" : "entregar"}
          </button>
          <button type="button" className="btn" onClick={() => setEditando(true)}>
            editar
          </button>
          <BotaoRemover aria={`Apagar a folha ${tituloDaFolha(f)}`} confirmar={`Apagar a folha "${tituloDaFolha(f)}"? Quem já recebeu perde o acesso.`} onConfirmar={() => void folhas.remover(f.id)} className="minilink">
            apagar
          </BotaoRemover>
        </div>
      )}
    </li>
  );
}

function NovaOuEditarFolha({ folhas, sala, aberta, aoTerminar }: { folhas: Folhas; sala: Sala; aberta: Folha | null; aoTerminar: () => void }) {
  const [titulo, setTitulo] = useState(aberta?.titulo ?? "");
  const [texto, setTexto] = useState(aberta?.texto ?? "");
  const [para, setPara] = useState<string>(aberta?.para ?? "");
  const [foto, setFoto] = useState<File | null>(null);
  const [tirarFoto, setTirarFoto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const jogadores = sala.personagens.filter((p) => !p.is_npc);
  const vazia = !titulo.trim() && !texto.trim() && !foto && !(aberta?.foto && !tirarFoto);

  async function salvar() {
    if (salvando || vazia) return;
    setSalvando(true);
    setErro(null);
    const dados = { titulo: titulo.trim().slice(0, TITULO_MAXIMO), texto: texto.trim().slice(0, TEXTO_MAXIMO), para: para || null };
    const r = aberta ? await folhas.editar(aberta.id, dados, foto ?? (tirarFoto ? null : undefined)) : await folhas.criar(dados, foto);
    setSalvando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    if (!aberta) {
      setTitulo("");
      setTexto("");
      setPara("");
      setFoto(null);
      if (arquivo.current) arquivo.current.value = "";
    }
    aoTerminar();
  }

  return (
    <div className="fol-form">
      <h4 className="fol-form-titulo">{aberta ? "Editar a folha" : "Nova folha"}</h4>
      <input
        type="text"
        className="mapa-aura-campo fol-campo"
        aria-label="Título da folha"
        placeholder="título (ex.: Carta do rei)"
        maxLength={TITULO_MAXIMO}
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />
      <textarea
        className="mapa-aura-campo fol-campo fol-area"
        aria-label="Texto da folha"
        placeholder="o que está escrito"
        maxLength={TEXTO_MAXIMO}
        rows={5}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="mapa-ferr">
        <label className="fol-rotulo">
          Pra quem
          <select className="mapa-aura-campo luz-select" aria-label="Pra quem é a folha" value={para} onChange={(e) => setPara(e.target.value)}>
            <option value="">a mesa toda</option>
            {jogadores.map((p) => (
              <option key={p.slug} value={p.slug}>
                só {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="fol-rotulo">
          Foto
          <input ref={arquivo} type="file" accept="image/*" aria-label="Foto da folha" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
        </label>
        {aberta?.foto && !foto && (
          <label className="checklabel">
            <input type="checkbox" checked={tirarFoto} onChange={(e) => setTirarFoto(e.target.checked)} />
            tirar a foto atual
          </label>
        )}
      </div>
      {erro && (
        <p className="mapa-erro" role="alert">
          {erro}
        </p>
      )}
      <div className="mapa-ferr">
        <button type="button" className="btn primary" disabled={salvando || vazia} onClick={() => void salvar()}>
          {salvando ? "salvando…" : aberta ? "salvar alterações" : "criar rascunho"}
        </button>
        {aberta && (
          <button type="button" className="btn" onClick={aoTerminar}>
            cancelar
          </button>
        )}
      </div>
      {!aberta && <p className="fc-sub">O rascunho só você vê. Quando tocar em “entregar”, quem for o destino passa a ver na aba Campanha → Folhas.</p>}
    </div>
  );
}
