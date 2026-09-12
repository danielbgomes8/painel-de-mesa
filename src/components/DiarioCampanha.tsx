"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { EntradaDiario } from "@/lib/tipos";
import { CampoTexto } from "@/components/CampoTexto";
import { CampoTextoAdiado } from "@/components/CampoTextoAdiado";
import { BotaoRemover } from "@/components/BotaoRemover";

/** Resumo por sessão, escrito pelo Mestre, visível pra todo mundo — pra
 *  lembrar "onde paramos" na próxima mesa. */
export function DiarioCampanha({ sala, souMestre }: { sala: Sala; souMestre: boolean }) {
  return (
    <div className="combat">
      <div className="combat-head">
        <h2>Diário da campanha</h2>
      </div>

      {sala.diario.length === 0 && (
        <p className="empty-note">
          {souMestre ? "Nenhuma entrada ainda — registre um resumo ao fim da sessão." : "Nada registrado ainda."}
        </p>
      )}

      <div className="diariolist">
        {sala.diario.map((e) => (
          <EntradaDiarioRow key={e.id} entrada={e} sala={sala} editavel={souMestre} />
        ))}
      </div>

      {souMestre && <FormNovaEntrada sala={sala} />}
    </div>
  );
}

function EntradaDiarioRow({
  entrada: e,
  sala,
  editavel,
}: {
  entrada: EntradaDiario;
  sala: Sala;
  editavel: boolean;
}) {
  const patch = (mudanca: Partial<EntradaDiario>) => sala.atualizarEntradaDiario(e.id, mudanca);
  return (
    <div className="diarioentry">
      <div className="diarioentryhead">
        {editavel ? (
          <CampoTexto valor={e.title} maxLength={80} placeholder="título" onCommit={(v) => patch({ title: v })} />
        ) : (
          <h3>{e.title || "Sessão"}</h3>
        )}
        <span className="hora">{new Date(e.created_at).toLocaleDateString("pt-BR")}</span>
        {editavel && (
          <BotaoRemover
            aria={`remover entrada ${e.title}`}
            confirmar="Remover essa entrada do diário?"
            onConfirmar={() => sala.removerEntradaDiario(e.id)}
          />
        )}
      </div>
      {editavel ? (
        <CampoTextoAdiado
          valor={e.text}
          maxLength={2000}
          placeholder="o que aconteceu nessa sessão..."
          onSalvar={(texto) => patch({ text: texto })}
        />
      ) : (
        <p>{e.text}</p>
      )}
    </div>
  );
}

function FormNovaEntrada({ sala }: { sala: Sala }) {
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");

  function adicionar() {
    if (!texto.trim()) return;
    sala.criarEntradaDiario({
      title: titulo.trim() || `Sessão de ${new Date().toLocaleDateString("pt-BR")}`,
      text: texto.trim(),
    });
    setTitulo("");
    setTexto("");
  }

  return (
    <div className="npclibform">
      <input
        type="text"
        placeholder="título (opcional)"
        maxLength={80}
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />
      <div className="notesbox">
        <textarea
          placeholder="resumo da sessão..."
          maxLength={2000}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      <button type="button" className="btn" disabled={!texto.trim()} onClick={adicionar}>
        + nova entrada
      </button>
    </div>
  );
}
