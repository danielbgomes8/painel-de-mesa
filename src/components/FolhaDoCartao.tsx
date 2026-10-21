"use client";

/* eslint-disable @next/next/no-img-element -- as fotos vêm do Storage do Supabase, já reduzidas no envio */

import { useEffect, useState } from "react";
import { type Quadro } from "@/hooks/useQuadro";
import { type Identidade } from "@/lib/identidade";
import { type EntradaDiario } from "@/lib/tipos";
import { FOTOS_MAXIMAS, todasAsFotos, COLUNAS_SUGERIDAS, LIMITE_COLUNA, LIMITE_NOTA, LIMITE_ROTULO_LIGACAO, ROTULOS_SUGERIDOS, autorDaPessoa, ligacoesDoCartao, notasDoCartao, podeAnotar, podeApagarNota, sessoesDoCartao, LIMITE_SUBTITULO, LIMITE_TEXTO, LIMITE_TITULO, TIPOS_DE_CARTAO, TITULO_DA_SILHUETA, emojiDoTipo, podeEditarCartao, podeVerSegredo, rotuloDoTipo, type Cartao, type CartaoVisto, type Revelacao, type TipoCartao } from "@/lib/quadro";
import { BotaoRemover } from "@/components/BotaoRemover";
import { CampoTexto } from "@/components/CampoTexto";
import { CampoTextoAdiado } from "@/components/CampoTextoAdiado";
import { ROTULO_REVELACAO, tituloVisto } from "@/components/apoioDoQuadro";

export function FolhaDoCartao({
  visto,
  quadro,
  quem,
  vistos,
  colunas,
  sessoes,
  nomeDoAutor,
  aoAbrirOutro,
  aoFechar,
}: {
  visto: CartaoVisto;
  quadro: Quadro;
  quem: Identidade | null;
  vistos: CartaoVisto[];
  /** Colunas já usadas nos cartões, pra escolher com um toque. */
  colunas: string[];
  sessoes: EntradaDiario[];
  nomeDoAutor: (autor: string) => string;
  aoAbrirOutro: (id: string) => void;
  aoFechar: () => void;
}) {
  const { cartao: c, visao } = visto;
  const silhueta = visao === "silhueta";
  const editavel = podeEditarCartao(c, quem);
  const urls = quadro.urlsDasFotos(c);
  const caminhos = todasAsFotos(c);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aoFechar]);

  async function novasFotos(lista: FileList | null) {
    const arquivos = Array.from(lista ?? []);
    if (arquivos.length === 0) return;
    setEnviandoFoto(true);
    setMensagem(null);
    const r = await quadro.acrescentarFotos(c.id, arquivos);
    setEnviandoFoto(false);
    if (!r.ok) setMensagem(r.erro);
  }
  async function mostrar(comoSilhueta = false) {
    setMensagem(null);
    const ok = await quadro.mostrarAMesa(c.id, comoSilhueta);
    setMensagem(
      ok
        ? comoSilhueta
          ? "Enviado: a mesa está vendo só a silhueta, em tela cheia."
          : "Enviado: a mesa está vendo o cartão em tela cheia."
        : "Não deu pra enviar. Tente de novo.",
    );
  }

  const titulo = silhueta ? TITULO_DA_SILHUETA : c.titulo || "Sem nome";

  return (
    <div className="qd-fundo" onClick={aoFechar} role="presentation">
      <div className="qd-folha" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="qd-fechar" onClick={aoFechar} aria-label="Fechar o cartão">
          ✕
        </button>

        {urls.length > 0 && <GaleriaDeFotos urls={urls} alt={silhueta ? "" : c.titulo} silhueta={silhueta} />}

        <p className="qd-tiporotulo">
          {emojiDoTipo(c.tipo)} {rotuloDoTipo(c.tipo)}
          {c.dono !== null && ` · cartão de ${nomeDoAutor(c.dono)}`}
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
                📷 {enviandoFoto ? "enviando…" : caminhos.length === 0 ? "pôr foto" : "adicionar foto"} ({caminhos.length}/{FOTOS_MAXIMAS})
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  disabled={enviandoFoto || caminhos.length >= FOTOS_MAXIMAS}
                  onChange={(e) => {
                    void novasFotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {urls.length > 1 && (
              <ul className="qd-miniaturas" aria-label="Fotos do cartão">
                {urls.map((u, i) => (
                  <li key={caminhos[i]}>
                    <img src={u} alt="" loading="lazy" />
                    <button
                      type="button"
                      className="qd-miniatura-tirar"
                      aria-label={`Tirar a foto ${i + 1}`}
                      onClick={() => void quadro.tirarFoto(c.id, caminhos[i])}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {urls.length === 1 && (
              <div className="qd-linha">
                <button type="button" className="btn ghost" onClick={() => void quadro.tirarFoto(c.id, caminhos[0])}>
                  tirar foto
                </button>
              </div>
            )}

            <CampoDeColuna cartao={c} quadro={quadro} existentes={colunas} />

            {c.dono === null ? (
              <ControlesDoMestre cartao={c} quadro={quadro} aoMostrar={() => void mostrar()} aoMostrarSilhueta={() => void mostrar(true)} />
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

        {!silhueta && (
          <>
            <SessoesDoCartao cartao={c} sessoes={sessoes} />
            {!quadro.extrasIndisponiveis && (
              <>
                <LigacoesDoCartao cartao={c} quadro={quadro} vistos={vistos} editavel={editavel} aoAbrirOutro={aoAbrirOutro} />
                <AnotacoesDoCartao cartao={c} visao={visao} quadro={quadro} quem={quem} nomeDoAutor={nomeDoAutor} />
              </>
            )}
            {quadro.extrasIndisponiveis && quem?.tipo === "mestre" && (
              <p className="qd-formdica">Ligações e anotações precisam da migration 0025 no Supabase.</p>
            )}
          </>
        )}

        <p className="qd-aviso" role="status" aria-live="polite">
          {mensagem ?? quadro.aviso}
        </p>
      </div>
    </div>
  );
}

/** "📖 Apareceu em: Sessão 1, Sessão 3" — a linha do tempo do cartão. */
export function SessoesDoCartao({ cartao, sessoes }: { cartao: Cartao; sessoes: EntradaDiario[] }) {
  const doCartao = sessoesDoCartao(cartao.id, sessoes);
  if (doCartao.length === 0) return null;
  return (
    <p className="qd-formdica qd-sessoes">
      📖 Apareceu em:{" "}
      {doCartao.map((s) => `${s.title || "Sessão"} (${new Date(s.created_at).toLocaleDateString("pt-BR")})`).join(" · ")}
    </p>
  );
}

export function LigacoesDoCartao({
  cartao: c,
  quadro,
  vistos,
  editavel,
  aoAbrirOutro,
}: {
  cartao: Cartao;
  quadro: Quadro;
  vistos: CartaoVisto[];
  editavel: boolean;
  aoAbrirOutro: (id: string) => void;
}) {
  const ligadas = ligacoesDoCartao(c.id, quadro.ligacoes, vistos);
  const candidatos = vistos.filter((v) => v.cartao.id !== c.id && v.visao === "completo");
  const [para, setPara] = useState("");
  const [rotulo, setRotulo] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function ligar() {
    if (!para || salvando) return;
    setSalvando(true);
    const ok = await quadro.ligar(c.id, para, rotulo);
    setSalvando(false);
    if (ok) {
      setPara("");
      setRotulo("");
    }
  }

  if (ligadas.length === 0 && !editavel) return null;
  return (
    <section className="qd-secao" aria-label="Ligações">
      <h4 className="qd-secaotitulo">🔗 Ligações</h4>
      <ul className="qd-lista">
        {ligadas.map(({ ligacao, outro, sentido }) => (
          <li key={ligacao.id}>
            <button type="button" className="qd-ligacao" onClick={() => aoAbrirOutro(outro.cartao.id)}>
              <span className="qd-ligacaotexto">
                {sentido === "saindo" ? (
                  <>
                    <i>{(outro.visao === "silhueta" ? "" : ligacao.rotulo) || "ligado a"}</i> → <b>{tituloVisto(outro)}</b>
                  </>
                ) : (
                  <>
                    <b>{tituloVisto(outro)}</b> → <i>{(outro.visao === "silhueta" ? "" : ligacao.rotulo) || "ligado a"}</i> → este
                  </>
                )}
              </span>
            </button>
            {editavel && (
              <BotaoRemover aria={`desfazer a ligação com ${tituloVisto(outro)}`} onConfirmar={() => void quadro.desligar(ligacao.id)} />
            )}
          </li>
        ))}
      </ul>
      {editavel && candidatos.length > 0 && (
        <div className="qd-ligar">
          <div className="qd-linha">
            <input
              type="text"
              aria-label="Tipo da ligação"
              placeholder="serve a, mora em…"
              maxLength={LIMITE_ROTULO_LIGACAO}
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
            />
            <select aria-label="Ligar a qual cartão" value={para} onChange={(e) => setPara(e.target.value)}>
              <option value="">cartão…</option>
              {candidatos.map((v) => (
                <option key={v.cartao.id} value={v.cartao.id}>
                  {emojiDoTipo(v.cartao.tipo)} {v.cartao.titulo || "Sem nome"}
                </option>
              ))}
            </select>
          </div>
          <div className="qd-sugestoes">
            {ROTULOS_SUGERIDOS.map((r) => (
              <button key={r} type="button" className="chip" aria-pressed={rotulo === r} onClick={() => setRotulo(r)}>
                {r}
              </button>
            ))}
          </div>
          <button type="button" className="btn" disabled={!para || salvando} onClick={() => void ligar()}>
            {salvando ? "Ligando…" : "＋ ligar"}
          </button>
        </div>
      )}
    </section>
  );
}

export function AnotacoesDoCartao({
  cartao: c,
  visao,
  quadro,
  quem,
  nomeDoAutor,
}: {
  cartao: Cartao;
  visao: CartaoVisto["visao"];
  quadro: Quadro;
  quem: Identidade | null;
  nomeDoAutor: (autor: string) => string;
}) {
  const doCartao = notasDoCartao(c.id, quadro.notas);
  const autor = autorDaPessoa(quem);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function anotar() {
    if (!autor || !texto.trim() || salvando) return;
    setSalvando(true);
    const ok = await quadro.anotar(c.id, autor, texto);
    setSalvando(false);
    if (ok) setTexto("");
  }

  const pode = podeAnotar(visao, quem);
  if (doCartao.length === 0 && !pode) return null;
  return (
    <section className="qd-secao" aria-label="Anotações">
      <h4 className="qd-secaotitulo">💬 Anotações da mesa</h4>
      <ul className="qd-lista">
        {doCartao.map((n) => (
          <li key={n.id} className="qd-nota">
            <p className="qd-notatexto">
              <b>{nomeDoAutor(n.autor)}:</b> {n.texto}
            </p>
            {podeApagarNota(n, quem) && (
              <BotaoRemover aria={`apagar a anotação de ${nomeDoAutor(n.autor)}`} onConfirmar={() => void quadro.apagarNota(n.id)} />
            )}
          </li>
        ))}
      </ul>
      {pode && (
        <div className="qd-linha">
          <input
            type="text"
            aria-label="Nova anotação"
            placeholder="acho que ele mente…"
            maxLength={LIMITE_NOTA}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void anotar();
            }}
          />
          <button type="button" className="btn" disabled={!texto.trim() || salvando} onClick={() => void anotar()}>
            anotar
          </button>
        </div>
      )}
    </section>
  );
}

/** Em que coluna o cartão fica na vista em colunas: um toque numa já usada, ou escreve uma nova. */
export function CampoDeColuna({ cartao: c, quadro, existentes }: { cartao: Cartao; quadro: Quadro; existentes: string[] }) {
  const opcoes = [...new Set([...existentes, ...COLUNAS_SUGERIDAS])];
  return (
    <div className="qd-coluna-campo">
      <p className="qd-rotulo">Coluna (na vista em colunas)</p>
      <CampoTexto valor={c.coluna} maxLength={LIMITE_COLUNA} placeholder="ex.: Suspeitos" onCommit={(v) => void quadro.atualizar(c.id, { coluna: v.trim() })} />
      <div className="qd-sugestoes">
        {opcoes.map((nome) => (
          <button key={nome} type="button" className="chip" aria-pressed={c.coluna === nome} onClick={() => void quadro.atualizar(c.id, { coluna: c.coluna === nome ? "" : nome })}>
            {nome}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ControlesDoMestre({
  cartao: c,
  quadro,
  aoMostrar,
  aoMostrarSilhueta,
}: {
  cartao: Cartao;
  quadro: Quadro;
  aoMostrar: () => void;
  aoMostrarSilhueta: () => void;
}) {
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
      {c.revelacao !== "revelado" && (
        <button type="button" className="btn qd-mostrar" onClick={aoMostrarSilhueta} title="A mesa vê só a foto escura e ???; o texto continua escondido">
          🌫️ Mostrar só a silhueta
        </button>
      )}

    </>
  );
}

/** Fotos do cartão lado a lado: desliza com o dedo, uma por vez. Uma só foto = sem enfeite. */
export function GaleriaDeFotos({ urls, alt, silhueta }: { urls: string[]; alt: string; silhueta: boolean }) {
  const [atual, setAtual] = useState(0);
  return (
    <div className="qd-galeria-caixa">
      <div
        className="qd-galeria"
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtual(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
      >
        {urls.map((u) => (
          <div key={u} className="qd-foto qd-fotogrande" data-silhueta={silhueta || undefined}>
            <img src={u} alt={alt} />
          </div>
        ))}
      </div>
      {urls.length > 1 && (
        <span className="qd-contagem" role="status" aria-live="polite">
          {Math.min(atual, urls.length - 1) + 1}/{urls.length}
        </span>
      )}
    </div>
  );
}
