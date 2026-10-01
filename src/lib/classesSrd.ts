import type { CampoModificavel, ClasseBase } from "./tipos";
import { NOME_CLASSE } from "./classesNomes";

// O rótulo das classes mora à parte (vai na abertura do app; este arquivo, não).
export { NOME_CLASSE };

/**
 * Catálogo de habilidades de classe por nível — conferido contra o SRD 2024
 * (api.open5e.com/v2/classes, CC-BY-4.0, mesma disciplina do catálogo de
 * monstros em monstrosSrd.ts). Cobre só a classe BASE, sem subclasse: quem
 * escolhe Feiticeiro Dracônico ou Patrulheiro Caçador continua cadastrando
 * essas características à parte na ficha completa (seções), porque
 * subclasse multiplica o conteúdo por 3-4 pra cada classe.
 *
 * As 12 classes base do SRD 2024 estão todas aqui.
 *
 * Pegadinha já encontrada aqui (guarda em classesSrd.test.ts): a `open5e` erra
 * o nível de algumas habilidades do Monge — "Deflect Attacks" veio sem nível
 * nenhum e "Stunning Strike" veio marcada em dois níveis (3 e 5). Conferido
 * contra aidedd.org e o Roll20 Compendium: os dois concordam em nível 3 e 5
 * respectivamente. Mesma coisa com "Bard Subclass": veio sem nível, e as duas
 * fontes de conferência confirmam nível 3 — que é aliás o padrão universal
 * (todas as 12 classes escolhem subclasse no nível 3). Não confiar só na
 * `open5e` pra "em que nível" quando o campo vier vazio ou contraditório —
 * cruzar com uma segunda fonte.
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
  {
    classe: "bardo",
    nivel: 1,
    nome: "Inspiração de Bardo",
    descricao:
      "Ação bônus: dá um dado de Inspiração (d6, sobe com o nível) pra uma criatura que veja/ouça você, a até 18m. Ela usa em até 1 hora, somando a um d20 que tenha falhado. Usos = modificador de Carisma (mínimo 1); recupera tudo num descanso longo.",
  },
  {
    classe: "bardo",
    nivel: 1,
    nome: "Conjuração",
    descricao: "Sabe magias de Bardo preparadas de cor, usando um instrumento musical como foco — Carisma é o atributo de conjuração.",
  },
  {
    classe: "bardo",
    nivel: 2,
    nome: "Especialização",
    descricao: "Escolhe 2 perícias com proficiência e dobra o bônus nelas (mais 2 no nível 9).",
  },
  {
    classe: "bardo",
    nivel: 2,
    nome: "Pau pra Toda Obra",
    descricao: "Soma metade do bônus de proficiência (arredondado pra baixo) em qualquer teste de perícia em que não é proficiente.",
  },
  {
    classe: "bardo",
    nivel: 3,
    nome: "Subclasse de Bardo",
    descricao: "Escolhe o colégio (do Conhecimento...) — as características dele ficam na ficha completa.",
  },
  {
    classe: "bardo",
    nivel: 4,
    nome: "Aprimoramento de Atributo",
    descricao: "Ganha um feito ou +2 em atributos (de novo nos níveis 8, 12 e 16).",
  },
  {
    classe: "bardo",
    nivel: 5,
    nome: "Fonte de Inspiração",
    descricao: "Recupera toda a Inspiração de Bardo num descanso curto ou longo. Também pode gastar um espaço de magia (sem ação) pra recuperar 1 uso.",
  },
  {
    classe: "bardo",
    nivel: 7,
    nome: "Contracanto",
    descricao: "Reação: alguém a até 9m (ou você) falhou contra Enfeitiçado/Amedrontado? Rola de novo, com vantagem.",
  },
  {
    classe: "bardo",
    nivel: 10,
    nome: "Segredos Mágicos",
    descricao: "Ao aumentar o número de magias preparadas, pode escolher entre as listas de Bardo, Clérigo, Druida ou Mago — contam como magia de Bardo pra você.",
  },
  {
    classe: "bardo",
    nivel: 18,
    nome: "Inspiração Superior",
    descricao: "Ao rolar iniciativa, recupera Inspiração de Bardo até ter pelo menos 2 usos.",
  },
  {
    classe: "bardo",
    nivel: 19,
    nome: "Dádiva Épica",
    descricao: "Ganha um feito épico.",
  },
  {
    classe: "bardo",
    nivel: 20,
    nome: "Palavras da Criação",
    descricao:
      "Sempre tem Palavra do Poder: Curar e Palavra do Poder: Matar preparadas; ao lançar uma delas, pode atingir uma segunda criatura a até 3m da primeira.",
  },
  {
    classe: "bruxo",
    nivel: 1,
    nome: "Invocações Místicas",
    descricao: "Ganha uma Invocação Mística (habilidade extra, escolhida de uma lista própria) — troca ou ganha mais ao subir de nível.",
  },
  {
    classe: "bruxo",
    nivel: 1,
    nome: "Magia de Pacto",
    descricao:
      "Sabe magias de Bruxo preparadas — Carisma é o atributo de conjuração. Poucos espaços, mas sempre no nível máximo e recarregam num descanso curto OU longo (diferente das outras classes conjuradoras).",
  },
  {
    classe: "bruxo",
    nivel: 2,
    nome: "Astúcia Mágica",
    descricao: "1 minuto de ritual: recupera até metade dos espaços de Magia de Pacto (arredondado pra cima). 1x por descanso longo.",
  },
  {
    classe: "bruxo",
    nivel: 3,
    nome: "Subclasse de Bruxo",
    descricao: "Escolhe o protetor (Corruptor...) — as características dele ficam na ficha completa.",
  },
  {
    classe: "bruxo",
    nivel: 4,
    nome: "Aprimoramento de Atributo",
    descricao: "Ganha um feito ou +2 em atributos (de novo nos níveis 8, 12 e 16).",
  },
  {
    classe: "bruxo",
    nivel: 9,
    nome: "Contato com o Protetor",
    descricao: "Sempre tem Contatar Outro Plano preparada e pode lançá-la de graça 1x por descanso longo, com sucesso automático no teste.",
  },
  {
    classe: "bruxo",
    nivel: 11,
    nome: "Arcano Místico",
    descricao:
      "Escolhe uma magia de nível 6 de Bruxo pra lançar 1x por descanso longo sem gastar espaço (ganha outra de nível 7 no 13, nível 8 no 15, nível 9 no 17).",
  },
  {
    classe: "bruxo",
    nivel: 19,
    nome: "Dádiva Épica",
    descricao: "Ganha um feito épico.",
  },
  {
    classe: "bruxo",
    nivel: 20,
    nome: "Mestre Místico",
    descricao: "Usar Astúcia Mágica recupera todos os espaços de Magia de Pacto, não só metade.",
  },
  {
    classe: "clerigo",
    nivel: 1,
    nome: "Ordem Divina",
    descricao:
      "Escolhe um papel: Protetor (proficiência em armas marciais e treino em armadura pesada) ou Taumaturgo (mais um truque, e bônus de Sabedoria — mín. +1 — em Arcanismo/Religião).",
  },
  {
    classe: "clerigo",
    nivel: 1,
    nome: "Conjuração",
    descricao: "Sabe magias de Clérigo preparadas de cor, usando um Símbolo Sagrado como foco — Sabedoria é o atributo de conjuração.",
  },
  {
    classe: "clerigo",
    nivel: 2,
    nome: "Canalizar Divindade",
    descricao:
      "2 usos (sobe com o nível): Fagulha Divina (cura ou dano necrótico/radiante à distância) ou Repelir Mortos-vivos (amedronta e incapacita mortos-vivos por perto). Recupera 1 uso no descanso curto, todos no longo.",
  },
  {
    classe: "clerigo",
    nivel: 3,
    nome: "Subclasses de Clérigo",
    descricao: "Escolhe o domínio (da Vida...) — as características dele ficam na ficha completa.",
  },
  {
    classe: "clerigo",
    nivel: 4,
    nome: "Aprimoramento de Atributo",
    descricao: "Ganha um feito ou +2 em atributos (de novo nos níveis 8, 12 e 16).",
  },
  {
    classe: "clerigo",
    nivel: 5,
    nome: "Repelir Mortos-vivos Fulminante",
    descricao: "Ao usar Repelir Mortos-vivos, quem falhar no teste também leva dano radiante (dados = modificador de Sabedoria).",
  },
  {
    classe: "clerigo",
    nivel: 7,
    nome: "Golpes Abençoados",
    descricao:
      "Escolhe: Investida Divina (1x por turno, +1d8 necrótico ou radiante num ataque de arma) ou Conjuração Potente (soma Sabedoria no dano de truque de Clérigo).",
  },
  {
    classe: "clerigo",
    nivel: 10,
    nome: "Intervenção Divina",
    descricao: "Ação: lança de graça, sem componente material, qualquer magia de Clérigo até nível 5 que não use reação. 1x por descanso longo.",
  },
  {
    classe: "clerigo",
    nivel: 14,
    nome: "Golpes Abençoados Aprimorados",
    descricao: "A opção escolhida em Golpes Abençoados fica mais forte: Investida Divina vai a 2d8, ou Conjuração Potente também dá PV temporário.",
  },
  {
    classe: "clerigo",
    nivel: 19,
    nome: "Dádiva Épica",
    descricao: "Ganha um feito épico.",
  },
  {
    classe: "clerigo",
    nivel: 20,
    nome: "Intervenção Divina Maior",
    descricao: "Intervenção Divina agora pode escolher Desejo; ao fazer isso, só pode usar de novo depois de 2d4 descansos longos.",
  },
  {
    classe: "druida",
    nivel: 1,
    nome: "Druídico",
    descricao: "Sabe o idioma secreto dos druidas e sempre tem Falar com Animais preparada.",
  },
  {
    classe: "druida",
    nivel: 1,
    nome: "Ordem Primordial",
    descricao:
      "Escolhe: Mago (mais um truque, e bônus de Sabedoria — mín. +1 — em Arcanismo/Natureza) ou Guardião (proficiência em armas marciais e treino em armadura média).",
  },
  {
    classe: "druida",
    nivel: 1,
    nome: "Conjuração",
    descricao: "Sabe magias de Druida preparadas de cor, usando um foco druídico — Sabedoria é o atributo de conjuração.",
  },
  {
    classe: "druida",
    nivel: 2,
    nome: "Companheiro Selvagem",
    descricao: "Ação: gasta um espaço de magia ou um uso de Forma Selvagem pra conjurar Encontrar Familiar sem componente material (familiar Fada, some no descanso longo).",
  },
  {
    classe: "druida",
    nivel: 2,
    nome: "Forma Selvagem",
    descricao:
      "Ação bônus: vira uma Fera que já conhece (CR até 1/4 no início, sem voo) por metade do nível de Druida em horas. 2 usos (sobe com o nível); recupera 1 no descanso curto, todos no longo. Conhece mais formas, com CR maior, à medida que sobe de nível.",
  },
  {
    classe: "druida",
    nivel: 3,
    nome: "Subclasse de Druida",
    descricao: "Escolhe o círculo (da Terra...) — as características dele ficam na ficha completa.",
  },
  {
    classe: "druida",
    nivel: 4,
    nome: "Aprimoramento de Atributo",
    descricao: "Ganha um feito ou +2 em atributos (de novo nos níveis 8, 12 e 16).",
  },
  {
    classe: "druida",
    nivel: 5,
    nome: "Ressurgimento Selvagem",
    descricao:
      "Sem usos de Forma Selvagem? Gasta um espaço de magia pra ganhar um (sem ação). Também pode virar 1 uso de Forma Selvagem num espaço de nível 1, 1x por descanso longo.",
  },
  {
    classe: "druida",
    nivel: 7,
    nome: "Fúria Elemental",
    descricao:
      "Escolhe: Conjuração Potente (soma Sabedoria no dano de truque) ou Investida Primordial (1x por turno, +1d8 de frio/fogo/elétrico/trovão num ataque de arma ou de Forma Selvagem).",
  },
  {
    classe: "druida",
    nivel: 15,
    nome: "Fúria Elemental Aprimorada",
    descricao: "A opção escolhida fica mais forte: Conjuração Potente aumenta o alcance do truque em 90m, ou Investida Primordial vai a 2d8.",
  },
  {
    classe: "druida",
    nivel: 18,
    nome: "Magias na Forma",
    descricao: "Pode conjurar magias em Forma Selvagem, menos as que gastam componente material com custo.",
  },
  {
    classe: "druida",
    nivel: 19,
    nome: "Dádiva Épica",
    descricao: "Ganha um feito épico.",
  },
  {
    classe: "druida",
    nivel: 20,
    nome: "Arquidruida",
    descricao:
      "Ao rolar iniciativa sem uso de Forma Selvagem, recupera um. Pode converter usos de Forma Selvagem num espaço de magia (2 níveis por uso, sem ação, 1x por descanso longo). Envelhece bem mais devagar.",
  },
  {
    classe: "ladino",
    nivel: 1,
    nome: "Ataque Furtivo",
    descricao:
      "1x por turno, dano extra (1d6 no nível 1, sobe a cada dois níveis até 10d6 no 20) num ataque com vantagem usando arma sutil ou à distância — ou sem vantagem, se tiver aliado sem Incapacitado adjacente ao alvo e você não tiver desvantagem.",
  },
  {
    classe: "ladino",
    nivel: 1,
    nome: "Cant dos Ladrões",
    descricao: "Conhece o Cant dos Ladrões e mais um idioma à escolha.",
  },
  {
    classe: "ladino",
    nivel: 1,
    nome: "Maestria em Armas",
    descricao: "Usa a propriedade de maestria de 2 tipos de arma com proficiência — troca ao final de um descanso longo.",
  },
  {
    classe: "ladino",
    nivel: 1,
    nome: "Especialização",
    descricao: "Escolhe 2 perícias com proficiência e dobra o bônus nelas (mais 2 no nível 6).",
  },
  {
    classe: "ladino",
    nivel: 2,
    nome: "Ação Ardilosa",
    descricao: "Ação bônus: Disparada, Desengajar ou Esconder.",
  },
  {
    classe: "ladino",
    nivel: 3,
    nome: "Subclasse de Ladino",
    descricao: "Escolhe a especialidade (Ladrão...) — as características dela ficam na ficha completa.",
  },
  {
    classe: "ladino",
    nivel: 3,
    nome: "Mira Firme",
    descricao: "Ação bônus, sem ter se movido este turno: vantagem no próximo ataque. Deslocamento vira 0 até o fim do turno.",
  },
  {
    classe: "ladino",
    nivel: 4,
    nome: "Aprimoramento de Atributo",
    descricao: "Ganha um feito ou +2 em atributos (de novo nos níveis 8, 12 e 16).",
  },
  {
    classe: "ladino",
    nivel: 5,
    nome: "Esquiva Inata",
    descricao: "Reação a ser acertado por quem você vê: reduz o dano à metade (arredondado pra baixo).",
  },
  {
    classe: "ladino",
    nivel: 5,
    nome: "Golpe Ardiloso",
    descricao: "No Ataque Furtivo, abre mão de dados de dano pra Envenenar (1d6, resistência de Constituição), Derrubar (1d6) ou Recuar metade do deslocamento sem provocar (1d6).",
  },
  {
    classe: "ladino",
    nivel: 7,
    nome: "Evasão",
    descricao: "Numa resistência de Destreza que causaria metade do dano: passou = nada; falhou = metade. Não funciona Incapacitado.",
  },
  {
    classe: "ladino",
    nivel: 7,
    nome: "Talento Confiável",
    descricao: "Num teste com perícia ou ferramenta proficiente, resultado 9 ou menos no d20 vira 10.",
  },
  {
    classe: "ladino",
    nivel: 11,
    nome: "Golpe Ardiloso Aprimorado",
    descricao: "Usa até dois efeitos de Golpe Ardiloso no mesmo Ataque Furtivo, pagando o custo de cada um.",
  },
  {
    classe: "ladino",
    nivel: 14,
    nome: "Golpes Traiçoeiros",
    descricao: "Golpe Ardiloso ganha mais opções: Atordoar (2d6), Nocautear (6d6, vira Inconsciente) ou Cegar (3d6).",
  },
  {
    classe: "ladino",
    nivel: 15,
    nome: "Mente Escorregadia",
    descricao: "Proficiência em resistência de Sabedoria e Carisma.",
  },
  {
    classe: "ladino",
    nivel: 18,
    nome: "Ilusório",
    descricao: "Ninguém tem vantagem pra te atacar, a menos que você esteja Incapacitado.",
  },
  {
    classe: "ladino",
    nivel: 19,
    nome: "Dádiva Épica",
    descricao: "Ganha um feito épico.",
  },
  {
    classe: "ladino",
    nivel: 20,
    nome: "Golpe de Sorte",
    descricao: "Falhou um teste de D20? Vira um 20. 1x por descanso curto ou longo.",
  },
  {
    classe: "mago",
    nivel: 1,
    nome: "Conjuração",
    descricao: "Sabe magias de Mago escritas num grimório e prepara uma lista delas a cada descanso longo — Inteligência é o atributo de conjuração.",
  },
  {
    classe: "mago",
    nivel: 1,
    nome: "Recuperação Arcana",
    descricao: "Num descanso curto, recupera espaços de magia com soma de níveis até metade do nível de Mago (arredondado pra cima, nenhum de nível 6+). 1x por descanso longo.",
  },
  {
    classe: "mago",
    nivel: 1,
    nome: "Adepto em Rituais",
    descricao: "Lança como Ritual qualquer magia com a tag Ritual que esteja no grimório, mesmo sem ter preparado — só precisa ler do livro.",
  },
  {
    classe: "mago",
    nivel: 2,
    nome: "Erudito",
    descricao: "Escolhe entre Arcanismo, História, Investigação, Medicina, Natureza ou Religião (com proficiência) e dobra o bônus nela.",
  },
  {
    classe: "mago",
    nivel: 3,
    nome: "Subclasse de Mago",
    descricao: "Escolhe a escola (de Evocação...) — as características dela ficam na ficha completa.",
  },
  {
    classe: "mago",
    nivel: 4,
    nome: "Aprimoramento de Atributo",
    descricao: "Ganha um feito ou +2 em atributos (de novo nos níveis 8, 12 e 16).",
  },
  {
    classe: "mago",
    nivel: 5,
    nome: "Memorizar Magia",
    descricao: "Num descanso curto, troca uma magia preparada por outra do grimório.",
  },
  {
    classe: "mago",
    nivel: 18,
    nome: "Maestria em Magias",
    descricao: "Escolhe uma magia de nível 1 e uma de nível 2 do grimório (de ação, não ritual) — ficam sempre preparadas, lança na forma básica sem gastar espaço.",
  },
  {
    classe: "mago",
    nivel: 19,
    nome: "Dádiva Épica",
    descricao: "Ganha um feito épico.",
  },
  {
    classe: "mago",
    nivel: 20,
    nome: "Magias de Assinatura",
    descricao: "Escolhe duas magias de nível 3 do grimório — sempre preparadas, lança cada uma 1x de graça por descanso curto ou longo.",
  },
  {
    classe: "paladino",
    nivel: 1,
    nome: "Impor as Mãos",
    descricao:
      "Reserva de cura = 5x nível de Paladino. Ação bônus: toca alguém e usa o quanto quiser da reserva pra curar PV, ou gasta 5 PV da reserva pra remover Envenenado.",
  },
  {
    classe: "paladino",
    nivel: 1,
    nome: "Conjuração",
    descricao: "Sabe magias de Paladino preparadas de cor — Carisma é o atributo de conjuração.",
  },
  {
    classe: "paladino",
    nivel: 1,
    nome: "Maestria em Armas",
    descricao: "Usa a propriedade de maestria de 2 tipos de arma com proficiência — troca ao final de um descanso longo.",
  },
  {
    classe: "paladino",
    nivel: 2,
    nome: "Estilo de Combate",
    descricao: "Ganha um feito de Estilo de Combate à escolha — pode trocar a cada novo nível de Paladino.",
  },
  {
    classe: "paladino",
    nivel: 2,
    nome: "Investida do Paladino",
    descricao: "Sempre tem Investida Divina preparada; lança de graça 1x por descanso longo.",
  },
  {
    classe: "paladino",
    nivel: 3,
    nome: "Canalizar Divindade",
    descricao:
      "2 usos (mais um no nível 11): Sentido Divino (ação bônus, detecta Celestiais/Corruptores/Mortos-vivos por 10 min a 18m). Recupera 1 uso no descanso curto, todos no longo.",
  },
  {
    classe: "paladino",
    nivel: 3,
    nome: "Subclasse de Paladino",
    descricao: "Escolhe o juramento (da Devoção...) — as características dele ficam na ficha completa.",
  },
  {
    classe: "paladino",
    nivel: 4,
    nome: "Aprimoramento de Atributo",
    descricao: "Ganha um feito ou +2 em atributos (de novo nos níveis 8, 12 e 16).",
  },
  {
    classe: "paladino",
    nivel: 5,
    nome: "Ataque Extra",
    descricao: "Ataca duas vezes toda vez que usa a ação Atacar.",
  },
  {
    classe: "paladino",
    nivel: 5,
    nome: "Montaria Fiel",
    descricao: "Sempre tem Encontrar Montaria preparada; lança de graça 1x por descanso longo.",
  },
  {
    classe: "paladino",
    nivel: 6,
    nome: "Aura de Proteção",
    descricao: "Emanação de 3m: você e aliados dentro ganham bônus em resistência = modificador de Carisma (mínimo +1).",
  },
  {
    classe: "paladino",
    nivel: 9,
    nome: "Repelir Inimigos",
    descricao: "Gasta um uso de Canalizar Divindade: criaturas à escolha (número = mod. de Carisma) a até 18m fazem resistência de Sabedoria ou ficam Amedrontadas por 1 minuto.",
  },
  {
    classe: "paladino",
    nivel: 10,
    nome: "Aura de Coragem",
    descricao: "Você e aliados na Aura de Proteção são imunes a Amedrontado.",
  },
  {
    classe: "paladino",
    nivel: 11,
    nome: "Investidas Radiantes",
    descricao: "Ataque corpo a corpo ou desarmado que acertar causa +1d8 radiante.",
  },
  {
    classe: "paladino",
    nivel: 14,
    nome: "Toque Restaurador",
    descricao: "Ao usar Impor as Mãos, também remove Cego, Enfeitiçado, Surdo, Amedrontado, Paralisado ou Atordoado — 5 PV da reserva por condição.",
  },
  {
    classe: "paladino",
    nivel: 18,
    nome: "Expansão da Aura",
    descricao: "Aura de Proteção vira uma Emanação de 9m.",
  },
  {
    classe: "paladino",
    nivel: 19,
    nome: "Dádiva Épica",
    descricao: "Ganha um feito épico.",
  },
  {
    classe: "patrulheiro",
    nivel: 1,
    nome: "Inimigo Favorito",
    descricao: "Sempre tem Marca do Caçador preparada; lança de graça 2x (sobe com o nível), recupera tudo no descanso longo.",
  },
  {
    classe: "patrulheiro",
    nivel: 1,
    nome: "Conjuração",
    descricao: "Sabe magias de Patrulheiro preparadas de cor — Sabedoria é o atributo de conjuração.",
  },
  {
    classe: "patrulheiro",
    nivel: 1,
    nome: "Maestria em Armas",
    descricao: "Usa a propriedade de maestria de 2 tipos de arma com proficiência — troca ao final de um descanso longo.",
  },
  {
    classe: "patrulheiro",
    nivel: 2,
    nome: "Explorador Talentoso",
    descricao: "Dobra o bônus de uma perícia à escolha (com proficiência) e aprende mais dois idiomas.",
  },
  {
    classe: "patrulheiro",
    nivel: 2,
    nome: "Estilo de Combate",
    descricao: "Ganha um feito de Estilo de Combate à escolha — pode trocar a cada novo nível de Patrulheiro.",
  },
  {
    classe: "patrulheiro",
    nivel: 3,
    nome: "Subclasse de Patrulheiro",
    descricao: "Escolhe a especialidade (Caçador...) — as características dela ficam na ficha completa.",
  },
  {
    classe: "patrulheiro",
    nivel: 4,
    nome: "Aprimoramento de Atributo",
    descricao: "Ganha um feito ou +2 em atributos (de novo nos níveis 8, 12 e 16).",
  },
  {
    classe: "patrulheiro",
    nivel: 5,
    nome: "Ataque Extra",
    descricao: "Ataca duas vezes toda vez que usa a ação Atacar.",
  },
  {
    classe: "patrulheiro",
    nivel: 6,
    nome: "Vagueio",
    descricao: "Deslocamento +3m sem armadura pesada; ganha deslocamento de escalada e de natação iguais ao normal.",
  },
  {
    classe: "patrulheiro",
    nivel: 9,
    nome: "Especialização",
    descricao: "Escolhe 2 perícias com proficiência e dobra o bônus nelas.",
  },
  {
    classe: "patrulheiro",
    nivel: 10,
    nome: "Incansável",
    descricao: "Ação: PV temporário = 1d8 + Sabedoria (mín. 1); usos = mod. de Sabedoria (mín. 1). Também tira 1 de Exaustão a cada descanso curto.",
  },
  {
    classe: "patrulheiro",
    nivel: 13,
    nome: "Caçador Implacável",
    descricao: "Levar dano não quebra mais a concentração em Marca do Caçador.",
  },
  {
    classe: "patrulheiro",
    nivel: 14,
    nome: "Véu da Natureza",
    descricao: "Ação bônus: fica Invisível até o fim do próximo turno. Usos = mod. de Sabedoria (mín. 1), recupera no descanso longo.",
  },
  {
    classe: "patrulheiro",
    nivel: 17,
    nome: "Caçador Preciso",
    descricao: "Vantagem em ataques contra o alvo marcado por Marca do Caçador.",
  },
  {
    classe: "patrulheiro",
    nivel: 18,
    nome: "Sentidos Ferais",
    descricao: "Visão às Cegas em 9m.",
  },
  {
    classe: "patrulheiro",
    nivel: 19,
    nome: "Dádiva Épica",
    descricao: "Ganha um feito épico.",
  },
  {
    classe: "patrulheiro",
    nivel: 20,
    nome: "Matador de Inimigos",
    descricao: "O dado de Marca do Caçador vira d10 em vez de d6.",
  },
];

/** Habilidades de uma classe até (e incluindo) o nível dado, na ordem em que
 *  são ganhas. */
export function habilidadesAte(classe: ClasseBase, nivel: number): HabilidadeClasse[] {
  return HABILIDADES_CLASSE.filter((h) => h.classe === classe && h.nivel <= nivel).sort((a, b) => a.nivel - b.nivel);
}

/** O que a classe ganha exatamente neste nível — pro card "próximo nível". */
export function habilidadesDoNivel(classe: ClasseBase, nivel: number): HabilidadeClasse[] {
  return HABILIDADES_CLASSE.filter((h) => h.classe === classe && h.nivel === nivel);
}

/** Habilidades de todas as classes de um personagem multiclasse — cada
 *  entrada marcada com o índice da classe de origem (posição na lista de
 *  `classes`), pra agrupar na tela uma seção por classe. */
export function habilidadesMulticlasse(
  classes: { classe: ClasseBase; nivel: number }[],
): (HabilidadeClasse & { classeIndice: number })[] {
  return classes.flatMap((c, indice) => habilidadesAte(c.classe, c.nivel).map((h) => ({ ...h, classeIndice: indice })));
}
