"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { EntradaDiario } from "@/lib/tipos";
import { alternarCartaoNaSessao, cartoesDaSessao, emojiDoTipo, type CartaoVisto } from "@/lib/quadro";
import { CampoTexto } from "@/components/CampoTexto";
import { CampoTextoAdiado } from "@/components/CampoTextoAdiado";
import { BotaoRemover } from "@/components/BotaoRemover";
import { RecapDaSessao } from "@/components/RecapDaSessao";

/** Resumo por sessão, escrito pelo Mestre, visível pra todo mundo — pra
 *  lembrar "onde paramos" na próxima mesa. */
export function DiarioCampanha({
  sala,
  codigo,
  souMestre,
  semCabecalho = false,
  cartoes = [],
  aoAbrirCartao,
}: {
  sala: Sala;
  /** Código da sala: o recap lê o histórico do log direto do banco. */
  codigo: string;
  souMestre: boolean;
  /** Os cartões do Quadro que esta pessoa vê (pra marcar e mostrar em cada sessão). */
  cartoes?: CartaoVisto[];
  aoAbrirCartao?: (id: string) => void;
  /** Dentro da aba Campanha o título já está lá em cima. */
  semCabecalho?: boolean;
}) {
  // O rascunho do recap entra no formulário de nova entrada; trocar a `key` recomeça o
  // formulário com o texto novo (sem efeito pra copiar prop em estado).
  const [rascunho, setRascunho] = useState({ id: 0, titulo: "", texto: "" });
  return (
    <div className={semCabecalho ? undefined : "combat"}>
      {!semCabecalho && (
        <div className="combat-head">
          <h2>Diário da campanha</h2>
        </div>
      )}

      {sala.diario.length === 0 && (
        <p className="empty-note">
          {souMestre ? "Nenhuma entrada ainda — registre um resumo ao fim da sessão." : "Nada registrado ainda."}
        </p>
      )}

      <div className="diariolist">
        {sala.diario.map((e) => (
          <EntradaDiarioRow key={e.id} entrada={e} sala={sala} editavel={souMestre} cartoes={cartoes} aoAbrirCartao={aoAbrirCartao} />
        ))}
      </div>

      {souMestre && (
        <>
          <RecapDaSessao
            codigo={codigo}
            jogadores={sala.personagens.filter((p) => !p.is_npc).map((p) => p.name)}
            cartoes={cartoes}
            aoGerar={(titulo, texto) => setRascunho((r) => ({ id: r.id + 1, titulo, texto }))}
          />
          <FormNovaEntrada key={rascunho.id} sala={sala} inicial={rascunho} />
        </>
      )}
    </div>
  );
}

function EntradaDiarioRow({
  entrada: e,
  sala,
  editavel,
  cartoes,
  aoAbrirCartao,
}: {
  entrada: EntradaDiario;
  sala: Sala;
  editavel: boolean;
  cartoes: CartaoVisto[];
  aoAbrirCartao?: (id: string) => void;
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
      {aoAbrirCartao && (cartoes.length > 0 || cartoesDaSessao(e, cartoes).length > 0) && (
        <CartoesDaSessao entrada={e} cartoes={cartoes} editavel={editavel} aoAbrir={aoAbrirCartao} aoMudar={(ids) => patch({ cartoes: ids })} />
      )}
    </div>
  );
}

/** Quem apareceu nesta sessão: chips que abrem o cartão; o Mestre marca e desmarca. */
function CartoesDaSessao({
  entrada,
  cartoes,
  editavel,
  aoAbrir,
  aoMudar,
}: {
  entrada: EntradaDiario;
  cartoes: CartaoVisto[];
  editavel: boolean;
  aoAbrir: (id: string) => void;
  aoMudar: (ids: string[]) => void;
}) {
  const marcados = cartoesDaSessao(entrada, cartoes);
  const livres = cartoes.filter((v) => v.visao === "completo" && !marcados.some((m) => m.cartao.id === v.cartao.id));
  if (marcados.length === 0 && !editavel) return null;
  return (
    <div className="qd-sessaocartoes">
      <span className="qd-rotulo">Apareceram:</span>
      {marcados.map((v) => (
        <span key={v.cartao.id} className="qd-chipcartao">
          <button type="button" className="chip" onClick={() => aoAbrir(v.cartao.id)}>
            {emojiDoTipo(v.cartao.tipo)} {v.visao === "silhueta" ? "???" : v.cartao.titulo || "Sem nome"}
          </button>
          {editavel && (
            <button
              type="button"
              className="qd-tirar"
              aria-label={`Tirar ${v.cartao.titulo} desta sessão`}
              onClick={() => aoMudar(alternarCartaoNaSessao(entrada.cartoes, v.cartao.id))}
            >
              ✕
            </button>
          )}
        </span>
      ))}
      {editavel && livres.length > 0 && (
        <select
          aria-label="Marcar um cartão nesta sessão"
          value=""
          onChange={(ev) => ev.target.value && aoMudar(alternarCartaoNaSessao(entrada.cartoes, ev.target.value))}
        >
          <option value="">＋ cartão…</option>
          {livres.map((v) => (
            <option key={v.cartao.id} value={v.cartao.id}>
              {emojiDoTipo(v.cartao.tipo)} {v.cartao.titulo || "Sem nome"}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function FormNovaEntrada({ sala, inicial }: { sala: Sala; inicial: { titulo: string; texto: string } }) {
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [texto, setTexto] = useState(inicial.texto);

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
