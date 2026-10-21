"use client";

/* eslint-disable @next/next/no-img-element -- as fotos vêm do Storage do Supabase, já reduzidas no envio */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Quadro } from "@/hooks/useQuadro";
import type { Identidade } from "@/lib/identidade";
import type { EntradaDiario } from "@/lib/tipos";
import {
  LIMITE_COLUNA,
  TIPOS_DE_CARTAO,
  TITULO_DA_SILHUETA,
  destaqueEmSilhueta,
  agruparPorColuna,
  colunasEmUso,
  comColunasVazias,
  vaziasDeVerdade,
  cartoesVisiveis,
  emojiDoTipo,
  filtrarPorTipo,
  podeEditarCartao,
  podeMoverCartao,
  rotuloDoTipo,
  type Cartao,
  type TipoCartao,
} from "@/lib/quadro";
import { MapaDeLigacoes } from "@/components/MapaDeLigacoes";
import { tituloVisto } from "@/components/apoioDoQuadro";
import { MiniaturaDoCartao } from "@/components/MiniaturaDoCartao";
import { COLUNA_NOVA, comSemColuna, useArrastoDeLigacao, useArrastoDeColuna } from "@/hooks/useArrastosDoQuadro";
import { FolhaDeLigacao } from "@/components/FolhaDeLigacao";
import { FormNovoCartao } from "@/components/FormNovoCartao";
import { FolhaDoCartao } from "@/components/FolhaDoCartao";

const CHAVE_VISAO = "mesa-quadro-visao";
type ModoDeVista = "galeria" | "colunas" | "mapa";

function lerVisao(): ModoDeVista {
  try {
    const salva = localStorage.getItem(CHAVE_VISAO);
    return salva === "colunas" || salva === "mapa" ? salva : "galeria";
  } catch {
    return "galeria";
  }
}

/** O Quadro da Campanha: cartões de NPC, vilão, local, pista... com foto, em
 *  galeria ou colunas. O Mestre decide o que a mesa vê (escondido, silhueta,
 *  revelado); cada jogador tem os próprios cartões, que só ele vê até
 *  compartilhar. */
export function QuadroCampanha({
  quadro,
  quem,
  sessoes,
  nomeDoAutor,
  aberto,
  setAberto,
}: {
  quadro: Quadro;
  quem: Identidade | null;
  sessoes: EntradaDiario[];
  nomeDoAutor: (autor: string) => string;
  /** O cartão aberto mora na aba (o diário de sessões também abre cartões). */
  aberto: string | null;
  setAberto: (id: string | null) => void;
}) {
  const souMestre = quem?.tipo === "mestre";
  const [vista, setVista] = useState<ModoDeVista>("galeria");
  const [tipo, setTipo] = useState<TipoCartao | null>(null);
  const [criando, setCriando] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);
  const arrasto = useArrastoDeColuna(quadro, quem !== null && vista === "colunas", listaRef);
  const ligando = useArrastoDeLigacao(listaRef);
  const [vazias, setVazias] = useState<string[]>([]);
  const [nomeNovaColuna, setNomeNovaColuna] = useState<string | null>(null);
  const [pendente, setPendente] = useState<{ de: string; para: string } | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  // Soltou a alça em cima de outro cartão: pergunta o tipo da ligação.
  useEffect(() => {
    if (ligando.solto) queueMicrotask(() => setPendente(ligando.solto));
  }, [ligando.solto]);

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

  function criarColuna() {
    const nome = (nomeNovaColuna ?? "").trim().slice(0, LIMITE_COLUNA);
    if (nome) setVazias((a) => (a.includes(nome) ? a : [...a, nome]));
    setNomeNovaColuna(null);
  }

  const visiveis = useMemo(() => cartoesVisiveis(quadro.cartoes, quem), [quadro.cartoes, quem]);
  const tiposPresentes = useMemo(() => new Set(visiveis.map((v) => v.cartao.tipo)), [visiveis]);
  // Se o tipo filtrado deixou de existir (cartão apagado ou escondido), volta pra "todos".
  const tipoAtivo = tipo && tiposPresentes.has(tipo) ? tipo : null;
  const lista = filtrarPorTipo(visiveis, tipoAtivo);
  const colunasDaTela = comColunasVazias(agruparPorColuna(lista), vaziasDeVerdade(visiveis, vazias));
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
        <div className="qd-vistas qd-vistas-icones" role="group" aria-label="Jeito de ver os cartões">
          <button type="button" aria-label="Galeria" title="Galeria" aria-pressed={vista === "galeria"} onClick={() => mudarVista("galeria")}>
            ▦
          </button>
          <button type="button" aria-label="Colunas" title="Colunas" aria-pressed={vista === "colunas"} onClick={() => mudarVista("colunas")}>
            ☰
          </button>
          <button type="button" aria-label="Mapa de ligações" title="Mapa de ligações" aria-pressed={vista === "mapa"} onClick={() => mudarVista("mapa")}>
            🕸
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
            Todos · {visiveis.length}
          </button>
          {TIPOS_DE_CARTAO.filter((t) => tiposPresentes.has(t.id)).map((t) => (
            <button key={t.id} type="button" className="chip" aria-pressed={tipoAtivo === t.id} onClick={() => setTipo(t.id)}>
              {t.emoji} {t.rotulo} · {visiveis.filter((v) => v.cartao.tipo === t.id).length}
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

      {vista === "mapa" ? (
        <MapaDeLigacoes vistos={lista} ligacoes={quadro.ligacoes} urlDaFoto={quadro.urlDaFoto} aoAbrir={setAberto} />
      ) : vista === "galeria" ? (
        <div className="qd-grade">
          {lista.map((v) => (
            <MiniaturaDoCartao
              key={v.cartao.id}
              visto={v}
              quadro={quadro}
              quem={quem}
              nomeDoAutor={nomeDoAutor}
              aoAbrir={() => setAberto(v.cartao.id)}
              alcaLigar={podeEditarCartao(v.cartao, quem) ? (e) => ligando.comecar(e, v.cartao) : undefined}
              alvoDeLigacao={ligando.sobre === v.cartao.id}
              origemDeLigacao={ligando.de === v.cartao.id}
            />
          ))}
        </div>
      ) : (
        <>
          {quem && (
            <div className="qd-novacoluna">
              {nomeNovaColuna === null ? (
                <button type="button" className="btn" onClick={() => setNomeNovaColuna("")}>
                  ＋ nova coluna
                </button>
              ) : (
                <>
                  <input
                    type="text"
                    aria-label="Nome da nova coluna"
                    placeholder="nome da coluna"
                    maxLength={LIMITE_COLUNA}
                    autoFocus
                    value={nomeNovaColuna}
                    onChange={(e) => setNomeNovaColuna(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") criarColuna();
                      if (e.key === "Escape") setNomeNovaColuna(null);
                    }}
                  />
                  <button type="button" className="btn primary" disabled={!nomeNovaColuna.trim()} onClick={criarColuna}>
                    criar
                  </button>
                  <button type="button" className="btn ghost" onClick={() => setNomeNovaColuna(null)}>
                    cancelar
                  </button>
                </>
              )}
            </div>
          )}
        <div className="qd-colunas" ref={listaRef} data-arrastando={arrasto.ativo || undefined}>
          {(arrasto.ativo ? comSemColuna(colunasDaTela) : colunasDaTela).map((col) => (
            <section
              key={col.nome}
              className="qd-coluna"
              data-coluna={col.valor}
              data-alvo={arrasto.sobre === col.valor || undefined}
              aria-label={`Coluna ${col.nome}`}
            >
              <h3 className="qd-colunatitulo">
                {col.nome} <span>{col.cartoes.length}</span>
              </h3>
              {col.cartoes.length === 0 && <p className="qd-formdica">arraste um cartão para cá</p>}
              {col.cartoes.map((v) => (
                <MiniaturaDoCartao
                  key={v.cartao.id}
                  visto={v}
                  quadro={quadro}
                  quem={quem}
                  nomeDoAutor={nomeDoAutor}
                  aoAbrir={() => setAberto(v.cartao.id)}
                  alca={podeMoverCartao(v.cartao, quem) ? (e) => arrasto.comecar(e, v.cartao) : undefined}
                  arrastando={arrasto.id === v.cartao.id}
                  alcaLigar={podeEditarCartao(v.cartao, quem) ? (e) => ligando.comecar(e, v.cartao) : undefined}
                  alvoDeLigacao={ligando.sobre === v.cartao.id}
                  origemDeLigacao={ligando.de === v.cartao.id}
                />
              ))}
            </section>
          ))}
          {arrasto.ativo && (
            <section className="qd-coluna qd-colunanova" data-coluna={COLUNA_NOVA} data-alvo={arrasto.sobre === COLUNA_NOVA || undefined}>
              <h3 className="qd-colunatitulo">＋ nova coluna</h3>
              <p className="qd-formdica">solte aqui</p>
            </section>
          )}
        </div>
        </>
      )}
      {ligando.fantasma && (
        <div className="qd-fantasma qd-fantasma--ligacao" style={{ left: ligando.fantasma.x, top: ligando.fantasma.y }}>
          🔗 {ligando.fantasma.titulo} → {ligando.sobre ? "solte" : "arraste até outro cartão"}
        </div>
      )}
      {feito && (
        <p className="qd-aviso" role="status" aria-live="polite">
          {feito}
        </p>
      )}
      {pendente && (
        <FolhaDeLigacao
          de={visiveis.find((v) => v.cartao.id === pendente.de) ?? null}
          para={visiveis.find((v) => v.cartao.id === pendente.para) ?? null}
          aoCancelar={() => {
            setPendente(null);
            ligando.limpar();
          }}
          aoConfirmar={async (rotulo) => {
            const de = visiveis.find((v) => v.cartao.id === pendente.de);
            const para = visiveis.find((v) => v.cartao.id === pendente.para);
            setPendente(null);
            ligando.limpar();
            if (!de || !para) return;
            const ok = await quadro.ligar(de.cartao.id, para.cartao.id, rotulo);
            setFeito(ok ? `Ligado: ${tituloVisto(de)} → ${rotulo.trim() || "ligado a"} → ${tituloVisto(para)}` : null);
          }}
        />
      )}
      {arrasto.fantasma && (
        <div className="qd-fantasma" style={{ left: arrasto.fantasma.x, top: arrasto.fantasma.y }}>
          {arrasto.fantasma.titulo}
        </div>
      )}

      {aVer && (
        <FolhaDoCartao
          visto={aVer}
          quadro={quadro}
          quem={quem}
          vistos={visiveis}
          colunas={colunasEmUso(visiveis)}
          sessoes={sessoes}
          nomeDoAutor={nomeDoAutor}
          aoAbrirOutro={setAberto}
          aoFechar={() => setAberto(null)}
        />
      )}
    </div>
  );
}

// ── Miniatura ───────────────────────────────────────────────────────────



// ── Rolagem automática na borda (os dois arrastos) ──────────────────────



// ── Arrastar pra ligar ──────────────────────────────────────────────────



// ── Arrastar entre colunas ──────────────────────────────────────────────




// ── Cartão novo ─────────────────────────────────────────────────────────


// ── Folha (cartão aberto) ───────────────────────────────────────────────








// ── Destaque em tela cheia ──────────────────────────────────────────────


/** O cartão que o Mestre acabou de mostrar: foto grande, nome e o texto.
 *  Toque (ou Esc) fecha; no telão, que ninguém toca, some sozinho. */
export function DestaqueDoCartao({
  cartao,
  urls,
  aoFechar,
  fecharSozinhoEmMs,
}: {
  cartao: Cartao;
  urls: string[];
  aoFechar: () => void;
  fecharSozinhoEmMs?: number;
}) {
  // Várias fotos: troca sozinha (ninguém desliza no telão, e o toque aqui fecha).
  // Quem usa recomeça da primeira com `key` (cartão + instante do destaque).
  const [indice, setIndice] = useState(0);
  useEffect(() => {
    if (urls.length < 2) return;
    const t = setInterval(() => setIndice((i) => (i + 1) % urls.length), 4000);
    return () => clearInterval(t);
  }, [urls.length, cartao.destaque_em]);

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

  // Silhueta: nada do cartão vaza — nem no nome lido pelo leitor de tela.
  const silhueta = destaqueEmSilhueta(cartao);
  return (
    <div
      className="qd-destaque"
      role="dialog"
      aria-modal="true"
      aria-label={silhueta ? "O Mestre mostrou uma silhueta" : `O Mestre mostrou: ${cartao.titulo}`}
      onClick={aoFechar}
    >
      <p className="qd-destaque-aviso">{silhueta ? "🌫️ O Mestre mostrou uma silhueta" : "📣 O Mestre mostrou à mesa"}</p>
      <div className="qd-destaque-corpo">
        {urls.length > 0 && (
          <div className="qd-destaque-foto" data-silhueta={silhueta || undefined}>
            <img src={urls[indice % urls.length]} alt={silhueta ? "" : cartao.titulo} />
            {urls.length > 1 && (
              <p className="qd-pontos" aria-hidden="true">
                {urls.map((u, i) => (
                  <span key={u} data-ativo={i === indice % urls.length || undefined} />
                ))}
              </p>
            )}
          </div>
        )}
        <div className="qd-destaque-textos">
          {silhueta ? (
            <h2 className="qd-destaque-titulo">{TITULO_DA_SILHUETA}</h2>
          ) : (
            <>
              <p className="qd-tiporotulo">
                {emojiDoTipo(cartao.tipo)} {rotuloDoTipo(cartao.tipo)}
              </p>
              <h2 className="qd-destaque-titulo">{cartao.titulo || "Sem nome"}</h2>
              {cartao.subtitulo && <p className="qd-subtitulo">{cartao.subtitulo}</p>}
              {cartao.texto && <p className="qd-destaque-texto">{cartao.texto}</p>}
            </>
          )}
        </div>
      </div>
      {!fecharSozinhoEmMs && <p className="qd-destaque-fechar">toque para fechar</p>}
    </div>
  );
}
