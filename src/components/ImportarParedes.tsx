"use client";

import { useMemo, useRef, useState } from "react";
import type { Cena } from "@/lib/cenas";
import { TEXTO_MAXIMO_DA_IMPORTACAO, lerParedesDoTexto, pedidoDeParedes } from "@/lib/importarParedes";
import type { NovaParede, Parede } from "@/lib/paredes";
import {
  LADO_DA_ANALISE,
  comoTextoDeImportacao,
  detectarParedes,
  rgbaParaCinza,
  type ResultadoDaDeteccao,
} from "@/lib/detectarParedes";
import { PreviaDeParedes, chaveDaParede, chaveDaPorta } from "@/components/PreviaDeParedes";

/** O que sobra da detecção depois de o Mestre tirar as linhas erradas na prévia. */
function semAsTiradas(d: ResultadoDaDeteccao, tiradas: ReadonlySet<string>): ResultadoDaDeteccao {
  return {
    ...d,
    paredes: d.paredes.filter((_, i) => !tiradas.has(chaveDaParede(i))),
    portas: d.portas.filter((_, i) => !tiradas.has(chaveDaPorta(i))),
  };
}

/** Baixa a imagem da cena e devolve os níveis de cinza, já reduzidos pro tamanho da análise. */
async function cinzaDaImagem(url: string): Promise<{ cinza: Uint8Array; largura: number; altura: number }> {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`imagem ${resposta.status}`);
  const imagem = await createImageBitmap(await resposta.blob());
  const escala = Math.min(1, LADO_DA_ANALISE / Math.max(imagem.width, imagem.height));
  const largura = Math.max(1, Math.round(imagem.width * escala));
  const altura = Math.max(1, Math.round(imagem.height * escala));
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const ctx = tela.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("sem canvas");
  ctx.drawImage(imagem, 0, 0, largura, altura);
  imagem.close();
  return { cinza: rgbaParaCinza(ctx.getImageData(0, 0, largura, altura).data, largura, altura), largura, altura };
}

function quantas(n: number, uma: string, varias: string): string {
  return `${n} ${n === 1 ? uma : varias}`;
}

/**
 * Paredes e portas vindas de fora, pra não desenhar um mapa grande inteiro à
 * mão: o Mestre manda a imagem pra uma IA com o pedido daqui e traz a resposta
 * (arquivo ou texto colado). Entra como rascunho — as regras estão em
 * `lib/importarParedes.ts`. Fica fechado até o Mestre abrir: é coisa de preparar
 * o mapa, não de usar no meio do combate.
 */
export function ImportarParedes({
  cena,
  urlDaImagem,
  paredes,
  adicionar,
}: {
  cena: Pick<Cena, "largura" | "altura">;
  /** Endereço da imagem da cena (pra detectar sozinho); sem ele o botão some. */
  urlDaImagem: string | null;
  paredes: readonly Parede[];
  adicionar: (novas: NovaParede[]) => Promise<boolean>;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [pedidoAVista, setPedidoAVista] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [detectando, setDetectando] = useState(false);
  const [comCurvas, setComCurvas] = useState(true);
  const [deteccao, setDeteccao] = useState<ResultadoDaDeteccao | null>(null);
  const [tiradas, setTiradas] = useState<ReadonlySet<string>>(new Set());
  const [aviso, setAviso] = useState<{ texto: string; falhou: boolean } | null>(null);
  const campoArquivo = useRef<HTMLInputElement>(null);

  // Pelos dois números, não pelo objeto da cena: ela muda a toda hora (câmera, explorado).
  const { largura, altura } = cena;
  const pedido = useMemo(() => pedidoDeParedes({ largura, altura }), [largura, altura]);
  const leitura = useMemo(
    () => (texto.trim() ? lerParedesDoTexto(texto, { largura, altura }, paredes) : null),
    [texto, largura, altura, paredes],
  );

  async function copiarPedido() {
    try {
      await navigator.clipboard.writeText(pedido);
      setAviso({ texto: "Pedido copiado. Cole na conversa com a IA, junto com a imagem do mapa.", falhou: false });
    } catch {
      // Navegador sem permissão de copiar: o texto fica à vista pra copiar à mão.
      setPedidoAVista(true);
      setAviso({ texto: "Não consegui copiar sozinho: selecione o texto abaixo e copie.", falhou: true });
    }
  }

  async function escolherArquivo(arquivo: File | null) {
    if (campoArquivo.current) campoArquivo.current.value = "";
    if (!arquivo) return;
    setAviso(null);
    if (arquivo.size > TEXTO_MAXIMO_DA_IMPORTACAO) {
      setAviso({ texto: "Esse arquivo é grande demais pra ser uma lista de paredes.", falhou: true });
      return;
    }
    try {
      setTexto(await arquivo.text());
    } catch {
      setAviso({ texto: "Não consegui abrir esse arquivo.", falhou: true });
    }
  }

  async function detectarSozinho() {
    if (!urlDaImagem || detectando) return;
    setDetectando(true);
    setAviso(null);
    try {
      const { cinza, largura: l, altura: a } = await cinzaDaImagem(urlDaImagem);
      // Deixa a tela pintar o "detectando…" antes de a conta (que trava a página por um instante) começar.
      await new Promise((ok) => setTimeout(ok, 30));
      const r = detectarParedes(cinza, l, a, { curvas: comCurvas });
      if (r.paredes.length + r.portas.length === 0) {
        setAviso({ texto: "Não achei paredes neste mapa. Tente o caminho da IA, logo abaixo.", falhou: true });
      } else {
        setDeteccao(r);
        setTiradas(new Set());
        setTexto(comoTextoDeImportacao(r));
        setAviso({ texto: "Achei sozinho. Toque nas linhas erradas pra tirá-las e depois importe.", falhou: false });
      }
    } catch (e) {
      console.warn("detectar paredes", e);
      setAviso({ texto: "Não consegui ler a imagem do mapa. Confira a conexão e tente de novo.", falhou: true });
    } finally {
      setDetectando(false);
    }
  }

  function alternarLinha(chave: string) {
    if (!deteccao) return;
    const novas = new Set(tiradas);
    if (!novas.delete(chave)) novas.add(chave);
    setTiradas(novas);
    setAviso(null);
    const resto = semAsTiradas(deteccao, novas);
    setTexto(resto.paredes.length + resto.portas.length ? comoTextoDeImportacao(resto) : "");
  }

  function voltarTodas() {
    if (!deteccao) return;
    setTiradas(new Set());
    setTexto(comoTextoDeImportacao(deteccao));
  }

  async function importar() {
    if (!leitura?.ok || enviando) return;
    const { novas, paredes: nParedes, portas: nPortas } = leitura;
    setEnviando(true);
    setAviso(null);
    const deuCerto = await adicionar(novas);
    setEnviando(false);
    if (!deuCerto) {
      setAviso({ texto: "Não importou. Confira a conexão e tente de novo.", falhou: true });
      return;
    }
    setTexto("");
    setDeteccao(null);
    setTiradas(new Set());
    setAviso({
      texto: `Entraram ${quantas(nParedes, "parede", "paredes")} e ${quantas(nPortas, "porta", "portas")}. Confira no mapa: se não ficou bom, “↩ desfazer parede” tira todas de uma vez.`,
      falhou: false,
    });
  }

  return (
    <div className="mapa-importar">
      <button type="button" className="btn" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        {aberto ? "▾" : "▸"} importar paredes de um arquivo
      </button>
      {aberto && (
        <>
          {urlDaImagem && (
            <>
              <p className="bkpexplica">
                O jeito mais rápido: o app procura sozinho as paredes e as portas na imagem. Funciona melhor em mapa com paredes retas;
                curva, móvel e tapete podem enganar. Entra como <b>rascunho</b>.
              </p>
              <label className="mapa-dica">
                <input type="checkbox" checked={comCurvas} onChange={(e) => setComCurvas(e.target.checked)} /> procurar também paredes curvas (salas redondas,
                cavernas — traz mais linhas pra conferir)
              </label>
              <div className="mapa-ferr">
                <button type="button" className="btn primary" disabled={detectando} onClick={() => void detectarSozinho()}>
                  {detectando ? "procurando…" : "🔍 achar paredes e portas sozinho"}
                </button>
              </div>
            </>
          )}
          {deteccao && urlDaImagem && (
            <>
              <PreviaDeParedes url={urlDaImagem} deteccao={deteccao} tiradas={tiradas} aoAlternar={alternarLinha} />
              <p className="mapa-dica">
                <span style={{ color: "#ff6b60" }}>▬</span> parede · <span style={{ color: "#ffd60a" }}>▬</span> porta · <span style={{ color: "#9a9a9a" }}>╌</span>{" "}
                tirada. Toque numa linha pra tirar ou pôr de volta.
                {tiradas.size > 0 && (
                  <>
                    {" "}
                    {quantas(tiradas.size, "linha tirada", "linhas tiradas")}.{" "}
                    <button type="button" className="minilink" onClick={voltarTodas}>
                      pôr todas de volta
                    </button>
                  </>
                )}
              </p>
            </>
          )}
          <p className="bkpexplica">Ou, pra não desenhar tudo à mão, uma IA que enxergue imagens marca as paredes e as portas pra você:</p>
          <ol className="mapa-passos">
            <li>
              Toque em <b>copiar o pedido pra IA</b>.
            </li>
            <li>
              Abra a IA que você usa e mande o pedido <b>junto com a imagem deste mapa</b> (a mesma que você subiu como cena).
            </li>
            <li>
              Cole a resposta dela no campo abaixo — ou toque em <b>escolher arquivo…</b>, se ela te entregou um arquivo.
            </li>
            <li>
              Confira quantas paredes e portas vão entrar e toque em <b>importar pro mapa</b>.
            </li>
          </ol>
          <p className="bkpexplica">
            Entra como <b>rascunho</b>: a IA acerta a planta, mas pode errar um canto ou fechar uma passagem. Confira no mapa e corrija
            com a ferramenta 🧱 paredes.
          </p>
          <div className="mapa-ferr">
            <button type="button" className="btn" onClick={() => void copiarPedido()}>
              copiar o pedido pra IA
            </button>
            <label className="bkparquivo">
              <span className="btn">escolher arquivo…</span>
              <input
                ref={campoArquivo}
                type="file"
                accept="application/json,text/plain,.json,.txt"
                onChange={(e) => void escolherArquivo(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {pedidoAVista && (
            <div className="notesbox">
              <textarea readOnly value={pedido} aria-label="Pedido pra IA" onFocus={(e) => e.target.select()} />
            </div>
          )}
          <div className="notesbox">
            <textarea
              placeholder="…ou cole aqui a resposta da IA"
              aria-label="Resposta da IA com as paredes"
              value={texto}
              maxLength={TEXTO_MAXIMO_DA_IMPORTACAO}
              onChange={(e) => {
                setAviso(null);
                // Texto mexido à mão deixa de ser o que a prévia mostra.
                setDeteccao(null);
                setTexto(e.target.value);
              }}
            />
          </div>
          {leitura &&
            (leitura.ok ? (
              <p className="mapa-dica">
                Prontas pra entrar: {quantas(leitura.paredes, "parede", "paredes")} e {quantas(leitura.portas, "porta", "portas")}.
                {leitura.emendadas > 0 && ` Fechei ${quantas(leitura.emendadas, "fresta", "frestas")} entre pontas que quase se encontravam.`}
                {leitura.ignoradas > 0 && ` ${quantas(leitura.ignoradas, "linha do texto não serviu e ficou", "linhas do texto não serviram e ficaram")} de fora.`}
                {leitura.semMedida &&
                  ` O texto não diz o tamanho da imagem, então tratei as coordenadas como sendo deste mapa (${largura} × ${altura}).`}
              </p>
            ) : (
              <p className="mapa-erro" role="alert">
                {leitura.erro}
              </p>
            ))}
          <div className="mapa-ferr">
            <button type="button" className="btn primary" disabled={!leitura?.ok || enviando} onClick={() => void importar()}>
              {enviando ? "importando…" : "importar pro mapa"}
            </button>
          </div>
          <p className={aviso?.falhou ? "catcopiado falhou" : "catcopiado"} aria-live="polite">
            {aviso ? aviso.texto : ""}
          </p>
        </>
      )}
    </div>
  );
}
