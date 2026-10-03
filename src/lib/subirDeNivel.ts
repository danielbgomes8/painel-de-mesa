/**
 * Subir de nível — as regras puras: o que muda na ficha quando um personagem ganha
 * um nível de classe (PV, dado de vida, espaços de magia, aumento de atributo,
 * habilidades novas). A tela (`SubirDeNivel.tsx`) só pede as escolhas da pessoa,
 * mostra o resultado e grava o `patch` que sai daqui.
 *
 * Regras de 2024 (SRD 5.2). Dado de vida e níveis de aumento de atributo conferidos na
 * fonte (open5e, srd-2024) em 02/10/2026 — o catálogo de habilidades do app só marca o
 * Aprimoramento de Atributo no nível 4 (a descrição diz "de novo nos 8, 12 e 16"), então
 * os níveis moram numa tabela própria aqui, com teste.
 *
 * Tudo é sugestão calculada que a pessoa confirma: o cartão de combate continua mandando
 * (CA, CD, resistências...) e a tela avisa quando a proficiência sobe.
 */
import { NOME_CLASSE } from "./classesNomes";
import type { HabilidadeClasse } from "./classesSrd";
import { bonusProficiencia, espacosDeMagia, modificador, nivelTotal, PREFIXO_ESPACO_MAGIA } from "./regras";
import type { Atributo, Atributos, ClasseBase, ClassePersonagem, Personagem, Recurso, SecaoFicha } from "./tipos";

export const NIVEL_MAXIMO = 20;
export const ATRIBUTO_MAXIMO = 20;

/** Faces do dado de vida de cada classe (SRD 5.2). */
export const DADO_DE_VIDA: Record<ClasseBase, number> = {
  barbaro: 12,
  bardo: 8,
  bruxo: 8,
  clerigo: 8,
  druida: 8,
  feiticeiro: 6,
  guerreiro: 10,
  ladino: 8,
  mago: 6,
  monge: 8,
  paladino: 10,
  patrulheiro: 10,
};

const NIVEIS_DE_ATRIBUTO_PADRAO = [4, 8, 12, 16];
const NIVEIS_DE_ATRIBUTO: Partial<Record<ClasseBase, number[]>> = {
  guerreiro: [4, 6, 8, 12, 14, 16],
  ladino: [4, 8, 10, 12, 16],
};
/** No nível 19 toda classe ganha a Dádiva Épica (um talento). */
export const NIVEL_DA_DADIVA_EPICA = 19;

export function ganhaAumentoDeAtributo(classe: ClasseBase, nivelDaClasse: number): boolean {
  return (NIVEIS_DE_ATRIBUTO[classe] ?? NIVEIS_DE_ATRIBUTO_PADRAO).includes(nivelDaClasse);
}

export type EscolhaPV = { tipo: "fixo" } | { tipo: "rolado"; valor: number };
export type EscolhaAtributos =
  | { tipo: "atributos"; aumentos: Partial<Record<Atributo, number>> }
  | { tipo: "talento" };

export type PedidoSubida = {
  /** Qual classe da ficha ganha o nível (índice em `classes`). */
  indiceClasse: number;
  pv: EscolhaPV;
  /** Obrigatório nos níveis em que a classe ganha aumento de atributo. */
  atributos?: EscolhaAtributos;
  /** Copia as habilidades novas pra ficha completa. */
  anotarHabilidades: boolean;
};

export type EstadoSubida = Pick<
  Personagem,
  "name" | "classes" | "atributos" | "hp" | "hp_max" | "hd_max" | "hd_cur" | "hd_die" | "resources" | "ficha_secoes"
>;

export type ResultadoSubida =
  | {
      ok: true;
      /** Só as colunas que mudam, prontas pro `patch`. */
      patch: Partial<Personagem>;
      /** Linha pro log do combate (é pública). */
      textoLog: string;
      /** O que mudou, uma frase por item, pra mostrar na confirmação. */
      linhas: string[];
      /** O que a pessoa ainda precisa fazer à mão. */
      avisos: string[];
    }
  | { ok: false; motivo: string };

/** PV de um nível: o valor do dado (fixo ou rolado) mais Constituição, no mínimo 1 (regra de 2024). */
export function pvDoNivel(faces: number, escolha: EscolhaPV, modCon: number): number | null {
  if (escolha.tipo === "rolado") {
    if (!Number.isInteger(escolha.valor) || escolha.valor < 1 || escolha.valor > faces) return null;
    return Math.max(1, escolha.valor + modCon);
  }
  return Math.max(1, Math.floor(faces / 2) + 1 + modCon);
}

/** O aumento de atributo escolhido vale? +2 em um ou +1 em dois, ninguém passa de 20. */
export function validarAumentos(
  atributos: Atributos,
  aumentos: Partial<Record<Atributo, number>>,
): { ok: true; novos: Atributos } | { ok: false; motivo: string } {
  const entradas = (Object.entries(aumentos) as [Atributo, number][]).filter(([, n]) => n !== 0);
  const total = entradas.reduce((s, [, n]) => s + n, 0);
  if (entradas.some(([, n]) => !Number.isInteger(n) || n < 0 || n > 2)) {
    return { ok: false, motivo: "O aumento de atributo é +2 em um atributo ou +1 em dois." };
  }
  if (total !== 2) return { ok: false, motivo: "Distribua os 2 pontos do aumento de atributo (+2 em um ou +1 em dois)." };
  const novos = { ...atributos };
  for (const [a, n] of entradas) {
    if (atributos[a] + n > ATRIBUTO_MAXIMO) {
      return { ok: false, motivo: `Nenhum atributo passa de ${ATRIBUTO_MAXIMO} (${a.toUpperCase()} já está em ${atributos[a]}).` };
    }
    novos[a] = atributos[a] + n;
  }
  return { ok: true, novos };
}

const geradas = (r: Recurso) => r.name.startsWith(PREFIXO_ESPACO_MAGIA);

/**
 * Espaços de magia depois do nível. Só mexe nos recursos "Espaço de magia Nv. N" (os que a
 * calculadora gera) e só quando há UMA classe conjuradora: o que sobe vai pro máximo e o que já
 * estava gasto continua gasto. Com mais de uma conjuradora a tabela é a de multiclasse e a conta
 * fica pra pessoa. Devolve null quando não há o que mudar.
 */
function atualizarEspacos(
  recursos: Recurso[],
  classes: ClassePersonagem[],
  indice: number,
): { recursos: Recurso[]; linha: string | null; aviso: string | null } | null {
  const conjuradoras = classes.filter((c) => c.conjurador !== "nenhum" && c.atributo_conjuracao);
  if (conjuradoras.length > 1) {
    return {
      recursos,
      linha: null,
      aviso: "Mais de uma classe conjuradora: confira os espaços de magia à mão (tabela de multiclasse).",
    };
  }
  const classe = classes[indice];
  if (conjuradoras.length !== 1 || conjuradoras[0] !== classe) return null;

  const existentes = recursos.filter(geradas);
  const novos = espacosDeMagia(classe.conjurador, classe.nivel);
  if (novos.length === 0) return null;
  if (existentes.length === 0) {
    return { recursos, linha: null, aviso: "Gere os espaços de magia em “Classe e conjuração” (ainda não há nenhum na ficha)." };
  }

  const porNivel = (n: number) => existentes.find((r) => r.name === `${PREFIXO_ESPACO_MAGIA}${n}`);
  const montados: Recurso[] = novos.map((e) => {
    const antigo = porNivel(e.nivel);
    const cur = antigo ? Math.min(e.max, antigo.cur + Math.max(0, e.max - antigo.max)) : e.max;
    return { name: `${PREFIXO_ESPACO_MAGIA}${e.nivel}`, max: e.max, cur, short_rest: classe.conjurador === "pacto" };
  });
  const iguais = JSON.stringify(montados) === JSON.stringify(existentes);
  if (iguais) return null;
  const resumo = novos.map((e) => `${e.nivel}º ${e.max}`).join(" · ");
  return {
    recursos: [...recursos.filter((r) => !geradas(r)), ...montados],
    linha: `Espaços de magia: ${resumo}`,
    aviso: null,
  };
}

function anotarNaFicha(secoes: SecaoFicha[], classe: ClasseBase, nivelDaClasse: number, novas: HabilidadeClasse[]): SecaoFicha[] {
  const titulo = `Habilidades de ${NOME_CLASSE[classe]}`;
  const itens = novas.map((h) => ({ titulo: h.nome, tag: `Nv. ${nivelDaClasse}`, descricao: h.descricao.slice(0, 1200) }));
  const i = secoes.findIndex((s) => s.tipo === "lista" && s.titulo === titulo);
  if (i === -1) return [...secoes, { titulo, tipo: "lista", itens }];
  const atual = secoes[i].itens ?? [];
  const novos = itens.filter((n) => !atual.some((a) => a.titulo === n.titulo && a.tag === n.tag));
  if (novos.length === 0) return secoes;
  return secoes.map((s, idx) => (idx === i ? { ...s, itens: [...atual, ...novos] } : s));
}

/**
 * Sobe um nível da classe `pedido.indiceClasse`. `habilidadesNovas` são as da classe nesse nível
 * (do catálogo, que baixa à parte — vazio se ainda não baixou).
 */
export function subirDeNivel(p: EstadoSubida, pedido: PedidoSubida, habilidadesNovas: HabilidadeClasse[] = []): ResultadoSubida {
  const classe = p.classes[pedido.indiceClasse];
  if (!classe) return { ok: false, motivo: "Essa classe não está na ficha." };
  const totalAntes = nivelTotal(p.classes);
  if (totalAntes >= NIVEL_MAXIMO) return { ok: false, motivo: `O personagem já está no nível ${NIVEL_MAXIMO}.` };
  if (classe.nivel >= NIVEL_MAXIMO) return { ok: false, motivo: `${NOME_CLASSE[classe.classe]} já está no nível ${NIVEL_MAXIMO}.` };

  const novoNivelDaClasse = classe.nivel + 1;
  const totalDepois = totalAntes + 1;
  const linhas: string[] = [];
  const avisos: string[] = [];
  const patch: Partial<Personagem> = {};

  // Atributos (antes dos PV: o modificador novo de Constituição vale já neste nível).
  let atributos = p.atributos;
  const pedeAtributo = ganhaAumentoDeAtributo(classe.classe, novoNivelDaClasse);
  if (pedeAtributo) {
    if (!pedido.atributos) return { ok: false, motivo: "Escolha o aumento de atributo ou o talento deste nível." };
    if (pedido.atributos.tipo === "atributos") {
      const v = validarAumentos(p.atributos, pedido.atributos.aumentos);
      if (!v.ok) return v;
      atributos = v.novos;
      patch.atributos = atributos;
      const texto = (Object.entries(pedido.atributos.aumentos) as [Atributo, number][])
        .filter(([, n]) => n > 0)
        .map(([a, n]) => `${a.toUpperCase()} +${n} (${p.atributos[a]} → ${atributos[a]})`)
        .join(", ");
      linhas.push(`Atributos: ${texto}`);
    } else {
      avisos.push("Anote o talento escolhido na ficha completa (o app não sabe os efeitos dele).");
    }
  }
  if (novoNivelDaClasse === NIVEL_DA_DADIVA_EPICA) avisos.push("Nível 19: escolha uma Dádiva Épica e anote na ficha completa.");

  // Classes
  patch.classes = p.classes.map((c, i) => (i === pedido.indiceClasse ? { ...c, nivel: novoNivelDaClasse } : c));
  linhas.unshift(
    `Nível ${totalDepois}: ${NOME_CLASSE[classe.classe]} ${novoNivelDaClasse}${p.classes.length > 1 ? ` (de ${p.classes.length} classes)` : ""}`,
  );

  // PV: o do nível novo (com a Constituição nova) e, se a Constituição subiu de modificador, o
  // retroativo de todos os níveis de antes (regra: +1 PV por nível por ponto de modificador).
  const faces = DADO_DE_VIDA[classe.classe];
  const modConAntes = modificador(p.atributos.con);
  const modConDepois = modificador(atributos.con);
  const doNivel = pvDoNivel(faces, pedido.pv, modConDepois);
  if (doNivel === null) return { ok: false, motivo: `O valor rolado tem de ser de 1 a ${faces} (d${faces}).` };
  const retroativo = (modConDepois - modConAntes) * totalAntes;
  const ganho = doNivel + retroativo;
  patch.hp_max = p.hp_max + ganho;
  // PV atual acompanha o máximo, menos pra quem está a 0 (caído): o nível não levanta ninguém.
  patch.hp = p.hp > 0 ? Math.min(patch.hp_max, p.hp + ganho) : p.hp;
  const como = pedido.pv.tipo === "rolado" ? `rolou ${pedido.pv.valor}` : `valor fixo ${Math.floor(faces / 2) + 1}`;
  linhas.push(`PV máximo +${ganho} (${como} no d${faces}, Constituição ${modConDepois >= 0 ? "+" : "−"}${Math.abs(modConDepois)}${retroativo !== 0 ? `, mais ${retroativo} dos níveis anteriores` : ""}) → ${patch.hp_max}`);

  // Dado de vida: mais um. Com uma classe só, o dado do personagem é o da classe.
  patch.hd_max = p.hd_max + 1;
  patch.hd_cur = Math.min(patch.hd_max, p.hd_cur + 1);
  if (p.classes.length === 1) patch.hd_die = `d${faces}`;
  linhas.push(`Dados de vida: ${patch.hd_max} × d${faces}`);

  if (bonusProficiencia(totalDepois) !== bonusProficiencia(totalAntes)) {
    linhas.push(`Bônus de proficiência: +${bonusProficiencia(totalDepois)}`);
    avisos.push("A proficiência subiu: confira os valores calculados (resistências, percepção, CD de magia) e use “usar o calculado”.");
  }

  // Espaços de magia
  const depoisDasClasses = patch.classes;
  const espacos = atualizarEspacos(p.resources, depoisDasClasses, pedido.indiceClasse);
  if (espacos) {
    if (espacos.recursos !== p.resources) patch.resources = espacos.recursos;
    if (espacos.linha) linhas.push(espacos.linha);
    if (espacos.aviso) avisos.push(espacos.aviso);
  }

  // Habilidades novas
  if (habilidadesNovas.length > 0) {
    linhas.push(`Habilidades novas: ${habilidadesNovas.map((h) => h.nome).join(", ")}`);
    if (pedido.anotarHabilidades) patch.ficha_secoes = anotarNaFicha(p.ficha_secoes ?? [], classe.classe, novoNivelDaClasse, habilidadesNovas);
  }

  return {
    ok: true,
    patch,
    textoLog: `${p.name} subiu para o nível ${totalDepois} (${NOME_CLASSE[classe.classe]} ${novoNivelDaClasse})`,
    linhas,
    avisos,
  };
}
