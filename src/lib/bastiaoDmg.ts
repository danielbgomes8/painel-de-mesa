/**
 * Referência do sistema de Bastião — Livro do Mestre 2024, cap. 8. Só a
 * estrutura (nomes, nível, pré-requisito, ordem, faixas de evento); a
 * descrição de cada instalação e o efeito de cada evento continuam no livro
 * de vocês — o app não substitui isso, só organiza.
 */

export const ORDENS_BASTIAO = [
  "Fabricar",
  "Fortalecer",
  "Colher",
  "Recrutar",
  "Pesquisar",
  "Comerciar",
] as const;

export const TAMANHOS_INSTALACAO = ["Apertado", "Amplo", "Vasto"] as const;

export type InstalacaoBasicaDmg = { name: string; descricao: string };

/** As duas instalações básicas iniciais (grátis) vêm desta lista; não têm
 *  efeito de jogo, só cenário pra história. */
export const INSTALACOES_BASICAS_DMG: InstalacaoBasicaDmg[] = [
  { name: "Quarto", descricao: "onde os moradores do bastião dormem" },
  { name: "Sala de Jantar", descricao: "onde a mesa janta e recebe visitas" },
  { name: "Salão", descricao: "espaço amplo pra reuniões e eventos" },
  { name: "Pátio", descricao: "área externa aberta, entrada do bastião" },
  { name: "Cozinha", descricao: "onde a comida da casa é preparada" },
  { name: "Depósito", descricao: "guarda suprimentos e tralha sem uso imediato" },
];

export type InstalacaoEspecialDmg = {
  name: string;
  nivel: 5 | 9 | 13 | 17;
  prerequisito: string;
  ordem: (typeof ORDENS_BASTIAO)[number];
  descricao: string;
};

/** As 27 instalações especiais oficiais — nível mínimo, pré-requisito e a
 *  ordem que cada uma aceita. Progressão real: nível 5 = 2 instalações
 *  especiais, nível 9 = 4, nível 13 = 5, nível 17 = 6 (soma, não substitui). */
export const INSTALACOES_ESPECIAIS_DMG: InstalacaoEspecialDmg[] = [
  { name: "Estudo Arcano", nivel: 5, prerequisito: "usa Foco Arcano ou ferramenta como foco de conjuração", ordem: "Fabricar", descricao: "prepara pergaminhos e pesquisa magias novas" },
  { name: "Arsenal", nivel: 5, prerequisito: "", ordem: "Comerciar", descricao: "guarda e fornece armas e armaduras pros aliados" },
  { name: "Alojamento", nivel: 5, prerequisito: "", ordem: "Recrutar", descricao: "hospeda e recruta mais defensores" },
  { name: "Jardim", nivel: 5, prerequisito: "", ordem: "Colher", descricao: "cultiva ervas, venenos e ingredientes" },
  { name: "Biblioteca", nivel: 5, prerequisito: "", ordem: "Pesquisar", descricao: "pesquisa lendas e ajuda a identificar itens mágicos" },
  { name: "Santuário", nivel: 5, prerequisito: "usa Símbolo Sagrado ou Foco Druídico como foco de conjuração", ordem: "Fabricar", descricao: "cura ferimentos leves e remove maldições entre aventuras" },
  { name: "Ferraria", nivel: 5, prerequisito: "", ordem: "Fabricar", descricao: "fabrica e repara armas e armaduras" },
  { name: "Armazém", nivel: 5, prerequisito: "", ordem: "Comerciar", descricao: "estoca e vende suprimentos, rende tesouro por turno" },
  { name: "Oficina", nivel: 5, prerequisito: "", ordem: "Fabricar", descricao: "fabrica ferramentas e engenhocas" },
  { name: "Salão de Jogos", nivel: 9, prerequisito: "", ordem: "Comerciar", descricao: "casa de jogos que rende ouro" },
  { name: "Estufa", nivel: 9, prerequisito: "", ordem: "Colher", descricao: "cultiva plantas raras pra poções e venenos" },
  { name: "Laboratório", nivel: 9, prerequisito: "(algumas ordens têm pré-requisito extra)", ordem: "Fabricar", descricao: "prepara poções e venenos mais avançados" },
  { name: "Sacristia", nivel: 9, prerequisito: "usa Símbolo Sagrado ou Foco Druídico como foco de conjuração", ordem: "Fabricar", descricao: "consagra itens sagrados e cura doenças" },
  { name: "Scriptório", nivel: 9, prerequisito: "(algumas ordens têm pré-requisito extra)", ordem: "Fabricar", descricao: "copia grimórios e produz obras escritas" },
  { name: "Estábulo", nivel: 9, prerequisito: "", ordem: "Comerciar", descricao: "cuida e treina montarias" },
  { name: "Círculo de Teleporte", nivel: 9, prerequisito: "", ordem: "Recrutar", descricao: "teleporta o grupo pra outro círculo conhecido" },
  { name: "Teatro", nivel: 9, prerequisito: "", ordem: "Fortalecer", descricao: "apresenta espetáculos que erguem o moral e rendem ouro" },
  { name: "Área de Treinamento", nivel: 9, prerequisito: "", ordem: "Fortalecer", descricao: "treina defensores e ajuda a praticar perícias e armas" },
  { name: "Sala de Troféus", nivel: 9, prerequisito: "", ordem: "Pesquisar", descricao: "expõe troféus de conquistas passadas" },
  { name: "Arquivo", nivel: 13, prerequisito: "", ordem: "Pesquisar", descricao: "guarda registros raros pra pesquisas profundas" },
  { name: "Câmara de Meditação", nivel: 13, prerequisito: "", ordem: "Fortalecer", descricao: "ajuda a recuperar o foco e reduzir exaustão" },
  { name: "Reserva de Criaturas", nivel: 13, prerequisito: "", ordem: "Recrutar", descricao: "abriga e cuida de criaturas capturadas ou domesticadas" },
  { name: "Observatório", nivel: 13, prerequisito: "usa foco de conjuração", ordem: "Fortalecer", descricao: "observa os céus e ajuda em rituais de adivinhação" },
  { name: "Taverna", nivel: 13, prerequisito: "", ordem: "Pesquisar", descricao: "ponto de encontro pra ouvir rumores e contratar gente" },
  { name: "Relicário", nivel: 13, prerequisito: "usa Símbolo Sagrado ou Foco Druídico como foco de conjuração", ordem: "Colher", descricao: "guarda e consagra relíquias sagradas" },
  { name: "Semiplano", nivel: 17, prerequisito: "usa Foco Arcano ou ferramenta como foco de conjuração", ordem: "Fortalecer", descricao: "espaço extradimensional particular do bastião" },
  { name: "Sede de Guilda", nivel: 17, prerequisito: "Especialização (Expertise) em uma perícia", ordem: "Recrutar", descricao: "sede de um ofício que treina especialização" },
  { name: "Sacrário", nivel: 17, prerequisito: "usa Símbolo Sagrado ou Foco Druídico como foco de conjuração", ordem: "Fortalecer", descricao: "santuário reservado pra rituais e devoção mais intensa" },
  { name: "Sala de Guerra", nivel: 17, prerequisito: "talento Estilo de Luta ou Defesa sem Armadura", ordem: "Recrutar", descricao: "planeja táticas e comanda tropas em conflitos maiores" },
];

/** Descrição curta (paráfrase, não é texto do livro) de uma instalação já
 *  criada, básica ou especial, pra mostrar como dica ao passar o mouse. */
export function descricaoInstalacao(nome: string): string | undefined {
  return (
    INSTALACOES_ESPECIAIS_DMG.find((m) => m.name === nome)?.descricao ??
    INSTALACOES_BASICAS_DMG.find((b) => b.name === nome)?.descricao
  );
}

/** Progressão oficial: quantas instalações especiais o nível dá direito a ter. */
export const PROGRESSAO_INSTALACOES_ESPECIAIS = [
  { nivel: 5, total: 2 },
  { nivel: 9, total: 4 },
  { nivel: 13, total: 5 },
  { nivel: 17, total: 6 },
] as const;

/** Tabela de eventos (d100) — só a faixa e o nome, pra consulta rápida.
 *  O efeito de cada evento está no livro; o app só dá espaço pra registrar
 *  o resultado no log do turno. */
export const EVENTOS_BASTIAO_DMG = [
  { faixa: "01–50", nome: "Tudo Bem" },
  { faixa: "51–55", nome: "Ataque" },
  { faixa: "56–58", nome: "Contratado Criminoso" },
  { faixa: "59–63", nome: "Oportunidade Extraordinária" },
  { faixa: "64–72", nome: "Visitantes Amigáveis" },
  { faixa: "73–76", nome: "Convidado" },
  { faixa: "77–79", nome: "Contratados Perdidos" },
  { faixa: "80–83", nome: "Descoberta Mágica" },
  { faixa: "84–91", nome: "Refugiados" },
  { faixa: "92–98", nome: "Pedido de Ajuda" },
  { faixa: "99–00", nome: "Tesouro" },
] as const;
