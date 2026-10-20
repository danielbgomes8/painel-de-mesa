"use client";

/* eslint-disable @next/next/no-img-element -- as fotos vêm do Storage do Supabase, já reduzidas no envio */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Quadro } from "@/hooks/useQuadro";
import type { Identidade } from "@/lib/identidade";
import type { EntradaDiario } from "@/lib/tipos";
import {
  FOTOS_MAXIMAS,
  todasAsFotos,
  COLUNAS_SUGERIDAS,
  LIMITE_COLUNA,
  LIMITE_NOTA,
  LIMITE_ROTULO_LIGACAO,
  ROTULOS_SUGERIDOS,
  SEM_COLUNA,
  autorDaPessoa,
  ligacoesDoCartao,
  notasDoCartao,
  podeAnotar,
  podeApagarNota,
  sessoesDoCartao,
  LIMITE_SUBTITULO,
  LIMITE_TEXTO,
  LIMITE_TITULO,
  TIPOS_DE_CARTAO,
  TITULO_DA_SILHUETA,
  destaqueEmSilhueta,
  agruparPorColuna,
  colunasEmUso,
  comColunasVazias,
  cartoesVisiveis,
  emojiDoTipo,
  filtrarPorTipo,
  podeEditarCartao,
  podeMoverCartao,
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
import { MapaDeLigacoes } from "@/components/MapaDeLigacoes";

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

const ROTULO_REVELACAO: Record<Revelacao, { emoji: string; curto: string; ajuda: string }> = {
  escondido: { emoji: "🔒", curto: "Escondido", ajuda: "só você vê" },
  silhueta: { emoji: "🌫️", curto: "Silhueta", ajuda: "a mesa vê a foto escura e ???" },
  revelado: { emoji: "👁", curto: "Revelado", ajuda: "a mesa vê tudo" },
};

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
  const colunasDaTela = comColunasVazias(agruparPorColuna(lista), vazias);
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

function estadoDoCartao(c: Cartao, quem: Identidade | null): { emoji: string; texto: string } | null {
  if (c.dono === null) {
    // A mesa não precisa de selo: o que ela vê já está liberado.
    if (quem?.tipo !== "mestre") return null;
    const r = ROTULO_REVELACAO[c.revelacao];
    return { emoji: r.emoji, texto: r.curto };
  }
  if (c.revelacao === "revelado") return { emoji: "👁", texto: "Compartilhado" };
  return { emoji: "🔒", texto: "Só meu" };
}

function MiniaturaDoCartao({
  visto,
  quadro,
  quem,
  aoAbrir,
  alca,
  arrastando,
  nomeDoAutor,
  alcaLigar,
  alvoDeLigacao,
  origemDeLigacao,
}: {
  visto: CartaoVisto;
  quadro: Quadro;
  quem: Identidade | null;
  nomeDoAutor: (autor: string) => string;
  aoAbrir: () => void;
  /** Só na vista em colunas e só pro Mestre: a alça de arrastar. */
  alca?: (e: React.PointerEvent<HTMLSpanElement>) => void;
  arrastando?: boolean;
  /** A alça 🔗: arrastar até outro cartão pra ligar os dois. */
  alcaLigar?: (e: React.PointerEvent<HTMLSpanElement>) => void;
  alvoDeLigacao?: boolean;
  origemDeLigacao?: boolean;
}) {
  const { cartao: c, visao } = visto;
  const silhueta = visao === "silhueta";
  const url = quadro.urlDaFoto(c);
  const estado = estadoDoCartao(c, quem);
  const titulo = silhueta ? TITULO_DA_SILHUETA : c.titulo || "Sem nome";
  return (
    <div
      className="qd-cartaobloco"
      data-cartao-id={c.id}
      data-arrastando={arrastando || origemDeLigacao || undefined}
      data-alvo-ligacao={alvoDeLigacao || undefined}
    >
      {alcaLigar && (
        <span
          className="qd-alca qd-alca--ligar"
          data-com-colunas={alca ? "" : undefined}
          onPointerDown={alcaLigar}
          role="button"
          aria-label={`Ligar ${titulo} a outro cartão`}
          title="Arrastar até outro cartão para ligar"
        >
          🔗
        </span>
      )}
      {alca && (
        <span className="qd-alca" onPointerDown={alca} role="button" aria-label={`Arrastar ${titulo} para outra coluna`} title="Arrastar para outra coluna">
          ⠿
        </span>
      )}
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
      {c.dono !== null && (
        <span className="qd-dono">🧑 {quem?.tipo === "jogador" && quem.slug === c.dono ? "seu cartão" : `de ${nomeDoAutor(c.dono)}`}</span>
      )}
      {!silhueta && c.subtitulo && <span className="qd-sub">{c.subtitulo}</span>}
    </button>
    </div>
  );
}

// ── Rolagem automática na borda (os dois arrastos) ──────────────────────

const BORDA_DA_ROLAGEM = 56;
const velocidadeDaRolagem = (dentro: number) => Math.round(4 + 16 * Math.min(1, Math.max(0, dentro / BORDA_DA_ROLAGEM)));

/** Com o dedo perto da borda, rola o quadro (de lado, se houver `lista`, e a página pra baixo/cima).
 *  Devolve se rolou: aí o que está sob o dedo mudou e o chamador refaz a conta. Roda a cada quadro
 *  da animação: no celular não dá pra "rolar com outro dedo" no meio do arrasto. */
function rolarPelaBorda(x: number, y: number, lista: HTMLElement | null): boolean {
  let rolou = false;
  if (lista) {
    const r = lista.getBoundingClientRect();
    if (x < r.left + BORDA_DA_ROLAGEM && lista.scrollLeft > 0) {
      lista.scrollLeft -= velocidadeDaRolagem(r.left + BORDA_DA_ROLAGEM - x);
      rolou = true;
    } else if (x > r.right - BORDA_DA_ROLAGEM && lista.scrollLeft < lista.scrollWidth - lista.clientWidth) {
      lista.scrollLeft += velocidadeDaRolagem(x - (r.right - BORDA_DA_ROLAGEM));
      rolou = true;
    }
  }
  const altura = window.innerHeight;
  if (y < BORDA_DA_ROLAGEM + 40 && window.scrollY > 0) {
    window.scrollBy(0, -velocidadeDaRolagem(BORDA_DA_ROLAGEM + 40 - y));
    rolou = true;
  } else if (y > altura - BORDA_DA_ROLAGEM && window.scrollY < document.documentElement.scrollHeight - altura) {
    window.scrollBy(0, velocidadeDaRolagem(y - (altura - BORDA_DA_ROLAGEM)));
    rolou = true;
  }
  return rolou;
}

// ── Arrastar pra ligar ──────────────────────────────────────────────────

/** Arrastar pela alça 🔗 até outro cartão. Soltar em cima de um cartão devolve
 *  `solto` ({ de, para }); a tela então pergunta o tipo da ligação. */
function useArrastoDeLigacao(listaRef: React.RefObject<HTMLDivElement | null>) {
  const [estado, setEstado] = useState<{ de: string; titulo: string; x: number; y: number; sobre: string | null } | null>(null);
  const [solto, setSolto] = useState<{ de: string; para: string } | null>(null);
  const deRef = useRef<string | null>(null);
  const posRef = useRef({ x: 0, y: 0 });

  const comecar = (e: React.PointerEvent<HTMLSpanElement>, c: Cartao) => {
    e.preventDefault();
    deRef.current = c.id;
    posRef.current = { x: e.clientX, y: e.clientY };
    setSolto(null);
    setEstado({ de: c.id, titulo: c.titulo || "Sem nome", x: e.clientX, y: e.clientY, sobre: null });
  };

  const ativo = estado !== null;
  useEffect(() => {
    if (!ativo) return;
    const cartaoEm = (x: number, y: number): string | null => {
      const id = (document.elementFromPoint(x, y)?.closest("[data-cartao-id]") as HTMLElement | null)?.dataset.cartaoId ?? null;
      return id && id !== deRef.current ? id : null;
    };
    function mover(e: PointerEvent) {
      posRef.current = { x: e.clientX, y: e.clientY };
      setEstado((a) => (a ? { ...a, x: e.clientX, y: e.clientY, sobre: cartaoEm(e.clientX, e.clientY) } : a));
    }
    // Perto da borda o quadro rola sozinho: o cartão de destino pode estar fora da tela.
    let quadro = 0;
    function rolar() {
      const { x, y } = posRef.current;
      if (rolarPelaBorda(x, y, listaRef.current)) {
        const sobre = cartaoEm(x, y);
        setEstado((a) => (a && a.sobre !== sobre ? { ...a, sobre } : a));
      }
      quadro = requestAnimationFrame(rolar);
    }
    quadro = requestAnimationFrame(rolar);
    function soltar(e: PointerEvent) {
      const de = deRef.current;
      const para = cartaoEm(e.clientX, e.clientY);
      deRef.current = null;
      setEstado(null);
      if (de && para) setSolto({ de, para });
    }
    function cancelar() {
      deRef.current = null;
      setEstado(null);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") cancelar();
    }
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", cancelar);
    window.addEventListener("keydown", tecla);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", cancelar);
      window.removeEventListener("keydown", tecla);
    };
  }, [ativo, listaRef]);

  return {
    comecar,
    de: estado?.de ?? null,
    sobre: estado?.sobre ?? null,
    solto,
    limpar: () => setSolto(null),
    fantasma: estado ? { x: estado.x, y: estado.y, titulo: estado.titulo } : null,
  };
}

/** "Barão Vael → ? → Culto": escolhe (ou digita) o tipo da ligação. */
function FolhaDeLigacao({
  de,
  para,
  aoConfirmar,
  aoCancelar,
}: {
  de: CartaoVisto | null;
  para: CartaoVisto | null;
  aoConfirmar: (rotulo: string) => void;
  aoCancelar: () => void;
}) {
  const [rotulo, setRotulo] = useState("");
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") aoCancelar();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aoCancelar]);
  if (!de || !para) return null;
  return (
    <div className="qd-fundo" role="presentation" onClick={aoCancelar}>
      <div className="qd-folha qd-folhaligacao" role="dialog" aria-modal="true" aria-label="Ligar cartões" onClick={(e) => e.stopPropagation()}>
        <h3 className="qd-titulo">
          {tituloVisto(de)} <span className="qd-seta">→</span> {tituloVisto(para)}
        </h3>
        <p className="qd-formdica">Que ligação é essa?</p>
        <div className="qd-sugestoes">
          {ROTULOS_SUGERIDOS.map((r) => (
            <button key={r} type="button" className="chip" aria-pressed={rotulo === r} onClick={() => setRotulo(r)}>
              {r}
            </button>
          ))}
        </div>
        <input
          type="text"
          aria-label="Tipo da ligação"
          placeholder="ou escreva: traiu, deve a…"
          maxLength={LIMITE_ROTULO_LIGACAO}
          value={rotulo}
          onChange={(e) => setRotulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") aoConfirmar(rotulo);
          }}
        />
        <div className="qd-linha">
          <button type="button" className="btn primary" onClick={() => aoConfirmar(rotulo)}>
            Ligar
          </button>
          <button type="button" className="btn ghost" onClick={aoCancelar}>
            cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Arrastar entre colunas ──────────────────────────────────────────────

const COLUNA_NOVA = "__nova__";

/** Na vista em colunas o Mestre mostra "Sem coluna" mesmo vazia, pra ter onde soltar. */
function comSemColuna(colunas: ReturnType<typeof agruparPorColuna>) {
  return colunas.some((c) => c.valor === "") ? colunas : [...colunas, { nome: SEM_COLUNA, valor: "", cartoes: [] }];
}

/** Arrastar pela alça (⠿) com o dedo ou o mouse: o cartão acompanha o ponteiro e a
 *  coluna por baixo acende; soltar grava a coluna. Soltar em "nova coluna" pergunta o nome.
 *  A alça tem `touch-action: none`, então arrastar nela não rola a página. */
function useArrastoDeColuna(quadro: Quadro, habilitado: boolean, listaRef: React.RefObject<HTMLDivElement | null>) {
  const [estado, setEstado] = useState<{ id: string; titulo: string; x: number; y: number; sobre: string | null } | null>(null);
  const idRef = useRef<string | null>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const quadroRef = useRef(quadro);
  useEffect(() => {
    quadroRef.current = quadro;
  }, [quadro]);

  const comecar = (e: React.PointerEvent<HTMLSpanElement>, c: Cartao) => {
    if (!habilitado) return;
    e.preventDefault();
    idRef.current = c.id;
    posRef.current = { x: e.clientX, y: e.clientY };
    // Uma batidinha avisa que o cartão "pegou" (celulares sem vibração não ligam).
    try {
      navigator.vibrate?.(15);
    } catch {
      // sem vibração: o cartão acompanhando o dedo já mostra
    }
    setEstado({ id: c.id, titulo: c.titulo || "Sem nome", x: e.clientX, y: e.clientY, sobre: null });
  };

  const ativo = estado !== null;
  useEffect(() => {
    if (!ativo) return;
    function colunaEm(x: number, y: number): string | null {
      const alvo = document.elementFromPoint(x, y)?.closest("[data-coluna]") as HTMLElement | null;
      return alvo ? alvo.dataset.coluna ?? "" : null;
    }
    function mover(e: PointerEvent) {
      posRef.current = { x: e.clientX, y: e.clientY };
      setEstado((a) => (a ? { ...a, x: e.clientX, y: e.clientY, sobre: colunaEm(e.clientX, e.clientY) } : a));
    }
    // Perto da borda o quadro rola sozinho, mesmo com o dedo parado.
    let quadro = 0;
    function rolar() {
      const { x, y } = posRef.current;
      if (rolarPelaBorda(x, y, listaRef.current)) {
        // O que está sob o dedo mudou porque o quadro andou.
        const sobre = colunaEm(x, y);
        setEstado((a) => (a && a.sobre !== sobre ? { ...a, sobre } : a));
      }
      quadro = requestAnimationFrame(rolar);
    }
    quadro = requestAnimationFrame(rolar);
    function soltar(e: PointerEvent) {
      const id = idRef.current;
      idRef.current = null;
      setEstado(null);
      const destino = colunaEm(e.clientX, e.clientY);
      if (!id || destino === null) return;
      const cartao = quadroRef.current.cartoes.find((c) => c.id === id);
      if (!cartao) return;
      let coluna = destino;
      if (destino === COLUNA_NOVA) {
        const nome = window.prompt("Nome da nova coluna:", "")?.trim().slice(0, LIMITE_COLUNA);
        if (!nome) return;
        coluna = nome;
      }
      if (coluna !== cartao.coluna.trim()) void quadroRef.current.atualizar(id, { coluna });
    }
    function cancelar() {
      idRef.current = null;
      setEstado(null);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") cancelar();
    }
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", cancelar);
    window.addEventListener("keydown", tecla);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", cancelar);
      window.removeEventListener("keydown", tecla);
    };
  }, [ativo, listaRef]);

  return {
    comecar,
    ativo,
    id: estado?.id ?? null,
    sobre: estado?.sobre ?? null,
    fantasma: estado ? { x: estado.x, y: estado.y, titulo: estado.titulo } : null,
  };
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

function tituloVisto(v: CartaoVisto): string {
  return v.visao === "silhueta" ? TITULO_DA_SILHUETA : v.cartao.titulo || "Sem nome";
}

/** "📖 Apareceu em: Sessão 1, Sessão 3" — a linha do tempo do cartão. */
function SessoesDoCartao({ cartao, sessoes }: { cartao: Cartao; sessoes: EntradaDiario[] }) {
  const doCartao = sessoesDoCartao(cartao.id, sessoes);
  if (doCartao.length === 0) return null;
  return (
    <p className="qd-formdica qd-sessoes">
      📖 Apareceu em:{" "}
      {doCartao.map((s) => `${s.title || "Sessão"} (${new Date(s.created_at).toLocaleDateString("pt-BR")})`).join(" · ")}
    </p>
  );
}

function LigacoesDoCartao({
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

function AnotacoesDoCartao({
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
function CampoDeColuna({ cartao: c, quadro, existentes }: { cartao: Cartao; quadro: Quadro; existentes: string[] }) {
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

function ControlesDoMestre({
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

// ── Destaque em tela cheia ──────────────────────────────────────────────

/** Fotos do cartão lado a lado: desliza com o dedo, uma por vez. Uma só foto = sem enfeite. */
function GaleriaDeFotos({ urls, alt, silhueta }: { urls: string[]; alt: string; silhueta: boolean }) {
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
