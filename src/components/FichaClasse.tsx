"use client";

import { useState } from "react";
import type {
  Atributo,
  CampoModificavel,
  ClasseBase,
  ClassePersonagem,
  Modificador,
  Personagem,
  TipoConjurador,
} from "@/lib/tipos";
import { NOME_CLASSE, habilidadesMulticlasse } from "@/lib/classesSrd";
import { bonusProficiencia, espacosDeMagia, nivelTotal, PREFIXO_ESPACO_MAGIA } from "@/lib/regras";
import { CampoNumero } from "@/components/CampoNumero";
import { BotaoRemover } from "@/components/BotaoRemover";
import { SecaoRecolhivel } from "@/components/SecaoRecolhivel";

const ATRIBUTOS: { chave: Atributo; nome: string }[] = [
  { chave: "for", nome: "Força" },
  { chave: "des", nome: "Destreza" },
  { chave: "con", nome: "Constituição" },
  { chave: "int", nome: "Inteligência" },
  { chave: "sab", nome: "Sabedoria" },
  { chave: "car", nome: "Carisma" },
];

const TIPOS_CONJURADOR: { valor: TipoConjurador; nome: string }[] = [
  { valor: "nenhum", nome: "Não conjura" },
  { valor: "terco", nome: "Terço (Cavaleiro Arcano, Trapaceiro Arcano)" },
  { valor: "meio", nome: "Meio (Paladino, Patrulheiro)" },
  { valor: "completo", nome: "Completo (Bardo, Clérigo, Druida, Feiticeiro, Mago)" },
  { valor: "pacto", nome: "Pacto de magia (Bruxo)" },
];

const CLASSES_BASE = (Object.keys(NOME_CLASSE) as ClasseBase[]).map((valor) => ({ valor, nome: NOME_CLASSE[valor] }));


function sinal(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Configuração de classe da ficha: classes e conjuração, espaços de magia,
 *  modificadores que ligam/desligam e as habilidades por nível. Os atributos,
 *  as resistências, as perícias e os valores calculados (PP, CD, ataque de
 *  magia) moram em FichaClassicaJogador, logo acima — que calcula como
 *  sugestão, nunca sobrescreve o cartão de combate sozinha. */
export function FichaClasse({
  personagem: p,
  editavel,
  patch,
}: {
  personagem: Personagem;
  editavel: boolean;
  patch: (mudanca: Partial<Personagem>) => void;
}) {
  // `??`: janela entre publicar este código e rodar a migration 0013/0014.
  const classes = p.classes ?? [];
  const modificadores = p.modificadores ?? [];

  const nivel = nivelTotal(classes);
  const conjuradoras = classes.filter((c) => c.conjurador !== "nenhum" && c.atributo_conjuracao);

  const habilidades = habilidadesMulticlasse(classes);

  function patchClasse(i: number, mudanca: Partial<ClassePersonagem>) {
    patch({
      classes: classes.map((c, idx) => {
        if (idx !== i) return c;
        const atualizada = { ...c, ...mudanca };
        if (atualizada.conjurador === "nenhum") atualizada.atributo_conjuracao = null;
        return atualizada;
      }),
    });
  }

  function adicionarClasse() {
    const nova: ClassePersonagem = { classe: "barbaro", nivel: 1, conjurador: "nenhum", atributo_conjuracao: null };
    patch({ classes: [...classes, nova] });
  }

  function removerClasse(i: number) {
    patch({ classes: classes.filter((_, idx) => idx !== i) });
  }

  function gerarEspacos() {
    if (conjuradoras.length !== 1) return;
    const conjuradora = conjuradoras[0];
    const gerados = espacosDeMagia(conjuradora.conjurador, conjuradora.nivel);
    if (gerados.length === 0) return;
    if (!confirm("Substituir os espaços de magia gerados antes (se houver) pelos calculados agora?")) return;
    const preservados = p.resources.filter((r) => !r.name.startsWith(PREFIXO_ESPACO_MAGIA));
    const novos = gerados.map((e) => ({
      name: `${PREFIXO_ESPACO_MAGIA}${e.nivel}`,
      max: e.max,
      cur: e.max,
      short_rest: conjuradora.conjurador === "pacto",
    }));
    patch({ resources: [...preservados, ...novos] });
  }

  function alternarModificador(i: number) {
    patch({ modificadores: modificadores.map((m, idx) => (idx === i ? { ...m, ativo: !m.ativo } : m)) });
  }

  function removerModificador(i: number) {
    patch({ modificadores: modificadores.filter((_, idx) => idx !== i) });
  }

  // Reaproveita um modificador já cadastrado com o mesmo nome em vez de
  // duplicar — "+ ativar agora" clicado duas vezes (ou dois aparelhos quase
  // juntos) não deve empilhar dois "Feitiçaria Inata".
  function adicionarModificador(m: Modificador) {
    const existente = modificadores.findIndex((x) => x.nome === m.nome);
    if (existente === -1) {
      patch({ modificadores: [...modificadores, m] });
      return;
    }
    patch({ modificadores: modificadores.map((x, idx) => (idx === existente ? m : x)) });
  }

  return (
    <div className="fichaclasse">
      <SecaoRecolhivel titulo={<h4>Classe e conjuração</h4>}>
        {classes.length > 0 && (
          <p className="fc-sub">
            Nível total {nivel} · proficiência {sinal(bonusProficiencia(nivel))}
          </p>
        )}
        <div className="fc-classes">
          {classes.length === 0 && <p className="empty-note">Nenhuma classe cadastrada.</p>}
          {classes.map((c, i) => (
            <div key={i} className="fc-classerow">
              {editavel ? (
                <>
                  <select value={c.classe} onChange={(e) => patchClasse(i, { classe: e.target.value as ClasseBase })}>
                    {CLASSES_BASE.map((cb) => (
                      <option key={cb.valor} value={cb.valor}>
                        {cb.nome}
                      </option>
                    ))}
                  </select>
                  <CampoNumero
                    className="num"
                    valor={c.nivel}
                    onCommit={(n) => patchClasse(i, { nivel: Math.min(20, Math.max(1, n)) })}
                  />
                  <select value={c.conjurador} onChange={(e) => patchClasse(i, { conjurador: e.target.value as TipoConjurador })}>
                    {TIPOS_CONJURADOR.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                  {c.conjurador !== "nenhum" && (
                    <select
                      value={c.atributo_conjuracao ?? ""}
                      onChange={(e) => patchClasse(i, { atributo_conjuracao: (e.target.value || null) as Atributo | null })}
                    >
                      <option value="">atributo de conjuração</option>
                      {ATRIBUTOS.map((a) => (
                        <option key={a.chave} value={a.chave}>
                          {a.nome}
                        </option>
                      ))}
                    </select>
                  )}
                  <BotaoRemover aria={`remover classe ${CLASSES_BASE.find((cb) => cb.valor === c.classe)?.nome}`} onConfirmar={() => removerClasse(i)} />
                </>
              ) : (
                <span>
                  {CLASSES_BASE.find((cb) => cb.valor === c.classe)?.nome} {c.nivel}
                </span>
              )}
            </div>
          ))}
          {editavel && (
            <button type="button" className="minilink" onClick={adicionarClasse}>
              + classe
            </button>
          )}
        </div>
      </SecaoRecolhivel>

      {conjuradoras.length === 1 && editavel && (
        <SecaoRecolhivel titulo={<h4>Espaços de magia</h4>}>
          <button type="button" className="btn" onClick={gerarEspacos}>
            gerar espaços de magia (nível {conjuradoras[0].nivel} de {CLASSES_BASE.find((cb) => cb.valor === conjuradoras[0].classe)?.nome})
          </button>
          <p className="fc-sub">Entram em Recursos, com pips clicáveis igual Fúria/Ki.</p>
        </SecaoRecolhivel>
      )}
      {conjuradoras.length > 1 && (
        <SecaoRecolhivel titulo={<h4>Espaços de magia</h4>}>
          <p className="fc-sub">
            Mais de uma classe conjurando ao mesmo tempo ainda não calcula sozinho — cadastre os espaços à mão em Recursos, como sempre foi.
          </p>
        </SecaoRecolhivel>
      )}

      <SecaoRecolhivel
        titulo={<h4>Modificadores</h4>}
        cabecalhoExtra={<span className="fc-sub">Bônus que liga/desliga (ex.: Feitiçaria Inata)</span>}
      >
        {modificadores.length === 0 && <p className="empty-note">Nenhum cadastrado.</p>}
        <div className="fc-mods">
          {modificadores.map((m, i) => (
            <div key={i} className="fc-modrow">
              <button
                type="button"
                className={`chip flag${m.ativo ? " on" : ""}`}
                aria-pressed={m.ativo}
                disabled={!editavel}
                onClick={() => alternarModificador(i)}
              >
                {m.nome} · {NOME_CAMPO[m.campo]} {sinal(m.delta)}
              </button>
              {editavel && <BotaoRemover aria={`remover modificador ${m.nome}`} onConfirmar={() => removerModificador(i)} />}
            </div>
          ))}
        </div>
        {editavel && <FormModificador onAdicionar={adicionarModificador} />}
      </SecaoRecolhivel>

      {classes.map((c, indice) => {
        const habilidadesDaClasse = habilidades.filter((h) => h.classeIndice === indice);
        return (
          <SecaoRecolhivel key={indice} titulo={<h4>Habilidades de {CLASSES_BASE.find((cb) => cb.valor === c.classe)?.nome}</h4>}>
            {habilidadesDaClasse.length === 0 && <p className="empty-note">Nenhuma até o nível {c.nivel}.</p>}
            {habilidadesDaClasse.map((h, i) => (
              <div key={i} className="fc-habilidade">
                <div className="fc-itemhead">
                  <span className="fc-tag">Nv. {h.nivel}</span>
                  <h5>{h.nome}</h5>
                  {editavel && h.sugestaoModificador && (
                    <button
                      type="button"
                      className="minilink rm"
                      onClick={() =>
                        adicionarModificador({
                          nome: h.nome,
                          campo: h.sugestaoModificador!.campo,
                          delta: h.sugestaoModificador!.delta,
                          ativo: true,
                        })
                      }
                    >
                      + ativar agora
                    </button>
                  )}
                </div>
                <p>{h.descricao}</p>
              </div>
            ))}
          </SecaoRecolhivel>
        );
      })}
    </div>
  );
}

const NOME_CAMPO: Record<CampoModificavel, string> = {
  for: "Força",
  des: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  sab: "Sabedoria",
  car: "Carisma",
  cd_magia: "CD de magia",
  ataque_magia: "Ataque de magia",
  pp: "PP",
};

/** Formulário pra cadastrar um modificador novo — nome livre + campo que
 *  afeta + valor. Nasce desligado; o jogador liga quando a habilidade
 *  estiver ativa de verdade. */
function FormModificador({ onAdicionar }: { onAdicionar: (m: Modificador) => void }) {
  const [nome, setNome] = useState("");
  const [campo, setCampo] = useState<CampoModificavel>("cd_magia");
  const [delta, setDelta] = useState("");

  function adicionar() {
    const nomeLimpo = nome.trim();
    const d = Number.parseInt(delta, 10);
    if (!nomeLimpo || Number.isNaN(d) || d === 0) return;
    onAdicionar({ nome: nomeLimpo, campo, delta: d, ativo: false });
    setNome("");
    setDelta("");
  }

  return (
    <div className="addcombatant" style={{ marginTop: 8 }}>
      <input
        type="text"
        placeholder="nome (ex.: Feitiçaria Inata)"
        maxLength={40}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <select value={campo} onChange={(e) => setCampo(e.target.value as CampoModificavel)}>
        {Object.entries(NOME_CAMPO).map(([valor, nomeCampo]) => (
          <option key={valor} value={valor}>
            {nomeCampo}
          </option>
        ))}
      </select>
      <input
        className="num"
        type="number"
        inputMode="numeric"
        placeholder="valor (ex.: 1 ou -2)"
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") adicionar();
        }}
      />
      <button type="button" className="btn" onClick={adicionar}>
        + modificador
      </button>
    </div>
  );
}
