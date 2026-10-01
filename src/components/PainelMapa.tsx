"use client";

import { useRef, useState } from "react";
import type { Cenas } from "@/hooks/useCenas";
import { useNevoa } from "@/hooks/useNevoa";
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
import { SecaoRecolhivel } from "@/components/SecaoRecolhivel";

/**
 * A mesa vendo o mapa: o que o Mestre pôs na tela, com a névoa. Usado na aba
 * Mapa dos jogadores e, em tela cheia e sem toque, no telão.
 */
export function VisorDaMesa({
  cena,
  codigo,
  urlDaImagem,
  telao = false,
}: {
  cena: Cena;
  codigo: string;
  urlDaImagem: (c: Cena) => string | null;
  telao?: boolean;
}) {
  const nevoa = useNevoa(cena.id, codigo);
  const mapaRef = useRef<CenaMapaApi>(null);
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
      />
      {!telao && (
        <div className="mapa-visor-barra">
          <span className="mapa-visor-nome">{cena.nome || "Mapa"}</span>
          <button type="button" className="btn" onClick={() => mapaRef.current?.reenquadrar()}>
            voltar à visão da mesa
          </button>
        </div>
      )}
    </div>
  );
}

/** Conteúdo da aba Mapa: o Mestre edita; os jogadores só veem o que está na mesa. */
export function PainelMapa({ cenas, codigo, souMestre }: { cenas: Cenas; codigo: string; souMestre: boolean }) {
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
          <VisorDaMesa cena={cenas.naMesa} codigo={codigo} urlDaImagem={cenas.urlDaImagem} />
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

  return <EditorDoMestre cenas={cenas} codigo={codigo} />;
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

function EditorDoMestre({ cenas, codigo }: { cenas: Cenas; codigo: string }) {
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
              </div>

              {ferramentaAtiva !== "mover" && (
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
              />
              <p className="mapa-dica">
                {ferramentaAtiva === "mover"
                  ? "Arraste com um dedo e use a pinça pra dar zoom. A névoa aparece meio transparente pra você; pra mesa ela é preta."
                  : "Passe o dedo pra pintar. Com dois dedos você mexe no mapa sem pintar. A mesa vê na hora."}
              </p>

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
