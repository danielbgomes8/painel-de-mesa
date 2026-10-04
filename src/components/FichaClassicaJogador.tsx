"use client";

import type { Sala } from "@/hooks/useSala";
import type { Atributo, NivelProficiencia, Pericia, Personagem } from "@/lib/tipos";
import { NOME_CLASSE } from "@/lib/classesNomes";
import { useCatalogoClasses } from "@/hooks/useCatalogoClasses";
import { AvisoCatalogo } from "@/components/FichaClasse";
import {
  ataqueMagia,
  bonusPericia,
  bonusProficiencia,
  bonusResistencia,
  cdMagia,
  formatarMetros,
  modificador,
  nivelTotal,
  percepcaoPassiva,
  PERICIAS,
  pvAoSubir,
  somaModificadores,
} from "@/lib/regras";
import { CampoNumero } from "@/components/CampoNumero";
import { SecaoRecolhivel } from "@/components/SecaoRecolhivel";
import { SubirDeNivel } from "@/components/SubirDeNivel";

const ATRIBUTOS: { chave: Atributo; sigla: string; nome: string }[] = [
  { chave: "for", sigla: "FOR", nome: "Força" },
  { chave: "des", sigla: "DES", nome: "Destreza" },
  { chave: "con", sigla: "CON", nome: "Constituição" },
  { chave: "int", sigla: "INT", nome: "Inteligência" },
  { chave: "sab", sigla: "SAB", nome: "Sabedoria" },
  { chave: "car", sigla: "CAR", nome: "Carisma" },
];

const CAMPO_SAVE: Record<Atributo, "save_str" | "save_dex" | "save_con" | "save_int" | "save_wis" | "save_cha"> = {
  for: "save_str",
  des: "save_dex",
  con: "save_con",
  int: "save_int",
  sab: "save_wis",
  car: "save_cha",
};

function sinal(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

function Tile({
  rotulo,
  valor,
  cartao,
  termo,
  onUsar,
}: {
  rotulo: string;
  valor: string | number;
  /** Valor que está no cartão de combate lá em cima, quando é outro. */
  cartao?: string;
  termo: string;
  onUsar?: () => void;
}) {
  return (
    <div className="fj-tile">
      <div className="fj-tilen">{valor}</div>
      <span className="fj-tilel">{rotulo}</span>
      {cartao !== undefined && (
        <span className="fj-tilec">
          {termo} {cartao}
          {onUsar && (
            <>
              {" · "}
              <button type="button" className="minilink" onClick={onUsar}>
                usar
              </button>
            </>
          )}
        </span>
      )}
    </div>
  );
}

/** A ficha do jogador no desenho clássico (discos de atributo, resistências e
 *  perícias que se calculam sozinhas, o que muda no próximo nível), na paleta
 *  do app. Só mostra e edita atributos/proficiências: as contas são todas de
 *  regras.ts, e o que calcula é SUGESTÃO — o cartão de combate (CA, saves, PP,
 *  CD) continua mandando, porque item mágico soma por cima da fórmula; cada
 *  diferença vira "cartão N · usar". */
export function FichaClassicaJogador({
  personagem: p,
  editavel,
  patch,
  sala,
  modo = "mestre",
}: {
  personagem: Personagem;
  editavel: boolean;
  patch: (mudanca: Partial<Personagem>) => void;
  /** Pra subir de nível gravando com log e desfazer (sem ela, o botão não aparece). */
  sala?: Sala;
  /** "jogador": a folha é a ficha principal de quem joga — CA, iniciativa e
   *  deslocamento já estão editáveis logo acima (não repete), e o "cartão" de
   *  combate é chamado de "resumo", que é o que o Mestre enxerga. */
  modo?: "mestre" | "jogador";
}) {
  const doJogador = modo === "jogador";
  const termoCartao = doJogador ? "resumo" : "cartão";
  // `??`: janela entre publicar este código e rodar as migrations 0013/0014.
  const atributos = p.atributos ?? { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 };
  const proficiencias = p.proficiencias ?? { saves: [], pericias: {} };
  const classes = p.classes ?? [];
  const modificadores = p.modificadores ?? [];
  // O que cada classe ganha por nível baixa à parte (ver useCatalogoClasses).
  const catalogoClasses = useCatalogoClasses();

  const nivel = nivelTotal(classes);
  const prof = bonusProficiencia(nivel);
  const conjuradoras = classes.filter((c) => c.conjurador !== "nenhum" && c.atributo_conjuracao);
  const modCon = modificador(atributos.con);

  const ppCalculado = percepcaoPassiva(atributos, proficiencias, nivel) + somaModificadores(modificadores, "pp");
  const saves = ATRIBUTOS.map((a) => ({
    ...a,
    calculado: bonusResistencia(atributos, proficiencias, nivel, a.chave),
    cartao: p[CAMPO_SAVE[a.chave]],
    proficiente: proficiencias.saves.includes(a.chave),
  }));
  const conjuracao = conjuradoras.map((c) => {
    const cd = cdMagia(atributos, nivel, c.atributo_conjuracao);
    const ataque = ataqueMagia(atributos, nivel, c.atributo_conjuracao);
    return {
      nome: NOME_CLASSE[c.classe],
      // Modificador de CD não entra no ataque (ver FichaClasse/regras): a
      // Feitiçaria Inata sobe a CD e dá vantagem no ataque, não +1 de acerto.
      cd: cd === null ? null : cd + somaModificadores(modificadores, "cd_magia"),
      ataque: ataque === null ? null : ataque + somaModificadores(modificadores, "ataque_magia"),
    };
  });

  // Tudo que o cálculo discorda do cartão, pra "usar todos" de uma vez só.
  const diferencas: Record<string, number> = {};
  for (const s of saves) if (s.calculado !== s.cartao) diferencas[CAMPO_SAVE[s.chave]] = s.calculado;
  if (ppCalculado !== p.pp) diferencas.pp = ppCalculado;
  if (conjuracao.length === 1 && conjuracao[0].cd !== null && conjuracao[0].cd !== p.spell_dc) {
    diferencas.spell_dc = conjuracao[0].cd;
  }
  const qtdDiferencas = Object.keys(diferencas).length;

  function alternarSave(chave: Atributo) {
    const lista = proficiencias.saves.includes(chave)
      ? proficiencias.saves.filter((a) => a !== chave)
      : [...proficiencias.saves, chave];
    patch({ proficiencias: { ...proficiencias, saves: lista } });
  }

  function mudarPericia(chave: Pericia, para: NivelProficiencia) {
    const pericias = { ...proficiencias.pericias };
    if (para === "nenhuma") delete pericias[chave];
    else pericias[chave] = para;
    patch({ proficiencias: { ...proficiencias, pericias } });
  }

  const totalComProficiencia = PERICIAS.filter((info) => (proficiencias.pericias[info.chave] ?? "nenhuma") !== "nenhuma").length;

  const textoClasses = classes.map((c) => `${NOME_CLASSE[c.classe]} ${c.nivel}`).join(" · ");

  return (
    <div className="fj">
      <div className="fj-idcard">
        <div>
          <span className="fj-lbl">Classe</span>
          <span className="fj-val">{textoClasses || p.cls || "—"}</span>
        </div>
        <div>
          <span className="fj-lbl">Nível</span>
          <span className="fj-val mono">{nivel || "—"}</span>
        </div>
        <div>
          <span className="fj-lbl">Proficiência</span>
          <span className="fj-val mono">{nivel ? sinal(prof) : "—"}</span>
        </div>
      </div>
      {classes.length === 0 && (
        <p className="empty-note">
          {editavel
            ? "Sem classe cadastrada — cadastre em “Classe e conjuração”, logo abaixo, pra tudo aqui calcular."
            : "Sem classe cadastrada."}
        </p>
      )}

      {classes.map((c, i) => {
        if (c.nivel >= 20) return null;
        const novas = catalogoClasses.catalogo?.habilidadesDoNivel(c.classe, c.nivel + 1) ?? null;
        const pv = classes.length === 1 ? pvAoSubir(p.hd_die, modCon) : null;
        return (
          <div key={i} className="fj-proximo">
            <SecaoRecolhivel
              abertoInicial={false}
              titulo={
                <h4>
                  Próximo nível · {NOME_CLASSE[c.classe]} {c.nivel + 1}
                </h4>
              }
            >
              {novas === null ? (
                <AvisoCatalogo falhou={catalogoClasses.falhou} tentarDeNovo={catalogoClasses.tentarDeNovo} />
              ) : novas.length === 0 ? (
                <p className="fc-sub">Sem característica nova de classe nesse nível — confira o livro.</p>
              ) : (
                novas.map((h) => (
                  <div key={h.nome} className="fc-habilidade">
                    <h5>{h.nome}</h5>
                    <p>{h.descricao}</p>
                  </div>
                ))
              )}
              {pv !== null && (
                <p className="fc-sub">
                  PV ao subir: {sinal(pv)} (valor fixo do {p.hd_die} {sinal(modCon)} de Constituição)
                  {sala && editavel ? "." : " — some à mão no PV máximo, lá em cima."}
                </p>
              )}
              {sala && editavel && <SubirDeNivel personagem={p} indiceClasse={i} habilidadesNovas={novas ?? []} sala={sala} />}
            </SecaoRecolhivel>
          </div>
        );
      })}

      {nivel > 0 && (
        <>
          <div className="fj-tiles">
            {/* Os três de cima da folha de papel. Só leitura: edita-se no
                cartão de combate, que é onde mudam durante a luta. */}
            {!doJogador && (
              <>
                <Tile rotulo="CA" valor={p.ac} termo={termoCartao} />
                <Tile rotulo="Iniciativa" valor={sinal(p.init_mod)} termo={termoCartao} />
                <Tile rotulo="Deslocamento" valor={formatarMetros(p.speed)} termo={termoCartao} />
              </>
            )}
            <Tile
              termo={termoCartao}
              rotulo="Perc. passiva"
              valor={ppCalculado}
              cartao={ppCalculado !== p.pp ? String(p.pp) : undefined}
              onUsar={editavel ? () => patch({ pp: ppCalculado }) : undefined}
            />
            {conjuracao.map((c, i) => {
              const sufixo = conjuracao.length > 1 ? ` · ${c.nome}` : "";
              return [
                c.cd !== null && (
                  <Tile
                    key={`cd${i}`}
                    termo={termoCartao}
                    rotulo={`CD de magia${sufixo}`}
                    valor={c.cd}
                    cartao={c.cd !== p.spell_dc ? (p.spell_dc === null ? "—" : String(p.spell_dc)) : undefined}
                    onUsar={editavel ? () => patch({ spell_dc: c.cd as number }) : undefined}
                  />
                ),
                c.ataque !== null && <Tile key={`atq${i}`} termo={termoCartao} rotulo={`Ataque de magia${sufixo}`} valor={sinal(c.ataque)} />,
              ];
            })}
          </div>
          {editavel && qtdDiferencas > 0 && (
            <p className="fj-nota">
              {doJogador ? "O resumo que o Mestre vê" : "O cartão de combate"} tem{" "}
              {qtdDiferencas === 1 ? "1 valor" : `${qtdDiferencas} valores`} diferente
              {qtdDiferencas === 1 ? "" : "s"} do calculado (resistências, percepção, CD).{" "}
              <button type="button" className="minilink" onClick={() => patch(diferencas as Partial<Personagem>)}>
                usar {qtdDiferencas === 1 ? "o calculado" : "todos os calculados"}
              </button>
            </p>
          )}
        </>
      )}

      {/* Arranjo da folha de papel: cada atributo é uma caixa (modificador
          grande, valor embaixo) e, ao lado, a resistência e as perícias dele. */}
      <SecaoRecolhivel
        titulo={<h4>Atributos, resistências e perícias</h4>}
        cabecalhoExtra={
          <span className="fc-sub">
            {totalComProficiencia === 0
              ? "nenhuma perícia com proficiência"
              : `${totalComProficiencia} ${totalComProficiencia === 1 ? "perícia" : "perícias"} com proficiência`}
          </span>
        }
      >
        <div className="fj-blocos-caixa">
        <div className="fj-blocos">
          {ATRIBUTOS.map((a) => {
            const s = saves.find((x) => x.chave === a.chave)!;
            return (
              <div key={a.chave} className="fj-bloco">
                <div className="fj-caixa">
                  <span className="fj-rotulo" title={a.nome}>
                    {a.sigla}
                  </span>
                  <span className="fj-mod">{sinal(modificador(atributos[a.chave]))}</span>
                  {editavel ? (
                    <CampoNumero
                      className="fj-score"
                      valor={atributos[a.chave]}
                      onCommit={(n) => patch({ atributos: { ...atributos, [a.chave]: Math.max(1, n) } })}
                    />
                  ) : (
                    <span className="fj-score">{atributos[a.chave]}</span>
                  )}
                </div>
                <ul className="fj-lista">
                  <li className={s.proficiente ? "prof" : ""}>
                    <button
                      type="button"
                      className={`fj-pip${s.proficiente ? " on" : ""}`}
                      aria-pressed={s.proficiente}
                      aria-label={`Proficiência em resistência de ${a.nome}`}
                      disabled={!editavel}
                      onClick={() => alternarSave(a.chave)}
                    />
                    <div className="fj-nomecol">
                      <button type="button" className="fj-nome" disabled={!editavel} onClick={() => alternarSave(a.chave)}>
                        Resistência
                      </button>
                      {s.calculado !== s.cartao && (
                        <span className="fj-dica">
                          {termoCartao} {sinal(s.cartao)}
                          {editavel && (
                            <>
                              {" · "}
                              <button
                                type="button"
                                className="minilink"
                                onClick={() => patch({ [CAMPO_SAVE[a.chave]]: s.calculado } as Partial<Personagem>)}
                              >
                                usar
                              </button>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <span className="fj-bonus mono">{sinal(s.calculado)}</span>
                  </li>
                  {PERICIAS.filter((info) => info.atributo === a.chave).map((info) => {
                    const nivelProf: NivelProficiencia = proficiencias.pericias[info.chave] ?? "nenhuma";
                    const proficiente = nivelProf !== "nenhuma";
                    const especialista = nivelProf === "especialista";
                    return (
                      <li key={info.chave} className={proficiente ? "prof" : ""}>
                        <button
                          type="button"
                          className={`fj-pip${proficiente ? " on" : ""}${especialista ? " dupla" : ""}`}
                          aria-pressed={proficiente}
                          aria-label={`Proficiência em ${info.nome}${especialista ? " (especialista)" : ""}`}
                          disabled={!editavel}
                          onClick={() => mudarPericia(info.chave, proficiente ? "nenhuma" : "proficiente")}
                        />
                        <div className="fj-nomecol">
                          <button
                            type="button"
                            className="fj-nome"
                            disabled={!editavel}
                            onClick={() => mudarPericia(info.chave, proficiente ? "nenhuma" : "proficiente")}
                          >
                            {info.nome}
                          </button>
                        </div>
                        {proficiente && editavel && (
                          <button
                            type="button"
                            className={`fj-esp${especialista ? " on" : ""}`}
                            aria-pressed={especialista}
                            aria-label={`Especialista em ${info.nome} (bônus de proficiência em dobro)`}
                            onClick={() => mudarPericia(info.chave, especialista ? "proficiente" : "especialista")}
                          >
                            ×2
                          </button>
                        )}
                        <span className="fj-bonus mono">
                          {sinal(bonusPericia(atributos, proficiencias, nivel, info.chave))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        </div>
        {editavel && <p className="fc-sub">Toque na resistência ou na perícia pra marcar proficiência; ×2 é especialista.</p>}
      </SecaoRecolhivel>
    </div>
  );
}
