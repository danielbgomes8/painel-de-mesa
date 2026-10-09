"use client";

import { useState } from "react";
import { lerHistoricoDoLog } from "@/hooks/lerHistoricoDoLog";
import type { CartaoVisto } from "@/lib/quadro";
import { detectarSessoes, resumirSessao, textoDoRecap, tituloDoRecap, type SessaoDetectada } from "@/lib/recap";
import { registrarUso } from "@/lib/registrarUso";

/** Quantas sessões a lista oferece (a mais recente primeiro). */
const SESSOES_NA_LISTA = 6;
/** Cartão mostrado à mesa até meia hora depois da última linha ainda é da sessão. */
const FOLGA_DOS_CARTOES_MS = 30 * 60 * 1000;

function rotuloDaSessao(s: SessaoDetectada): string {
  const dia = new Date(s.inicio).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  const h = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia}, ${h(s.inicio)}–${h(s.fim)} · ${s.linhas.length} registros`;
}

/**
 * "📝 Gerar recap": o Mestre escolhe uma das sessões que o log mostra e o app
 * escreve um rascunho do diário (combate, quem caiu, magias, baú, cartões
 * mostrados). O rascunho vai pro formulário de nova entrada — nada é salvo
 * até o Mestre editar e apertar "+ nova entrada".
 */
export function RecapDaSessao({
  codigo,
  jogadores,
  cartoes,
  aoGerar,
}: {
  codigo: string;
  /** Nomes dos personagens dos jogadores (quem não está aqui conta como inimigo). */
  jogadores: string[];
  /** Os cartões do Quadro que o Mestre vê (os mostrados à mesa entram no recap). */
  cartoes: CartaoVisto[];
  aoGerar: (titulo: string, texto: string) => void;
}) {
  const [estado, setEstado] = useState<"fechado" | "lendo" | "pronto" | "falhou">("fechado");
  const [sessoes, setSessoes] = useState<SessaoDetectada[]>([]);

  async function abrir() {
    setEstado("lendo");
    const log = await lerHistoricoDoLog(codigo);
    if (!log) {
      setEstado("falhou");
      return;
    }
    setSessoes(detectarSessoes(log).slice(0, SESSOES_NA_LISTA));
    setEstado("pronto");
  }

  function gerar(s: SessaoDetectada) {
    registrarUso("acao:recap");
    const de = Date.parse(s.inicio);
    const ate = Date.parse(s.fim) + FOLGA_DOS_CARTOES_MS;
    const mostrados = cartoes
      .map((v) => v.cartao)
      .filter((c) => {
        if (c.revelacao !== "revelado" || !c.destaque_em) return false;
        const t = Date.parse(c.destaque_em);
        return t >= de && t <= ate;
      })
      .map((c) => c.titulo.trim() || "Sem nome");
    aoGerar(tituloDoRecap(s.inicio), textoDoRecap(s, resumirSessao(s.linhas, jogadores), mostrados));
    setEstado("fechado");
  }

  if (estado === "fechado") {
    return (
      <button type="button" className="btn" onClick={() => void abrir()}>
        📝 Gerar recap da sessão
      </button>
    );
  }

  return (
    <div className="recap" role="group" aria-label="Gerar recap da sessão">
      {estado === "lendo" && <p className="empty-note">Lendo o histórico…</p>}
      {estado === "falhou" && (
        <p className="inv-alerta" role="status">
          Não consegui ler o histórico. Confira a conexão e tente de novo.
        </p>
      )}
      {estado === "pronto" && sessoes.length === 0 && (
        <p className="empty-note">
          Ainda não há uma sessão no histórico (o recap usa o registro do combate, e precisa de pelo menos 5 linhas).
        </p>
      )}
      {estado === "pronto" && sessoes.length > 0 && (
        <>
          <span className="sectitle">Qual sessão?</span>
          <ul className="recap-lista">
            {sessoes.map((s) => (
              <li key={s.inicio}>
                <button type="button" className="btn" onClick={() => gerar(s)}>
                  {rotuloDaSessao(s)}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" className="minilink" onClick={() => setEstado("fechado")}>
        cancelar
      </button>
    </div>
  );
}
