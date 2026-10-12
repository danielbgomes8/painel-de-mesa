"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { LojaHook } from "@/hooks/useLoja";
import type { Identidade } from "@/lib/identidade";
import type { MoedaId } from "@/lib/tipos";
import { juntarItem, normalizarInventario, normalizarMoedas, textoMoedas } from "@/lib/inventario";
import {
  DESCRICAO_MAXIMA,
  ESTOQUE_MAXIMO,
  ITENS_MAXIMOS_POR_LOJA,
  LOJAS_MAXIMAS,
  NOME_DA_LOJA_MAXIMO,
  NOME_DO_ITEM_MAXIMO,
  QTD_MAXIMA_POR_COMPRA,
  VALOR_EM_PC,
  itemComprado,
  itensDaLoja,
  moedaDoPreco,
  linhaDeCompra,
  lojasVisiveis,
  motivoDeNaoComprar,
  nomeDaLoja,
  pagar,
  precoEmPc,
  textoDoPreco,
  type ItemDaLoja,
  type Loja,
} from "@/lib/loja";
import { BotaoRemover } from "@/components/BotaoRemover";
import { CampoTexto } from "@/components/CampoTexto";

const AVISO_NAO_FOI = "Não deu certo. Confira a conexão e tente de novo.";
const MOEDAS_DO_PRECO: { id: MoedaId; sigla: string }[] = [
  { id: "po", sigla: "PO" },
  { id: "pp", sigla: "PP" },
  { id: "pc", sigla: "PC" },
];

/**
 * A parte "🛒 Loja" da Campanha. O Mestre monta as lojas (itens, preço, estoque) e abre pra mesa; o jogador compra pelo
 * celular: o dinheiro sai da ficha dele, o item entra no inventário, o estoque baixa e o log conta.
 */
export function LojaDaCampanha({ loja, sala, identidade }: { loja: LojaHook; sala: Sala; identidade: Identidade | null }) {
  const souMestre = identidade?.tipo === "mestre";
  const [novoNome, setNovoNome] = useState("");

  if (loja.indisponivel) {
    return (
      <p className="bkpexplica">
        {souMestre
          ? "A loja ainda não está ligada no banco: falta rodar a migration 0038 no SQL Editor do Supabase. O resto do app funciona sem ela."
          : "O Mestre ainda não ligou a loja."}
      </p>
    );
  }
  if (loja.carregando) return <p className="empty-note">Carregando a loja…</p>;

  const visiveis = lojasVisiveis(loja.lojas, souMestre);
  return (
    <div className="loja">
      {souMestre && (
        <div className="fol-form">
          <h4 className="fol-form-titulo">Nova loja</h4>
          <div className="mapa-ferr">
            <input
              type="text"
              className="mapa-aura-campo fol-campo"
              aria-label="Nome da loja"
              placeholder="nome (ex.: Empório da esquina)"
              maxLength={NOME_DA_LOJA_MAXIMO}
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
            />
            <button
              type="button"
              className="btn primary"
              disabled={loja.lojas.length >= LOJAS_MAXIMAS}
              onClick={async () => {
                if (await loja.criarLoja(novoNome.trim().slice(0, NOME_DA_LOJA_MAXIMO))) setNovoNome("");
              }}
            >
              criar loja
            </button>
          </div>
          <p className="fc-sub">A loja nasce fechada: só você vê. Monte os itens e toque em “abrir pra mesa”.</p>
        </div>
      )}
      {loja.aviso && (
        <p className="mapa-erro" role="alert">
          {loja.aviso}
        </p>
      )}
      {visiveis.length === 0 ? (
        <p className="empty-note">{souMestre ? `Nenhuma loja ainda (cabem ${LOJAS_MAXIMAS}). Crie a primeira acima.` : "Nenhuma loja aberta por enquanto."}</p>
      ) : (
        visiveis.map((l) => (souMestre ? <LojaDoMestre key={l.id} l={l} loja={loja} /> : <LojaDoJogador key={l.id} l={l} loja={loja} sala={sala} identidade={identidade} />))
      )}
    </div>
  );
}

// ── Jogador ────────────────────────────────────────────────────────────────

function LojaDoJogador({ l, loja, sala, identidade }: { l: Loja; loja: LojaHook; sala: Sala; identidade: Identidade | null }) {
  const meuSlug = identidade?.tipo === "jogador" ? identidade.slug : null;
  const eu = sala.personagens.find((p) => p.slug === meuSlug && !p.is_npc) ?? null;
  const dinheiro = normalizarMoedas(eu?.moedas);
  const itens = itensDaLoja(loja.itens, l.id);
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function comprar(item: ItemDaLoja) {
    if (ocupado) return;
    if (!eu) {
      setMensagem("Entre como um personagem pra comprar.");
      return;
    }
    const qtd = Math.max(1, Number.parseInt(quantidades[item.id] ?? "1", 10) || 1);
    const motivo = motivoDeNaoComprar(item, qtd, dinheiro);
    if (motivo) {
      setMensagem(motivo);
      return;
    }
    setOcupado(true);
    try {
      if (!(await loja.tirarEstoque(item.id, qtd))) {
        setMensagem("Esgotou enquanto você escolhia. A loja já foi atualizada.");
        return;
      }
      const resultado = await sala.alterarListasDoPersonagem(eu.id, (f) => {
        // Conta em cima da ficha de verdade (outro aparelho pode ter gasto nesse meio-tempo).
        const depois = pagar(normalizarMoedas(f.moedas), item.preco_pc * qtd);
        if (!depois) return null;
        return { moedas: depois, inventario: juntarItem(normalizarInventario(f.inventario), itemComprado(item, qtd)) };
      });
      if (resultado !== "ok") {
        await loja.devolverEstoque(item.id, qtd); // desfaz: nada sai da loja se a compra não terminou
        setMensagem(resultado === "mudou" ? "Seu dinheiro mudou e não chega mais." : AVISO_NAO_FOI);
        return;
      }
      void sala.registrarLog(linhaDeCompra(eu.name, item, qtd, l));
      setMensagem(`Comprou ${qtd > 1 ? `${qtd}× ` : ""}${item.nome} por ${textoDoPreco(item.preco_pc * qtd)}.`);
      setQuantidades((q) => ({ ...q, [item.id]: "1" }));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="loja-bloco" aria-label={`Loja ${nomeDaLoja(l)}`}>
      <h4 className="loja-titulo">🛒 {nomeDaLoja(l)}</h4>
      {eu ? <p className="fc-sub">Seu dinheiro: {textoMoedas(dinheiro)}</p> : <p className="fc-sub">Entre como um personagem pra comprar.</p>}
      {itens.length === 0 ? (
        <p className="empty-note">Esta loja ainda não tem nada à venda.</p>
      ) : (
        <ul className="loja-lista">
          {itens.map((i) => {
            const qtd = Math.max(1, Number.parseInt(quantidades[i.id] ?? "1", 10) || 1);
            const esgotado = i.estoque !== null && i.estoque <= 0;
            const motivo = eu ? motivoDeNaoComprar(i, qtd, dinheiro) : "Entre como um personagem.";
            return (
              <li key={i.id} className={esgotado ? "loja-item loja-item--esgotado" : "loja-item"}>
                <div className="loja-item-corpo">
                  <b>
                    {i.nome}
                    {i.magico ? " ✨" : ""}
                  </b>
                  <span className="loja-preco">{textoDoPreco(i.preco_pc)}</span>
                  <span className="fc-sub">{i.estoque === null ? "sempre tem" : esgotado ? "esgotado" : `${i.estoque} restante${i.estoque === 1 ? "" : "s"}`}</span>
                  {i.descricao && <span className="fc-sub loja-desc">{i.descricao}</span>}
                </div>
                {!esgotado && (
                  <div className="loja-compra">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={QTD_MAXIMA_POR_COMPRA}
                      className="mapa-aura-campo loja-qtd"
                      aria-label={`Quantas ${i.nome} comprar`}
                      value={quantidades[i.id] ?? "1"}
                      onChange={(e) => setQuantidades((q) => ({ ...q, [i.id]: e.target.value }))}
                    />
                    <button type="button" className="btn primary" disabled={ocupado || (Boolean(eu) && motivo !== null)} aria-label={`Comprar ${i.nome}`} onClick={() => void comprar(i)}>
                      comprar
                    </button>
                    {eu && motivo && <span className="fc-sub loja-motivo">{motivo}</span>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {mensagem && (
        <p className="inv-alerta" role="status">
          {mensagem}
        </p>
      )}
    </section>
  );
}

// ── Mestre ─────────────────────────────────────────────────────────────────

function LojaDoMestre({ l, loja }: { l: Loja; loja: LojaHook }) {
  const itens = itensDaLoja(loja.itens, l.id);
  const [editando, setEditando] = useState<string | null>(null);
  return (
    <section className={l.aberta ? "loja-bloco" : "loja-bloco loja-bloco--fechada"} aria-label={`Loja ${nomeDaLoja(l)}`}>
      <div className="mapa-linha">
        <CampoTexto valor={l.nome} maxLength={NOME_DA_LOJA_MAXIMO} placeholder="nome da loja" onCommit={(v) => void loja.atualizarLoja(l.id, { nome: v })} />
        <BotaoRemover aria={`Apagar a loja ${nomeDaLoja(l)}`} confirmar={`Apagar a loja "${nomeDaLoja(l)}" e tudo o que ela vende?`} onConfirmar={() => void loja.apagarLoja(l.id)} />
      </div>
      <div className="mapa-ferr">
        <button type="button" className={l.aberta ? "btn" : "btn primary"} aria-pressed={l.aberta} onClick={() => void loja.atualizarLoja(l.id, { aberta: !l.aberta })}>
          {l.aberta ? "fechar a loja" : "abrir pra mesa"}
        </button>
        <span className="fc-sub">{l.aberta ? "A mesa está vendo esta loja." : "Fechada: só você vê."}</span>
      </div>
      {itens.length > 0 && (
        <ul className="loja-lista">
          {itens.map((i) =>
            editando === i.id ? (
              <li key={i.id} className="loja-item">
                <FormularioDoItem loja={loja} lojaId={l.id} item={i} aoTerminar={() => setEditando(null)} />
              </li>
            ) : (
              <li key={i.id} className="loja-item">
                <div className="loja-item-corpo">
                  <b>
                    {i.nome}
                    {i.magico ? " ✨" : ""}
                  </b>
                  <span className="loja-preco">{textoDoPreco(i.preco_pc)}</span>
                  <span className="fc-sub">{i.estoque === null ? "sempre tem" : `${i.estoque} no estoque`}</span>
                  {i.descricao && <span className="fc-sub loja-desc">{i.descricao}</span>}
                </div>
                <div className="loja-compra">
                  <button type="button" className="minilink" aria-label={`Editar ${i.nome}`} onClick={() => setEditando(i.id)}>
                    editar
                  </button>
                  <BotaoRemover aria={`Apagar ${i.nome} da loja`} confirmar={`Tirar "${i.nome}" da loja?`} onConfirmar={() => void loja.apagarItem(i.id)} className="minilink">
                    apagar
                  </BotaoRemover>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      {editando === null && itens.length < ITENS_MAXIMOS_POR_LOJA && <FormularioDoItem loja={loja} lojaId={l.id} item={null} aoTerminar={() => undefined} />}
    </section>
  );
}

function FormularioDoItem({ loja, lojaId, item, aoTerminar }: { loja: LojaHook; lojaId: string; item: ItemDaLoja | null; aoTerminar: () => void }) {
  const [nome, setNome] = useState(item?.nome ?? "");
  const moedaInicial = item ? moedaDoPreco(item.preco_pc) : "po";
  const [moeda, setMoeda] = useState<MoedaId>(moedaInicial);
  const [valor, setValor] = useState(item ? String(item.preco_pc / VALOR_EM_PC[moedaInicial]).replace(".", ",") : "");
  const [semLimite, setSemLimite] = useState(item ? item.estoque === null : true);
  const [estoque, setEstoque] = useState(item && item.estoque !== null ? String(item.estoque) : "1");
  const [peso, setPeso] = useState(item ? String(item.peso).replace(".", ",") : "");
  const [magico, setMagico] = useState(item?.magico ?? false);
  const [descricao, setDescricao] = useState(item?.descricao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    const preco = precoEmPc(valor, moeda);
    if (!nome.trim()) return setErro("Dê um nome ao item.");
    if (preco === null) return setErro("O preço não vale: use um número de zero pra cima.");
    const estoqueNum = semLimite ? null : Math.max(0, Math.min(ESTOQUE_MAXIMO, Number.parseInt(estoque, 10) || 0));
    const dados = {
      nome: nome.trim().slice(0, NOME_DO_ITEM_MAXIMO),
      preco_pc: preco,
      estoque: estoqueNum,
      peso: Math.max(0, Number.parseFloat(peso.replace(",", ".")) || 0),
      magico,
      descricao: descricao.trim().slice(0, DESCRICAO_MAXIMA),
    };
    setErro(null);
    setSalvando(true);
    const ok = item ? await loja.atualizarItem(item.id, dados) : await loja.adicionarItem(lojaId, dados);
    setSalvando(false);
    if (!ok) return;
    if (!item) {
      setNome("");
      setValor("");
      setPeso("");
      setDescricao("");
      setMagico(false);
    }
    aoTerminar();
  }

  return (
    <div className="fol-form">
      <h5 className="luz-subtitulo">{item ? "Editar o item" : "Novo item à venda"}</h5>
      <input type="text" className="mapa-aura-campo fol-campo" aria-label="Nome do item" placeholder="nome (ex.: Poção de cura)" maxLength={NOME_DO_ITEM_MAXIMO} value={nome} onChange={(e) => setNome(e.target.value)} />
      <div className="mapa-ferr">
        <input type="text" inputMode="decimal" className="mapa-aura-campo loja-qtd" aria-label="Preço" placeholder="preço" value={valor} onChange={(e) => setValor(e.target.value)} />
        <select className="mapa-aura-campo luz-select" aria-label="Moeda do preço" value={moeda} onChange={(e) => setMoeda(e.target.value as MoedaId)}>
          {MOEDAS_DO_PRECO.map((m) => (
            <option key={m.id} value={m.id}>
              {m.sigla}
            </option>
          ))}
        </select>
        <label className="checklabel">
          <input type="checkbox" checked={semLimite} onChange={(e) => setSemLimite(e.target.checked)} />
          sempre tem
        </label>
        {!semLimite && (
          <input type="number" inputMode="numeric" min={0} className="mapa-aura-campo loja-qtd" aria-label="Estoque" value={estoque} onChange={(e) => setEstoque(e.target.value)} />
        )}
      </div>
      <div className="mapa-ferr">
        <input type="text" inputMode="decimal" className="mapa-aura-campo loja-qtd" aria-label="Peso em kg" placeholder="peso (kg)" value={peso} onChange={(e) => setPeso(e.target.value)} />
        <label className="checklabel">
          <input type="checkbox" checked={magico} onChange={(e) => setMagico(e.target.checked)} />
          item mágico
        </label>
      </div>
      <input type="text" className="mapa-aura-campo fol-campo" aria-label="Descrição do item" placeholder="descrição (opcional)" maxLength={DESCRICAO_MAXIMA} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      {erro && (
        <p className="mapa-erro" role="alert">
          {erro}
        </p>
      )}
      <div className="mapa-ferr">
        <button type="button" className="btn primary" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? "salvando…" : item ? "salvar alterações" : "pôr à venda"}
        </button>
        {item && (
          <button type="button" className="btn" onClick={aoTerminar}>
            cancelar
          </button>
        )}
      </div>
    </div>
  );
}
