"use client";

import { useMemo, useRef, useState } from "react";
import type { Cenas } from "@/hooks/useCenas";
import type { Sala } from "@/hooks/useSala";
import { useNevoa } from "@/hooks/useNevoa";
import { usePecas } from "@/hooks/usePecas";
import { usePing, type QuemPinga } from "@/hooks/usePing";
import { montarPecasNaTela, posicoesIniciais, type TamanhoPeca } from "@/lib/pecas";
import type { ModoRegua } from "@/lib/regua";
import { MODELO_INICIAL, type ModeloArea } from "@/lib/area";
import {
  cameraValida,
  gradePxParaQuadrados,
  gradeUsavel,
  nomeDaCenaPeloArquivo,
  quadradosNaLargura,
  type Cena,
  type ModoNevoa,
  type TamanhoPincel,
} from "@/lib/cenas";
import { BotaoRemover } from "@/components/BotaoRemover";
import { CampoNumero } from "@/components/CampoNumero";
import { CampoTexto } from "@/components/CampoTexto";
import { CenaMapa, type CenaMapaApi, type Ferramenta } from "@/components/CenaMapa";
import { ControlesDeArea } from "@/components/ControlesDeArea";
import { LegendaIconesPeao } from "@/components/LegendaIconesPeao";
import { SecaoRecolhivel } from "@/components/SecaoRecolhivel";

/**
 * A mesa vendo o mapa: o que o Mestre pôs na tela, com a névoa. Usado na aba
 * Mapa dos jogadores e, em tela cheia e sem toque, no telão.
 */
export function VisorDaMesa({
  cena,
  codigo,
  urlDaImagem,
  sala,
  quem = null,
  meuSlug = null,
  telao = false,
}: {
  cena: Cena;
  codigo: string;
  urlDaImagem: (c: Cena) => string | null;
  sala: Sala;
  /** Quem está olhando: com isso a pessoa também pinga. O telão só recebe. */
  quem?: QuemPinga | null;
  /** A ficha de quem joga (move o peão dela); null no telão. */
  meuSlug?: string | null;
  telao?: boolean;
}) {
  const nevoa = useNevoa(cena.id, codigo);
  const ping = usePing(cena, quem);
  const banco = usePecas(cena.id, codigo);
  const mapaRef = useRef<CenaMapaApi>(null);
  // O que o toque faz no mapa: mexer, medir (régua) ou marcar uma área de magia.
  const [uso, setUso] = useState<"mover" | "regua" | "area">("mover");
  const medindo = uso === "regua";
  const [modoRegua, setModoRegua] = useState<ModoRegua>("grade");
  const [modeloArea, setModeloArea] = useState<ModeloArea>(MODELO_INICIAL);
  // Sempre do ponto de vista de jogador: o telão e os celulares nunca veem o
  // nome de um inimigo ainda não revelado (ver lib/pecas.ts).
  const pecas = useMemo(
    () =>
      montarPecasNaTela({
        pecas: banco.pecas,
        cena,
        fichas: sala.personagens,
        vezDe: sala.combate.order[sala.combate.turn]?.slug ?? null,
        slugsDosJogadores: sala.personagens.filter((p) => !p.is_npc).map((p) => p.slug),
        visao: { mestre: false, meuSlug },
        selecionadaId: null,
      }),
    [banco.pecas, cena, sala.personagens, sala.combate, meuSlug],
  );
  const minhaFicha = meuSlug ? sala.personagens.find((p) => p.slug === meuSlug) : undefined;
  const semMeuPeao = Boolean(minhaFicha) && !banco.pecas.some((p) => p.slug === meuSlug);

  function porMeuPeao() {
    if (!minhaFicha) return;
    const [x, y] = posicoesIniciais(cena, 1, mapaRef.current?.regiaoVisivel() ?? null, banco.pecas.map((p) => [p.x, p.y]))[0];
    void banco.adicionar([{ slug: minhaFicha.slug, nome: "", x, y }]);
  }
  return (
    <div className={telao ? "mapa-visor mapa-visor--telao" : "mapa-visor"}>
      <CenaMapa
        ref={mapaRef}
        cena={cena}
        imagemUrl={urlDaImagem(cena)}
        regras={nevoa.regras}
        mestre={false}
        interativo={!telao}
        seguirCamera
        pings={ping.pings}
        aoPingar={quem ? ping.enviar : undefined}
        ferramenta={uso}
        modoRegua={modoRegua}
        corRegua={quem?.cor}
        reguas={ping.reguas}
        aoMedir={quem ? ping.enviarRegua : undefined}
        modeloArea={modeloArea}
        areas={ping.areas}
        aoAreaar={quem ? ping.enviarArea : undefined}
        pecas={pecas}
        aoMoverPeca={telao ? undefined : (id, x, y) => void banco.atualizar(id, { x, y })}
      />
      {!telao && (
        <>
          <div className="mapa-visor-barra">
            <span className="mapa-visor-nome">{cena.nome || "Mapa"}</span>
            <div className="mapa-visor-botoes">
              {semMeuPeao && (
                <button type="button" className="btn" onClick={porMeuPeao}>
                  pôr meu peão no mapa
                </button>
              )}
              {quem && (
                <>
                  <button type="button" className="chip alvo" aria-pressed={medindo} onClick={() => setUso(medindo ? "mover" : "regua")}>
                    📏 medir
                  </button>
                  <button type="button" className="chip alvo" aria-pressed={uso === "area"} onClick={() => setUso(uso === "area" ? "mover" : "area")}>
                    ✨ área
                  </button>
                </>
              )}
              <button type="button" className="btn" onClick={() => mapaRef.current?.reenquadrar()}>
                voltar à visão da mesa
              </button>
            </div>
          </div>
          {medindo && (
            <div className="mapa-ferr" role="group" aria-label="Como medir">
              <button type="button" className="chip alvo" aria-pressed={modoRegua === "grade"} onClick={() => setModoRegua("grade")}>
                na grade
              </button>
              <button type="button" className="chip alvo" aria-pressed={modoRegua === "reta"} onClick={() => setModoRegua("reta")}>
                em linha reta
              </button>
            </div>
          )}
          {uso === "area" && <ControlesDeArea modelo={modeloArea} aoMudar={setModeloArea} metrosPorQuadrado={cena.metros} />}
          {banco.aviso && (
            <p className="mapa-erro" role="alert">
              {banco.aviso}
            </p>
          )}
          {quem && (
            <p className="mapa-dica">
              <span className="mapa-cor" style={{ background: quem.cor }} aria-hidden="true" />
              <b>Sua cor.</b> Segure o dedo parado no mapa pra mostrar um ponto pra todo mundo: o pulso aparece com o seu
              nome na TV e nos outros celulares. {medindo
                ? "Medindo: arraste de um ponto a outro. Começando no seu peão, diz se cabe no seu deslocamento."
                : uso === "area"
                  ? "Área de magia: escolha a forma e o tamanho e arraste no mapa. A mesa vê a figura por alguns segundos."
                  : "Toque em 📏 medir pra ver a distância em metros, ou em ✨ área pra mostrar o alcance de uma magia."}
            </p>
          )}
          <LegendaIconesPeao />
        </>
      )}
    </div>
  );
}

/** Conteúdo da aba Mapa: o Mestre edita; os jogadores só veem o que está na mesa. */
export function PainelMapa({
  cenas,
  codigo,
  souMestre,
  quem,
  sala,
  meuSlug,
}: {
  cenas: Cenas;
  codigo: string;
  souMestre: boolean;
  quem: QuemPinga | null;
  sala: Sala;
  meuSlug: string | null;
}) {
  if (cenas.indisponivel) {
    return (
      <section className="combat" aria-label="Mapa">
        <div className="combat-head">
          <h2>Mapa</h2>
        </div>
        <p className="bkpexplica">
          {souMestre
            ? "Os mapas ainda não estão ligados no banco: falta rodar a migration 0018_cenas.sql no SQL Editor do Supabase. Até lá, o resto do painel funciona normalmente."
            : "O Mestre ainda não ligou os mapas."}
        </p>
      </section>
    );
  }

  if (!souMestre) {
    return (
      <section className="combat" aria-label="Mapa">
        {cenas.naMesa ? (
          <VisorDaMesa
            cena={cenas.naMesa}
            codigo={codigo}
            urlDaImagem={cenas.urlDaImagem}
            sala={sala}
            quem={quem}
            meuSlug={meuSlug}
          />
        ) : (
          <>
            <div className="combat-head">
              <h2>Mapa</h2>
            </div>
            <p className="empty-note">O Mestre ainda não pôs um mapa na tela.</p>
          </>
        )}
      </section>
    );
  }

  return <EditorDoMestre cenas={cenas} codigo={codigo} quem={quem} sala={sala} />;
}

/** Número com vírgula ou ponto ("1,5"), pros metros por quadrado. */
function CampoMetros({ valor, onCommit }: { valor: number; onCommit: (n: number) => void }) {
  const [rascunho, setRascunho] = useState(String(valor).replace(".", ","));
  const [focado, setFocado] = useState(false);
  const mostrado = focado ? rascunho : String(valor).replace(".", ",");
  return (
    <input
      className="mapa-num"
      type="text"
      inputMode="decimal"
      aria-label="Metros por quadrado"
      value={mostrado}
      onFocus={() => {
        setRascunho(String(valor).replace(".", ","));
        setFocado(true);
      }}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={() => {
        setFocado(false);
        const n = Number.parseFloat(rascunho.replace(",", "."));
        if (Number.isFinite(n) && n > 0 && n <= 100 && n !== valor) onCommit(Math.round(n * 100) / 100);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

function EditorDoMestre({ cenas, codigo, quem, sala }: { cenas: Cenas; codigo: string; quem: QuemPinga | null; sala: Sala }) {
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const cena = cenas.cenas.find((c) => c.id === escolhida) ?? cenas.naMesa ?? cenas.cenas[0] ?? null;

  const [ferramenta, setFerramenta] = useState<Ferramenta>("mover");
  const [modo, setModo] = useState<ModoNevoa>("revelar");
  const [pincel, setPincel] = useState<TamanhoPincel>("m");
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const mapaRef = useRef<CenaMapaApi>(null);

  const nevoa = useNevoa(cena?.id ?? null, codigo);
  const ping = usePing(cena, quem);
  const banco = usePecas(cena?.id ?? null, codigo);
  const [pecaSelecionada, setPecaSelecionada] = useState<string | null>(null);
  const [modoRegua, setModoRegua] = useState<ModoRegua>("grade");
  const [modeloArea, setModeloArea] = useState<ModeloArea>(MODELO_INICIAL);
  const [nomeMarcador, setNomeMarcador] = useState("");
  const pecas = useMemo(
    () =>
      cena
        ? montarPecasNaTela({
            pecas: banco.pecas,
            cena,
            fichas: sala.personagens,
            vezDe: sala.combate.order[sala.combate.turn]?.slug ?? null,
            slugsDosJogadores: sala.personagens.filter((p) => !p.is_npc).map((p) => p.slug),
            visao: { mestre: true, meuSlug: null },
            selecionadaId: pecaSelecionada,
          })
        : [],
    [banco.pecas, cena, sala.personagens, sala.combate, pecaSelecionada],
  );

  /** Onde cair um peão novo: o meio do que o Mestre está vendo. */
  function regiaoAtual() {
    return mapaRef.current?.regiaoVisivel() ?? null;
  }

  /** Onde já tem peão (pra os novos não caírem em cima). */
  function lugaresOcupados(): [number, number][] {
    return banco.pecas.map((p) => [p.x, p.y]);
  }

  function porOGrupo() {
    if (!cena) return;
    const faltam = sala.personagens.filter((p) => !p.is_npc && !banco.pecas.some((x) => x.slug === p.slug));
    const lugares = posicoesIniciais(cena, faltam.length, regiaoAtual(), lugaresOcupados());
    void banco.adicionar(faltam.map((p, i) => ({ slug: p.slug, nome: "", x: lugares[i][0], y: lugares[i][1] })));
  }

  /** Os inimigos que estão na iniciativa e ainda não têm peão. Entram OCULTOS:
   *  o Mestre mostra quando quiser (igual ao NPC oculto da ficha). */
  function porOsInimigos() {
    if (!cena) return;
    const naOrdem = new Set(sala.combate.order.map((o) => o.slug));
    const faltam = sala.personagens.filter((p) => p.is_npc && naOrdem.has(p.slug) && !banco.pecas.some((x) => x.slug === p.slug));
    const lugares = posicoesIniciais(cena, faltam.length, regiaoAtual(), lugaresOcupados());
    void banco.adicionar(faltam.map((p, i) => ({ slug: p.slug, nome: "", x: lugares[i][0], y: lugares[i][1], oculto: true })));
  }

  function porMarcador() {
    if (!cena) return;
    const nome = nomeMarcador.trim().slice(0, 30);
    if (!nome) return;
    const [x, y] = posicoesIniciais(cena, 1, regiaoAtual(), lugaresOcupados())[0];
    void banco.adicionar([{ slug: null, nome, x, y }]);
    setNomeMarcador("");
  }

  function proximoTamanho(t: TamanhoPeca): TamanhoPeca {
    return (t >= 3 ? 1 : t + 1) as TamanhoPeca;
  }

  async function aoEscolherArquivo(arquivos: FileList | null) {
    const arquivo = arquivos?.[0];
    if (arquivoRef.current) arquivoRef.current.value = "";
    if (!arquivo) return;
    setErroEnvio(null);
    setEnviando("Preparando…");
    const r = await cenas.criarCena(arquivo, setEnviando);
    setEnviando(null);
    if (!r.ok) {
      setErroEnvio(r.erro);
      return;
    }
    // O nome vem do arquivo; o Mestre troca depois, se quiser.
    await cenas.atualizarCena(r.cena.id, { nome: nomeDaCenaPeloArquivo(arquivo.name) });
    setEscolhida(r.cena.id);
    setFerramenta("mover");
  }

  async function levarCamera(tudo: boolean) {
    if (!cena) return;
    if (tudo) {
      await cenas.atualizarCena(cena.id, { camera: null });
      return;
    }
    const regiao = mapaRef.current?.regiaoVisivel();
    const camera = regiao ? cameraValida(regiao, cena) : null;
    if (camera) await cenas.atualizarCena(cena.id, { camera });
  }

  async function cobrirTudo() {
    if (!cena) return;
    if (!confirm("Cobrir o mapa inteiro de névoa de novo? As pinceladas feitas até agora são apagadas.")) return;
    if (await nevoa.limpar()) await cenas.atualizarCena(cena.id, { nevoa_ligada: true });
  }

  async function revelarTudo() {
    if (!cena) return;
    if (!confirm("Revelar o mapa inteiro pra mesa? As pinceladas feitas até agora são apagadas.")) return;
    if (await nevoa.limpar()) await cenas.atualizarCena(cena.id, { nevoa_ligada: false });
  }

  const podeQuadradinhos = cena ? gradeUsavel(cena) : false;
  // Sem grade, "quadradinhos" não existe: cai no pincel em vez de ficar sem ferramenta.
  const ferramentaAtiva: Ferramenta = ferramenta === "quadradinhos" && !podeQuadradinhos ? "pincel" : ferramenta;
  const avisos = [cenas.aviso, nevoa.aviso].filter((a): a is string => Boolean(a));

  return (
    <section className="combat" aria-label="Mapa">
      <div className="combat-head">
        <h2>Mapa</h2>
        <div className="combatctrls">
          <button type="button" className="btn primary" disabled={enviando !== null} onClick={() => arquivoRef.current?.click()}>
            {enviando ?? "+ nova cena"}
          </button>
          <input
            ref={arquivoRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void aoEscolherArquivo(e.target.files)}
          />
        </div>
      </div>

      {erroEnvio && (
        <p className="mapa-erro" role="alert">
          {erroEnvio}
        </p>
      )}
      {avisos.map((a) => (
        <p key={a} className="mapa-erro" role="alert">
          {a}
        </p>
      ))}

      {cenas.carregando ? (
        <p className="empty-note">Carregando os mapas…</p>
      ) : cenas.cenas.length === 0 ? (
        <p className="bkpexplica">
          Nenhum mapa ainda. Toque em <b>+ nova cena</b> e escolha a imagem (a arte do mapa, um print ou uma foto). O
          app reduz o tamanho sozinho antes de enviar. Depois é só pintar o que a mesa pode ver.
        </p>
      ) : (
        <>
          <div className="mapa-cenas" role="group" aria-label="Cenas">
            {cenas.cenas.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip alvo"
                aria-pressed={c.id === cena?.id}
                onClick={() => setEscolhida(c.id)}
              >
                {c.nome || "Sem nome"}
                {c.na_mesa ? " · na mesa" : ""}
              </button>
            ))}
          </div>

          {cena && (
            <>
              <div className="mapa-linha">
                <CampoTexto valor={cena.nome} maxLength={60} placeholder="nome da cena" onCommit={(v) => void cenas.atualizarCena(cena.id, { nome: v })} />
                <BotaoRemover
                  aria={`apagar a cena ${cena.nome || "sem nome"}`}
                  confirmar={`Apagar a cena "${cena.nome || "sem nome"}"? A imagem e a névoa dela são apagadas de vez.`}
                  onConfirmar={() => void cenas.apagarCena(cena.id)}
                />
              </div>

              <div className="mapa-mesa">
                {cena.na_mesa ? (
                  <>
                    <span className="mapa-mesa-ok">✓ A mesa está vendo este mapa</span>
                    <button type="button" className="btn" onClick={() => void cenas.mandarParaMesa(null)}>
                      tirar o mapa da mesa
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn primary" onClick={() => void cenas.mandarParaMesa(cena.id)}>
                    levar a mesa pra este mapa
                  </button>
                )}
              </div>

              <div className="mapa-ferr" role="group" aria-label="Ferramenta">
                <button type="button" className="chip alvo" aria-pressed={ferramentaAtiva === "mover"} onClick={() => setFerramenta("mover")}>
                  ✋ mover
                </button>
                {podeQuadradinhos && (
                  <button
                    type="button"
                    className="chip alvo"
                    aria-pressed={ferramentaAtiva === "quadradinhos"}
                    onClick={() => setFerramenta("quadradinhos")}
                  >
                    ▦ quadradinhos
                  </button>
                )}
                <button type="button" className="chip alvo" aria-pressed={ferramentaAtiva === "pincel"} onClick={() => setFerramenta("pincel")}>
                  🖌 pincel
                </button>
                <button type="button" className="chip alvo" aria-pressed={ferramentaAtiva === "retangulo"} onClick={() => setFerramenta("retangulo")}>
                  ▭ retângulo
                </button>
                <button type="button" className="chip alvo" aria-pressed={ferramentaAtiva === "ping"} onClick={() => setFerramenta("ping")}>
                  📍 ping
                </button>
                <button type="button" className="chip alvo" aria-pressed={ferramentaAtiva === "regua"} onClick={() => setFerramenta("regua")}>
                  📏 régua
                </button>
                <button type="button" className="chip alvo" aria-pressed={ferramentaAtiva === "area"} onClick={() => setFerramenta("area")}>
                  ✨ área
                </button>
              </div>

              {ferramentaAtiva === "area" && <ControlesDeArea modelo={modeloArea} aoMudar={setModeloArea} metrosPorQuadrado={cena.metros} />}

              {ferramentaAtiva === "regua" && (
                <div className="mapa-ferr" role="group" aria-label="Como medir">
                  <button type="button" className="chip alvo" aria-pressed={modoRegua === "grade"} onClick={() => setModoRegua("grade")}>
                    na grade
                  </button>
                  <button type="button" className="chip alvo" aria-pressed={modoRegua === "reta"} onClick={() => setModoRegua("reta")}>
                    em linha reta
                  </button>
                </div>
              )}

              {ferramentaAtiva !== "mover" && ferramentaAtiva !== "ping" && ferramentaAtiva !== "regua" && ferramentaAtiva !== "area" && (
                <div className="mapa-ferr" role="group" aria-label="Opções da névoa">
                  <button type="button" className="chip alvo" aria-pressed={modo === "revelar"} onClick={() => setModo("revelar")}>
                    revelar
                  </button>
                  <button type="button" className="chip alvo" aria-pressed={modo === "esconder"} onClick={() => setModo("esconder")}>
                    esconder
                  </button>
                  {ferramentaAtiva === "pincel" &&
                    (["p", "m", "g"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="chip alvo"
                        aria-pressed={pincel === t}
                        aria-label={`Pincel ${t === "p" ? "pequeno" : t === "m" ? "médio" : "grande"}`}
                        onClick={() => setPincel(t)}
                      >
                        {t === "p" ? "P" : t === "m" ? "M" : "G"}
                      </button>
                    ))}
                </div>
              )}

              <CenaMapa
                ref={mapaRef}
                cena={cena}
                imagemUrl={cenas.urlDaImagem(cena)}
                regras={nevoa.regras}
                mestre
                ferramenta={ferramentaAtiva}
                modoNevoa={modo}
                pincel={pincel}
                aoPintar={(nova) => void nevoa.adicionar(nova)}
                pings={ping.pings}
                aoPingar={quem ? ping.enviar : undefined}
                modoRegua={modoRegua}
                corRegua={quem?.cor}
                reguas={ping.reguas}
                aoMedir={quem ? ping.enviarRegua : undefined}
                modeloArea={modeloArea}
                areas={ping.areas}
                aoAreaar={quem ? ping.enviarArea : undefined}
                pecas={pecas}
                aoMoverPeca={(id, x, y) => void banco.atualizar(id, { x, y })}
                aoTocarPeca={setPecaSelecionada}
              />
              <p className="mapa-dica">
                {ferramentaAtiva === "mover"
                  ? "Arraste com um dedo e use a pinça pra dar zoom. Segure o dedo parado pra mostrar um ponto pra mesa (ping). A névoa aparece meio transparente pra você; pra mesa ela é preta."
                  : ferramentaAtiva === "ping"
                    ? "Toque num ponto: a mesa vê um pulso dourado ali, com o seu nome. Com dois dedos você mexe no mapa."
                    : ferramentaAtiva === "area"
                      ? "Escolha a forma e o tamanho e arraste no mapa: a origem encaixa no canto do quadradinho e a mesa vê a figura por alguns segundos, com o seu nome. Esfera: toque onde cai o centro. Cone, cubo e linha: arraste pra onde apontam."
                      : ferramentaAtiva === "regua"
                      ? `Arraste de um ponto a outro: a mesa vê a linha com a distância (${modoRegua === "grade" ? "diagonal vale 1 quadrado, como na regra" : "em linha reta"}). Começando num peão, diz se cabe no deslocamento dele. O valor do quadradinho está em "Grade e névoa".`
                      : "Passe o dedo pra pintar. Com dois dedos você mexe no mapa sem pintar. A mesa vê na hora."}
              </p>
              <LegendaIconesPeao />

              <div className="mapa-ferr">
                <button type="button" className="btn" disabled={nevoa.regras.length === 0} onClick={() => void nevoa.desfazerUltima()}>
                  ↩ desfazer
                </button>
                <button type="button" className="btn" onClick={() => void revelarTudo()}>
                  revelar tudo
                </button>
                <button type="button" className="btn" onClick={() => void cobrirTudo()}>
                  cobrir tudo
                </button>
              </div>

              <SecaoRecolhivel
                abertoInicial={false}
                titulo={<h4>Peões</h4>}
                cabecalhoExtra={<span className="fc-sub">{banco.indisponivel ? "ainda não ligados" : `${banco.pecas.length} no mapa`}</span>}
              >
                {banco.indisponivel ? (
                  <p className="fc-sub">
                    Falta rodar a migration 0019_pecas.sql no SQL Editor do Supabase pra ligar os peões. O resto do mapa funciona sem eles.
                  </p>
                ) : (
                  <>
                    <p className="fc-sub">
                      Arraste um peão com um dedo (ele encaixa no quadradinho). Cada jogador move só o dele. Inimigos entram
                      ocultos; a mesa vê “?” no peão de inimigo que ainda não foi revelado.
                    </p>
                    <div className="mapa-ferr">
                      <button type="button" className="btn" onClick={porOGrupo}>
                        pôr o grupo no mapa
                      </button>
                      <button type="button" className="btn" onClick={porOsInimigos}>
                        pôr os inimigos da iniciativa
                      </button>
                    </div>
                    <div className="mapa-linha">
                      <input
                        className="campotexto"
                        value={nomeMarcador}
                        maxLength={30}
                        placeholder="nome do marcador"
                        aria-label="Nome do marcador avulso"
                        onChange={(e) => setNomeMarcador(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") porMarcador();
                        }}
                      />
                      <button type="button" className="btn" onClick={porMarcador}>
                        + marcador
                      </button>
                    </div>
                    {banco.aviso && (
                      <p className="mapa-erro" role="alert">
                        {banco.aviso}
                      </p>
                    )}
                    <div className="mapa-pecas">
                      {banco.pecas.map((p) => {
                        const naTela = pecas.find((x) => x.id === p.id);
                        return (
                          <div key={p.id} className={`mapa-peca${p.id === pecaSelecionada ? " sel" : ""}`}>
                            <button type="button" className="mapa-peca-nome" onClick={() => setPecaSelecionada(p.id === pecaSelecionada ? null : p.id)}>
                              <span className="mapa-cor" style={{ background: naTela?.cor }} aria-hidden="true" />
                              {naTela?.nome ?? p.nome}
                              {naTela?.vez ? " · vez" : ""}
                            </button>
                            <button
                              type="button"
                              className="chip alvo"
                              aria-pressed={p.oculto}
                              aria-label={`${p.oculto ? "Mostrar" : "Ocultar"} o peão ${naTela?.nome ?? p.nome} pra mesa`}
                              onClick={() => void banco.atualizar(p.id, { oculto: !p.oculto })}
                            >
                              {p.oculto ? "oculto" : "visível"}
                            </button>
                            <button
                              type="button"
                              className="chip"
                              aria-label={`Tamanho do peão ${naTela?.nome ?? p.nome}: ${p.tamanho}. Tocar muda.`}
                              onClick={() => void banco.atualizar(p.id, { tamanho: proximoTamanho(p.tamanho) })}
                            >
                              tam {p.tamanho}
                            </button>
                            <BotaoRemover
                              aria={`tirar o peão ${naTela?.nome ?? p.nome} do mapa`}
                              onConfirmar={() => {
                                if (pecaSelecionada === p.id) setPecaSelecionada(null);
                                void banco.remover(p.id);
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {banco.pecas.length > 0 && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          if (confirm("Tirar todos os peões deste mapa?")) {
                            setPecaSelecionada(null);
                            void banco.removerTodas();
                          }
                        }}
                      >
                        tirar todos os peões
                      </button>
                    )}
                  </>
                )}
              </SecaoRecolhivel>

              <SecaoRecolhivel abertoInicial={false} titulo={<h4>Visão da mesa</h4>}>
                <p className="fc-sub">
                  O telão e os celulares abrem enquadrados no pedaço que você escolher aqui (e os jogadores podem dar
                  zoom por conta própria).
                </p>
                <div className="mapa-ferr">
                  <button type="button" className="btn" onClick={() => void levarCamera(false)}>
                    levar a mesa pra esta visão
                  </button>
                  <button type="button" className="btn" onClick={() => void levarCamera(true)}>
                    mesa vê o mapa todo
                  </button>
                  <button type="button" className="btn" onClick={() => mapaRef.current?.enquadrarTudo()}>
                    ver o mapa todo (só eu)
                  </button>
                </div>
                <p className="fc-sub">{cena.camera ? "A mesa está enquadrada num pedaço do mapa." : "A mesa vê o mapa todo."}</p>
              </SecaoRecolhivel>

              <SecaoRecolhivel abertoInicial={false} titulo={<h4>Grade e névoa</h4>}>
                <label className="checklabel">
                  <input
                    type="checkbox"
                    checked={cena.grade_ligada}
                    onChange={(e) => void cenas.atualizarCena(cena.id, { grade_ligada: e.target.checked })}
                  />
                  mostrar a grade (os quadradinhos)
                </label>
                {cena.grade_ligada && (
                  <div className="mapa-grade">
                    <label>
                      quadrados na largura
                      <CampoNumero
                        className="mapa-num"
                        valor={Math.round(quadradosNaLargura(cena))}
                        onCommit={(n) => {
                          if (n >= 1 && n <= 300) void cenas.atualizarCena(cena.id, { grade_px: gradePxParaQuadrados(cena.largura, n) });
                        }}
                      />
                    </label>
                    <label>
                      começa em x
                      <CampoNumero
                        className="mapa-num"
                        valor={Math.round(cena.grade_dx)}
                        onCommit={(n) => void cenas.atualizarCena(cena.id, { grade_dx: Math.max(0, Math.min(n, Math.round(cena.grade_px))) })}
                      />
                    </label>
                    <label>
                      começa em y
                      <CampoNumero
                        className="mapa-num"
                        valor={Math.round(cena.grade_dy)}
                        onCommit={(n) => void cenas.atualizarCena(cena.id, { grade_dy: Math.max(0, Math.min(n, Math.round(cena.grade_px))) })}
                      />
                    </label>
                    <label>
                      metros por quadrado
                      <CampoMetros valor={cena.metros} onCommit={(n) => void cenas.atualizarCena(cena.id, { metros: n })} />
                    </label>
                  </div>
                )}
                <p className="fc-sub">
                  Conte quantos quadradinhos cabem na largura do mapa e digite acima; “começa em x/y” (em pixels) alinha
                  a grade com a do desenho. A grade só ajuda a pintar: a névoa que você já fez não se mexe se você
                  ajustar depois.
                </p>
                <label className="checklabel">
                  <input
                    type="checkbox"
                    checked={cena.nevoa_ligada}
                    onChange={(e) => void cenas.atualizarCena(cena.id, { nevoa_ligada: e.target.checked })}
                  />
                  a cena começa coberta de névoa
                </label>
              </SecaoRecolhivel>
            </>
          )}
        </>
      )}
    </section>
  );
}
