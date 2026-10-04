"use client";

import { useMemo, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import { useCatalogoMonstros } from "@/hooks/useCatalogoMonstros";
import { XP_MAXIMO, formatarXp, linhaDeXp, normalizarXp } from "@/lib/experiencia";
import {
  inimigosDerrotados,
  jogadoresCaidos,
  jogadoresDoCombate,
  lerXpDigitado,
  linhaDeFimDoCombate,
  partilharXp,
  semCondicoesComPrazo,
  xpDoInimigo,
} from "@/lib/fimDoCombate";
import { mudancaDe, textoDesfeito, type MudancaPersonagem } from "@/lib/desfazer";

/** Encerrar o combate (só o Mestre): mostra o resumo, sugere o XP dos inimigos derrotados (o Mestre confirma
 *  quem conta e pode digitar o XP de quem o catálogo não conhece), divide entre os jogadores que lutaram e
 *  limpa a ordem. Vai pro log e dá pra desfazer inteiro. As contas moram em `lib/fimDoCombate.ts`. */
export function EncerrarCombate({ sala, onFechar }: { sala: Sala; onFechar: () => void }) {
  const { catalogo, falhou, tentarDeNovo } = useCatalogoMonstros();
  const { order, round } = sala.combate;
  const derrotados = useMemo(() => inimigosDerrotados(order, sala.personagens), [order, sala.personagens]);
  const jogadores = useMemo(() => jogadoresDoCombate(order, sala.personagens), [order, sala.personagens]);
  const caidos = useMemo(() => jogadoresCaidos(order, sala.personagens), [order, sala.personagens]);

  // O que o Mestre mexeu; o resto vem do catálogo (xp) ou do padrão (todos marcados).
  const [contam, setContam] = useState<Record<string, boolean>>({});
  const [digitado, setDigitado] = useState<Record<string, string>>({});
  const [recebem, setRecebem] = useState<Record<string, boolean>>({});
  const [limparPrazos, setLimparPrazos] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const xpDe = (slug: string, nome: string): string => {
    if (digitado[slug] !== undefined) return digitado[slug];
    const achado = catalogo ? xpDoInimigo(nome, catalogo.MONSTROS_SRD) : null;
    return achado === null ? "" : String(achado);
  };
  const conta = (slug: string) => contam[slug] ?? true;
  const recebe = (slug: string) => recebem[slug] ?? true;

  const marcados = derrotados.filter((d) => conta(d.slug));
  const destinatarios = jogadores.filter((j) => recebe(j.slug));
  const partilha = partilharXp(marcados.map((d) => lerXpDigitado(xpDe(d.slug, d.name))), destinatarios.length);

  async function encerrar() {
    if (ocupado) return;
    setOcupado(true);
    setAviso(null);

    const mudancas: MudancaPersonagem[] = [];
    const textos: string[] = [];

    if (partilha.cada > 0) {
      for (const j of destinatarios) {
        const antes = normalizarXp(j.xp);
        const depois = Math.min(XP_MAXIMO, antes + partilha.cada);
        if (depois === antes) continue;
        mudancas.push(mudancaDe(j, { xp: depois }));
        textos.push(linhaDeXp(j.name, depois - antes, depois));
      }
    }
    if (limparPrazos) {
      for (const j of jogadores) {
        if (Object.keys(j.cond_prazo ?? {}).length === 0) continue;
        const r = semCondicoesComPrazo(j.cond, j.cond_prazo);
        if (r.tiradas.length === 0 && Object.keys(j.cond_prazo).length === 0) continue;
        const patch = { cond: r.cond, cond_prazo: r.cond_prazo };
        const ja = mudancas.find((m) => m.id === j.id);
        if (ja) {
          // mesma ficha já mexida pelo XP: junta as duas mudanças numa só, pra o desfazer devolver tudo
          ja.depois = { ...ja.depois, ...patch };
          ja.antes = { ...ja.antes, cond: j.cond, cond_prazo: j.cond_prazo };
        } else {
          mudancas.push(mudancaDe(j, patch));
        }
      }
    }

    if (mudancas.length > 0) {
      const ok = await sala.atualizarVariosPersonagens(mudancas.map((m) => ({ id: m.id, patch: m.depois })));
      if (!ok) {
        setAviso("Não consegui gravar nas fichas, então o combate continua aberto. Tente de novo.");
        setOcupado(false);
        return;
      }
    }

    const feito = await sala.definirCombate({ round: 1, turn: 0, order: [] });
    if (!feito) {
      setAviso("As fichas foram atualizadas, mas não consegui limpar a ordem. Use “Reiniciar combate”.");
      setOcupado(false);
      return;
    }
    const fim = linhaDeFimDoCombate(round, marcados.length, partilha, destinatarios.length);
    sala.registrarVariosLogs([fim, ...textos]);
    sala.lembrarDesfazer({
      rotulo: "Combate encerrado",
      textoLog: textoDesfeito([fim, ...textos], "Combate encerrado"),
      personagens: mudancas,
      combate: feito,
      criados: [],
    });
    setOcupado(false);
    onFechar();
  }

  return (
    <div className="fim">
      <div className="fim-cab">
        <b>Encerrar combate</b>
        <button type="button" className="rm" aria-label="Fechar" onClick={onFechar}>
          ✕
        </button>
      </div>
      <p className="fim-resumo">
        Rodada {round} · {derrotados.length} {derrotados.length === 1 ? "inimigo a 0 PV" : "inimigos a 0 PV"} · {caidos.length}{" "}
        {caidos.length === 1 ? "jogador caído" : "jogadores caídos"}
      </p>

      {derrotados.length > 0 && (
        <div className="fim-xp">
          <span className="sectitle">XP dos inimigos derrotados</span>
          <p className="empty-note">
            Confirme quem conta (um inimigo a 0 PV pode ter fugido ou sido poupado). O XP vem do catálogo pelo nome; onde não achou, digite.
          </p>
          {falhou && (
            <p className="inv-alerta">
              Não consegui baixar o catálogo. <button type="button" className="minilink" onClick={tentarDeNovo}>tentar de novo</button>
            </p>
          )}
          <ul className="fim-lista">
            {derrotados.map((d) => (
              <li key={d.id} className="fim-item">
                <label className="inv-mag">
                  <input type="checkbox" checked={conta(d.slug)} onChange={(e) => setContam((c) => ({ ...c, [d.slug]: e.target.checked }))} />
                  {d.name}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="XP"
                  aria-label={`XP de ${d.name}`}
                  disabled={!conta(d.slug)}
                  value={xpDe(d.slug, d.name)}
                  onChange={(e) => setDigitado((x) => ({ ...x, [d.slug]: e.target.value }))}
                />
              </li>
            ))}
          </ul>

          <span className="sectitle">Quem recebe</span>
          <div className="chips">
            {jogadores.length === 0 && <span className="empty-note">Nenhum jogador na ordem.</span>}
            {jogadores.map((j) => (
              <button key={j.id} type="button" className="chip alvo" aria-pressed={recebe(j.slug)} onClick={() => setRecebem((r) => ({ ...r, [j.slug]: !recebe(j.slug) }))}>
                {j.name}
              </button>
            ))}
          </div>
          <p className="fim-total">
            {partilha.total > 0
              ? destinatarios.length > 0
                ? `Total ${formatarXp(partilha.total)} XP · ${formatarXp(partilha.cada)} pra ${destinatarios.length === 1 ? "o jogador" : "cada um"}${partilha.sobra > 0 ? ` (sobram ${formatarXp(partilha.sobra)})` : ""}`
                : `Total ${formatarXp(partilha.total)} XP, mas ninguém selecionado pra receber.`
              : "Nenhum XP a dar."}
          </p>
        </div>
      )}

      <label className="inv-mag">
        <input type="checkbox" checked={limparPrazos} onChange={(e) => setLimparPrazos(e.target.checked)} />
        tirar dos jogadores as condições que têm prazo
      </label>

      {aviso && (
        <p className="inv-alerta" role="status" aria-live="polite">
          {aviso}
        </p>
      )}
      <div className="fim-acoes">
        <button type="button" className="btn primary" disabled={ocupado} onClick={encerrar}>
          🏁 Encerrar combate
        </button>
        <button type="button" className="btn" disabled={ocupado} onClick={onFechar}>
          cancelar
        </button>
      </div>
    </div>
  );
}
