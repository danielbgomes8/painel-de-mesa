"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { InstalacaoBastiao } from "@/lib/tipos";
import { d100 } from "@/lib/dados";
import { eventoBastiaoPara } from "@/lib/regras";
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
 *  é recurso do grupo, então Mestre e jogadores mexem igual. */
export function PainelBastiao({ sala }: { sala: Sala }) {
  const { bastiao, instalacoesBastiao: instalacoes } = sala;
  const especiais = instalacoes.filter((i) => i.categoria === "especial");
  const basicas = instalacoes.filter((i) => i.categoria === "basica");
  const especiaisAtivas = especiais.filter((i) => i.ativa);
  const trabalhandoAgora = especiaisAtivas.filter((i) => i.ultimo_turno_executado === bastiao.turno).length;
  const [avancando, setAvancando] = useState(false);

  async function avancarTurno() {
    if (avancando) return;
    setAvancando(true);
    const proximo = await sala.definirBastiao((atual) => ({ turno: atual.turno + 1 }));
    setAvancando(false);
    // null = a escrita falhou e o turno já voltou pro valor anterior; não
    // anuncia um avanço que não aconteceu de verdade.
    if (proximo) sala.registrarLogBastiao(`Turno ${proximo.turno} começou`);
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
        <button type="button" className="btn primary" onClick={avancarTurno} disabled={avancando}>
          Próximo turno →
        </button>
        <span className="bastiaostat">
          Tesouro{" "}
          <CampoNumero className="campnum" valor={bastiao.tesouro_po} onCommit={(n) => sala.definirBastiao({ tesouro_po: Math.max(0, n) })} />{" "}
          PO
        </span>
        <span className="bastiaostat">
          Defensores{" "}
          <CampoNumero className="campnum" valor={bastiao.defensores} onCommit={(n) => sala.definirBastiao({ defensores: Math.max(0, n) })} />
        </span>
        {especiaisAtivas.length > 0 && (
          <span className="bastiaostat">
            {trabalhandoAgora}/{especiaisAtivas.length} instalações trabalhando
          </span>
        )}
      </div>

      <span className="sectitle">Instalações especiais ({especiais.length})</span>
      <p className="empty-note" style={{ padding: "0 0 8px" }}>
        Progressão oficial: {PROGRESSAO_INSTALACOES_ESPECIAIS.map((p) => `nv.${p.nivel}→${p.total}`).join(" · ")}
      </p>
      <div className="reslist" style={{ marginBottom: 12 }}>
        {especiais.map((i) => (
          <LinhaInstalacao key={i.id} instalacao={i} sala={sala} />
        ))}
      </div>
      <div style={{ marginBottom: 16 }}>
        {PROGRESSAO_INSTALACOES_ESPECIAIS.map(({ nivel }) => (
          <div key={nivel} style={{ marginBottom: 10 }}>
            <span className="sectitle">Nível {nivel}</span>
            <div className="grid">
              {INSTALACOES_ESPECIAIS_DMG.filter((m) => m.nivel === nivel).map((m) => (
                <button
                  key={m.name}
                  type="button"
                  className="instalacaobtn"
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
                  <div>
                    <span className="nome">{m.name}</span>
                    <span className="nivel">{m.ordem}</span>
                  </div>
                  <p className="instdesc">
                    {m.descricao}
                    {m.prerequisito && ` · pré-requisito: ${m.prerequisito}`}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <span className="sectitle">Instalações básicas ({basicas.length}) — só cenário, sem efeito de jogo</span>
      <div className="reslist" style={{ marginBottom: 12 }}>
        {basicas.map((i) => (
          <LinhaInstalacao key={i.id} instalacao={i} sala={sala} />
        ))}
      </div>
      <div className="grid" style={{ marginBottom: 16 }}>
        {INSTALACOES_BASICAS_DMG.map((b) => (
          <button
            key={b.name}
            type="button"
            className="instalacaobtn"
            onClick={() => sala.criarInstalacaoBastiao({ name: b.name, categoria: "basica" })}
          >
            <span className="nome">{b.name}</span>
            <p className="instdesc">{b.descricao}</p>
          </button>
        ))}
      </div>

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

      <RegistrarEvento sala={sala} />

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

function LinhaInstalacao({ instalacao: i, sala }: { instalacao: InstalacaoBastiao; sala: Sala }) {
  const patch = (mudanca: Partial<InstalacaoBastiao>) => sala.atualizarInstalacaoBastiao(i.id, mudanca);
  const descricao = descricaoInstalacao(i.name);
  const trabalhando = i.ultimo_turno_executado === sala.bastiao.turno;
  return (
    <div>
      <div className={`resrow${i.ativa ? "" : " inativa"}`}>
        <CampoTexto valor={i.name} maxLength={40} onCommit={(v) => patch({ name: v })} />
        <select value={i.tamanho} onChange={(e) => patch({ tamanho: e.target.value as InstalacaoBastiao["tamanho"] })}>
          {TAMANHOS_INSTALACAO.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {i.categoria === "especial" && (
          <select value={i.ordem} onChange={(e) => patch({ ordem: e.target.value })}>
            <option value="">sem ordem</option>
            {ORDENS_BASTIAO.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}
        <CampoTexto
          valor={i.contratado}
          maxLength={40}
          placeholder="contratado"
          onCommit={(v) => patch({ contratado: v })}
        />
        {i.categoria === "especial" && i.ativa && (
          <button
            type="button"
            className="chip flag"
            aria-pressed={trabalhando}
            onClick={() => patch({ ultimo_turno_executado: trabalhando ? null : sala.bastiao.turno })}
          >
            {trabalhando ? "trabalhando este turno" : "não trabalhou este turno"}
          </button>
        )}
        <button type="button" className={`chip flag${i.ativa ? "" : " danger"}`} aria-pressed={!i.ativa} onClick={() => patch({ ativa: !i.ativa })}>
          {i.ativa ? "ativa" : "inativa"}
        </button>
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
      </div>
      {descricao && <p className="instdesc">{descricao}</p>}
    </div>
  );
}

function RegistrarEvento({ sala }: { sala: Sala }) {
  const [texto, setTexto] = useState("");

  function rolarEvento() {
    const rolagem = d100();
    const nome = eventoBastiaoPara(rolagem, EVENTOS_BASTIAO_DMG) ?? "evento desconhecido";
    setTexto(`Evento (d100 ${rolagem}): ${nome} — `);
  }

  function registrar() {
    if (!texto.trim()) return;
    sala.registrarLogBastiao(texto.trim());
    setTexto("");
  }

  return (
    <div className="addcombatant" style={{ marginTop: 12 }}>
      <button type="button" className="btn" onClick={rolarEvento}>
        🎲 rolar evento (d100)
      </button>
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
