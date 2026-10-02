"use client";

import { useState } from "react";
import type { Bau } from "@/hooks/useBau";
import type { ItemInventario, MoedaId, Personagem } from "@/lib/tipos";
import {
  LIMITE_SINTONIA,
  MOEDAS,
  capacidadeDeCarga,
  formatarKg,
  itemNovo,
  juntarItem,
  normalizarInventario,
  normalizarMoedas,
  pesoCarregado,
  pesoDoItem,
  sintonizados,
  tirarQuantidade,
  valorEmPo,
} from "@/lib/inventario";
import { CampoNumero } from "@/components/CampoNumero";
import { CampoTexto } from "@/components/CampoTexto";
import { CampoTextoAdiado } from "@/components/CampoTextoAdiado";
import { BotaoRemover } from "@/components/BotaoRemover";
import { SecaoRecolhivel } from "@/components/SecaoRecolhivel";

/** Inventário do personagem: moedas, itens com quantidade e peso, o que está
 *  equipado e a sintonização dos mágicos (limite de três). Lê e escreve na
 *  linha do personagem (migration 0026), então o Mestre e os outros celulares
 *  veem na hora. As contas moram em `lib/inventario.ts`. */
export function InventarioPersonagem({
  personagem: p,
  editavel,
  patch,
  bau,
}: {
  personagem: Personagem;
  editavel: boolean;
  patch: (mudanca: Partial<Personagem>) => void;
  bau?: Bau;
}) {
  // `normalizar*`: a linha pode ser de antes da migration 0026 (sem a coluna).
  const moedas = normalizarMoedas(p.moedas);
  const inventario = normalizarInventario(p.inventario);
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [qtd, setQtd] = useState("1");
  const [peso, setPeso] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  const carga = pesoCarregado(inventario, moedas);
  const capacidade = capacidadeDeCarga(p.atributos?.for ?? 10);
  const sintonia = sintonizados(inventario);
  const aoLimite = capacidade > 0 && carga > capacidade;
  const podeMandarAoBau = Boolean(bau && !bau.indisponivel);

  function mudarItem(i: number, mudanca: Partial<ItemInventario>) {
    patch({ inventario: inventario.map((x, idx) => (idx === i ? { ...x, ...mudanca } : x)) });
  }

  function alternarSintonia(i: number) {
    const item = inventario[i];
    if (!item.magico) return;
    if (item.sintonia === 2) return mudarItem(i, { sintonia: 1 });
    if (sintonia >= LIMITE_SINTONIA) {
      setAviso(`Já são ${LIMITE_SINTONIA} itens sintonizados, que é o limite. Tire a sintonia de um antes.`);
      return;
    }
    setAviso(null);
    mudarItem(i, { sintonia: 2 });
  }

  function adicionar() {
    const n = nome.trim();
    if (!n) return;
    const q = Math.max(1, Number.parseInt(qtd, 10) || 1);
    const kg = Number.parseFloat(peso.replace(",", ".")) || 0;
    patch({ inventario: juntarItem(inventario, { ...itemNovo(n), qtd: q, peso: Math.max(0, kg) }) });
    setNome("");
    setQtd("1");
    setPeso("");
  }

  async function mandarAoBau(i: number) {
    if (!bau) return;
    const item = inventario[i];
    const ok = await bau.guardarItem({
      nome: item.nome,
      qtd: item.qtd,
      peso: item.peso,
      descricao: item.descricao,
      magico: item.magico,
      raridade: item.raridade,
    });
    if (!ok) {
      setAviso("Não deu pra guardar no baú. Confira a conexão e tente de novo.");
      return;
    }
    setAviso(null);
    setEditandoIdx(null);
    patch({ inventario: tirarQuantidade(inventario, i, item.qtd) });
  }

  return (
    <SecaoRecolhivel abertoInicial={false} titulo={<h4>Inventário e moedas</h4>}>
      <div className="inv">
        <div className="inv-moedas" role="group" aria-label="Moedas">
          {MOEDAS.map(({ id, sigla, nome: nomeMoeda }) => (
            <label key={id} className="inv-moeda" title={nomeMoeda}>
              <span>{sigla}</span>
              {editavel ? (
                <CampoNumero
                  valor={moedas[id]}
                  onCommit={(n) => patch({ moedas: { ...moedas, [id as MoedaId]: Math.max(0, n) } })}
                />
              ) : (
                <b>{moedas[id]}</b>
              )}
            </label>
          ))}
        </div>
        <p className="inv-resumo">
          ≈ {String(valorEmPo(moedas)).replace(".", ",")} PO em moedas ·{" "}
          <span className={aoLimite ? "inv-alerta" : undefined}>
            carga {formatarKg(carga)} de {formatarKg(capacidade)}
          </span>{" "}
          · sintonia {sintonia}/{LIMITE_SINTONIA}
        </p>
        {aoLimite && <p className="inv-alerta">Acima da capacidade de carga (Força × 7,5 kg).</p>}
        {aviso && (
          <p className="inv-alerta" role="status" aria-live="polite">
            {aviso}
          </p>
        )}

        {inventario.length === 0 && (
          <p className="empty-note">{editavel ? "Nada no inventário ainda." : "Inventário vazio."}</p>
        )}

        <ul className="inv-lista">
          {inventario.map((item, i) => {
            const aberto = editavel && editandoIdx === i;
            return (
              <li key={i} className="inv-item" data-equipado={item.equipado || undefined}>
                <div className="inv-linha">
                  <div className="inv-nome">
                    <b>{item.nome || "(sem nome)"}</b>
                    {item.raridade && <span className="fc-tag">{item.raridade}</span>}
                    {item.magico && <span className="fc-tag">mágico</span>}
                  </div>
                  <div className="inv-qtd">
                    {editavel && (
                      <button
                        type="button"
                        className="inv-passo"
                        aria-label={`menos um ${item.nome}`}
                        onClick={() => patch({ inventario: tirarQuantidade(inventario, i, 1) })}
                      >
                        −
                      </button>
                    )}
                    <span aria-label={`${item.qtd} unidades`}>×{item.qtd}</span>
                    {editavel && (
                      <button
                        type="button"
                        className="inv-passo"
                        aria-label={`mais um ${item.nome}`}
                        onClick={() => mudarItem(i, { qtd: item.qtd + 1 })}
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
                <div className="inv-meta">
                  {item.peso > 0 && <span>{formatarKg(pesoDoItem(item))}</span>}
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={item.equipado}
                    disabled={!editavel}
                    onClick={() => mudarItem(i, { equipado: !item.equipado })}
                  >
                    {item.equipado ? "equipado" : "equipar"}
                  </button>
                  {item.magico && (
                    <button
                      type="button"
                      className="chip"
                      aria-pressed={item.sintonia === 2}
                      disabled={!editavel}
                      onClick={() => alternarSintonia(i)}
                    >
                      {item.sintonia === 2 ? "sintonizado" : "sintonizar"}
                    </button>
                  )}
                  {editavel && (
                    <button type="button" className="minilink" onClick={() => setEditandoIdx(aberto ? null : i)}>
                      {aberto ? "fechar" : "editar"}
                    </button>
                  )}
                </div>
                {!aberto && item.descricao && <p className="inv-desc">{item.descricao}</p>}
                {aberto && (
                  <div className="inv-edicao">
                    <CampoTexto
                      valor={item.nome}
                      maxLength={80}
                      placeholder="nome"
                      onCommit={(t) => mudarItem(i, { nome: t })}
                    />
                    <div className="inv-edicao-linha">
                      <label>
                        qtd <CampoNumero className="num" valor={item.qtd} onCommit={(n) => mudarItem(i, { qtd: Math.max(0, n) })} />
                      </label>
                      <label>
                        kg cada{" "}
                        <CampoTexto
                          valor={String(item.peso).replace(".", ",")}
                          maxLength={8}
                          placeholder="0"
                          onCommit={(t) => mudarItem(i, { peso: Math.max(0, Number.parseFloat(t.replace(",", ".")) || 0) })}
                        />
                      </label>
                    </div>
                    <label className="inv-mag">
                      <input
                        type="checkbox"
                        checked={item.magico}
                        onChange={(e) =>
                          mudarItem(i, { magico: e.target.checked, sintonia: e.target.checked ? item.sintonia : 0 })
                        }
                      />{" "}
                      item mágico
                    </label>
                    {item.magico && (
                      <>
                        <CampoTexto
                          valor={item.raridade}
                          maxLength={20}
                          placeholder="raridade (ex.: raro)"
                          onCommit={(t) => mudarItem(i, { raridade: t })}
                        />
                        <label className="inv-mag">
                          <input
                            type="checkbox"
                            checked={item.sintonia > 0}
                            onChange={(e) => mudarItem(i, { sintonia: e.target.checked ? 1 : 0 })}
                          />{" "}
                          precisa de sintonização
                        </label>
                      </>
                    )}
                    <CampoTextoAdiado
                      valor={item.descricao}
                      maxLength={500}
                      atrasoMs={700}
                      placeholder="descrição, efeito, cargas…"
                      onSalvar={(t) => mudarItem(i, { descricao: t })}
                    />
                    <div className="inv-acoes">
                      {podeMandarAoBau && (
                        <button type="button" className="btn" onClick={() => void mandarAoBau(i)}>
                          🎒 guardar no baú do grupo
                        </button>
                      )}
                      <BotaoRemover
                        aria={`remover ${item.nome || "item"}`}
                        confirmar={`Remover "${item.nome || "item"}" do inventário?`}
                        onConfirmar={() => {
                          setEditandoIdx(null);
                          patch({ inventario: inventario.filter((_, idx) => idx !== i) });
                        }}
                        className="removechar"
                      >
                        remover item
                      </BotaoRemover>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {editavel && (
          <div className="addcombatant inv-novo">
            <input
              type="text"
              placeholder="novo item (ex.: Corda, 15 m)"
              aria-label="nome do novo item"
              maxLength={80}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
            />
            <input
              className="num"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="qtd"
              aria-label="quantidade"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
            />
            <input
              className="num"
              type="text"
              inputMode="decimal"
              placeholder="kg cada"
              aria-label="peso de cada unidade, em quilos"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
            />
            <button type="button" className="btn" onClick={adicionar}>
              + item
            </button>
          </div>
        )}
      </div>
    </SecaoRecolhivel>
  );
}
