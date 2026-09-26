#!/usr/bin/env node
/**
 * Gera src/lib/monstrosSrdGerados.ts — os monstros do SRD 5.2 (D&D 2024) que
 * NÃO estão na lista curada de src/lib/monstrosSrd.ts, lidos direto da
 * fonte estruturada (open5e, documento srd-2024) e traduzidos com as tabelas
 * abaixo. Os números (CA, PV, iniciativa, deslocamento, acerto, dano, ND)
 * vêm da fonte sem ninguém digitar — é o que impede a volta dos números de
 * 2014 (ver AGENTS.md, "A mesa joga D&D 2024").
 *
 *   node scripts/gerar-monstros-srd.mjs              (baixa da open5e)
 *   node scripts/gerar-monstros-srd.mjs dados.json   (usa uma cópia local)
 *
 * Não edite o arquivo gerado à mão: pra caprichar num monstro (dica de
 * tática escrita), mova-o pra lista curada em monstrosSrd.ts e ponha o nome
 * em inglês dele em CURADOS_EN — o gerador passa a pular ele.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const FONTE = "https://api.open5e.com/v2/creatures/?document__key=srd-2024&limit=100";

/** Quantas criaturas o SRD 5.2 tem na fonte (o teste confere o catálogo). */
export const TOTAL_SRD_2024 = 331;

/** Monstros escritos à mão em monstrosSrd.ts (nome no SRD). */
export const CURADOS_EN = [
  "Kobold Warrior", "Goblin Warrior", "Skeleton", "Bandit", "Cultist", "Hobgoblin Warrior", "Wolf", "Black Bear",
  "Zombie", "Ghoul", "Giant Spider", "Ogre", "Wight", "Owlbear", "Troll", "Giant Rat", "Stirge",
  "Giant Venomous Snake", "Gnoll Warrior", "Worg", "Bugbear Warrior", "Harpy", "Bandit Captain", "Griffon", "Ettin",
  "Basilisk", "Minotaur of Baphomet", "Werewolf", "Manticore", "Hill Giant", "Vampire Spawn", "Wraith", "Chimera",
  "Fire Elemental", "Frost Giant", "Fire Giant", "Young Blue Dragon", "Lich", "Guard", "Knight", "Mage", "Priest",
  "Assassin", "Brown Bear", "Boar", "Crocodile", "Giant Eagle", "Air Elemental", "Earth Elemental",
  "Water Elemental", "Gelatinous Cube", "Gargoyle", "Ghost", "Shadow", "Imp", "Young Red Dragon",
];

// ─── Tabelas de tradução ────────────────────────────────────────────────────

const CORES = {
  Black: "preto", Blue: "azul", Green: "verde", Red: "vermelho", White: "branco",
  Brass: "de latão", Bronze: "de bronze", Copper: "de cobre", Gold: "de ouro", Silver: "de prata",
};
const IDADES = { Wyrmling: "filhote", Young: "jovem", Adult: "adulto", Ancient: "ancião" };

/** Nome em português. Dragão de cor/idade sai de CORES/IDADES. Onde não há
 *  nome consagrado em português, fica o original (Aboleth, Behir, Chuul...). */
const NOMES = {
  "Aboleth": "Aboleth", "Allosaurus": "Alossauro", "Animated Armor": "Armadura animada",
  "Animated Flying Sword": "Espada voadora animada", "Animated Rug of Smothering": "Tapete sufocante animado",
  "Ankheg": "Ankheg", "Ankylosaurus": "Anquilossauro", "Ape": "Macaco", "Archelon": "Arquelon",
  "Archmage": "Arquimago", "Awakened Shrub": "Arbusto desperto", "Awakened Tree": "Árvore desperta",
  "Axe Beak": "Bico-de-machado", "Azer Sentinel": "Sentinela azer", "Baboon": "Babuíno", "Badger": "Texugo",
  "Balor": "Balor", "Barbed Devil": "Diabo farpado", "Bat": "Morcego", "Bearded Devil": "Diabo barbado",
  "Behir": "Behir", "Berserker": "Berserker", "Black Pudding": "Pudim negro", "Blink Dog": "Cão intermitente",
  "Blood Hawk": "Falcão sanguinário", "Bone Devil": "Diabo ossudo", "Bugbear Stalker": "Bugbear espreitador",
  "Bulette": "Bulette", "Camel": "Camelo", "Cat": "Gato", "Centaur Trooper": "Centauro soldado",
  "Chain Devil": "Diabo acorrentado", "Chuul": "Chuul", "Clay Golem": "Golem de argila", "Cloaker": "Capa assassina",
  "Cloud Giant": "Gigante das nuvens", "Cockatrice": "Cocatriz", "Commoner": "Plebeu",
  "Constrictor Snake": "Cobra constritora", "Couatl": "Couatl", "Crab": "Caranguejo",
  "Cultist Fanatic": "Cultista fanático", "Darkmantle": "Manto negro", "Death Dog": "Cão da morte",
  "Deer": "Cervo", "Deva": "Deva", "Dire Wolf": "Lobo atroz", "Djinni": "Djinni", "Doppelganger": "Doppelganger",
  "Draft Horse": "Cavalo de tração", "Dragon Turtle": "Tartaruga-dragão", "Dretch": "Dretch", "Drider": "Drider",
  "Druid": "Druida", "Dryad": "Dríade", "Dust Mephit": "Mefite de poeira", "Eagle": "Águia", "Efreeti": "Efreeti",
  "Elephant": "Elefante", "Elk": "Alce", "Erinyes": "Erínia", "Ettercap": "Ettercap", "Flesh Golem": "Golem de carne",
  "Flying Snake": "Cobra voadora", "Frog": "Rã", "Ghast": "Ghast", "Giant Ape": "Macaco gigante",
  "Giant Badger": "Texugo gigante", "Giant Bat": "Morcego gigante", "Giant Boar": "Javali gigante",
  "Giant Centipede": "Centopeia gigante", "Giant Constrictor Snake": "Cobra constritora gigante",
  "Giant Crab": "Caranguejo gigante", "Giant Crocodile": "Crocodilo gigante", "Giant Elk": "Alce gigante",
  "Giant Fire Beetle": "Besouro-de-fogo gigante", "Giant Fly": "Mosca gigante", "Giant Frog": "Rã gigante",
  "Giant Goat": "Bode gigante", "Giant Hyena": "Hiena gigante", "Giant Lizard": "Lagarto gigante",
  "Giant Octopus": "Polvo gigante", "Giant Owl": "Coruja gigante", "Giant Scorpion": "Escorpião gigante",
  "Giant Seahorse": "Cavalo-marinho gigante", "Giant Shark": "Tubarão gigante", "Giant Toad": "Sapo gigante",
  "Giant Vulture": "Abutre gigante", "Giant Wasp": "Vespa gigante", "Giant Weasel": "Doninha gigante",
  "Giant Wolf Spider": "Aranha-lobo gigante", "Gibbering Mouther": "Boca balbuciante", "Glabrezu": "Glabrezu",
  "Gladiator": "Gladiador", "Goat": "Bode", "Goblin Boss": "Chefe goblin", "Goblin Minion": "Goblin lacaio",
  "Gorgon": "Górgona", "Gray Ooze": "Limo cinzento", "Green Hag": "Bruxa verde", "Grick": "Grick",
  "Grimlock": "Grimlock", "Guard Captain": "Capitão da guarda", "Guardian Naga": "Naga guardiã",
  "Half-Dragon": "Meio-dragão", "Hawk": "Falcão", "Hell Hound": "Cão infernal", "Hezrou": "Hezrou",
  "Hippogriff": "Hipogrifo", "Hippopotamus": "Hipopótamo", "Hobgoblin Captain": "Capitão hobgoblin",
  "Homunculus": "Homúnculo", "Horned Devil": "Diabo chifrudo", "Hunter Shark": "Tubarão caçador", "Hydra": "Hidra",
  "Hyena": "Hiena", "Ice Devil": "Diabo do gelo", "Ice Mephit": "Mefite de gelo", "Incubus": "Íncubo",
  "Invisible Stalker": "Perseguidor invisível", "Iron Golem": "Golem de ferro", "Jackal": "Chacal",
  "Killer Whale": "Orca", "Kraken": "Kraken", "Lamia": "Lâmia", "Lemure": "Lêmure", "Lion": "Leão",
  "Lizard": "Lagarto", "Magma Mephit": "Mefite de magma", "Magmin": "Magmin", "Mammoth": "Mamute",
  "Marilith": "Marilith", "Mastiff": "Mastim", "Medusa": "Medusa", "Merfolk Skirmisher": "Sereiano batedor",
  "Merrow": "Merrow", "Mimic": "Mímico", "Minotaur Skeleton": "Esqueleto de minotauro", "Mule": "Mula",
  "Mummy": "Múmia", "Mummy Lord": "Senhor múmia", "Nalfeshnee": "Nalfeshnee", "Night Hag": "Bruxa noturna",
  "Nightmare": "Pesadelo", "Noble": "Nobre", "Ochre Jelly": "Geleia ocre", "Octopus": "Polvo",
  "Ogre Zombie": "Ogro zumbi", "Oni": "Oni", "Otyugh": "Otyugh", "Owl": "Coruja", "Panther": "Pantera",
  "Pegasus": "Pégaso", "Phase Spider": "Aranha de fase", "Piranha": "Piranha", "Pirate": "Pirata",
  "Pirate Captain": "Capitão pirata", "Pit Fiend": "Diabo do fosso", "Planetar": "Planetar",
  "Plesiosaurus": "Plesiossauro", "Polar Bear": "Urso-polar", "Pony": "Pônei", "Priest Acolyte": "Acólito",
  "Pseudodragon": "Pseudodragão", "Pteranodon": "Pteranodonte", "Purple Worm": "Verme púrpura",
  "Quasit": "Quasit", "Rakshasa": "Rakshasa", "Rat": "Rato", "Raven": "Corvo", "Reef Shark": "Tubarão-de-recife",
  "Remorhaz": "Remorhaz", "Rhinoceros": "Rinoceronte", "Riding Horse": "Cavalo de montaria", "Roc": "Roca",
  "Roper": "Roper", "Rust Monster": "Monstro da ferrugem", "Saber-Toothed Tiger": "Tigre-dentes-de-sabre",
  "Sahuagin Warrior": "Guerreiro sahuagin", "Salamander": "Salamandra", "Satyr": "Sátiro", "Scorpion": "Escorpião",
  "Scout": "Batedor", "Sea Hag": "Bruxa do mar", "Seahorse": "Cavalo-marinho", "Shambling Mound": "Monte ambulante",
  "Shield Guardian": "Guardião escudo", "Shrieker Fungus": "Fungo gritador", "Solar": "Solar",
  // O "Espectro" da lista curada é o Wraith (tradução que o catálogo já usava).
  "Specter": "Aparição",
  "Sphinx of Lore": "Esfinge do saber", "Sphinx of Valor": "Esfinge do valor", "Sphinx of Wonder": "Esfinge do encanto",
  "Spider": "Aranha", "Spirit Naga": "Naga espiritual", "Sprite": "Sprite", "Spy": "Espião",
  "Steam Mephit": "Mefite de vapor", "Stone Giant": "Gigante de pedra", "Stone Golem": "Golem de pedra",
  "Storm Giant": "Gigante das tempestades", "Succubus": "Súcubo", "Swarm of Bats": "Enxame de morcegos",
  "Swarm of Crawling Claws": "Enxame de garras rastejantes", "Swarm of Insects": "Enxame de insetos",
  "Swarm of Piranhas": "Enxame de piranhas", "Swarm of Rats": "Enxame de ratos", "Swarm of Ravens": "Enxame de corvos",
  "Swarm of Venomous Snakes": "Enxame de cobras venenosas", "Tarrasque": "Tarrasque", "Tiger": "Tigre",
  "Tough": "Brutamontes", "Tough Boss": "Chefe dos brutamontes", "Treant": "Treant", "Triceratops": "Tricerátops",
  "Troll Limb": "Membro de troll", "Tyrannosaurus Rex": "Tiranossauro rex", "Unicorn": "Unicórnio",
  "Vampire": "Vampiro", "Vampire Familiar": "Familiar vampírico", "Venomous Snake": "Cobra venenosa",
  "Violet Fungus": "Fungo violeta", "Vrock": "Vrock", "Vulture": "Abutre", "Warhorse": "Cavalo de guerra",
  "Warhorse Skeleton": "Esqueleto de cavalo de guerra", "Warrior Infantry": "Soldado de infantaria",
  "Warrior Veteran": "Guerreiro veterano", "Weasel": "Doninha", "Werebear": "Homem-urso", "Wereboar": "Homem-javali",
  "Wererat": "Homem-rato", "Weretiger": "Homem-tigre", "Will-o'-Wisp": "Fogo-fátuo", "Winter Wolf": "Lobo do inverno",
  "Wyvern": "Serpe", "Xorn": "Xorn",
};

/** Ações com jogada de ataque. */
const ATAQUES = {
  "Abyssal Glaive": "Glaive abissal", "Arcane Burst": "Explosão arcana", "Attach": "Grudar",
  "Battleaxe": "Machado de batalha", "Beak": "Bico", "Beaks": "Bicadas", "Beard": "Barba", "Bite": "Mordida",
  "Bites": "Mordidas", "Bladed Arm": "Braço-lâmina", "Bone Bow": "Arco de osso", "Bone Cudgel": "Porrete de osso",
  "Boulder": "Pedregulho", "Burn": "Queimadura", "Burning Hammer": "Martelo ardente", "Chain": "Corrente",
  "Channel Negative Energy": "Canalizar energia negativa", "Charged Tendril": "Gavinha eletrizada", "Claw": "Garra",
  "Claws": "Garras", "Club": "Clava", "Crush": "Esmagar", "Cursed Touch": "Toque amaldiçoado", "Dagger": "Adaga",
  "Devilish Claw": "Garra diabólica", "Dissolving Pseudopod": "Pseudópode dissolvente",
  "Draining Swipe": "Investida drenante", "Eldritch Burst": "Explosão mística", "Enchanting Bow": "Arco encantador",
  "Fiendish Touch": "Toque corruptor", "Fiery Bolt": "Raio de fogo", "Fiery Mace": "Maça flamejante", "Fist": "Punho",
  "Flame Spear": "Lança de chamas", "Flame Sword": "Espada flamejante", "Flame Whip": "Chicote de chamas",
  "Flying Sword": "Espada voadora", "Force Bolt": "Raio de força", "Foreleg": "Pata dianteira",
  "Frost Axe": "Machado gélido", "Gore": "Chifrada", "Gouge": "Estocada", "Grab": "Agarrão",
  "Grave Strike": "Golpe sepulcral", "Great Bow": "Arco grande", "Greataxe": "Machado grande",
  "Greatclub": "Clava grande", "Greatsword": "Espadão", "Hail of Bark": "Chuva de casca",
  "Hammer Throw": "Martelo arremessado", "Hand Crossbow": "Besta de mão", "Handaxe": "Machadinha",
  "Harpoon": "Arpão", "Heated Blade": "Lâmina incandescente", "Heavy Crossbow": "Besta pesada",
  "Holy Mace": "Maça sagrada", "Hooves": "Cascos", "Hurl Flame": "Arremessar chamas", "Ice Spear": "Lança de gelo",
  "Infernal Glaive": "Glaive infernal", "Infernal Sting": "Ferrão infernal", "Javelin": "Azagaia",
  "Life Drain": "Drenar vida", "Light Crossbow": "Besta leve", "Light Hammer": "Martelo leve",
  "Lightning Blade": "Lâmina relampejante", "Longbow": "Arco longo", "Longsword": "Espada longa", "Mace": "Maça",
  "Morningstar": "Maça-estrela", "Necrotic Bow": "Arco necrótico", "Necrotic Ray": "Raio necrótico",
  "Necrotic Sword": "Espada necrótica", "Needle Sword": "Espada-agulha", "Nightmare Ray": "Raio de pesadelo",
  "Ocean Spear": "Lança oceânica", "Pact Blade": "Lâmina do pacto", "Paralyzing Touch": "Toque paralisante",
  "Petrifying Bite": "Mordida petrificante", "Pike": "Pique", "Pincer": "Pinça", "Pistol": "Pistola",
  "Poison Burst": "Explosão de veneno", "Poison Ray": "Raio venenoso", "Proboscis": "Probóscide",
  "Pseudopod": "Pseudópode", "Radiant Flame": "Chama radiante", "Radiant Horn": "Chifre radiante",
  "Radiant Sword": "Espada radiante", "Rake": "Rasgar", "Ram": "Aríete", "Rapier": "Rapieira", "Rend": "Dilacerar",
  "Restless Touch": "Toque inquieto", "Ritual Sickle": "Foice ritual", "Rock": "Pedra", "Rock Launch": "Lançar pedra",
  "Rotting Fist": "Punho putrefato", "Rotting Touch": "Toque putrefato", "Scimitar": "Cimitarra",
  "Scratch": "Arranhão", "Searing Fork": "Forcado escaldante", "Shock": "Choque", "Shortbow": "Arco curto",
  "Shortsword": "Espada curta", "Shred": "Retalhar", "Slam": "Golpe", "Slash": "Talho", "Smother": "Sufocar",
  "Snake Hair": "Cabelo de serpentes", "Spear": "Lança", "Sting": "Ferrão", "Stone Club": "Clava de pedra",
  "Storm Blade": "Lâmina da tempestade", "Storm Bolt": "Raio da tempestade", "Storm Sword": "Espada da tempestade",
  "Swarm of Grasping Hands": "Enxame de mãos agarradoras", "Tail": "Cauda", "Tail Spike": "Espinho de cauda",
  "Tail Stinger": "Ferrão da cauda", "Talons": "Garras", "Tentacle": "Tentáculo", "Tentacles": "Tentáculos",
  "Thorn Burst": "Explosão de espinhos", "Thunderbolt": "Relâmpago", "Thundercloud": "Nuvem trovejante",
  "Thunderous Mace": "Maça trovejante", "Thunderous Slam": "Golpe trovejante", "Touch": "Toque",
  "Trash Lob": "Arremesso de lixo", "Tree Club": "Clava de tronco", "Tusk": "Presa", "Umbral Dagger": "Adaga umbral",
  "Verdant Wisp": "Fagulha verdejante", "Vile Slime": "Gosma vil", "Vine Lash": "Chicote de vinha",
  "Vine Staff": "Cajado de vinha", "Warhammer": "Martelo de guerra", "Wind Swipe": "Rajada de vento",
  "Withering Sword": "Espada definhante", "Withering Touch": "Toque definhante",
};

/** Ações em que o ALVO rola a resistência (sopro, olhar...). */
const RESISTENCIAS = {
  "Acid Breath": "Sopro ácido", "Acid Spray": "Borrifo ácido", "Baleful Command": "Comando funesto",
  "Bite": "Mordida", "Blinding Spittle": "Cuspe cegante", "Boulder Toss": "Arremessar pedregulho",
  "Cold Breath": "Sopro de frio", "Conjure Infernal Chain": "Corrente infernal", "Constrict": "Constringir",
  "Consume Memories": "Consumir memórias", "Corrupting Touch": "Toque corrompido",
  "Create Whirlwind": "Criar redemoinho", "Deadly Leap": "Salto mortal", "Death Glare": "Olhar mortal",
  "Dragon's Breath": "Sopro de dragão", "Draining Kiss": "Beijo drenante", "Dreadful Glare": "Olhar pavoroso",
  "Engulf": "Engolfar", "Entangling Rope": "Corda enredante", "Fire Breath": "Sopro de fogo", "Fling": "Arremessar",
  "Frost Breath": "Sopro gélido", "Holy Burst": "Explosão sagrada", "Horrific Visage": "Visagem horripilante",
  "Infernal Tail": "Cauda infernal", "Life Drain": "Drenar vida", "Lightning Breath": "Sopro de relâmpago",
  "Lightning Storm": "Tempestade de raios", "Lightning Strike": "Golpe de raio",
  "Mind-Rending Roar": "Rugido dilacerante", "Mockery": "Zombaria", "Poison Breath": "Sopro venenoso",
  "Poisonous Spittle": "Cuspe venenoso", "Pummel": "Espancar", "Roar": "Rugido", "Shield Bash": "Golpe de escudo",
  "Slaying Bow": "Arco assassino", "Spores": "Esporos", "Steam Breath": "Sopro de vapor", "Sting": "Ferrão",
  "Stunning Screech": "Guincho atordoante", "Swallow": "Engolir", "Tentacle Slam": "Pancada de tentáculos",
  "Thunderous Bellow": "Bramido trovejante", "Vortex": "Vórtice", "Weakening Breath": "Sopro enfraquecedor",
  "Whelm": "Sobrepujar", "Whirlwind": "Redemoinho",
};

/** Tipo de dano: como vai na linha de ataque (o leitor de ataque entende
 *  "de fogo") e como vai nas notas ("imune a fogo"). */
const DANOS = {
  Acid: ["ácido", "ácido"], Bludgeoning: ["contundente", "contundente"], Cold: ["de frio", "frio"],
  Fire: ["de fogo", "fogo"], Force: ["de força", "força"], Lightning: ["elétrico", "elétrico"],
  Necrotic: ["necrótico", "necrótico"], Piercing: ["perfurante", "perfurante"], Poison: ["veneno", "veneno"],
  Psychic: ["psíquico", "psíquico"], Radiant: ["radiante", "radiante"], Slashing: ["cortante", "cortante"],
  Thunder: ["de trovão", "trovão"],
};

const CONDICOES = {
  Blinded: "Cego", Charmed: "Enfeitiçado", Deafened: "Surdo", Exhaustion: "Exaustão", Frightened: "Amedrontado",
  Grappled: "Agarrado", Incapacitated: "Incapacitado", Paralyzed: "Paralisado", Petrified: "Petrificado",
  Poisoned: "Envenenado", Prone: "Caído", Restrained: "Contido", Stunned: "Atordoado", Unconscious: "Inconsciente",
};

// [tipo, feminino?]
const TIPOS = {
  Aberration: ["Aberração", true], Beast: ["Fera", true], Celestial: ["Celestial", false],
  Construct: ["Constructo", false], Dragon: ["Dragão", false], Elemental: ["Elemental", false], Fey: ["Fada", true],
  Fiend: ["Corruptor", false], Giant: ["Gigante", false], Humanoid: ["Humanoide", false],
  Monstrosity: ["Monstruosidade", true], Ooze: ["Limo", false], Plant: ["Planta", true],
  Undead: ["Morto-vivo", false],
};
const TAMANHOS = {
  Tiny: ["miúdo", "miúda"], Small: ["pequeno", "pequena"], Medium: ["médio", "média"],
  MediumOrSmall: ["médio ou pequeno", "média ou pequena"],
  Large: ["grande", "grande"], Huge: ["enorme", "enorme"], Gargantuan: ["imenso", "imensa"],
};

/**
 * A open5e marca como "Small" três tamanhos diferentes do SRD 2024: Miúdo
 * (gato, diabrete), Pequeno (goblin) e "Médio ou Pequeno" (os humanoides,
 * vampiros, licantropos). O dado de vida desempata — no D&D ele vem do
 * tamanho: Miúdo d4, Pequeno d6, Médio d8 (conferido: os 84 "Small" da fonte
 * caem certinho em d4/d6/d8, e cada tamanho maior tem um dado só).
 */
export function tamanhoReal(t) {
  if (t.size.name !== "Small") return t.size.name;
  const dado = (t.hit_dice ?? "").match(/d(\d+)/)?.[1];
  return dado === "4" ? "Tiny" : dado === "8" ? "MediumOrSmall" : "Small";
}

/** Habilidades comuns que valem uma palavra nas notas (o resto fica no livro). */
const HABILIDADES = [
  ["Magic Resistance", "Resistência à magia (vantagem nas resistências contra magia)"],
  ["Pack Tactics", "Tática de bando"],
  ["Amphibious", "Anfíbio"],
  ["Water Breathing", "Respira embaixo d'água"],
  ["Spider Climb", "Escala como aranha, até de cabeça pra baixo"],
  ["Flyby", "Voo rasante: sair de perto não provoca ataque de oportunidade"],
  ["Swarm", "Enxame: divide espaço com outras criaturas"],
  ["Sunlight Sensitivity", "Sensível à luz solar"],
  ["Death Burst", "Explode ao morrer"],
  ["Fire Aura", "Aura de fogo: queima quem chega perto"],
  ["Amorphous", "Amorfo: passa por frestas de 2,5 cm"],
  ["Immutable Form", "Forma imutável"],
  ["Siege Monster", "Monstro de cerco: dano dobrado em objetos e estruturas"],
  ["Incorporeal Movement", "Atravessa criaturas e objetos"],
  ["Regeneration", "Regeneração"],
  ["Undead Fortitude", "Fortitude de morto-vivo: resiste pra ficar com 1 PV"],
  ["Shapechanger", "Muda de forma"],
  ["False Appearance", "Parado, parece objeto comum"],
];

// ─── Leitura da fonte ───────────────────────────────────────────────────────

const NUMEROS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

export function nomeEmPortugues(en) {
  const dragao = en.match(/^(?:(Young|Adult|Ancient) )?(\w+) Dragon(?: (Wyrmling))?$/);
  if (dragao && CORES[dragao[2]]) {
    const idade = IDADES[dragao[1] ?? dragao[3]];
    if (idade) return `Dragão ${CORES[dragao[2]]} ${idade}`;
  }
  return NOMES[en] ?? null;
}

function tipoETamanho(t) {
  const [tipo, feminino] = TIPOS[t.type.name];
  return `${tipo} ${TAMANHOS[tamanhoReal(t)][feminino ? 1 : 0]}`;
}

const metros = (pes) => Math.round(pes * 0.3 * 10) / 10;
const comSinal = (n) => (n >= 0 ? `+${n}` : `${n}`);

/** "13 (1d10 + 8) Slashing" → "1d10+8 cortante"; "1 Slashing" → "1 cortante". */
function danoPt(m) {
  const tipo = DANOS[m.tipo];
  if (!tipo) throw new Error(`tipo de dano sem tradução: ${m.tipo}`);
  if (!m.dados) return `${m.fixo} ${tipo[0]}`;
  return `${m.dados}${m.mod ? (m.mod > 0 ? `+${m.mod}` : `${m.mod}`) : ""} ${tipo[0]}`;
}

const EXPR_DANO = /(\d+)(?: \((\d+d\d+)(?: ([+−-]) (\d+))?\))? ([A-Z][a-z]+) damage/;

function lerDano(trecho) {
  const m = trecho.match(EXPR_DANO);
  if (!m) return null;
  const mod = m[4] ? Number(m[4]) * (m[3] === "+" ? 1 : -1) : 0;
  return { fixo: Number(m[1]), dados: m[2] ?? null, mod, tipo: m[5], fim: m.index + m[0].length, inicio: m.index };
}

/** Dano de um ataque: o principal e os "plus X" incondicionais da mesma frase
 *  (o "plus 1d4 if the attack roll had Advantage" do goblin fica de fora, e a
 *  versão de duas mãos, "or 8 (1d10 + 3)...", também). */
function danoDoAtaque(desc) {
  const principal = lerDano(desc);
  if (!principal) return null;
  const partes = [danoPt(principal)];
  let resto = desc.slice(principal.fim);
  const fimFrase = resto.search(/\.(\s|$)|, or /);
  if (fimFrase >= 0) resto = resto.slice(0, fimFrase);
  for (const pedaco of resto.split(/\bplus\b/).slice(1)) {
    if (/\bif\b|\bwhile\b|\bagainst\b/.test(pedaco)) continue;
    const extra = lerDano(pedaco);
    if (extra) partes.push(danoPt(extra));
  }
  return partes.join(" + ");
}

function recarga(limite) {
  if (!limite) return "";
  if (limite.type === "RECHARGE_ON_ROLL") return limite.param >= 6 ? " (recarga 6)" : ` (recarga ${limite.param}-6)`;
  if (limite.type === "PER_DAY") return ` (${limite.param}/dia)`;
  if (limite.type === "RECHARGE") return " (1x por descanso)";
  return "";
}

/** "makes three Rend attacks" / "two attacks, using A or B in any combination"
 *  / "one Bite attack and two Claw attacks" → como montar a linha. */
function lerMultiataque(desc) {
  let frase = desc.split(/\.(?:\s|$)/)[0];
  frase = frase.split(/, or it makes|, or |\bor uses\b|\band uses\b|\band can use\b|, and it (?:uses|can)|, uses /)[0];
  const qualquer = frase.match(/makes (\w+)(?: other)? attacks, using (.+?) in any combination/);
  const antes = frase.match(/makes one ([A-Z][\w' -]*?) attack and (\w+) other attacks, using (.+?) in any combination/);
  if (antes) {
    const nomes = [antes[1], ...antes[3].split(/, or |, | or | and /)];
    return { tipo: "escolha", n: 1 + (NUMEROS[antes[2]] ?? 0), nomes };
  }
  if (qualquer) return { tipo: "escolha", n: NUMEROS[qualquer[1]] ?? 0, nomes: qualquer[2].split(/, or |, | or | and /) };
  const achados = [...frase.matchAll(/\b(one|two|three|four|five|six) ([A-Z][\w' -]*?)(?: or ([A-Z][\w' -]*?))? attacks?\b/g)];
  if (achados.length === 1 && achados[0][3]) {
    return { tipo: "escolha", n: NUMEROS[achados[0][1]], nomes: [achados[0][2], achados[0][3]] };
  }
  if (achados.length >= 1) {
    return { tipo: "fixo", itens: achados.map((a) => ({ n: NUMEROS[a[1]], nome: a[2] })) };
  }
  return null;
}

function linhaDeAtaque(t) {
  const acoes = t.actions.filter((a) => a.action_type === "ACTION");
  const comRolagem = [];
  const deResistencia = [];
  for (const a of acoes) {
    const acerto = a.desc.match(/Attack Roll: ([+-]\d+)/);
    if (acerto) {
      const nome = ATAQUES[a.name.trim()];
      if (!nome) throw new Error(`${t.name}: ataque sem tradução: "${a.name}"`);
      const dano = danoDoAtaque(a.desc);
      if (!dano) continue;
      comRolagem.push({ en: a.name.trim(), texto: `${nome}${recarga(a.usage_limits)} ${comSinal(Number(acerto[1]))}, ${dano}` });
      continue;
    }
    const cd = a.desc.match(/Saving Throw: DC (\d+)/);
    if (cd) {
      const falha = a.desc.indexOf("Failure:");
      const dano = danoDoAtaque(falha >= 0 ? a.desc.slice(falha) : a.desc.slice(cd.index));
      if (!dano) continue;
      const nome = RESISTENCIAS[a.name.trim()];
      if (!nome) throw new Error(`${t.name}: ação de resistência sem tradução: "${a.name}"`);
      deResistencia.push(`${nome}${recarga(a.usage_limits)}: CD ${cd[1]}, ${dano}`);
    }
  }

  const multi = acoes.find((a) => a.name.startsWith("Multiattack"));
  const plano = multi ? lerMultiataque(multi.desc) : null;
  const acha = (en) => comRolagem.find((c) => c.en.toLowerCase() === en.trim().toLowerCase());
  const usados = new Set();
  let cabeca = "";
  if (plano?.tipo === "escolha" && plano.n >= 2) {
    const escolhidos = plano.nomes.map(acha).filter(Boolean);
    if (escolhidos.length > 0) {
      escolhidos.forEach((c) => usados.add(c));
      cabeca = `${plano.n} ataques: ${escolhidos.map((c) => c.texto).join(" · ")}`;
    }
  } else if (plano?.tipo === "fixo") {
    const pedacos = [];
    for (const { n, nome } of plano.itens) {
      const c = acha(nome);
      if (!c || usados.has(c)) continue;
      usados.add(c);
      pedacos.push(`${n > 1 ? `${n}x ` : ""}${c.texto}`);
    }
    cabeca = pedacos.join(" e ");
  }
  const resto = [...comRolagem.filter((c) => !usados.has(c)).map((c) => c.texto), ...deResistencia];
  return [cabeca, ...resto].filter(Boolean).join(" · ");
}

function ndTexto(nd) {
  return nd === 0.125 ? "1/8" : nd === 0.25 ? "1/4" : nd === 0.5 ? "1/2" : String(nd);
}

function lista(itens) {
  return itens.length <= 1 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
}

function notas(t) {
  const frases = [`ND ${ndTexto(t.challenge_rating)} (${t.experience_points.toLocaleString("pt-BR")} XP)`];

  const s = t.speed;
  const movimento = [
    s.fly ? `voa ${metros(s.fly)}m${s.hover ? " (paira)" : ""}` : null,
    s.swim ? `nada ${metros(s.swim)}m` : null,
    s.climb ? `escala ${metros(s.climb)}m` : null,
    s.burrow ? `escava ${metros(s.burrow)}m` : null,
  ].filter(Boolean);
  if (movimento.length) frases.push(movimento.join(", ").replace(/^./, (c) => c.toUpperCase()));

  const r = t.resistances_and_immunities;
  const danos = (lista_) => lista_.map((x) => DANOS[x.name]?.[1] ?? x.name.toLowerCase());
  if (r.damage_immunities.length) frases.push(`Imune a ${lista(danos(r.damage_immunities))}`);
  if (r.damage_resistances.length) frases.push(`Resiste a ${lista(danos(r.damage_resistances))}`);
  if (r.damage_vulnerabilities.length) frases.push(`Vulnerável a ${lista(danos(r.damage_vulnerabilities))}`);
  if (r.condition_immunities.length) {
    frases.push(`Imune às condições ${lista(r.condition_immunities.map((c) => CONDICOES[c.name] ?? c.name))}`);
  }

  for (const traco of t.traits ?? []) {
    const lendaria = traco.name.match(/^Legendary Resistance \((\d+)\/Day(?:, or (\d+)\/Day in Lair)?\)/);
    if (lendaria) {
      frases.push(`Resistência Lendária ${lendaria[1]}/dia${lendaria[2] ? ` (${lendaria[2]} no covil)` : ""}`);
      continue;
    }
    const conhecida = HABILIDADES.find(([en]) => traco.name === en || traco.name.startsWith(`${en} (`));
    if (conhecida) frases.push(conhecida[1]);
  }

  // O que a linha de ataque não consegue dizer sobre o ataque múltiplo.
  const multi = t.actions.find((a) => a.action_type === "ACTION" && a.name.startsWith("Multiattack"));
  if (multi && /as many (\w+) attacks as it has heads/.test(multi.desc)) {
    frases.push("Ataque múltiplo: uma mordida por cabeça que tiver");
  }
  const alternativa = multi?.desc.match(/, or it makes (\w+) ([A-Z][\w' -]*?) attacks/);
  if (alternativa && ATAQUES[alternativa[2]]) {
    frases.push(`Ou, no ataque múltiplo: ${NUMEROS[alternativa[1]] ?? alternativa[1]}x ${ATAQUES[alternativa[2]]}`);
  }

  // Dano extra condicional fica fora da linha de ataque (não é sempre).
  const comVantagem = t.actions
    .map((a) => a.desc.match(/plus \d+ \((\d+d\d+)\) \w+ damage if the attack roll had Advantage/))
    .find(Boolean);
  if (comVantagem) frases.push(`Atacando com vantagem, causa +${comVantagem[1]} de dano`);

  const magia = t.actions.find((a) => a.name.startsWith("Spellcasting"));
  const cd = magia?.desc.match(/spell save DC (\d+)/);
  if (magia) frases.push(cd ? `Conjura magias (CD ${cd[1]})` : "Conjura magias");
  if (t.actions.some((a) => a.action_type === "LEGENDARY_ACTION")) frases.push("Tem ações lendárias");
  return `${frases.join(". ")}.`;
}

/** `name` à parte pra dar pra comparar os curados (que não estão em NOMES). */
export function monstroDaFonte(t, name = nomeEmPortugues(t.name)) {
  if (!name) throw new Error(`criatura sem tradução: "${t.name}"`);
  return {
    name,
    en: t.name,
    nd: t.challenge_rating,
    cls: tipoETamanho(t),
    ac: t.armor_class,
    hp_max: t.hit_points,
    speed: metros(t.speed.walk ?? 0),
    init_mod: t.initiative_bonus,
    ataque: linhaDeAtaque(t),
    notes: notas(t),
  };
}

async function baixar() {
  const todas = [];
  for (let url = FONTE; url; ) {
    const resp = await fetch(url, { headers: { "User-Agent": "painel-de-mesa (gerador do catalogo)" } });
    if (!resp.ok) throw new Error(`open5e respondeu ${resp.status}`);
    const pagina = await resp.json();
    todas.push(...pagina.results);
    url = pagina.next;
  }
  return todas;
}

const TS = (m) =>
  `  { name: ${JSON.stringify(m.name)}, en: ${JSON.stringify(m.en)}, nd: ${m.nd}, cls: ${JSON.stringify(m.cls)}, ` +
  `ac: ${m.ac}, hp_max: ${m.hp_max}, speed: ${m.speed}, init_mod: ${m.init_mod}, ` +
  `ataque: ${JSON.stringify(m.ataque)}, notes: ${JSON.stringify(m.notes)} },`;

async function main() {
  const arquivo = process.argv[2];
  const fonte = arquivo ? JSON.parse(await readFile(arquivo, "utf-8")) : await baixar();
  if (fonte.length !== TOTAL_SRD_2024) throw new Error(`a fonte tem ${fonte.length} criaturas, esperava ${TOTAL_SRD_2024}`);
  const curados = new Set(CURADOS_EN);
  const faltando = CURADOS_EN.filter((en) => !fonte.some((t) => t.name === en));
  if (faltando.length) throw new Error(`curados que não existem na fonte: ${faltando.join(", ")}`);

  const gerados = fonte
    .filter((t) => !curados.has(t.name))
    .map((t) => monstroDaFonte(t))
    .sort((a, b) => a.nd - b.nd || a.name.localeCompare(b.name, "pt-BR"));

  const repetidos = gerados.map((m) => m.name).filter((n, i, todos) => todos.indexOf(n) !== i);
  if (repetidos.length) throw new Error(`nome repetido: ${repetidos.join(", ")}`);

  const cabecalho = `// GERADO por scripts/gerar-monstros-srd.mjs a partir do SRD 5.2 (D&D 2024,
// CC-BY-4.0, Wizards of the Coast), via open5e. NÃO EDITE À MÃO — rode o
// gerador de novo; pra caprichar num monstro, mova-o pra lista curada em
// monstrosSrd.ts (ver o cabeçalho do gerador).
import type { MonstroCatalogo } from "./monstrosSrd";

export const MONSTROS_GERADOS: MonstroCatalogo[] = [
`;
  const destino = fileURLToPath(new URL("../src/lib/monstrosSrdGerados.ts", import.meta.url));
  await writeFile(destino, `${cabecalho}${gerados.map(TS).join("\n")}\n];\n`, "utf-8");
  console.log(`${gerados.length} monstros gerados em ${destino}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
