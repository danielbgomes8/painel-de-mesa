"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Relogios } from "@/hooks/useRelogios";
import {
  CONSEQUENCIA_MAXIMA,
  FATIAS_VALIDAS,
  NOME_MAXIMO,
  RELOGIOS_MAXIMOS,
  consequenciaVisivel,
  estaCheio,
  fatiasParaDesenho,
  linhaDeRelogio,
  nomeDoRelogio,
  relogiosVisiveis,
  rotuloDoRelogio,
  type Relogio,
} from "@/lib/relogios";
import { BotaoRemover } from "@/components/BotaoRemover";

/** O círculo do relógio, em SVG: as fatias cheias na cor de destaque, as vazias só no contorno. */
export function DesenhoDoRelogio({ r, tamanho = 64 }: { r: Pick<Relogio, "fatias" | "cheias" | "nome">; tamanho?: number }) {
  const fatias = fatiasParaDesenho(r.fatias, r.cheias, 50, 50, 46);
  return (
    <svg className="rel-svg" viewBox="0 0 100 100" width={tamanho} height={tamanho} role="img" aria-label={`${nomeDoRelogio(r)}: ${r.cheias} de ${r.fatias}`}>
      {fatias.map((f, i) => (
        <path key={i} d={f.d} className={f.cheia ? "rel-fatia rel-fatia--cheia" : "rel-fatia"} />
      ))}
    </svg>
  );
}

/**
 * Os relógios que a mesa enxerga, numa faixa: desenho, nome e quanto falta. No telão ficam num cartão no canto. A
 * consequência só aparece quando o relógio fecha. O Mestre vê todos (os escondidos tracejados).
 */
export function RelogiosNaMesa({ relogios, mestre = false, telao = false }: { relogios: readonly Relogio[]; mestre?: boolean; telao?: boolean }) {
  const lista = relogiosVisiveis(relogios, mestre);
  if (lista.length === 0) return null;
  return (
    <ul className={telao ? "rel-faixa rel-faixa--telao" : "rel-faixa"} aria-label="Relógios">
      {lista.map((r) => {
        const consequencia = consequenciaVisivel(r, false);
        return (
          <li key={r.id} className={`rel-item${estaCheio(r) ? " rel-item--cheio" : ""}${r.visivel ? "" : " rel-item--oculto"}`}>
            <DesenhoDoRelogio r={r} tamanho={telao ? 96 : 52} />
            <span className="rel-texto">
              <b>{nomeDoRelogio(r)}</b>
              <span className="rel-contagem">{estaCheio(r) ? "fechou!" : `${r.cheias} de ${r.fatias}`}</span>
              {consequencia && <span className="rel-conseq">{consequencia}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** A parte "⏳ Relógios" da Campanha, só pro Mestre: cria, enche, esvazia, esconde da mesa e apaga. */
export function RelogiosDaCampanha({ relogios, sala }: { relogios: Relogios; sala: Sala }) {
  const [nome, setNome] = useState("");
  const [fatias, setFatias] = useState<number>(6);
  const [consequencia, setConsequencia] = useState("");
  const [paraMesa, setParaMesa] = useState(true);
  const [salvando, setSalvando] = useState(false);

  if (relogios.indisponivel) {
    return <p className="bkpexplica">Os relógios ainda não estão ligados no banco: falta rodar a migration 0038 no SQL Editor do Supabase. O resto do app funciona sem eles.</p>;
  }
  if (relogios.carregando) return <p className="empty-note">Carregando os relógios…</p>;

  async function criar() {
    if (salvando) return;
    setSalvando(true);
    const ok = await relogios.criar({ nome: nome.trim().slice(0, NOME_MAXIMO), fatias, visivel: paraMesa, consequencia: consequencia.trim().slice(0, CONSEQUENCIA_MAXIMA) });
    setSalvando(false);
    if (ok) {
      setNome("");
      setConsequencia("");
    }
  }

  async function mexer(r: Relogio, delta: number) {
    const resultado = await relogios.mexer(r.id, delta);
    if (!resultado) return;
    const linha = linhaDeRelogio(resultado.antes, resultado.depois);
    // Só conta no log o que a mesa pode saber: relógio escondido anda em silêncio.
    if (linha && resultado.depois.visivel) void sala.registrarLog(linha);
  }

  return (
    <div className="rel">
      <div className="rel-form">
        <h4 className="fol-form-titulo">Novo relógio</h4>
        <input
          type="text"
          className="mapa-aura-campo fol-campo"
          aria-label="Nome do relógio"
          placeholder="nome (ex.: o ritual termina)"
          maxLength={NOME_MAXIMO}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <input
          type="text"
          className="mapa-aura-campo fol-campo"
          aria-label="O que acontece quando fecha"
          placeholder="o que acontece quando fecha (a mesa só lê depois)"
          maxLength={CONSEQUENCIA_MAXIMA}
          value={consequencia}
          onChange={(e) => setConsequencia(e.target.value)}
        />
        <div className="mapa-ferr" role="group" aria-label="Quantas fatias">
          <span className="mapa-aura-titulo">Fatias</span>
          {FATIAS_VALIDAS.map((n) => (
            <button key={n} type="button" className="chip alvo" aria-pressed={fatias === n} onClick={() => setFatias(n)}>
              {n}
            </button>
          ))}
        </div>
        <label className="checklabel">
          <input type="checkbox" checked={paraMesa} onChange={(e) => setParaMesa(e.target.checked)} />
          a mesa vê este relógio
        </label>
        <div className="mapa-ferr">
          <button type="button" className="btn primary" disabled={salvando || relogios.relogios.length >= RELOGIOS_MAXIMOS} onClick={() => void criar()}>
            {salvando ? "criando…" : "criar relógio"}
          </button>
        </div>
      </div>

      {relogios.aviso && (
        <p className="mapa-erro" role="alert">
          {relogios.aviso}
        </p>
      )}

      {relogios.relogios.length === 0 ? (
        <p className="empty-note">Nenhum relógio ainda (cabem {RELOGIOS_MAXIMOS}). Crie o primeiro acima.</p>
      ) : (
        <ul className="rel-lista">
          {relogiosVisiveis(relogios.relogios, true).map((r) => (
            <li key={r.id} className={`rel-linha${estaCheio(r) ? " rel-item--cheio" : ""}${r.visivel ? "" : " rel-item--oculto"}`}>
              <DesenhoDoRelogio r={r} tamanho={56} />
              <span className="rel-texto">
                <b>{nomeDoRelogio(r)}</b>
                <span className="rel-contagem">{rotuloDoRelogio(r)}</span>
                {r.consequencia && <span className="rel-conseq">ao fechar: {r.consequencia}</span>}
              </span>
              <span className="rel-acoes">
                <button type="button" className="btn" aria-label={`Esvaziar uma fatia de ${nomeDoRelogio(r)}`} disabled={r.cheias <= 0} onClick={() => void mexer(r, -1)}>
                  −
                </button>
                <button type="button" className="btn primary" aria-label={`Encher uma fatia de ${nomeDoRelogio(r)}`} disabled={estaCheio(r)} onClick={() => void mexer(r, 1)}>
                  +
                </button>
                <button type="button" className="minilink" aria-label={`${r.visivel ? "Esconder da mesa" : "Mostrar pra mesa"} ${nomeDoRelogio(r)}`} onClick={() => void relogios.atualizar(r.id, { visivel: !r.visivel })}>
                  {r.visivel ? "👁 mesa vê" : "🔒 só eu"}
                </button>
                <BotaoRemover aria={`Apagar o relógio ${nomeDoRelogio(r)}`} confirmar={`Apagar o relógio "${nomeDoRelogio(r)}"?`} onConfirmar={() => void relogios.remover(r.id)} className="minilink">
                  apagar
                </BotaoRemover>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
