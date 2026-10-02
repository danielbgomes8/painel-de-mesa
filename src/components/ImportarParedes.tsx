"use client";

import { useMemo, useRef, useState } from "react";
import type { Cena } from "@/lib/cenas";
import { TEXTO_MAXIMO_DA_IMPORTACAO, lerParedesDoTexto, pedidoDeParedes } from "@/lib/importarParedes";
import type { NovaParede, Parede } from "@/lib/paredes";

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
  paredes,
  adicionar,
}: {
  cena: Pick<Cena, "largura" | "altura">;
  paredes: readonly Parede[];
  adicionar: (novas: NovaParede[]) => Promise<boolean>;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [pedidoAVista, setPedidoAVista] = useState(false);
  const [enviando, setEnviando] = useState(false);
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
          <p className="bkpexplica">Pra não desenhar tudo à mão, uma IA que enxergue imagens marca as paredes e as portas pra você:</p>
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
