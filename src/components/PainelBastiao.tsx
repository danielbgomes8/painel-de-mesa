"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { InstalacaoBastiao } from "@/lib/tipos";
import {
  descricaoInstalacao,
  EVENTOS_BASTIAO_DMG,
  INSTALACOES_BASICAS_DMG,
  INSTALACOES_ESPECIAIS_DMG,
  ORDENS_BASTIAO,
  PROGRESSAO_INSTALACOES_ESPECIAIS,
  TAMANHOS_INSTALACAO,
} from "@/lib/bastiaoDmg";
import { CampoNumero } from "@/components/CampoNumero";
import { CampoTexto } from "@/components/CampoTexto";

/** Painel do Bastião (DMG 2024, cap. 8) — um só, compartilhado pela mesa;
 *  só o Mestre mexe, os jogadores acompanham (mesmo padrão do Diário). */
export function PainelBastiao({ sala, souMestre }: { sala: Sala; souMestre: boolean }) {
  const { bastiao, instalacoesBastiao: instalacoes } = sala;
  const especiais = instalacoes.filter((i) => i.categoria === "especial");
  const basicas = instalacoes.filter((i) => i.categoria === "basica");

  async function avancarTurno() {
    const proximo = await sala.definirBastiao((atual) => ({ turno: atual.turno + 1 }));
    sala.registrarLogBastiao(`Turno ${proximo.turno} começou`);
  }

  return (
    <div className="combat">
      <div className="combat-head">
        <h2>Bastião</h2>
        <div className="round">
          Turno <b>{bastiao.turno}</b>
        </div>
      </div>

      <div className="combatctrls" style={{ marginBottom: 14 }}>
        {souMestre && (
          <button type="button" className="btn primary" onClick={avancarTurno}>
            Próximo turno →
          </button>
        )}
        <span className="bastiaostat">
          Tesouro{" "}
          {souMestre ? (
            <CampoNumero className="campnum" valor={bastiao.tesouro_po} onCommit={(n) => sala.definirBastiao({ tesouro_po: Math.max(0, n) })} />
          ) : (
            <b>{bastiao.tesouro_po}</b>
          )}{" "}
          PO
        </span>
        <span className="bastiaostat">
          Defensores{" "}
          {souMestre ? (
            <CampoNumero className="campnum" valor={bastiao.defensores} onCommit={(n) => sala.definirBastiao({ defensores: Math.max(0, n) })} />
          ) : (
            <b>{bastiao.defensores}</b>
          )}
        </span>
      </div>

      <span className="sectitle">Instalações especiais ({especiais.length})</span>
      <p className="empty-note" style={{ padding: "0 0 8px" }}>
        Progressão oficial: {PROGRESSAO_INSTALACOES_ESPECIAIS.map((p) => `nv.${p.nivel}→${p.total}`).join(" · ")}
      </p>
      <div className="reslist" style={{ marginBottom: 12 }}>
        {especiais.map((i) => (
          <LinhaInstalacao key={i.id} instalacao={i} sala={sala} editavel={souMestre} />
        ))}
      </div>
      {souMestre && (
        <div className="chips" style={{ marginBottom: 16 }}>
          {INSTALACOES_ESPECIAIS_DMG.map((m) => (
            <button
              key={m.name}
              type="button"
              className="chip"
              title={`nível ${m.nivel} · ${m.descricao}${m.prerequisito ? ` · ${m.prerequisito}` : ""}`}
              onClick={() =>
                sala.criarInstalacaoBastiao({
                  name: m.name,
                  categoria: "especial",
                  tamanho: "Apertado",
                  nivel_min: m.nivel,
                  ordem: m.ordem,
                })
              }
            >
              {m.name} · nv.{m.nivel}
            </button>
          ))}
        </div>
      )}

      <span className="sectitle">Instalações básicas ({basicas.length}) — só cenário, sem efeito de jogo</span>
      <div className="reslist" style={{ marginBottom: 12 }}>
        {basicas.map((i) => (
          <LinhaInstalacao key={i.id} instalacao={i} sala={sala} editavel={souMestre} />
        ))}
      </div>
      {souMestre && (
        <div className="chips" style={{ marginBottom: 16 }}>
          {INSTALACOES_BASICAS_DMG.map((b) => (
            <button
              key={b.name}
              type="button"
              className="chip"
              title={b.descricao}
              onClick={() => sala.criarInstalacaoBastiao({ name: b.name, categoria: "basica" })}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      <details className="bastiaoeventos">
        <summary>Tabela de eventos (d100) — referência rápida</summary>
        <div className="eventoslist">
          {EVENTOS_BASTIAO_DMG.map((e) => (
            <div key={e.nome} className="eventorow">
              <span className="mono">{e.faixa}</span>
              <span>{e.nome}</span>
            </div>
          ))}
        </div>
      </details>

      {souMestre && <RegistrarEvento sala={sala} />}

      {sala.logBastiao.length > 0 && (
        <div className="loglist" style={{ marginTop: 14 }}>
          {sala.logBastiao.map((l) => (
            <div key={l.id} className="logrow">
              <span className="hora">
                {new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span>{l.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LinhaInstalacao({
  instalacao: i,
  sala,
  editavel,
}: {
  instalacao: InstalacaoBastiao;
  sala: Sala;
  editavel: boolean;
}) {
  const patch = (mudanca: Partial<InstalacaoBastiao>) => sala.atualizarInstalacaoBastiao(i.id, mudanca);
  return (
    <div className={`resrow${i.ativa ? "" : " inativa"}`} title={descricaoInstalacao(i.name)}>
      {editavel ? (
        <CampoTexto valor={i.name} maxLength={40} onCommit={(v) => patch({ name: v })} />
      ) : (
        <span>{i.name}</span>
      )}
      {editavel ? (
        <select value={i.tamanho} onChange={(e) => patch({ tamanho: e.target.value as InstalacaoBastiao["tamanho"] })}>
          {TAMANHOS_INSTALACAO.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      ) : (
        <span className="empty-note" style={{ padding: 0 }}>
          {i.tamanho}
        </span>
      )}
      {i.categoria === "especial" &&
        (editavel ? (
          <select value={i.ordem} onChange={(e) => patch({ ordem: e.target.value })}>
            <option value="">sem ordem</option>
            {ORDENS_BASTIAO.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <span className="empty-note" style={{ padding: 0 }}>
            {i.ordem || "sem ordem"}
          </span>
        ))}
      {editavel ? (
        <CampoTexto
          valor={i.contratado}
          maxLength={40}
          placeholder="contratado"
          onCommit={(v) => patch({ contratado: v })}
        />
      ) : (
        i.contratado && (
          <span className="empty-note" style={{ padding: 0 }}>
            {i.contratado}
          </span>
        )
      )}
      {editavel ? (
        <button type="button" className={`chip flag${i.ativa ? "" : " danger"}`} aria-pressed={!i.ativa} onClick={() => patch({ ativa: !i.ativa })}>
          {i.ativa ? "ativa" : "inativa"}
        </button>
      ) : (
        <span className={`chip flag${i.ativa ? "" : " danger"}`}>{i.ativa ? "ativa" : "inativa"}</span>
      )}
      {editavel && (
        <button
          type="button"
          className="rm"
          aria-label={`remover ${i.name}`}
          onClick={() => {
            if (confirm(`Remover "${i.name}" do Bastião?`)) sala.removerInstalacaoBastiao(i.id);
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function RegistrarEvento({ sala }: { sala: Sala }) {
  const [texto, setTexto] = useState("");
  function registrar() {
    if (!texto.trim()) return;
    sala.registrarLogBastiao(texto.trim());
    setTexto("");
  }
  return (
    <div className="addcombatant" style={{ marginTop: 12 }}>
      <input
        type="text"
        placeholder="registrar evento/resultado deste turno..."
        maxLength={300}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") registrar();
        }}
      />
      <button type="button" className="btn" onClick={registrar} disabled={!texto.trim()}>
        + registrar
      </button>
    </div>
  );
}
