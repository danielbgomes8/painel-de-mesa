"use client";

import { useMemo, useState } from "react";
import type { MagiaPersonagem, Personagem } from "@/lib/tipos";
import { useCatalogoMagias } from "@/hooks/useCatalogoMagias";
import type { MagiaCatalogo } from "@/lib/magiasSrd";
import {
  agruparPorNivel,
  conjurar,
  contarPreparadas,
  contarSempre,
  contarTruques,
  contarTruquesExtras,
  espacosDosRecursos,
  espacosPossiveis,
  jaTemMagia,
  limiteDePreparadas,
  limiteDeTruques,
  magiaNova,
  normalizarMagias,
  rotuloDeNivel,
} from "@/lib/magias";
import { NOME_CLASSE } from "@/lib/classesNomes";
import { CampoTexto } from "@/components/CampoTexto";
import { CampoTextoAdiado } from "@/components/CampoTextoAdiado";
import { BotaoRemover } from "@/components/BotaoRemover";
import { SecaoRecolhivel } from "@/components/SecaoRecolhivel";

const MAX_RESULTADOS = 8;

/** Lista de magias do personagem: preparar, conjurar (gasta o espaço de magia
 *  que já está nos Recursos e liga a concentração) e buscar no catálogo do SRD
 *  5.2. As contas moram em `lib/magias.ts`. */
export function MagiasPersonagem({
  personagem: p,
  editavel,
  patch,
  registrar,
}: {
  personagem: Personagem;
  editavel: boolean;
  patch: (mudanca: Partial<Personagem>) => void;
  /** Escreve uma linha no log do combate ("Tibério conjura Bênção"). */
  registrar?: (texto: string) => void;
}) {
  const magias = normalizarMagias(p.magias);
  const grupos = useMemo(() => agruparPorNivel(magias), [magias]);
  const espacos = espacosDosRecursos(p.resources);
  const [aberta, setAberta] = useState<number | null>(null);
  const [conjurando, setConjurando] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const preparadas = contarPreparadas(magias);
  const sempre = contarSempre(magias);
  const limite = limiteDePreparadas(Array.isArray(p.classes) ? p.classes : []);
  const acima = limite !== null && preparadas > limite.total;
  const truques = contarTruques(magias);
  const truquesExtras = contarTruquesExtras(magias);
  const limiteTruques = limiteDeTruques(Array.isArray(p.classes) ? p.classes : []);
  const truquesAcima = limiteTruques !== null && truques > limiteTruques.total;
  const detalheTruques = limiteTruques
    ? `Limite pelas tabelas de classe do SRD: ${limiteTruques.porClasse.map((c) => `${NOME_CLASSE[c.classe]} ${c.nivel} = ${c.limite}`).join(" + ")}. Truque marcado como extra (espécie, talento, subclasse) não conta.`
    : undefined;
  const detalheLimite = limite
    ? `Limite pelas tabelas de classe do SRD: ${limite.porClasse.map((c) => `${NOME_CLASSE[c.classe]} ${c.nivel} = ${c.limite}`).join(" + ")}. Magia marcada como sempre preparada (subclasse, juramento, espécie) não conta.`
    : undefined;

  /** Preparar passando do limite é permitido (pode haver magia sempre preparada que ainda
   *  não foi marcada), mas avisa; despreparar limpa o aviso. */
  function alternarPreparada(i: number) {
    const virar = !magias[i].preparada;
    alterar(i, { preparada: virar });
    if (virar && limite && preparadas + 1 > limite.total) {
      setAviso(
        `Isso passa do limite: ${preparadas + 1} preparadas pra ${limite.total} permitidas. Se for sempre preparada (subclasse, juramento), abra a magia e marque “sempre preparada”.`,
      );
    } else {
      setAviso(null);
    }
  }

  function alterar(i: number, mudanca: Partial<MagiaPersonagem>) {
    patch({ magias: magias.map((m, idx) => (idx === i ? { ...m, ...mudanca } : m)) });
  }

  function conjurarMagia(i: number, opcoes: { nivelDoEspaco?: number; comoRitual?: boolean }) {
    const magia = magias[i];
    const r = conjurar(
      { resources: p.resources, concentration: p.concentration, concentration_on: p.concentration_on },
      magia,
      opcoes,
    );
    if (!r) {
      setAviso(`Sem espaço de magia pra ${magia.nome}.`);
      return;
    }
    patch(r.mudanca);
    registrar?.(`${p.name} conjura ${r.resumo}${r.largouConcentracao ? ` (larga a concentração em ${r.largouConcentracao})` : ""}`);
    setAviso(r.largouConcentracao ? `Você largou a concentração em ${r.largouConcentracao}.` : null);
    setConjurando(null);
  }

  function aoToqueConjurar(i: number) {
    const magia = magias[i];
    setAviso(null);
    // Truque: direto. Magia com um jeito só de conjurar: direto também.
    if (magia.nivel === 0) return conjurarMagia(i, {});
    const possiveis = espacosPossiveis(p.resources, magia.nivel);
    if (possiveis.length === 0 && !magia.ritual) {
      setAviso(`Sem espaço de magia disponível pra ${magia.nome}.`);
      return;
    }
    if (possiveis.length === 1 && !magia.ritual) return conjurarMagia(i, { nivelDoEspaco: possiveis[0].nivel });
    setConjurando(conjurando === i ? null : i);
  }

  return (
    <SecaoRecolhivel abertoInicial={false} titulo={<h4>Magias</h4>}>
      <div className="mg">
        <div className="mg-estado">
          {espacos.length === 0 ? (
            <span className="empty-note">
              Sem espaços de magia — gere em “Classe e conjuração” ou cadastre em Recursos.
            </span>
          ) : (
            espacos.map((e) => (
              <span key={e.nivel} className="mg-espaco" data-vazio={e.cur === 0 || undefined}>
                {e.nivel}º <b>{e.cur}</b>/{e.max}
              </span>
            ))
          )}
          {truques + truquesExtras > 0 && (
            <span className="mg-contagem mg-truques" data-acima={truquesAcima || undefined} title={detalheTruques}>
              {limiteTruques ? `${truques}/${limiteTruques.total}` : truques} truques{truquesExtras > 0 ? ` · +${truquesExtras} extra` : ""}
            </span>
          )}
          <span className="mg-contagem" data-acima={acima || undefined} title={detalheLimite}>
            {limite ? `${preparadas}/${limite.total}` : preparadas} preparadas{sempre > 0 ? ` · +${sempre} sempre` : ""}
          </span>
        </div>

        {p.concentration && (
          <p className="mg-conc">
            🧠 Concentrando{p.concentration_on ? ` em ${p.concentration_on}` : ""}
            {editavel && (
              <button
                type="button"
                className="minilink"
                onClick={() => patch({ concentration: false, concentration_on: "" })}
              >
                largar
              </button>
            )}
          </p>
        )}
        {aviso && (
          <p className="inv-alerta" role="status" aria-live="polite">
            {aviso}
          </p>
        )}

        {magias.length === 0 && !adicionando && (
          <p className="empty-note">{editavel ? "Nenhuma magia ainda." : "Nenhuma magia cadastrada."}</p>
        )}

        {grupos.map((g) => (
          <div key={g.nivel} className="mg-grupo">
            <span className="sectitle">{rotuloDeNivel(g.nivel)}</span>
            <ul className="mg-lista">
              {g.magias.map(({ magia, indice }) => {
                const detalhe = aberta === indice;
                const pronta = magia.nivel === 0 || magia.preparada || magia.sempre;
                return (
                  <li key={indice} className="mg-item" data-pronta={pronta || undefined}>
                    <div className="mg-linha">
                      <button
                        type="button"
                        className="mg-nome"
                        aria-expanded={detalhe}
                        onClick={() => setAberta(detalhe ? null : indice)}
                      >
                        {magia.nome || "(sem nome)"}
                        {magia.concentracao && <span className="fc-tag" title="Concentração">C</span>}
                        {magia.ritual && <span className="fc-tag" title="Ritual">R</span>}
                      </button>
                      {magia.nivel > 0 && (
                        <button
                          type="button"
                          className="chip alvo"
                          aria-pressed={magia.preparada}
                          disabled={!editavel || magia.sempre}
                          title={magia.sempre ? "Sempre preparada: não conta no limite. Desmarque nos detalhes da magia." : undefined}
                          onClick={() => alternarPreparada(indice)}
                        >
                          {magia.sempre ? "sempre" : magia.preparada ? "preparada" : "preparar"}
                        </button>
                      )}
                      {editavel && (
                        <button type="button" className="btn mg-conjurar" onClick={() => aoToqueConjurar(indice)}>
                          conjurar
                        </button>
                      )}
                    </div>

                    {conjurando === indice && (
                      <div className="mg-escolha" role="group" aria-label={`Como conjurar ${magia.nome}`}>
                        <span>usar espaço de:</span>
                        {espacosPossiveis(p.resources, magia.nivel).map((e) => (
                          <button
                            key={e.nivel}
                            type="button"
                            className="chip alvo"
                            onClick={() => conjurarMagia(indice, { nivelDoEspaco: e.nivel })}
                          >
                            {e.nivel}º ({e.cur})
                          </button>
                        ))}
                        {magia.ritual && (
                          <button type="button" className="chip alvo" onClick={() => conjurarMagia(indice, { comoRitual: true })}>
                            ritual (sem espaço)
                          </button>
                        )}
                      </div>
                    )}

                    {detalhe && (
                      <div className="mg-detalhe">
                        <p className="mg-dados">
                          {[magia.escola, magia.tempo, magia.alcance, magia.duracao].filter(Boolean).join(" · ")}
                        </p>
                        {magia.componentes && <p className="mg-dados">Componentes: {magia.componentes}</p>}
                        {editavel ? (
                          <>
                            <CampoTexto
                              valor={magia.nome}
                              maxLength={80}
                              placeholder="nome"
                              onCommit={(t) => alterar(indice, { nome: t })}
                            />
                            {magia.nivel === 0 && (
                              <label className="inv-mag">
                                <input
                                  type="checkbox"
                                  checked={magia.sempre}
                                  onChange={(e) => alterar(indice, { sempre: e.target.checked })}
                                />{" "}
                                truque extra (espécie, talento, subclasse): não conta no limite
                              </label>
                            )}
                            {magia.nivel > 0 && (
                              <label className="inv-mag">
                                <input
                                  type="checkbox"
                                  checked={magia.sempre}
                                  onChange={(e) =>
                                    alterar(indice, e.target.checked ? { sempre: true, preparada: true } : { sempre: false })
                                  }
                                />{" "}
                                sempre preparada (subclasse, juramento, espécie)
                              </label>
                            )}
                            <label className="inv-mag">
                              <input
                                type="checkbox"
                                checked={magia.concentracao}
                                onChange={(e) => alterar(indice, { concentracao: e.target.checked })}
                              />{" "}
                              exige concentração
                            </label>
                            <label className="inv-mag">
                              <input
                                type="checkbox"
                                checked={magia.ritual}
                                onChange={(e) => alterar(indice, { ritual: e.target.checked })}
                              />{" "}
                              pode ser ritual
                            </label>
                            <CampoTextoAdiado
                              valor={magia.descricao}
                              maxLength={4000}
                              atrasoMs={700}
                              placeholder="texto da magia"
                              onSalvar={(t) => alterar(indice, { descricao: t })}
                            />
                            <BotaoRemover
                              aria={`remover ${magia.nome || "magia"}`}
                              confirmar={`Tirar "${magia.nome || "magia"}" da lista?`}
                              onConfirmar={() => {
                                setAberta(null);
                                patch({ magias: magias.filter((_, idx) => idx !== indice) });
                              }}
                              className="removechar"
                            >
                              remover magia
                            </BotaoRemover>
                          </>
                        ) : (
                          magia.descricao &&
                          magia.descricao.split(/\n{2,}/).map((t, k) => (
                            <p key={k} className="mg-texto">
                              {t}
                            </p>
                          ))
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {editavel &&
          (adicionando ? (
            <AdicionarMagia
              magias={magias}
              aoAdicionar={(m) => patch({ magias: [...magias, m] })}
              aoFechar={() => setAdicionando(false)}
            />
          ) : (
            <button type="button" className="btn" onClick={() => setAdicionando(true)}>
              + magia
            </button>
          ))}
      </div>
    </SecaoRecolhivel>
  );
}

/** Busca no catálogo do SRD (some por padrão e aparece ao digitar — ver a nota
 *  do AGENTS.md sobre listas no celular) ou cadastro à mão. */
function AdicionarMagia({
  magias,
  aoAdicionar,
  aoFechar,
}: {
  magias: MagiaPersonagem[];
  aoAdicionar: (m: MagiaPersonagem) => void;
  aoFechar: () => void;
}) {
  const { catalogo, falhou, tentarDeNovo } = useCatalogoMagias(true);
  const [texto, setTexto] = useState("");
  const [nivel, setNivel] = useState<number | null>(null);
  const [classe, setClasse] = useState<string | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  const [nomeManual, setNomeManual] = useState("");
  const [nivelManual, setNivelManual] = useState(1);
  const [recemAdicionada, setRecemAdicionada] = useState<string | null>(null);

  const buscando = texto.trim() !== "" || nivel !== null || classe !== null;
  const resultados = useMemo(
    () => (catalogo && buscando ? catalogo.buscarMagias({ texto, nivel, classe }, 60) : []),
    [catalogo, buscando, texto, nivel, classe],
  );
  const visiveis = verTodos ? resultados : resultados.slice(0, MAX_RESULTADOS);

  function adicionarDoCatalogo(m: MagiaCatalogo) {
    if (!catalogo) return;
    aoAdicionar(catalogo.magiaDoCatalogo(m));
    setRecemAdicionada(m.nome);
  }

  function adicionarManual() {
    const n = nomeManual.trim();
    if (!n) return;
    aoAdicionar(magiaNova(n, nivelManual));
    setRecemAdicionada(n);
    setNomeManual("");
  }

  return (
    <div className="mg-adicionar">
      <div className="mg-busca">
        <input
          type="search"
          placeholder="buscar magia (português ou inglês)"
          aria-label="buscar magia no catálogo"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setVerTodos(false);
          }}
        />
        <select
          aria-label="filtrar por nível"
          value={nivel ?? ""}
          onChange={(e) => setNivel(e.target.value === "" ? null : Number(e.target.value))}
        >
          <option value="">todo nível</option>
          {Array.from({ length: 10 }, (_, n) => (
            <option key={n} value={n}>
              {rotuloDeNivel(n)}
            </option>
          ))}
        </select>
        <select aria-label="filtrar por classe" value={classe ?? ""} onChange={(e) => setClasse(e.target.value || null)}>
          <option value="">toda classe</option>
          {(catalogo?.CLASSES_CONJURADORAS ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {falhou && (
        <p className="inv-alerta">
          Não consegui baixar o catálogo. <button type="button" className="minilink" onClick={tentarDeNovo}>tentar de novo</button>
        </p>
      )}
      {!catalogo && !falhou && <p className="empty-note">Baixando o catálogo…</p>}
      {catalogo && !buscando && <p className="empty-note">Digite um nome ou escolha nível/classe pra ver as magias do SRD.</p>}
      {catalogo && buscando && resultados.length === 0 && <p className="empty-note">Nenhuma magia encontrada.</p>}

      <ul className="mg-resultados">
        {visiveis.map((m) => {
          const ja = jaTemMagia(magias, m.nome);
          return (
            <li key={m.en} className="mg-resultado">
              <div>
                <b>{m.nome}</b>
                {m.nome !== m.en && <span className="mg-en"> {m.en}</span>}
                <div className="mg-dados">
                  {rotuloDeNivel(m.nivel)} · {m.escola} · {m.tempo}
                  {m.concentracao ? " · C" : ""}
                  {m.ritual ? " · R" : ""}
                </div>
              </div>
              <button type="button" className="btn" disabled={ja} onClick={() => adicionarDoCatalogo(m)}>
                {ja ? "já tem" : "+ adicionar"}
              </button>
            </li>
          );
        })}
      </ul>
      {!verTodos && resultados.length > MAX_RESULTADOS && (
        <button type="button" className="minilink" onClick={() => setVerTodos(true)}>
          ver as {resultados.length} encontradas
        </button>
      )}
      {recemAdicionada && (
        <p className="empty-note" role="status" aria-live="polite">
          {recemAdicionada} entrou na lista.
        </p>
      )}

      <div className="addcombatant">
        <input
          type="text"
          placeholder="ou cadastre à mão: nome da magia"
          aria-label="nome da magia a cadastrar à mão"
          maxLength={80}
          value={nomeManual}
          onChange={(e) => setNomeManual(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionarManual()}
        />
        <select aria-label="nível da magia" value={nivelManual} onChange={(e) => setNivelManual(Number(e.target.value))}>
          {Array.from({ length: 10 }, (_, n) => (
            <option key={n} value={n}>
              {rotuloDeNivel(n)}
            </option>
          ))}
        </select>
        <button type="button" className="btn" onClick={adicionarManual}>
          + cadastrar
        </button>
      </div>
      <button type="button" className="minilink" onClick={aoFechar}>
        fechar busca
      </button>
    </div>
  );
}
