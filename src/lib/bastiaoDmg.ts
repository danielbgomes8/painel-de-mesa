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

/** As duas instalações básicas iniciais (grátis) vêm desta lista; não têm
 *  efeito de jogo, só cenário pra história. */
export const INSTALACOES_BASICAS_DMG = [
  "Quarto",
  "Sala de Jantar",
  "Salão",
  "Pátio",
  "Cozinha",
  "Depósito",
] as const;

export type InstalacaoEspecialDmg = {
  name: string;
  nivel: 5 | 9 | 13 | 17;
  prerequisito: string;
  ordem: (typeof ORDENS_BASTIAO)[number];
};

/** As 27 instalações especiais oficiais — nível mínimo, pré-requisito e a
 *  ordem que cada uma aceita. Progressão real: nível 5 = 2 instalações
 *  especiais, nível 9 = 4, nível 13 = 5, nível 17 = 6 (soma, não substitui). */
export const INSTALACOES_ESPECIAIS_DMG: InstalacaoEspecialDmg[] = [
  { name: "Estudo Arcano", nivel: 5, prerequisito: "usa Foco Arcano ou ferramenta como foco de conjuração", ordem: "Fabricar" },
  { name: "Arsenal", nivel: 5, prerequisito: "", ordem: "Comerciar" },
  { name: "Alojamento", nivel: 5, prerequisito: "", ordem: "Recrutar" },
  { name: "Jardim", nivel: 5, prerequisito: "", ordem: "Colher" },
  { name: "Biblioteca", nivel: 5, prerequisito: "", ordem: "Pesquisar" },
  { name: "Santuário", nivel: 5, prerequisito: "usa Símbolo Sagrado ou Foco Druídico como foco de conjuração", ordem: "Fabricar" },
  { name: "Ferraria", nivel: 5, prerequisito: "", ordem: "Fabricar" },
  { name: "Armazém", nivel: 5, prerequisito: "", ordem: "Comerciar" },
  { name: "Oficina", nivel: 5, prerequisito: "", ordem: "Fabricar" },
  { name: "Salão de Jogos", nivel: 9, prerequisito: "", ordem: "Comerciar" },
  { name: "Estufa", nivel: 9, prerequisito: "", ordem: "Colher" },
  { name: "Laboratório", nivel: 9, prerequisito: "(algumas ordens têm pré-requisito extra)", ordem: "Fabricar" },
  { name: "Sacristia", nivel: 9, prerequisito: "usa Símbolo Sagrado ou Foco Druídico como foco de conjuração", ordem: "Fabricar" },
  { name: "Scriptório", nivel: 9, prerequisito: "(algumas ordens têm pré-requisito extra)", ordem: "Fabricar" },
  { name: "Estábulo", nivel: 9, prerequisito: "", ordem: "Comerciar" },
  { name: "Círculo de Teleporte", nivel: 9, prerequisito: "", ordem: "Recrutar" },
  { name: "Teatro", nivel: 9, prerequisito: "", ordem: "Fortalecer" },
  { name: "Área de Treinamento", nivel: 9, prerequisito: "", ordem: "Fortalecer" },
  { name: "Sala de Troféus", nivel: 9, prerequisito: "", ordem: "Pesquisar" },
  { name: "Arquivo", nivel: 13, prerequisito: "", ordem: "Pesquisar" },
  { name: "Câmara de Meditação", nivel: 13, prerequisito: "", ordem: "Fortalecer" },
  { name: "Reserva de Criaturas", nivel: 13, prerequisito: "", ordem: "Recrutar" },
  { name: "Observatório", nivel: 13, prerequisito: "usa foco de conjuração", ordem: "Fortalecer" },
  { name: "Taverna", nivel: 13, prerequisito: "", ordem: "Pesquisar" },
  { name: "Relicário", nivel: 13, prerequisito: "usa Símbolo Sagrado ou Foco Druídico como foco de conjuração", ordem: "Colher" },
  { name: "Semiplano", nivel: 17, prerequisito: "usa Foco Arcano ou ferramenta como foco de conjuração", ordem: "Fortalecer" },
  { name: "Sede de Guilda", nivel: 17, prerequisito: "Especialização (Expertise) em uma perícia", ordem: "Recrutar" },
  { name: "Sacrário", nivel: 17, prerequisito: "usa Símbolo Sagrado ou Foco Druídico como foco de conjuração", ordem: "Fortalecer" },
  { name: "Sala de Guerra", nivel: 17, prerequisito: "talento Estilo de Luta ou Defesa sem Armadura", ordem: "Recrutar" },
];

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
