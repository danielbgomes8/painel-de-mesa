"use client";

import { useState } from "react";
import type { Bau } from "@/hooks/useBau";
import type { Sala } from "@/hooks/useSala";
import type { Identidade } from "@/lib/identidade";
import type { MoedaId, Moedas } from "@/lib/tipos";
import {
  MOEDAS,
  dividirMoedas,
  formatarKg,
  itemDoBauParaInventario,
  juntarItem,
  moedasDoBau,
  moedasVazias,
  normalizarInventario,
  normalizarMoedas,
  objetosDoBau,
  somarMoedas,
  temMoeda,
  textoMoedas,
  valorEmPo,
} from "@/lib/inventario";
import { BotaoRemover } from "@/components/BotaoRemover";
import { HistoricoDoBau } from "@/components/HistoricoDoBau";

const AVISO_NAO_FOI = "Não deu certo. Confira a conexão e tente de novo.";

/** O baú do grupo: o espólio que ainda não é de ninguém. Qualquer pessoa da
 *  mesa guarda e pega; o Mestre também entrega a quem quiser e divide o
 *  dinheiro. Cada troca tira de um lado e põe do outro — se o segundo passo
 *  falhar, o primeiro é desfeito, pra nada sumir no meio do caminho. */
export function BauDoGrupo({
  bau,
  sala,
  codigo,
  identidade,
}: {
  bau: Bau;
  sala: Sala;
  codigo: string;
  identidade: Identidade | null;
}) {
  const souMestre = identidade?.tipo === "mestre";
  const jogadores = sala.personagens.filter((p) => !p.is_npc);
  const meuSlug = identidade?.tipo === "jogador" ? identidade.slug : null;
  const [destinoEscolhido, setDestinoEscolhido] = useState<string>("");
  // Jogador entrega pra si mesmo; o Mestre escolhe quem.
  const destinoSlug = souMestre ? destinoEscolhido : meuSlug;
  const destino = jogadores.find((p) => p.slug === destinoSlug) ?? null;

  const dinheiro = moedasDoBau(bau.itens);
  const objetos = objetosDoBau(bau.itens);
  const [entrada, setEntrada] = useState<Record<MoedaId, string>>({ pc: "", pp: "", pe: "", po: "", pl: "" });
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [divisao, setDivisao] = useState<string[] | null>(null);
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [nome, setNome] = useState("");
  const [qtd, setQtd] = useState("1");
  const [peso, setPeso] = useState("");
  const [magico, setMagico] = useState(false);
  // O log é público e é de onde o recap da sessão conta o tesouro: cada troca do baú deixa uma linha.
  const registrar = (texto: string) => void sala.registrarLog(texto);
  const quemMexe = souMestre ? "O Mestre" : (jogadores.find((p) => p.slug === meuSlug)?.name ?? "Alguém");
  const vezes = (n: number) => (n > 1 ? `${n}× ` : "");

  const pedido: Moedas = (() => {
    const m = moedasVazias();
    for (const { id } of MOEDAS) m[id] = Math.max(0, Number.parseInt(entrada[id], 10) || 0);
    return m;
  })();

  async function executar(tarefa: () => Promise<string | null>) {
    if (ocupado) return;
    setOcupado(true);
    setAviso(null);
    try {
      setAviso(await tarefa());
    } finally {
      setOcupado(false);
    }
  }

  const limparEntrada = () => setEntrada({ pc: "", pp: "", pe: "", po: "", pl: "" });

  const guardarMoedas = () =>
    executar(async () => {
      if (!temMoeda(pedido)) return "Digite quanto vai pro baú.";
      if (!(await bau.guardarMoedas(pedido))) return AVISO_NAO_FOI;
      registrar(`💰 ${quemMexe} guardou ${textoMoedas(pedido)} no baú`);
      limparEntrada();
      return null;
    });

  const pegarMoedas = () =>
    executar(async () => {
      if (!destino) return souMestre ? "Escolha quem recebe." : "Entre como um personagem pra pegar.";
      if (!temMoeda(pedido)) return "Digite quanto vai pegar.";
      for (const { id, sigla } of MOEDAS) if (pedido[id] > dinheiro[id]) return `O baú não tem tantos ${sigla}.`;
      if (!(await bau.tirarMoedas(pedido))) return "O baú mudou enquanto você pedia. Olhe de novo e tente outra vez.";
      const ok =
        (await sala.alterarListasDoPersonagem(destino.id, (f) => ({
          moedas: somarMoedas(normalizarMoedas(f.moedas), pedido),
        }))) === "ok";
      if (!ok) {
        await bau.guardarMoedas(pedido); // desfaz: o dinheiro volta pro baú
        return AVISO_NAO_FOI;
      }
      registrar(`💰 ${destino.name} pegou ${textoMoedas(pedido)} do baú`);
      limparEntrada();
      return null;
    });

  const dividir = () =>
    executar(async () => {
      const alvos = jogadores.filter((p) => (divisao ?? []).includes(p.slug));
      if (alvos.length === 0) return "Marque quem recebe.";
      const { cada } = dividirMoedas(dinheiro, alvos.length);
      if (!temMoeda(cada)) return "Não tem moeda suficiente pra dar pelo menos uma a cada um.";
      const total = moedasVazias();
      for (const { id } of MOEDAS) total[id] = cada[id] * alvos.length;
      if (!(await bau.tirarMoedas(total))) return "O baú mudou enquanto você dividia. Olhe de novo e tente outra vez.";
      const resultados = await Promise.all(
        alvos.map((p) =>
          sala.alterarListasDoPersonagem(p.id, (f) => ({ moedas: somarMoedas(normalizarMoedas(f.moedas), cada) })),
        ),
      );
      const falharam = resultados.filter((r) => r !== "ok").length;
      if (falharam > 0) {
        // Devolve ao baú só a parte de quem não recebeu; quem recebeu fica com o que levou.
        const devolver = moedasVazias();
        for (const { id } of MOEDAS) devolver[id] = cada[id] * falharam;
        await bau.guardarMoedas(devolver);
        return AVISO_NAO_FOI;
      }
      setDivisao(null);
      registrar(`💰 Dinheiro do baú dividido entre ${alvos.map((p) => p.name).join(", ")}: cada um levou ${textoMoedas(cada)}`);
      return `Cada um levou ${textoMoedas(cada)}.`;
    });

  const guardarItem = () =>
    executar(async () => {
      const n = nome.trim();
      if (!n) return "Dê um nome ao item.";
      const ok = await bau.guardarItem({
        nome: n,
        qtd: Math.max(1, Number.parseInt(qtd, 10) || 1),
        peso: Math.max(0, Number.parseFloat(peso.replace(",", ".")) || 0),
        magico,
      });
      if (!ok) return AVISO_NAO_FOI;
      registrar(`🎒 ${quemMexe} guardou ${vezes(Math.max(1, Number.parseInt(qtd, 10) || 1))}${n} no baú`);
      setNome("");
      setQtd("1");
      setPeso("");
      setMagico(false);
      return null;
    });

  const pegarItem = (id: string) =>
    executar(async () => {
      const item = bau.itens.find((i) => i.id === id);
      if (!item) return "Esse item já saiu do baú.";
      if (!destino) return souMestre ? "Escolha quem recebe." : "Entre como um personagem pra pegar.";
      const quanto = Math.min(item.qtd, Math.max(1, Number.parseInt(quantidades[id] ?? "1", 10) || 1));
      if (!(await bau.tirarItem(id, quanto))) return "Alguém levou esse item antes de você. O baú já foi atualizado.";
      const novo = itemDoBauParaInventario(item, quanto);
      const ok =
        (await sala.alterarListasDoPersonagem(destino.id, (f) => ({
          inventario: juntarItem(normalizarInventario(f.inventario), novo),
        }))) === "ok";
      if (!ok) {
        await bau.guardarItem({ ...item, qtd: quanto }); // desfaz: o item volta pro baú
        return AVISO_NAO_FOI;
      }
      registrar(`🎒 ${destino.name} pegou ${vezes(quanto)}${item.nome} do baú`);
      return `${quanto > 1 ? `${quanto}× ` : ""}${item.nome} foi pra ${destino.name}.`;
    });

  if (bau.indisponivel) {
    return (
      <p className="empty-note">
        O baú ainda não foi ligado neste banco (falta rodar a migration 0026). O resto do app funciona normalmente.
      </p>
    );
  }

  return (
    <div className="bau">
      <section className="bau-bloco" aria-label="Dinheiro do grupo">
        <span className="sectitle">Dinheiro do grupo</span>
        <p className="bau-total">
          {textoMoedas(dinheiro)}
          {temMoeda(dinheiro) && <span className="bau-sub"> ≈ {String(valorEmPo(dinheiro)).replace(".", ",")} PO</span>}
        </p>
        {identidade && (
          <>
            <div className="inv-moedas" role="group" aria-label="Quantidade de moedas">
              {MOEDAS.map(({ id, sigla, nome: nm }) => (
                <label key={id} className="inv-moeda" title={nm}>
                  <span>{sigla}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="0"
                    value={entrada[id]}
                    onChange={(e) => setEntrada((a) => ({ ...a, [id]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <div className="bau-acoes">
              <button type="button" className="btn" disabled={ocupado} onClick={() => void guardarMoedas()}>
                guardar no baú
              </button>
              <button type="button" className="btn" disabled={ocupado} onClick={() => void pegarMoedas()}>
                pegar{destino ? ` pra ${destino.name}` : ""}
              </button>
            </div>
          </>
        )}
        {souMestre && jogadores.length > 0 && (
          <label className="bau-destino">
            Quem recebe o que for pego:{" "}
            <select value={destinoEscolhido} onChange={(e) => setDestinoEscolhido(e.target.value)}>
              <option value="">escolha…</option>
              {jogadores.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {identidade && temMoeda(dinheiro) && jogadores.length > 0 && (
          <div className="bau-divisao">
            {divisao === null ? (
              <button type="button" className="minilink" onClick={() => setDivisao(jogadores.map((p) => p.slug))}>
                dividir o dinheiro entre o grupo
              </button>
            ) : (
              <>
                <span className="sectitle">Dividir entre</span>
                <div className="bau-quem">
                  {jogadores.map((p) => (
                    <button
                      key={p.slug}
                      type="button"
                      className="chip alvo"
                      aria-pressed={divisao.includes(p.slug)}
                      onClick={() =>
                        setDivisao((d) => (d ?? []).includes(p.slug) ? (d ?? []).filter((s) => s !== p.slug) : [...(d ?? []), p.slug])
                      }
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                {divisao.length > 0 && (
                  <p className="bau-sub">
                    Cada um leva {textoMoedas(dividirMoedas(dinheiro, divisao.length).cada)}; no baú sobra{" "}
                    {textoMoedas(dividirMoedas(dinheiro, divisao.length).resto)}.
                  </p>
                )}
                <div className="bau-acoes">
                  <button type="button" className="btn primary" disabled={ocupado} onClick={() => void dividir()}>
                    dividir
                  </button>
                  <button type="button" className="btn ghost" onClick={() => setDivisao(null)}>
                    cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <section className="bau-bloco" aria-label="Itens do baú">
        <span className="sectitle">Itens</span>
        {bau.carregando && <p className="empty-note">Abrindo o baú…</p>}
        {!bau.carregando && objetos.length === 0 && <p className="empty-note">O baú está sem itens.</p>}
        <ul className="inv-lista">
          {objetos.map((item) => (
            <li key={item.id} className="inv-item">
              <div className="inv-linha">
                <div className="inv-nome">
                  <b>{item.nome}</b>
                  {item.raridade && <span className="fc-tag">{item.raridade}</span>}
                  {item.magico && <span className="fc-tag">mágico</span>}
                </div>
                <span>×{item.qtd}</span>
              </div>
              {item.descricao && <p className="inv-desc">{item.descricao}</p>}
              <div className="inv-meta">
                {item.peso > 0 && <span>{formatarKg(item.peso)} cada</span>}
                {identidade && (
                  <>
                    {item.qtd > 1 && (
                      <input
                        className="num bau-qtd"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={item.qtd}
                        aria-label={`quantas ${item.nome} pegar`}
                        value={quantidades[item.id] ?? "1"}
                        onChange={(e) => setQuantidades((q) => ({ ...q, [item.id]: e.target.value }))}
                      />
                    )}
                    <button type="button" className="btn" disabled={ocupado} onClick={() => void pegarItem(item.id)}>
                      pegar{destino ? ` pra ${destino.name}` : ""}
                    </button>
                    <BotaoRemover
                      aria={`remover ${item.nome} do baú`}
                      confirmar={`Jogar fora "${item.nome}"? Ninguém vai ficar com ele.`}
                      onConfirmar={() => {
                        void bau.remover(item.id).then((ok) => ok && registrar(`🎒 ${quemMexe} jogou fora ${vezes(item.qtd)}${item.nome} do baú`));
                      }}
                    />
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>

        {identidade && (
          <div className="addcombatant inv-novo">
            <input
              type="text"
              placeholder="guardar item (ex.: Poção de cura)"
              aria-label="nome do item a guardar"
              maxLength={80}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void guardarItem()}
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
            <label className="inv-mag">
              <input type="checkbox" checked={magico} onChange={(e) => setMagico(e.target.checked)} /> mágico
            </label>
            <button type="button" className="btn" disabled={ocupado} onClick={() => void guardarItem()}>
              + guardar
            </button>
          </div>
        )}
      </section>

      {aviso && (
        <p className="inv-alerta" role="status" aria-live="polite">
          {aviso}
        </p>
      )}

      <HistoricoDoBau codigo={codigo} gatilho={sala.log[0]?.id} />
    </div>
  );
}
