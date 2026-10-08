"use client";

import { useEffect, useMemo, useState } from "react";
import { useSala } from "@/hooks/useSala";
import { useCenas } from "@/hooks/useCenas";
import { useQuadro } from "@/hooks/useQuadro";
import { useBau } from "@/hooks/useBau";
import { useTempo } from "@/hooks/useTempo";
import { rotuloCurtoDoDia } from "@/lib/tempoCampanha";
import { useVersaoNova } from "@/hooks/useVersaoNova";
import { AvisoVersaoNova } from "@/components/AvisoVersaoNova";
import { useCodigoSala, useNoNavegador } from "@/hooks/useCodigoSala";
import { useIdentidade } from "@/hooks/useIdentidade";
import { useModoTelao } from "@/hooks/useModoTelao";
import {
  limparIdentidade,
  salvarIdentidade,
  type Identidade,
} from "@/lib/identidade";
import { lembrarSala, rotuloDaSala } from "@/lib/sala";
import { COR_PING_MESTRE, corDoJogador } from "@/lib/ping";
import type { QuemPinga } from "@/hooks/usePing";
import { horaCurta } from "@/lib/offline";
import { definirContextoDoErro, relatarErro } from "@/lib/relatarErro";
import { baixarBackupDaSala } from "@/components/BackupSala";
import { Portao } from "@/components/Portao";
import { RastreadorCombate } from "@/components/RastreadorCombate";
import { AcoesEmMassa } from "@/components/AcoesEmMassa";
import { AbaMestre } from "@/components/AbaMestre";
import { FichaPersonagem } from "@/components/FichaPersonagem";
import { BannerSuaVez } from "@/components/BannerSuaVez";
import { BannerMapaNaMesa } from "@/components/BannerMapaNaMesa";
import { LogCombate } from "@/components/LogCombate";
import { AbaCampanha } from "@/components/AbaCampanha";
import { DestaqueDoCartao } from "@/components/QuadroCampanha";
import { PainelBastiao } from "@/components/PainelBastiao";
import { PainelMapa } from "@/components/MapaSobDemanda";
import { Telao } from "@/components/Telao";
import { BASTIAO_ATIVO, BarraAbas, type Aba } from "@/components/BarraAbas";
import { EscolherCampanha } from "@/components/EscolherCampanha";
import { BarraDesfazer } from "@/components/BarraDesfazer";

/** Roda `fazer` quando o navegador estiver à toa (ou em 2 s, onde não há
 *  requestIdleCallback, como no Safari antigo). Devolve como cancelar. */
function quandoSobrarTempo(fazer: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fazer, { timeout: 5000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fazer, 2000);
  return () => window.clearTimeout(id);
}

export function Painel() {
  const codigo = useCodigoSala();
  const noNavegador = useNoNavegador();

  // Service worker (public/sw.js): guarda o app no aparelho pra ele abrir
  // sem internet. Só no site publicado — no `npm run dev` ele guardaria
  // versões de desenvolvimento e atrapalharia.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((e) => relatarErro("service worker", e));
  }, []);

  // No servidor e na hidratação a sala ainda não é conhecida: a página é
  // estática, e o código vem da URL ou da última sala deste aparelho (ver
  // escolherSala). Montar a sala antes disso abria a conexão da sala padrão
  // à toa — e o efeito que grava `?sala=` no endereço prendia a pessoa nela:
  // o app instalado caía na Salamina em vez da última campanha (achado
  // testando). O título neutro também é o que um preview de link (WhatsApp)
  // enxerga, em vez do nome de outra campanha.
  if (!noNavegador) {
    return (
      <>
        <title>Painel de Mesa</title>
        <div className="tela-centro">
          <h1>Painel de Mesa</h1>
          <p>Conectando à sala…</p>
        </div>
      </>
    );
  }

  // Aba do navegador com o nome da campanha aberta: o React 19 leva o <title>
  // pro <head>. Não fica no metadata do layout — lá é fixo e o Next o aplica
  // depois da montagem, por cima de um document.title (achado testando).
  // key=codigo: trocar de sala (link, botão de trocar campanha ou voltar)
  // remonta do zero — estado, conexão e tempo real da campanha anterior vão
  // embora juntos.
  return (
    <>
      <title>{`Painel de Mesa — ${rotuloDaSala(codigo)}`}</title>
      <PainelSala key={codigo} codigo={codigo} />
    </>
  );
}

function PainelSala({ codigo }: { codigo: string }) {
  const sala = useSala(codigo);
  // Mapas têm canal próprio: um problema neles (migration não rodada, imagem
  // pesada) nunca derruba o combate.
  const cenas = useCenas(codigo);
  const identidade = useIdentidade(codigo);
  const telao = useModoTelao();
  // O quadro também tem canal próprio. No telão ninguém tem identidade: ele
  // vê só o que a mesa inteira vê.
  const quadro = useQuadro(codigo, telao ? null : identidade);
  // O baú do grupo (itens e moedas ainda sem dono) também tem canal próprio.
  const bau = useBau(codigo);
  // O tempo da campanha (dia, calendário e efeitos que duram dias), idem.
  const tempo = useTempo(codigo);
  // Saiu uma versão nova depois de abrir? O telão (que ninguém toca) recarrega sozinho; nos
  // celulares aparece um aviso e a pessoa decide a hora (não no meio de um combate).
  const versaoNova = useVersaoNova(telao);
  const rotulo = rotuloDaSala(codigo);

  function entrar(id: Identidade) {
    salvarIdentidade(codigo, id);
  }
  function trocar() {
    limparIdentidade(codigo);
    // A pilha de desfazer é do aparelho, não da pessoa: quem entra depois
    // não pode desfazer o que o Mestre fez antes de passar o celular.
    sala.esquecerDesfazer();
  }
  // O telão é uma página à parte (`?telao=1`), feita pra outro aparelho ou pra uma
  // aba arrastada pra TV. O link leva a sala, então abre a campanha certa em qualquer lugar.
  const [telaoAberto, setTelaoAberto] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState<"" | "sim" | "nao">("");
  function linkDoTelao() {
    const params = new URLSearchParams(window.location.search);
    params.set("sala", codigo);
    params.set("telao", "1");
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }
  function abrirTelao() {
    window.open(linkDoTelao(), "_blank");
  }
  async function copiarLinkDoTelao() {
    try {
      await navigator.clipboard.writeText(linkDoTelao());
      setLinkCopiado("sim");
    } catch {
      setLinkCopiado("nao");
    }
  }
  // O arquivo vem de uma leitura nova do banco (não do que está na tela), pra
  // levar o log inteiro e o Bastião — ver BackupSala.
  const [baixandoBackup, setBaixandoBackup] = useState(false);
  async function baixarBackup() {
    setBaixandoBackup(true);
    await baixarBackupDaSala(sala, codigo, rotulo);
    setBaixandoBackup(false);
  }

  const souMestre = identidade?.tipo === "mestre";
  const [aba, setAba] = useState<Aba>("diario");
  // O Mestre sempre vê a aba (é onde ele prepara, e onde descobre que falta a
  // migration); o jogador só quando há um mapa na mesa.
  const temMapa = souMestre || Boolean(cenas.naMesa);

  // O que ficou fora da abertura do app baixa no tempo livre, depois que a
  // tela já está na mão: as habilidades de classe sempre (a ficha tem de abrir
  // sem internet, e o service worker só guarda o que já foi baixado) e o mapa
  // pra quem tem mapa — o Mestre, ou todo mundo quando há um na mesa. Falha
  // calada: sem internet, a tela que precisa avisa na hora.
  useEffect(() => quandoSobrarTempo(() => void import("@/lib/classesSrd").catch(() => {})), []);
  useEffect(() => {
    if (!temMapa) return;
    return quandoSobrarTempo(() => void import("@/components/PainelMapa").catch(() => {}));
  }, [temMapa]);
  // Último mapa que esta pessoa viu (abriu a aba ou dispensou o aviso): o aviso
  // "tem um mapa na mesa" só aparece pra um mapa que ela ainda não viu.
  const [mapaVisto, setMapaVisto] = useState<string | null>(null);
  const abaEfetiva: Aba =
    (aba === "mestre" && !souMestre) || (aba === "bastiao" && !BASTIAO_ATIVO) || (aba === "mapa" && !temMapa)
      ? "diario"
      : aba;

  function mudarAba(nova: Aba) {
    // Abrir o mapa, ou sair dele, conta como ter visto o que está na mesa agora.
    if (nova === "mapa" || abaEfetiva === "mapa") setMapaVisto(cenas.naMesa?.id ?? null);
    setAba(nova);
  }

  const meuPersonagem = useMemo(() => {
    if (identidade?.tipo !== "jogador") return null;
    return sala.personagens.find((p) => p.slug === identidade.slug) ?? null;
  }, [identidade, sala.personagens]);

  // Quem pinga no mapa e com que cor: o Mestre é dourado; cada jogador tem a
  // sua, pela posição da ficha entre as dos jogadores (ver corDoJogador).
  const quemPinga = useMemo<QuemPinga | null>(() => {
    if (identidade?.tipo === "mestre") return { nome: "Mestre", cor: COR_PING_MESTRE };
    if (identidade?.tipo !== "jogador") return null;
    const slugs = sala.personagens.filter((p) => !p.is_npc).map((p) => p.slug);
    const nome = meuPersonagem?.name ?? identidade.slug;
    return { nome, cor: corDoJogador(identidade.slug, slugs, nome) };
  }, [identidade, meuPersonagem, sala.personagens]);

  const [trocandoCampanha, setTrocandoCampanha] = useState(false);

  // Sala e quem está no aparelho vão junto de cada relato de erro (ver
  // lib/relatarErro.ts) — "deu erro no celular do Tibério, no telão...".
  const quemUsa = telao
    ? "telão"
    : identidade?.tipo === "mestre"
      ? "Mestre"
      : identidade?.tipo === "jogador"
        ? (meuPersonagem?.name ?? identidade.slug)
        : null;
  useEffect(() => {
    definirContextoDoErro(codigo, quemUsa);
  }, [codigo, quemUsa]);

  // A sala vai pro endereço mesmo quando veio da "última sala" (ver
  // escolherSala): recarregar fica na mesma, e o link copiado dali leva
  // quem recebe pra campanha certa em vez de pra última sala DELE.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("sala")) return;
    url.searchParams.set("sala", codigo);
    window.history.replaceState(null, "", url);
  }, [codigo]);

  // Só lembra depois de entrar de verdade — um link com erro de digitação que
  // só foi espiado não vira a sala que o app instalado abre amanhã.
  useEffect(() => {
    if (identidade) lembrarSala(codigo);
  }, [codigo, identidade]);

  if (sala.erro) {
    return (
      <div className="tela-centro">
        <h1>Não deu pra abrir a sala</h1>
        <p>{sala.erro}</p>
      </div>
    );
  }

  if (sala.carregando) {
    return (
      <div className="tela-centro">
        <h1>Painel de Mesa</h1>
        <p>Conectando à sala…</p>
      </div>
    );
  }

  if (telao) {
    return (
      <>
        <Telao sala={sala} rotulo={rotulo} cenas={cenas} codigo={codigo} tempo={tempo} />
        {quadro.destaque && (
          <DestaqueDoCartao
            cartao={quadro.destaque}
            url={quadro.urlDaFoto(quadro.destaque)}
            aoFechar={quadro.dispensarDestaque}
            fecharSozinhoEmMs={30000}
          />
        )}
      </>
    );
  }

  if (!identidade) {
    return <Portao sala={sala} codigo={codigo} rotulo={rotulo} onEntrar={entrar} />;
  }

  const quem =
    identidade.tipo === "mestre" ? "Mestre" : meuPersonagem?.name ?? identidade.slug;

  const personagemSumiu =
    identidade.tipo === "jogador" && sala.conectado && !meuPersonagem;

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <h1>Painel de Mesa</h1>
          <span className="tag">{rotulo}</span>
          {tempo.tempo && <span className="tag tag-dia">🗓 {rotuloCurtoDoDia(tempo.tempo)}</span>}
        </div>
        <div className="whoami">
          <span className={`synctag${sala.semInternet ? " semrede" : sala.conectado ? " on" : ""}`}>
            {sala.semInternet
              ? `sem internet${sala.esperando > 0 ? ` · ${sala.esperando} esperando` : ""}`
              : sala.conectado
                ? "sincronizado"
                : "offline"}
          </span>
          <span>
            Entrou como <b>{quem}</b>
          </span>
          {souMestre && (
            <>
              <button
                className="linkbtn"
                type="button"
                aria-expanded={telaoAberto}
                onClick={() => setTelaoAberto((v) => !v)}
              >
                📺 modo telão
              </button>
              <button className="linkbtn" type="button" onClick={baixarBackup} disabled={baixandoBackup}>
                {baixandoBackup ? "⬇ juntando…" : "⬇ backup"}
              </button>
            </>
          )}
          <button className="linkbtn" type="button" onClick={trocar}>
            trocar
          </button>
          <button
            className="linkbtn"
            type="button"
            aria-expanded={trocandoCampanha}
            onClick={() => setTrocandoCampanha((v) => !v)}
          >
            ⇄ trocar campanha
          </button>
        </div>
      </div>

      {souMestre && telaoAberto && (
        <section className="combat" aria-label="Modo telão">
          <div className="combat-head">
            <h2>📺 Modo telão</h2>
          </div>
          <p className="bkpexplica">
            O telão é uma tela só pra mesa olhar: de quem é a vez, os próximos e o mapa. Ele
            não ocupa este painel e não tem controle nenhum — tudo o que você faz aqui aparece lá
            na hora. O ideal é abrir num <b>outro aparelho</b> (TV, tablet, notebook): copie o link e
            abra lá. Com um aparelho só, abra em aba nova e arraste a aba pra TV ou projetor.
          </p>
          <div className="whoami">
            <button className="linkbtn" type="button" onClick={copiarLinkDoTelao}>
              🔗 copiar link do telão
            </button>
            <button className="linkbtn" type="button" onClick={abrirTelao}>
              ↗ abrir em aba nova
            </button>
            <span aria-live="polite">
              {linkCopiado === "sim"
                ? "Link copiado."
                : linkCopiado === "nao"
                  ? "Não deu pra copiar — segure o link abaixo e copie."
                  : ""}
            </span>
          </div>
          <p className="bkpexplica" style={{ wordBreak: "break-all" }}>
            {linkDoTelao()}
          </p>
        </section>
      )}

      {trocandoCampanha && (
        <section className="combat" aria-label="Trocar de campanha">
          <div className="combat-head">
            <h2>Trocar de campanha</h2>
            <button className="linkbtn" type="button" onClick={() => setTrocandoCampanha(false)}>
              fechar
            </button>
          </div>
          <p className="bkpexplica">
            Cada campanha tem as fichas, o combate e o diário dela. Em cada uma você
            entra uma vez como Mestre ou personagem, e o aparelho lembra.
          </p>
          <EscolherCampanha atual={codigo} />
        </section>
      )}

      {sala.avisoFalha && (
        <div className="avisofalha" role="alert" aria-live="polite">
          <span>⚠ {sala.avisoFalha}</span>
          <button type="button" onClick={sala.limparAvisoFalha} aria-label="Dispensar aviso">
            ✕
          </button>
        </div>
      )}

      <AvisoVersaoNova aparecer={versaoNova} comFilaPendente={sala.esperando > 0} />

      {sala.semInternet && (
        <div className="avisosemrede" role="status">
          <b>Sem internet.</b> O combate continua: o que você fizer fica guardado neste aparelho e vai
          pro banco quando a conexão voltar — os outros celulares só veem depois.
          {sala.fotoDe && ` Abriu sem conexão: mostrando o que este aparelho tinha às ${horaCurta(sala.fotoDe)}.`}
        </div>
      )}

      {identidade.tipo === "jogador" && (
        <BannerSuaVez sala={sala} meuSlug={identidade.slug} />
      )}

      {!souMestre && abaEfetiva !== "mapa" && (
        <BannerMapaNaMesa
          cena={cenas.naMesa}
          visto={mapaVisto}
          aoAbrir={() => mudarAba("mapa")}
          aoDispensar={() => setMapaVisto(cenas.naMesa?.id ?? null)}
        />
      )}

      <BarraAbas aba={abaEfetiva} onMudar={mudarAba} souMestre={souMestre} temMapa={temMapa} />

      {abaEfetiva === "diario" && <AbaCampanha sala={sala} codigo={codigo} quadro={quadro} bau={bau} tempo={tempo} identidade={identidade} />}

      {abaEfetiva === "bastiao" && <PainelBastiao sala={sala} />}

      {abaEfetiva === "combate" && (
        <>
          <RastreadorCombate sala={sala} souMestre={souMestre} meuPersonagem={meuPersonagem} cenaNaMesa={cenas.naMesa} />
          {souMestre && <AcoesEmMassa sala={sala} tempo={tempo} />}
          <LogCombate log={sala.log} />
        </>
      )}

      {abaEfetiva === "mapa" && <PainelMapa
          cenas={cenas}
          codigo={codigo}
          souMestre={souMestre}
          quem={quemPinga}
          sala={sala}
          meuSlug={identidade.tipo === "jogador" ? identidade.slug : null}
        />}

      {abaEfetiva === "mestre" && souMestre && (
        <AbaMestre
          sala={sala}
          codigo={codigo}
          rotulo={rotulo}
          aoAbrirTelao={() => {
            setTelaoAberto(true);
            window.scrollTo({ top: 0 });
          }}
        />
      )}

      {abaEfetiva === "fichas" &&
        (personagemSumiu ? (
          <div className="tela-centro">
            <h1>Seu personagem não está mais na sala</h1>
            <p>
              O Mestre pode ter removido ou renomeado. Toque em <b>trocar</b> no
              topo pra escolher de novo.
            </p>
          </div>
        ) : (
          <div className="grid">
            {souMestre
              ? sala.personagens.map((p) => (
                  <FichaPersonagem key={p.id} personagem={p} souMestre ehMinha={false} sala={sala} bau={bau} />
                ))
              : meuPersonagem && (
                  <FichaPersonagem
                    key={meuPersonagem.id}
                    personagem={meuPersonagem}
                    souMestre={false}
                    ehMinha
                    sala={sala}
                    bau={bau}
                  />
                )}
          </div>
        ))}

      {/* No fim do conteúdo e presa no rodapé (sticky): sempre ao alcance do
          polegar, sem cobrir o topo da ordem de iniciativa. */}
      {(abaEfetiva === "combate" || abaEfetiva === "fichas") && <BarraDesfazer sala={sala} />}

      {quadro.destaque && (
        <DestaqueDoCartao cartao={quadro.destaque} url={quadro.urlDaFoto(quadro.destaque)} aoFechar={quadro.dispensarDestaque} />
      )}
    </>
  );
}
