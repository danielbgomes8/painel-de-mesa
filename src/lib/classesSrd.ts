import type { CampoModificavel, ClasseBase } from "./tipos";

/**
 * Catálogo de habilidades de classe por nível — conferido contra o SRD 2024
 * (api.open5e.com/v2/classes, CC-BY-4.0, mesma disciplina do catálogo de
 * monstros em monstrosSrd.ts). Cobre só a classe BASE, sem subclasse: quem
 * escolhe Feiticeiro Dracônico ou Patrulheiro Caçador continua cadastrando
 * essas características à parte na ficha completa (seções), porque
 * subclasse multiplica o conteúdo por 3-4 pra cada classe.
 *
 * Populado por prioridade — Feiticeiro e Bárbaro primeiro (mesa toca essas
 * classes hoje). As outras 10 entram conforme alguém da mesa jogar.
 */
export type HabilidadeClasse = {
  classe: ClasseBase;
  nivel: number;
  nome: string;
  descricao: string;
  /** Quando a habilidade é um bônus que liga/desliga num número que a
   *  calculadora já soma (CD de magia, resistência, PP) — sugestão pronta
   *  pra virar Modificador com um clique, não obrigatória. */
  sugestaoModificador?: { campo: CampoModificavel; delta: number };
};

export const HABILIDADES_CLASSE: HabilidadeClasse[] = [
  {
    classe: "feiticeiro",
    nivel: 1,
    nome: "Conjuração",
    descricao: "Sabe truques e magias de Feiticeiro de cor, sem preparar — Carisma é o atributo de conjuração.",
  },
  {
    classe: "feiticeiro",
    nivel: 1,
    nome: "Feitiçaria Inata",
    descricao:
      "Ação bônus, 2 usos (voltam num descanso longo): por 1 minuto, CD de magia +1 e vantagem nos ataques de magia.",
    sugestaoModificador: { campo: "cd_magia", delta: 1 },
  },
  {
    classe: "feiticeiro",
    nivel: 2,
    nome: "Fonte de Magia",
    descricao:
      "Ganha Pontos de Feitiçaria (cadastre em Recursos) — usa pra criar espaço de magia ou pagar Metamagia. Reseta num descanso longo.",
  },
  {
    classe: "feiticeiro",
    nivel: 2,
    nome: "Metamagia",
    descricao: "Escolhe 2 opções pra modificar magias ao custo de Pontos de Feitiçaria (mais 2 no nível 10).",
  },
  {
    classe: "feiticeiro",
    nivel: 3,
    nome: "Subclasse de Feiticeiro",
    descricao: "Escolhe a origem mágica (Dracônica, Selvagem...) — as características dela ficam na ficha completa.",
  },
  {
    classe: "feiticeiro",
    nivel: 4,
    nome: "Aprimoramento de Atributo",
    descricao: "Ganha um feito ou +2 em atributos (de novo nos níveis 8, 12 e 16).",
  },
  {
    classe: "feiticeiro",
    nivel: 5,
    nome: "Restauração Feiticeira",
    descricao:
      "Num descanso curto, recupera Pontos de Feitiçaria até metade do nível de Feiticeiro (arredondado pra baixo). 1x por descanso longo.",
  },
  {
    classe: "feiticeiro",
    nivel: 7,
    nome: "Feitiçaria Encarnada",
    descricao:
      "Sem usos de Feitiçaria Inata sobrando, ativa gastando 2 Pontos de Feitiçaria. Enquanto ativa, usa até 2 Metamagias na mesma magia.",
  },
  {
    classe: "feiticeiro",
    nivel: 19,
    nome: "Dádiva Épica",
    descricao: "Ganha um feito épico.",
  },
  {
    classe: "feiticeiro",
    nivel: 20,
    nome: "Apoteose Arcana",
    descricao: "Enquanto Feitiçaria Inata está ativa, usa uma Metamagia de graça em cada turno.",
  },
  {
    classe: "barbaro",
    nivel: 1,
    nome: "Fúria",
    descricao:
      "Ação bônus (sem armadura pesada): resistência a dano cortante/perfurante/contundente e bônus de dano corpo a corpo com Força. Usos por nível — cadastre em Recursos. Recupera 1 uso no descanso curto, todos no longo.",
  },
  {
    classe: "barbaro",
    nivel: 1,
    nome: "Defesa sem Armadura",
    descricao: "Sem armadura, CA = 10 + Destreza + Constituição. Pode usar escudo e manter o benefício.",
  },
  {
    classe: "barbaro",
    nivel: 1,
    nome: "Maestria em Armas",
    descricao: "Usa a propriedade de maestria de 2 tipos de arma corpo a corpo simples/marcial — troca ao final de um descanso longo.",
  },
  {
    classe: "barbaro",
    nivel: 2,
    nome: "Sentido de Perigo",
    descricao: "Vantagem em resistência de Destreza, exceto se Incapacitado.",
  },
  {
    classe: "barbaro",
    nivel: 2,
    nome: "Ataque Imprudente",
    descricao: "No primeiro ataque do turno, pode trocar: vantagem nos seus ataques de Força até o início do próximo turno, mas os ataques contra você também têm vantagem.",
  },
  {
    classe: "barbaro",
    nivel: 3,
    nome: "Conhecimento Primordial",
    descricao: "Ganha proficiência em mais uma perícia da lista do Bárbaro. Em Fúria, pode rolar Acrobacia, Furtividade, Intimidação, Percepção ou Sobrevivência como teste de Força.",
  },
  {
    classe: "barbaro",
    nivel: 3,
    nome: "Subclasse de Bárbaro",
    descricao: "Escolhe o caminho (Berserker, Coração Selvagem, Árvore-Mundo, Fanático...) — as características dele ficam na ficha completa.",
  },
  {
    classe: "barbaro",
    nivel: 4,
    nome: "Aprimoramento de Atributo",
    descricao: "Ganha um feito ou +2 em atributos (de novo nos níveis 8, 12 e 16).",
  },
  {
    classe: "barbaro",
    nivel: 5,
    nome: "Ataque Extra",
    descricao: "Ataca duas vezes toda vez que usa a ação Atacar.",
  },
  {
    classe: "barbaro",
    nivel: 5,
    nome: "Movimento Rápido",
    descricao: "Deslocamento +3m sem armadura pesada.",
  },
  {
    classe: "barbaro",
    nivel: 7,
    nome: "Instinto Selvagem",
    descricao: "Vantagem nas jogadas de iniciativa.",
  },
  {
    classe: "barbaro",
    nivel: 7,
    nome: "Bote Instintivo",
    descricao: "Ao entrar em Fúria (ação bônus), pode se mover até metade do deslocamento junto.",
  },
  {
    classe: "barbaro",
    nivel: 9,
    nome: "Golpe Brutal",
    descricao: "Ao usar Ataque Imprudente, pode abrir mão da vantagem num ataque de Força pra causar +1d10 de dano e um efeito extra (empurrar, atordoar etc.).",
  },
  {
    classe: "barbaro",
    nivel: 11,
    nome: "Fúria Implacável",
    descricao: "Ao cair a 0 PV em Fúria (sem morrer), teste de Constituição CD 10 (sobe +5 a cada uso) pra ficar com PV igual a duas vezes o nível, em vez de cair.",
  },
  {
    classe: "barbaro",
    nivel: 13,
    nome: "Golpe Brutal Aprimorado",
    descricao: "Golpe Brutal ganha mais duas opções de efeito (atordoar a próxima resistência, ou dar +5 no próximo ataque de outra criatura contra o alvo).",
  },
  {
    classe: "barbaro",
    nivel: 15,
    nome: "Fúria Persistente",
    descricao: "Ao rolar iniciativa, recupera todos os usos de Fúria (1x por descanso longo). Fúria passa a durar 10 minutos sozinha, sem precisar agir pra manter.",
  },
  {
    classe: "barbaro",
    nivel: 17,
    nome: "Golpe Brutal Aprimorado (Reforçado)",
    descricao: "Dano extra do Golpe Brutal sobe pra 2d10, e dá pra usar dois efeitos diferentes de uma vez.",
  },
  {
    classe: "barbaro",
    nivel: 18,
    nome: "Força Indomável",
    descricao: "Se o resultado de um teste ou resistência de Força ficar abaixo do valor do atributo, usa o atributo no lugar.",
  },
  {
    classe: "barbaro",
    nivel: 19,
    nome: "Dádiva Épica",
    descricao: "Ganha um feito épico.",
  },
  {
    classe: "barbaro",
    nivel: 20,
    nome: "Campeão Primevo",
    descricao: "Força e Constituição sobem +4 (máximo 25).",
  },
];

/** Habilidades de uma classe até (e incluindo) o nível dado, na ordem em que
 *  são ganhas. */
export function habilidadesAte(classe: ClasseBase, nivel: number): HabilidadeClasse[] {
  return HABILIDADES_CLASSE.filter((h) => h.classe === classe && h.nivel <= nivel).sort((a, b) => a.nivel - b.nivel);
}

/** Habilidades de todas as classes de um personagem multiclasse — cada
 *  entrada marcada com o índice da classe de origem (posição na lista de
 *  `classes`), pra agrupar na tela uma seção por classe. */
export function habilidadesMulticlasse(
  classes: { classe: ClasseBase; nivel: number }[],
): (HabilidadeClasse & { classeIndice: number })[] {
  return classes.flatMap((c, indice) => habilidadesAte(c.classe, c.nivel).map((h) => ({ ...h, classeIndice: indice })));
}
