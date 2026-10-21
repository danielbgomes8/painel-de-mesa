"use client";

import { useState } from "react";
import { type Quadro } from "@/hooks/useQuadro";
import { type Identidade } from "@/lib/identidade";
import { FOTOS_MAXIMAS, LIMITE_TITULO, TIPOS_DE_CARTAO, type Cartao, type TipoCartao } from "@/lib/quadro";

export function FormNovoCartao({
  quadro,
  quem,
  aoCriar,
  aoCancelar,
}: {
  quadro: Quadro;
  quem: Identidade;
  aoCriar: (c: Cartao) => void;
  aoCancelar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoCartao>("npc");
  const [titulo, setTitulo] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    if (enviando || !titulo.trim()) return;
    setEnviando(true);
    setErro(null);
    const r = await quadro.criar(
      { tipo, titulo: titulo.trim(), dono: quem.tipo === "jogador" ? quem.slug : null },
      fotos,
    );
    setEnviando(false);
    if (r.ok) aoCriar(r.cartao);
    else setErro(r.erro);
  }

  return (
    <div className="qd-form">
      <p className="qd-formdica">
        {quem.tipo === "mestre"
          ? "Nasce escondido: só você vê até decidir mostrar."
          : "Cartão só seu: ninguém vê até você compartilhar com a mesa."}
      </p>
      <div className="qd-linha">
        <select aria-label="Tipo do cartão" value={tipo} onChange={(e) => setTipo(e.target.value as TipoCartao)}>
          {TIPOS_DE_CARTAO.map((t) => (
            <option key={t.id} value={t.id}>
              {t.emoji} {t.rotulo}
            </option>
          ))}
        </select>
        <input
          type="text"
          aria-label="Nome do cartão"
          placeholder="nome"
          maxLength={LIMITE_TITULO}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void criar();
          }}
        />
      </div>
      <div className="qd-linha">
        <label className="btn ghost qd-arquivo">
          📷 {fotos.length ? "trocar fotos" : `fotos (opcional, até ${FOTOS_MAXIMAS})`}
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              setFotos(Array.from(e.target.files ?? []).slice(0, FOTOS_MAXIMAS));
              e.target.value = "";
            }}
          />
        </label>
        {fotos.length > 0 && <span className="qd-nomearquivo">{fotos.length === 1 ? fotos[0].name : `${fotos.length} fotos`}</span>}
      </div>
      <div className="qd-linha">
        <button type="button" className="btn primary" disabled={enviando || !titulo.trim()} onClick={() => void criar()}>
          {enviando ? "Criando…" : "Criar cartão"}
        </button>
        <button type="button" className="btn ghost" onClick={aoCancelar}>
          cancelar
        </button>
      </div>
      <p className="qd-aviso" role="status" aria-live="polite">
        {erro}
      </p>
    </div>
  );
}
