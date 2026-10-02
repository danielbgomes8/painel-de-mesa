"use client";

/* eslint-disable @next/next/no-img-element -- as fotos vêm do Storage do Supabase, já reduzidas no envio */

import { useEffect, useMemo, useState } from "react";
import type { Quadro } from "@/hooks/useQuadro";
import type { Identidade } from "@/lib/identidade";
import {
  COLUNAS_SUGERIDAS,
  LIMITE_COLUNA,
  LIMITE_SUBTITULO,
  LIMITE_TEXTO,
  LIMITE_TITULO,
  TIPOS_DE_CARTAO,
  TITULO_DA_SILHUETA,
  agruparPorColuna,
  cartoesVisiveis,
  emojiDoTipo,
  filtrarPorTipo,
  podeEditarCartao,
  podeVerSegredo,
  rotuloDoTipo,
  type Cartao,
  type CartaoVisto,
  type Revelacao,
  type TipoCartao,
} from "@/lib/quadro";
import { BotaoRemover } from "@/components/BotaoRemover";
import { CampoTexto } from "@/components/CampoTexto";
import { CampoTextoAdiado } from "@/components/CampoTextoAdiado";

const CHAVE_VISAO = "mesa-quadro-visao";
type ModoDeVista = "galeria" | "colunas";

function lerVisao(): ModoDeVista {
  try {
    return localStorage.getItem(CHAVE_VISAO) === "colunas" ? "colunas" : "galeria";
  } catch {
    return "galeria";
  }
}

const ROTULO_REVELACAO: Record<Revelacao, { emoji: string; curto: string; ajuda: string }> = {
  escondido: { emoji: "🔒", curto: "Escondido", ajuda: "só você vê" },
  silhueta: { emoji: "🌫️", curto: "Silhueta", ajuda: "a mesa vê a foto escura e ???" },
  revelado: { emoji: "👁", curto: "Revelado", ajuda: "a mesa vê tudo" },
};

/** O Quadro da Campanha: cartões de NPC, vilão, local, pista... com foto, em
 *  galeria ou colunas. O Mestre decide o que a mesa vê (escondido, silhueta,
 *  revelado); cada jogador tem os próprios cartões, que só ele vê até
 *  compartilhar. */
export function QuadroCampanha({ quadro, quem }: { quadro: Quadro; quem: Identidade | null }) {
  const souMestre = quem?.tipo === "mestre";
  const [vista, setVista] = useState<ModoDeVista>("galeria");
  const [tipo, setTipo] = useState<TipoCartao | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  // A escolha de vista é do aparelho; lida depois da hidratação, sem setState em efeito.
  useEffect(() => {
    const salva = lerVisao();
    if (salva !== "galeria") queueMicrotask(() => setVista(salva));
  }, []);
  function mudarVista(v: ModoDeVista) {
    setVista(v);
    try {
      localStorage.setItem(CHAVE_VISAO, v);
    } catch {
      // sem armazenamento: vale só nesta sessão
    }
  }

  const visiveis = useMemo(() => cartoesVisiveis(quadro.cartoes, quem), [quadro.cartoes, quem]);
  const tiposPresentes = useMemo(() => new Set(visiveis.map((v) => v.cartao.tipo)), [visiveis]);
  // Se o tipo filtrado deixou de existir (cartão apagado ou escondido), volta pra "todos".
  const tipoAtivo = tipo && tiposPresentes.has(tipo) ? tipo : null;
  const lista = filtrarPorTipo(visiveis, tipoAtivo);
  const aVer = visiveis.find((v) => v.cartao.id === aberto) ?? null;

  if (quadro.indisponivel) {
    return (
      <p className="empty-note">
        {souMestre
          ? "O Quadro ainda não está pronto: falta rodar a migration 0024 no Supabase."
          : "O Quadro ainda não está disponível."}
      </p>
    );
  }

  return (
    <div className="qd">
      <div className="qd-topo">
        <div className="qd-vistas" role="group" aria-label="Jeito de ver os cartões">
          <button type="button" className="chip" aria-pressed={vista === "galeria"} onClick={() => mudarVista("galeria")}>
            ▦ Galeria
          </button>
          <button type="button" className="chip" aria-pressed={vista === "colunas"} onClick={() => mudarVista("colunas")}>
            ☰ Colunas
          </button>
        </div>
        {quem && (
          <button type="button" className="btn primary qd-novo" onClick={() => setCriando((c) => !c)} aria-expanded={criando}>
            + cartão
          </button>
        )}
      </div>

      {criando && quem && (
        <FormNovoCartao
          quadro={quadro}
          quem={quem}
          aoCriar={(c) => {
            setCriando(false);
            setAberto(c.id);
          }}
          aoCancelar={() => setCriando(false)}
        />
      )}

      {quadro.aviso && (
        <p className="qd-aviso" role="status">
          {quadro.aviso}
        </p>
      )}

      {tiposPresentes.size > 1 && (
        <div className="qd-filtros" role="group" aria-label="Filtrar por tipo">
          <button type="button" className="chip" aria-pressed={tipoAtivo === null} onClick={() => setTipo(null)}>
            Todos
          </button>
          {TIPOS_DE_CARTAO.filter((t) => tiposPresentes.has(t.id)).map((t) => (
            <button key={t.id} type="button" className="chip" aria-pressed={tipoAtivo === t.id} onClick={() => setTipo(t.id)}>
              {t.emoji} {t.rotulo}
            </button>
          ))}
        </div>
      )}

      {quadro.carregando && <p className="empty-note">Carregando o quadro…</p>}
      {!quadro.carregando && visiveis.length === 0 && (
        <p className="empty-note">
          {souMestre
            ? "Nenhum cartão ainda. Crie um vilão, um NPC ou um local — ele nasce escondido, e você decide quando a mesa vê."
            : quem
              ? "O Mestre ainda não mostrou nada. Você pode criar cartões só seus, pra anotar o que descobrir."
              : "Nada no quadro ainda."}
        </p>
      )}

      {vista === "galeria" ? (
        <div className="qd-grade">
          {lista.map((v) => (
            <MiniaturaDoCartao key={v.cartao.id} visto={v} quadro={quadro} quem={quem} aoAbrir={() => setAberto(v.cartao.id)} />
          ))}
        </div>
      ) : (
        <div className="qd-colunas">
          {agruparPorColuna(lista).map((col) => (
            <section key={col.nome} className="qd-coluna" aria-label={`Coluna ${col.nome}`}>
              <h3 className="qd-colunatitulo">
                {col.nome} <span>{col.cartoes.length}</span>
              </h3>
              {col.cartoes.map((v) => (
                <MiniaturaDoCartao key={v.cartao.id} visto={v} quadro={quadro} quem={quem} aoAbrir={() => setAberto(v.cartao.id)} />
              ))}
            </section>
          ))}
        </div>
      )}

      {aVer && <FolhaDoCartao visto={aVer} quadro={quadro} quem={quem} aoFechar={() => setAberto(null)} />}
    </div>
  );
}

// ── Miniatura ───────────────────────────────────────────────────────────

function estadoDoCartao(c: Cartao, quem: Identidade | null): { emoji: string; texto: string } | null {
  if (c.dono === null) {
    // A mesa não precisa de selo: o que ela vê já está liberado.
    if (quem?.tipo !== "mestre") return null;
    const r = ROTULO_REVELACAO[c.revelacao];
    return { emoji: r.emoji, texto: r.curto };
  }
  if (c.revelacao === "revelado") return { emoji: "👁", texto: quem?.tipo === "jogador" && quem.slug === c.dono ? "Da mesa" : "Do jogador" };
  return { emoji: "🔒", texto: "Só meu" };
}

function MiniaturaDoCartao({
  visto,
  quadro,
  quem,
  aoAbrir,
}: {
  visto: CartaoVisto;
  quadro: Quadro;
  quem: Identidade | null;
  aoAbrir: () => void;
}) {
  const { cartao: c, visao } = visto;
  const silhueta = visao === "silhueta";
  const url = quadro.urlDaFoto(c);
  const estado = estadoDoCartao(c, quem);
  const titulo = silhueta ? TITULO_DA_SILHUETA : c.titulo || "Sem nome";
  return (
    <button type="button" className="qd-cartao" data-revelacao={c.revelacao} data-dono={c.dono ? "pessoal" : "mesa"} onClick={aoAbrir}>
      <span className="qd-foto" data-silhueta={silhueta || undefined}>
        {url ? <img src={url} alt="" loading="lazy" /> : <span className="qd-semfoto">{emojiDoTipo(c.tipo)}</span>}
        <span className="qd-tipo">
          {emojiDoTipo(c.tipo)} {rotuloDoTipo(c.tipo)}
        </span>
        {estado && (
          <span className="qd-estado">
            {estado.emoji} {estado.texto}
          </span>
        )}
      </span>
      <span className="qd-nome">{titulo}</span>
      {!silhueta && c.subtitulo && <span className="qd-sub">{c.subtitulo}</span>}
    </button>
  );
}

// ── Cartão novo ─────────────────────────────────────────────────────────

function FormNovoCartao({
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
  const [foto, setFoto] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    if (enviando || !titulo.trim()) return;
    setEnviando(true);
    setErro(null);
    const r = await quadro.criar(
      { tipo, titulo: titulo.trim(), dono: quem.tipo === "jogador" ? quem.slug : null },
      foto,
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
          📷 {foto ? "trocar foto" : "foto (opcional)"}
          <input type="file" accept="image/*" hidden onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
        </label>
        {foto && <span className="qd-nomearquivo">{foto.name}</span>}
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

// ── Folha (cartão aberto) ───────────────────────────────────────────────

function FolhaDoCartao({
  visto,
  quadro,
  quem,
  aoFechar,
}: {
  visto: CartaoVisto;
  quadro: Quadro;
  quem: Identidade | null;
  aoFechar: () => void;
}) {
  const { cartao: c, visao } = visto;
  const silhueta = visao === "silhueta";
  const editavel = podeEditarCartao(c, quem);
  const url = quadro.urlDaFoto(c);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aoFechar]);

  async function novaFoto(arquivo: File | undefined) {
    if (!arquivo) return;
    setEnviandoFoto(true);
    setMensagem(null);
    const r = await quadro.trocarFoto(c.id, arquivo);
    setEnviandoFoto(false);
    if (!r.ok) setMensagem(r.erro);
  }
  async function mostrar() {
    setMensagem(null);
    const ok = await quadro.mostrarAMesa(c.id);
    setMensagem(ok ? "Enviado: a mesa está vendo o cartão em tela cheia." : "Não deu pra enviar. Tente de novo.");
  }

  const titulo = silhueta ? TITULO_DA_SILHUETA : c.titulo || "Sem nome";

  return (
    <div className="qd-fundo" onClick={aoFechar} role="presentation">
      <div className="qd-folha" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="qd-fechar" onClick={aoFechar} aria-label="Fechar o cartão">
          ✕
        </button>

        {url && (
          <div className="qd-foto qd-fotogrande" data-silhueta={silhueta || undefined}>
            <img src={url} alt={silhueta ? "" : c.titulo} />
          </div>
        )}

        <p className="qd-tiporotulo">
          {emojiDoTipo(c.tipo)} {rotuloDoTipo(c.tipo)}
          {c.dono !== null && " · pessoal"}
        </p>

        {!editavel && (
          <>
            <h3 className="qd-titulo">{titulo}</h3>
            {!silhueta && c.subtitulo && <p className="qd-subtitulo">{c.subtitulo}</p>}
            {silhueta ? (
              <p className="qd-subtitulo">Você ouviu falar, mas ainda não conhece.</p>
            ) : (
              c.texto && <p className="qd-texto">{c.texto}</p>
            )}
          </>
        )}

        {editavel && (
          <div className="qd-edicao">
            <div className="qd-linha">
              <select
                aria-label="Tipo do cartão"
                value={c.tipo}
                onChange={(e) => void quadro.atualizar(c.id, { tipo: e.target.value as TipoCartao })}
              >
                {TIPOS_DE_CARTAO.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.emoji} {t.rotulo}
                  </option>
                ))}
              </select>
              <CampoTexto valor={c.titulo} maxLength={LIMITE_TITULO} placeholder="nome" onCommit={(v) => void quadro.atualizar(c.id, { titulo: v })} />
            </div>
            <CampoTexto
              valor={c.subtitulo}
              maxLength={LIMITE_SUBTITULO}
              placeholder="quem é (ex.: barão de Vael)"
              onCommit={(v) => void quadro.atualizar(c.id, { subtitulo: v })}
            />
            <div className="notesbox">
              <CampoTextoAdiado
                valor={c.texto}
                maxLength={LIMITE_TEXTO}
                placeholder={c.dono === null ? "o que a mesa pode ler..." : "suas anotações..."}
                onSalvar={(v) => void quadro.atualizar(c.id, { texto: v })}
              />
            </div>

            {podeVerSegredo(c, quem) && (
              <div className="qd-segredo">
                <p className="qd-rotulo">🤫 Segredo — só você lê</p>
                <div className="notesbox">
                  <CampoTextoAdiado
                    valor={c.segredo}
                    maxLength={LIMITE_TEXTO}
                    placeholder="o plano, o que esconde..."
                    onSalvar={(v) => void quadro.atualizar(c.id, { segredo: v })}
                  />
                </div>
              </div>
            )}

            <div className="qd-linha">
              <label className="btn ghost qd-arquivo">
                📷 {enviandoFoto ? "enviando…" : c.foto ? "trocar foto" : "pôr foto"}
                <input type="file" accept="image/*" hidden disabled={enviandoFoto} onChange={(e) => void novaFoto(e.target.files?.[0])} />
              </label>
              {c.foto && (
                <button type="button" className="btn ghost" onClick={() => void quadro.tirarFoto(c.id)}>
                  tirar foto
                </button>
              )}
            </div>

            {c.dono === null ? (
              <ControlesDoMestre cartao={c} quadro={quadro} aoMostrar={() => void mostrar()} />
            ) : (
              <div className="qd-revelacao" role="group" aria-label="Quem vê este cartão">
                <button
                  type="button"
                  className="chip"
                  aria-pressed={c.revelacao !== "revelado"}
                  onClick={() => void quadro.atualizar(c.id, { revelacao: "escondido" })}
                >
                  🔒 só eu
                </button>
                <button
                  type="button"
                  className="chip"
                  aria-pressed={c.revelacao === "revelado"}
                  onClick={() => void quadro.atualizar(c.id, { revelacao: "revelado" })}
                >
                  👁 mostrar pra mesa
                </button>
              </div>
            )}

            <div className="qd-linha qd-apagar">
              <BotaoRemover
                aria={`apagar o cartão ${c.titulo}`}
                confirmar="Apagar este cartão? Não dá pra desfazer."
                onConfirmar={() => {
                  aoFechar();
                  void quadro.remover(c.id);
                }}
                className="btn ghost"
              >
                🗑 apagar cartão
              </BotaoRemover>
            </div>
          </div>
        )}

        <p className="qd-aviso" role="status" aria-live="polite">
          {mensagem ?? quadro.aviso}
        </p>
      </div>
    </div>
  );
}

function ControlesDoMestre({ cartao: c, quadro, aoMostrar }: { cartao: Cartao; quadro: Quadro; aoMostrar: () => void }) {
  return (
    <>
      <div className="qd-revelacao" role="group" aria-label="O que a mesa vê">
        {(Object.keys(ROTULO_REVELACAO) as Revelacao[]).map((r) => (
          <button
            key={r}
            type="button"
            className="chip"
            aria-pressed={c.revelacao === r}
            title={ROTULO_REVELACAO[r].ajuda}
            onClick={() => void quadro.atualizar(c.id, { revelacao: r })}
          >
            {ROTULO_REVELACAO[r].emoji} {ROTULO_REVELACAO[r].curto}
          </button>
        ))}
      </div>
      <p className="qd-formdica">{ROTULO_REVELACAO[c.revelacao].emoji} {ROTULO_REVELACAO[c.revelacao].ajuda}.</p>

      <button type="button" className="btn primary qd-mostrar" onClick={aoMostrar}>
        📣 Mostrar à mesa agora
      </button>

      <div className="qd-coluna-campo">
        <p className="qd-rotulo">Coluna (na vista em colunas)</p>
        <CampoTexto valor={c.coluna} maxLength={LIMITE_COLUNA} placeholder="ex.: Suspeitos" onCommit={(v) => void quadro.atualizar(c.id, { coluna: v.trim() })} />
        <div className="qd-sugestoes">
          {COLUNAS_SUGERIDAS.map((nome) => (
            <button key={nome} type="button" className="chip" aria-pressed={c.coluna === nome} onClick={() => void quadro.atualizar(c.id, { coluna: c.coluna === nome ? "" : nome })}>
              {nome}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Destaque em tela cheia ──────────────────────────────────────────────

/** O cartão que o Mestre acabou de mostrar: foto grande, nome e o texto.
 *  Toque (ou Esc) fecha; no telão, que ninguém toca, some sozinho. */
export function DestaqueDoCartao({
  cartao,
  url,
  aoFechar,
  fecharSozinhoEmMs,
}: {
  cartao: Cartao;
  url: string | null;
  aoFechar: () => void;
  fecharSozinhoEmMs?: number;
}) {
  useEffect(() => {
    try {
      navigator.vibrate?.([60, 40, 60]);
    } catch {
      // sem vibração: a tela cheia já avisa
    }
  }, [cartao.id, cartao.destaque_em]);

  useEffect(() => {
    if (!fecharSozinhoEmMs) return;
    const t = setTimeout(aoFechar, fecharSozinhoEmMs);
    return () => clearTimeout(t);
  }, [fecharSozinhoEmMs, aoFechar, cartao.destaque_em]);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aoFechar]);

  return (
    <div className="qd-destaque" role="dialog" aria-modal="true" aria-label={`O Mestre mostrou: ${cartao.titulo}`} onClick={aoFechar}>
      <p className="qd-destaque-aviso">📣 O Mestre mostrou à mesa</p>
      {url && (
        <div className="qd-destaque-foto">
          <img src={url} alt={cartao.titulo} />
        </div>
      )}
      <p className="qd-tiporotulo">
        {emojiDoTipo(cartao.tipo)} {rotuloDoTipo(cartao.tipo)}
      </p>
      <h2 className="qd-destaque-titulo">{cartao.titulo || "Sem nome"}</h2>
      {cartao.subtitulo && <p className="qd-subtitulo">{cartao.subtitulo}</p>}
      {cartao.texto && <p className="qd-destaque-texto">{cartao.texto}</p>}
      <p className="qd-destaque-fechar">toque para fechar</p>
    </div>
  );
}
