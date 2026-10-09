"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import { useEfeitosDoCombate } from "@/hooks/useEfeitos";
import type { Personagem } from "@/lib/tipos";
import {
  DURACOES_RAPIDAS,
  DURACAO_MAXIMA,
  NOME_MAXIMO,
  efeitoVisivel,
  efeitosQueAcabaram,
  linhaDoEfeito,
  textoRestante,
  validarNovoEfeito,
  type SituacaoDosEfeitos,
} from "@/lib/efeitosCombate";
import { nomeNoLog } from "@/lib/regras";
import { registrarUso } from "@/lib/registrarUso";
import { BotaoRemover } from "@/components/BotaoRemover";

/**
 * Efeitos com duração no combate (migration 0035; regras em `lib/efeitosCombate.ts`):
 * "Bênção, 10 rodadas". Três peças:
 *  - `AvisosDeEfeitos`: os que acabaram e esperam alguém dizer "acabou" (Mestre vê todos; jogador, os seus);
 *  - `EfeitosNaLinha`: os chips de efeito ativo na linha da iniciativa;
 *  - `EfeitosDoPersonagem`: lista + formulário "+ Efeito" no painel que abre ao tocar na linha.
 */

function useSituacao(sala: Sala): SituacaoDosEfeitos {
  const { order, round, turn } = sala.combate;
  return useMemo(() => ({ round, turn, order }), [round, turn, order]);
}

/** Efeito que acabou: aparece pro Mestre e pra quem lançou ou está sob ele. Vibra uma vez por aviso novo. */
export function AvisosDeEfeitos({ sala, meuSlug }: { sala: Sala; meuSlug: string | null }) {
  const { efeitos, remover } = useEfeitosDoCombate();
  const situacao = useSituacao(sala);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const lista = useMemo(
    () =>
      efeitosQueAcabaram(efeitos, situacao).filter(
        (e) => meuSlug === null || e.alvo_slug === meuSlug || e.lancador_slug === meuSlug,
      ),
    [efeitos, situacao, meuSlug],
  );
  const vistos = useRef<Set<string>>(new Set());

  useEffect(() => {
    const novos = lista.filter((e) => !vistos.current.has(e.id));
    if (novos.length === 0) return;
    novos.forEach((e) => vistos.current.add(e.id));
    try {
      navigator.vibrate?.([120, 60, 120]);
    } catch {
      // aparelho sem vibração: o aviso na tela basta
    }
  }, [lista]);

  if (lista.length === 0) return null;

  async function acabou(id: string, nome: string, alvoSlug: string) {
    if (ocupado) return;
    setOcupado(id);
    registrarUso("acao:efeito-acabou");
    const alvo = sala.personagens.find((p) => p.slug === alvoSlug);
    // Só conta à mesa depois que o banco aceitou, e uma vez só (o apagar devolve true só pra quem apagou).
    const ok = await remover(id);
    if (ok && alvo) await sala.registrarLog(linhaDoEfeito(nome, nomeNoLog(alvo)));
    setOcupado(null);
  }

  return (
    <div className="evavisos" role="status" aria-live="polite">
      {lista.map((e) => {
        const alvo = sala.personagens.find((p) => p.slug === e.alvo_slug);
        return (
          <div key={e.id} className="evaviso">
            <p className="evgatilho">⏳ Efeito acabou{alvo ? ` · ${meuSlug === null ? nomeNoLog(alvo) : alvo.name}` : ""}</p>
            <p className="evtexto">{e.nome}</p>
            <button type="button" className="btn primary" disabled={ocupado === e.id} onClick={() => void acabou(e.id, e.nome, e.alvo_slug)}>
              Acabou · contar à mesa
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Chips dos efeitos ainda valendo na linha da iniciativa (some quando não há nenhum). */
export function EfeitosNaLinha({ sala, personagem: p, souMestre }: { sala: Sala; personagem: Personagem; souMestre: boolean }) {
  const { efeitos } = useEfeitosDoCombate();
  const situacao = useSituacao(sala);
  if (!efeitoVisivel(souMestre, p)) return null;
  const meus = efeitos.filter((e) => e.alvo_slug === p.slug && e.termina_rodada >= situacao.round);
  if (meus.length === 0) return null;
  return (
    <div className="initconds">
      {meus.map((e) => (
        <span key={e.id} className="condtag efeitotag">
          ⏳ {e.nome} · {textoRestante(e, situacao.round)}
        </span>
      ))}
    </div>
  );
}

/** No painel da linha: efeitos deste personagem (com ✕ pra tirar à mão) e o formulário pra criar um. */
export function EfeitosDoPersonagem({ sala, personagem: p }: { sala: Sala; personagem: Personagem }) {
  const { efeitos, indisponivel, criar, remover } = useEfeitosDoCombate();
  const situacao = useSituacao(sala);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [duracao, setDuracao] = useState("10");
  const [lancador, setLancador] = useState(p.slug);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const meus = efeitos.filter((e) => e.alvo_slug === p.slug);
  const quemLanca = situacao.order.map((o) => {
    const q = sala.personagens.find((x) => x.slug === o.slug);
    return { slug: o.slug, nome: q ? nomeNoLog(q) : o.slug };
  });

  async function adicionar() {
    if (enviando) return;
    setAviso(null);
    const v = validarNovoEfeito(
      { nome, duracao, alvo_slug: p.slug, lancador_slug: situacao.order.some((o) => o.slug === lancador) ? lancador : null },
      situacao.round,
    );
    if (!v.ok) {
      setAviso(v.motivo);
      return;
    }
    setEnviando(true);
    registrarUso("acao:efeito-criar");
    const ok = await criar(v.efeito);
    setEnviando(false);
    if (!ok) {
      setAviso("Não consegui guardar o efeito. Confira a internet e tente de novo.");
      return;
    }
    setNome("");
    setAberto(false);
  }

  return (
    <div className="initajustecond">
      <span className="sectitle">Efeitos com duração</span>
      {indisponivel ? (
        <p className="initajustenota">Falta rodar a migration 0035 no Supabase — os efeitos ainda não funcionam.</p>
      ) : (
        <>
          {meus.length > 0 && (
            <ul className="efeitolista">
              {meus.map((e) => (
                <li key={e.id}>
                  <span>
                    ⏳ {e.nome} · {textoRestante(e, situacao.round)}
                  </span>
                  <BotaoRemover aria={`Tirar o efeito ${e.nome}`} onConfirmar={() => void remover(e.id)} />
                </li>
              ))}
            </ul>
          )}
          {!aberto ? (
            <button type="button" className="btn" onClick={() => setAberto(true)}>
              + Efeito
            </button>
          ) : (
            <div className="efeitoform">
              <input
                type="text"
                placeholder="Bênção, Escudo da Fé…"
                aria-label="Nome do efeito"
                maxLength={NOME_MAXIMO}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              <div className="efeitorapido">
                {DURACOES_RAPIDAS.map((d) => (
                  <button
                    key={d.rodadas}
                    type="button"
                    className="btn"
                    aria-pressed={duracao === String(d.rodadas)}
                    onClick={() => setDuracao(String(d.rodadas))}
                  >
                    {d.rotulo}
                  </button>
                ))}
              </div>
              <label className="efeitocampo">
                Dura (rodadas)
                <input
                  className="num"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={DURACAO_MAXIMA}
                  value={duracao}
                  onChange={(e) => setDuracao(e.target.value)}
                />
              </label>
              <label className="efeitocampo">
                Lançado por
                <select value={lancador} onChange={(e) => setLancador(e.target.value)}>
                  {quemLanca.map((q) => (
                    <option key={q.slug} value={q.slug}>
                      {q.nome}
                    </option>
                  ))}
                </select>
              </label>
              <p className="initajustenota">Acaba no início do turno de quem lançou.</p>
              {aviso && (
                <p className="initajustenota" role="alert">
                  {aviso}
                </p>
              )}
              <div className="efeitoacoes">
                <button type="button" className="btn primary" disabled={enviando} onClick={() => void adicionar()}>
                  Guardar efeito
                </button>
                <button type="button" className="btn" onClick={() => setAberto(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
