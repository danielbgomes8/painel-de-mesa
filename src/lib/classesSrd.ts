import type { CampoModificavel, ClasseBase } from "./tipos";

/**
 * Catálogo de habilidades de classe por nível — conferido contra o SRD 2024
 * (api.open5e.com/v2/classes, CC-BY-4.0, mesma disciplina do catálogo de
 * monstros em monstrosSrd.ts). Cobre só a classe BASE, sem subclasse: quem
 * escolhe Feiticeiro Dracônico ou Patrulheiro Caçador continua cadastrando
 * essas características à parte na ficha completa (seções), porque
 * subclasse multiplica o conteúdo por 3-4 pra cada classe.
 *
 * Populado por prioridade, conforme alguém da mesa joga a classe: Feiticeiro,
 * Bárbaro, Guerreiro e Monge feitos. As outras 8 entram do mesmo jeito.
 *
 * Pegadinha já encontrada aqui (guarda em classesSrd.test.ts): a `open5e` erra
 * o nível de algumas habilidades do Monge — "Deflect Attacks" veio sem nível
 * nenhum e "Stunning Strike" veio marcada em dois níveis (3 e 5). Conferido
 * contra aidedd.org e o Roll20 Compendium: os dois concordam em nível 3 e 5
 * respectivamente. Não confiar só na `open5e` pra "em que nível" — cruzar com
 * uma segunda fonte quando a resposta não fechar sozinha.
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
  {
    classe: "guerreiro",
    nivel: 1,
    nome: "Estilo de Combate",
    descricao: "Ganha um feito de Estilo de Combate à escolha (Defesa é recomendado) — pode trocar a cada novo nível de Guerreiro.",
  },
  {
    classe: "guerreiro",
    nivel: 1,
    nome: "Segundo Fôlego",
    descricao:
      "Ação bônus: recupera 1d10 + nível de Guerreiro em PV. 2 usos (3 a partir do nível 4, 4 a partir do 10) — recupera 1 uso no descanso curto, todos no longo.",
  },
  {
    classe: "guerreiro",
    nivel: 1,
    nome: "Maestria em Armas",
    descricao:
      "Usa a propriedade de maestria de 3 tipos de arma simples/marcial (4 a partir do nível 4, 5 a partir do 10, 6 a partir do 16) — troca uma escolha ao final de um descanso longo.",
  },
  {
    classe: "guerreiro",
    nivel: 2,
    nome: "Mente Tática",
    descricao:
      "Ao falhar um teste de habilidade, pode gastar 1 uso de Segundo Fôlego: rola 1d10 e soma ao teste, em vez de curar PV. Se ainda falhar, o uso não é gasto.",
  },
  {
    classe: "guerreiro",
    nivel: 2,
    nome: "Surto de Ação",
    descricao:
      "Faz uma ação extra no seu turno (menos a ação Magia). 1x por descanso curto/longo (2x a partir do nível 17, mas só 1 por turno).",
  },
  {
    classe: "guerreiro",
    nivel: 3,
    nome: "Subclasse de Guerreiro",
    descricao: "Escolhe a subclasse (Campeão...) — as características dela ficam na ficha completa.",
  },
  {
    classe: "guerreiro",
    nivel: 4,
    nome: "Aprimoramento de Atributo",
    descricao: "Ganha um feito ou +2 em atributos (de novo nos níveis 6, 8, 12, 14 e 16).",
  },
  {
    classe: "guerreiro",
    nivel: 5,
    nome: "Ataque Extra",
    descricao: "Ataca duas vezes toda vez que usa a ação Atacar.",
  },
  {
    classe: "guerreiro",
    nivel: 5,
    nome: "Mudança Tática",
    descricao: "Ao usar Segundo Fôlego com ação bônus, pode se mover até metade do deslocamento sem provocar Ataques de Oportunidade.",
  },
  {
    classe: "guerreiro",
    nivel: 9,
    nome: "Indomável",
    descricao:
      "Falhou uma resistência? Rola de nova somando o nível de Guerreiro — precisa usar o novo resultado. 1x por descanso longo (2x a partir do 13, 3x a partir do 17).",
  },
  {
    classe: "guerreiro",
    nivel: 9,
    nome: "Mestre Tático",
    descricao: "Ao atacar com arma cuja maestria pode usar, troca a propriedade dela por Empurrar, Enfraquecer ou Retardar nesse ataque.",
  },
  {
    classe: "guerreiro",
    nivel: 11,
    nome: "Dois Ataques Extras",
    descricao: "Ataca três vezes toda vez que usa a ação Atacar.",
  },
  {
    classe: "guerreiro",
    nivel: 13,
    nome: "Ataques Estudados",
    descricao: "Errou um ataque contra uma criatura? Vantagem no próximo ataque contra ela até o fim do seu próximo turno.",
  },
  {
    classe: "guerreiro",
    nivel: 19,
    nome: "Dádiva Épica",
    descricao: "Ganha um feito épico.",
  },
  {
    classe: "guerreiro",
    nivel: 20,
    nome: "Três Ataques Extras",
    descricao: "Ataca quatro vezes toda vez que usa a ação Atacar.",
  },
  {
    classe: "monge",
    nivel: 1,
    nome: "Artes Marciais",
    descricao:
      "Desarmado ou com arma de monge (simples, ou marcial leve), sem armadura/escudo: ataque desarmado como ação bônus, rola o dado de Artes Marciais (1d6, sobe com o nível) no lugar do dano normal, e usa Destreza em vez de Força pra acerto, dano e CD de agarrar/empurrar.",
  },
  {
    classe: "monge",
    nivel: 1,
    nome: "Defesa sem Armadura",
    descricao: "Sem armadura ou escudo, CA = 10 + Destreza + Sabedoria.",
  },
  {
    classe: "monge",
    nivel: 2,
    nome: "Foco do Monge",
    descricao:
      "Ganha Pontos de Foco (cadastre em Recursos, quantidade = nível de Monge) pra usar em Rajada de Golpes, Defesa Paciente e Passo do Vento. CD desses efeitos = 8 + Sabedoria + proficiência. Recupera tudo num descanso curto ou longo.",
  },
  {
    classe: "monge",
    nivel: 2,
    nome: "Movimento sem Armadura",
    descricao: "Deslocamento +3m sem armadura/escudo — sobe mais nos níveis 6, 10, 14 e 18.",
  },
  {
    classe: "monge",
    nivel: 2,
    nome: "Metabolismo Inaudito",
    descricao:
      "Ao rolar iniciativa, recupera todos os Pontos de Foco e cura PV igual ao nível de Monge + uma rolagem do dado de Artes Marciais. 1x por descanso longo.",
  },
  {
    classe: "monge",
    nivel: 3,
    nome: "Desviar Ataques",
    descricao:
      "Reação contra um ataque que causa dano de porrete/perfurante/cortante: reduz o dano em 1d10 + Destreza + nível de Monge. Se zerar o dano, pode gastar 1 Ponto de Foco pra atingir outra criatura por perto (resistência de Destreza ou leva 2 rolagens do dado de Artes Marciais + Destreza).",
  },
  {
    classe: "monge",
    nivel: 3,
    nome: "Subclasse de Monge",
    descricao: "Escolhe a tradição (Mão Aberta...) — as características dela ficam na ficha completa.",
  },
  {
    classe: "monge",
    nivel: 4,
    nome: "Aprimoramento de Atributo",
    descricao: "Ganha um feito ou +2 em atributos (de novo nos níveis 8, 12 e 16).",
  },
  {
    classe: "monge",
    nivel: 4,
    nome: "Queda Suave",
    descricao: "Reação ao cair: reduz o dano da queda em 5x o nível de Monge.",
  },
  {
    classe: "monge",
    nivel: 5,
    nome: "Ataque Extra",
    descricao: "Ataca duas vezes toda vez que usa a ação Atacar.",
  },
  {
    classe: "monge",
    nivel: 5,
    nome: "Golpe Atordoante",
    descricao:
      "Uma vez por turno, ao acertar com arma de monge ou ataque desarmado, gasta 1 Ponto de Foco: teste de Constituição do alvo. Falhou = Atordoado até o início do seu próximo turno. Passou = deslocamento pela metade e o próximo ataque contra ele tem vantagem, até lá.",
  },
  {
    classe: "monge",
    nivel: 6,
    nome: "Golpes Fortalecidos",
    descricao: "O dano do ataque desarmado pode ser do tipo Força, em vez do tipo normal.",
  },
  {
    classe: "monge",
    nivel: 7,
    nome: "Evasão",
    descricao:
      "Numa resistência de Destreza que causaria metade do dano: passou = não leva nada; falhou = leva só metade. Não funciona se estiver Incapacitado.",
  },
  {
    classe: "monge",
    nivel: 9,
    nome: "Movimento Acrobático",
    descricao: "Sem armadura/escudo, anda em superfícies verticais e sobre líquidos sem cair durante o movimento.",
  },
  {
    classe: "monge",
    nivel: 10,
    nome: "Foco Aprimorado",
    descricao:
      "Rajada de Golpes gasta 1 Foco pra virar 3 ataques em vez de 2; Defesa Paciente gasta 1 Foco pra dar PV temporário igual a 2 rolagens do dado de Artes Marciais; Passo do Vento gasta 1 Foco pra levar junto uma criatura Grande ou menor.",
  },
  {
    classe: "monge",
    nivel: 10,
    nome: "Autorrestauração",
    descricao: "No fim de cada turno, remove de si Enfeitiçado, Amedrontado ou Envenenado. Passar fome/sede não causa mais Exaustão.",
  },
  {
    classe: "monge",
    nivel: 13,
    nome: "Desviar Energia",
    descricao: "Desviar Ataques passa a funcionar contra qualquer tipo de dano, não só porrete/perfurante/cortante.",
  },
  {
    classe: "monge",
    nivel: 14,
    nome: "Sobrevivente Disciplinado",
    descricao: "Proficiência em todas as resistências. Falhou uma? Pode gastar 1 Ponto de Foco pra rolar de novo (usa o novo resultado).",
  },
  {
    classe: "monge",
    nivel: 15,
    nome: "Foco Perfeito",
    descricao: "Ao rolar iniciativa sem usar Metabolismo Inaudito: com 3 Pontos de Foco ou menos, sobe pra 4.",
  },
  {
    classe: "monge",
    nivel: 18,
    nome: "Defesa Superior",
    descricao: "Ação: gasta 3 Pontos de Foco, resistência a todo dano (menos Força) por 1 minuto ou até ficar Incapacitado.",
  },
  {
    classe: "monge",
    nivel: 19,
    nome: "Dádiva Épica",
    descricao: "Ganha um feito épico.",
  },
  {
    classe: "monge",
    nivel: 20,
    nome: "Corpo e Mente",
    descricao: "Destreza e Sabedoria sobem +4 (máximo 25).",
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
