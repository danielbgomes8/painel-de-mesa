#!/usr/bin/env node
/**
 * Gera src/lib/magiasSrdGerados.ts — as 339 magias do SRD 5.2 (D&D 2024,
 * CC-BY-4.0, Wizards of the Coast), lidas direto da fonte estruturada (open5e,
 * documento srd-2024). O que é DADO (nível, escola, tempo, alcance, duração,
 * componentes, concentração, ritual, dano, salvaguarda, classes) sai da fonte e é
 * traduzido pelas tabelas abaixo, sem ninguém digitar número. O que é TEXTO
 * (descrição, "em níveis superiores", gatilho, material) vem de scripts/magias-ptbr.json,
 * traduzido com a skill baoyu-translate e conferido por importar-traducao-magias.mjs
 * (mesmos dados de rolagem, nada em pés/milhas). Sem esse arquivo, fica o inglês.
 *
 * O NOME em português vem de NOMES, a tradução publicada do livro de 2014;
 * onde não há nome consagrado de que se tenha certeza, fica o original. A
 * busca acha pelos dois nomes.
 *
 *   node scripts/gerar-magias-srd.mjs              (baixa da open5e)
 *   node scripts/gerar-magias-srd.mjs dados.json   (usa uma cópia local)
 *
 * Não edite o arquivo gerado à mão: pra mudar um nome, edite NOMES aqui e rode de novo.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const FONTE = "https://api.open5e.com/v2/spells/?document__key=srd-2024&limit=100";

/** Quantas magias o SRD 5.2 tem na fonte (o teste confere o catálogo). */
export const TOTAL_SRD_2024 = 339;

const ESCOLAS = {
  Abjuration: "Abjuração", Conjuration: "Conjuração", Divination: "Adivinhação", Enchantment: "Encantamento",
  Evocation: "Evocação", Illusion: "Ilusão", Necromancy: "Necromancia", Transmutation: "Transmutação",
};

const CLASSES = {
  Bard: "Bardo", Cleric: "Clérigo", Druid: "Druida", Paladin: "Paladino", Ranger: "Patrulheiro",
  Sorcerer: "Feiticeiro", Warlock: "Bruxo", Wizard: "Mago",
};

const TEMPOS = {
  action: "1 ação", "bonus-action": "1 ação bônus", reaction: "1 reação",
  "1minute": "1 minuto", "10minutes": "10 minutos", "1hour": "1 hora",
};

const ATRIBUTOS = {
  strength: "Força", dexterity: "Destreza", constitution: "Constituição",
  intelligence: "Inteligência", wisdom: "Sabedoria", charisma: "Carisma",
};

const DANOS = {
  acid: "ácido", bludgeoning: "contundente", cold: "frio", fire: "fogo", force: "energia", lightning: "elétrico",
  necrotic: "necrótico", piercing: "perfurante", poison: "veneno", psychic: "psíquico", radiant: "radiante",
  slashing: "cortante", thunder: "trovejante",
};

const UNIDADES = { round: ["rodada", "rodadas"], minute: ["minuto", "minutos"], hour: ["hora", "horas"], day: ["dia", "dias"] };

const SEM_NOME_EM_PT = new Set();

/** Lacunas da fonte: magias que a open5e entrega com a descrição vazia. O texto é o do
 *  SRD 5.2 (conferido em 02/10/2026); some daqui quando a fonte for corrigida. */
const TEXTO_FALTANTE = {
  "Greater Invisibility": "A creature you touch has the Invisible condition until the spell ends.",
};

/** Nome em português (tradução do livro de 2014). Ausente = fica o original. */
const NOMES = {
  "Acid Arrow": "Flecha ácida", "Acid Splash": "Respingo ácido", "Aid": "Ajuda", "Alarm": "Alarme",
  "Alter Self": "Alterar-se", "Animal Friendship": "Amizade animal", "Animal Messenger": "Mensageiro animal",
  "Animal Shapes": "Formas animais", "Animate Dead": "Animar mortos", "Animate Objects": "Animar objetos",
  "Antilife Shell": "Carapaça antivida", "Antimagic Field": "Campo antimagia", "Antipathy/Sympathy": "Antipatia/Simpatia",
  "Arcane Eye": "Olho arcano", "Arcane Hand": "Mão arcana", "Arcane Lock": "Tranca arcana", "Arcane Sword": "Espada arcana",
  "Arcanist's Magic Aura": "Aura mágica do arcanista", "Astral Projection": "Projeção astral", "Augury": "Augúrio",
  "Aura of Life": "Aura de vida", "Awaken": "Despertar", "Bane": "Perdição", "Banishment": "Banimento",
  "Barkskin": "Pele de árvore", "Beacon of Hope": "Farol de esperança", "Bestow Curse": "Rogar maldição",
  "Black Tentacles": "Tentáculos negros", "Blade Barrier": "Barreira de lâminas", "Bless": "Bênção", "Blight": "Definhar",
  "Blindness/Deafness": "Cegueira/Surdez", "Blink": "Piscar", "Blur": "Borrão", "Burning Hands": "Mãos flamejantes",
  "Call Lightning": "Convocar relâmpago", "Calm Emotions": "Acalmar emoções", "Chain Lightning": "Relâmpago encadeado",
  "Charm Monster": "Enfeitiçar monstro", "Charm Person": "Enfeitiçar pessoa", "Chill Touch": "Toque gélido",
  "Chromatic Orb": "Orbe cromática", "Circle of Death": "Círculo da morte", "Clairvoyance": "Clarividência",
  "Clone": "Clone", "Cloudkill": "Nuvem mortal", "Color Spray": "Spray colorido", "Command": "Comando",
  "Commune": "Comunhão", "Commune with Nature": "Comunhão com a natureza", "Comprehend Languages": "Compreender idiomas",
  "Compulsion": "Compulsão", "Cone of Cold": "Cone de frio", "Confusion": "Confusão", "Conjure Animals": "Invocar animais",
  "Conjure Celestial": "Invocar celestial", "Conjure Elemental": "Invocar elemental", "Conjure Fey": "Invocar feérico",
  "Conjure Minor Elementals": "Invocar elementais menores", "Conjure Woodland Beings": "Invocar seres da floresta",
  "Contact Other Plane": "Contatar outro plano", "Contagion": "Contágio", "Contingency": "Contingência",
  "Continual Flame": "Chama contínua", "Control Water": "Controlar a água", "Control Weather": "Controlar o clima",
  "Counterspell": "Contramágica", "Create Food and Water": "Criar alimento e água", "Create Undead": "Criar mortos-vivos",
  "Create or Destroy Water": "Criar ou destruir água", "Creation": "Criação", "Cure Wounds": "Curar ferimentos",
  "Dancing Lights": "Luzes dançantes", "Darkness": "Escuridão", "Darkvision": "Visão no escuro", "Daylight": "Luz do dia",
  "Death Ward": "Proteção contra a morte", "Delayed Blast Fireball": "Bola de fogo controlada", "Demiplane": "Semiplano",
  "Detect Evil and Good": "Detectar o bem e o mal", "Detect Magic": "Detectar magia",
  "Detect Poison and Disease": "Detectar veneno e doença", "Detect Thoughts": "Detectar pensamentos",
  "Dimension Door": "Porta dimensional", "Disguise Self": "Disfarçar-se", "Disintegrate": "Desintegrar",
  "Dispel Evil and Good": "Dissipar o bem e o mal", "Dispel Magic": "Dissipar magia",
  "Dissonant Whispers": "Sussurros dissonantes", "Divination": "Adivinhação", "Divine Favor": "Favor divino",
  "Divine Smite": "Punição divina", "Divine Word": "Palavra divina", "Dominate Beast": "Dominar fera",
  "Dominate Monster": "Dominar monstro", "Dominate Person": "Dominar pessoa", "Dragon's Breath": "Sopro do dragão",
  "Dream": "Sonho", "Druidcraft": "Arte druídica", "Earthquake": "Terremoto", "Eldritch Blast": "Rajada mística",
  "Elementalism": "Elementalismo", "Enhance Ability": "Aprimorar habilidade", "Enlarge/Reduce": "Aumentar/Reduzir",
  "Entangle": "Enredar", "Enthrall": "Cativar", "Etherealness": "Eterealidade", "Expeditious Retreat": "Retirada acelerada",
  "Fabricate": "Fabricar", "Faerie Fire": "Fogo das fadas", "Faithful Hound": "Cão fiel", "False Life": "Vida falsa",
  "Fear": "Medo", "Feather Fall": "Queda suave", "Find Familiar": "Convocar familiar", "Find Steed": "Convocar montaria",
  "Find Traps": "Encontrar armadilhas", "Find the Path": "Encontrar o caminho", "Finger of Death": "Dedo da morte",
  "Fire Bolt": "Raio de fogo", "Fire Shield": "Escudo de fogo", "Fire Storm": "Tempestade de fogo", "Fireball": "Bola de fogo",
  "Flame Blade": "Lâmina de fogo", "Flame Strike": "Coluna de chamas", "Flaming Sphere": "Esfera flamejante",
  "Flesh to Stone": "Carne para pedra", "Floating Disk": "Disco flutuante", "Fly": "Voo", "Fog Cloud": "Névoa",
  "Forbiddance": "Proibição", "Forcecage": "Jaula de força", "Foresight": "Presciência",
  "Freedom of Movement": "Liberdade de movimento", "Freezing Sphere": "Esfera congelante", "Gaseous Form": "Forma gasosa",
  "Gate": "Portal", "Geas": "Missão", "Gentle Repose": "Descanso tranquilo", "Giant Insect": "Inseto gigante",
  "Glibness": "Eloquência", "Globe of Invulnerability": "Globo de invulnerabilidade", "Glyph of Warding": "Glifo de proteção",
  "Grease": "Graxa", "Greater Invisibility": "Invisibilidade maior", "Greater Restoration": "Restauração maior",
  "Guardian of Faith": "Guardião da fé", "Guards and Wards": "Guardas e proteções", "Guidance": "Orientação",
  "Guiding Bolt": "Raio guia", "Gust of Wind": "Lufada de vento", "Hallow": "Santificar",
  "Hallucinatory Terrain": "Terreno alucinatório", "Haste": "Velocidade", "Heal": "Cura", "Healing Word": "Palavra de cura",
  "Heat Metal": "Aquecer metal", "Hellish Rebuke": "Repreensão diabólica", "Heroes' Feast": "Banquete de heróis",
  "Heroism": "Heroísmo", "Hex": "Maldição", "Hideous Laughter": "Riso histérico", "Hold Monster": "Imobilizar monstro",
  "Hold Person": "Imobilizar pessoa", "Holy Aura": "Aura sagrada", "Hunter's Mark": "Marca do caçador",
  "Hypnotic Pattern": "Padrão hipnótico", "Ice Knife": "Faca de gelo", "Ice Storm": "Tempestade de gelo",
  "Identify": "Identificação", "Illusory Script": "Escrita ilusória", "Imprisonment": "Aprisionamento",
  "Incendiary Cloud": "Nuvem incendiária", "Inflict Wounds": "Infligir ferimentos", "Insect Plague": "Praga de insetos",
  "Instant Summons": "Invocação instantânea", "Invisibility": "Invisibilidade", "Irresistible Dance": "Dança irresistível",
  "Jump": "Salto", "Knock": "Arrombar", "Legend Lore": "Conhecimento lendário", "Lesser Restoration": "Restauração menor",
  "Levitate": "Levitação", "Light": "Luz", "Lightning Bolt": "Relâmpago",
  "Locate Animals or Plants": "Localizar animais ou plantas", "Locate Creature": "Localizar criatura",
  "Locate Object": "Localizar objeto", "Longstrider": "Passos largos", "Mage Armor": "Armadura arcana",
  "Mage Hand": "Mãos mágicas", "Magic Circle": "Círculo mágico", "Magic Missile": "Mísseis mágicos",
  "Magic Mouth": "Boca mágica", "Magic Weapon": "Arma mágica", "Magnificent Mansion": "Mansão magnífica",
  "Major Image": "Imagem maior", "Mass Cure Wounds": "Curar ferimentos em massa", "Mass Heal": "Cura em massa",
  "Mass Healing Word": "Palavra de cura em massa", "Mass Suggestion": "Sugestão em massa", "Maze": "Labirinto",
  "Meld into Stone": "Fundir-se à pedra", "Mending": "Reparar", "Message": "Mensagem", "Meteor Swarm": "Chuva de meteoros",
  "Mind Blank": "Mente vazia", "Minor Illusion": "Ilusão menor", "Mirage Arcane": "Miragem arcana",
  "Mirror Image": "Imagem espelhada", "Mislead": "Despistar", "Misty Step": "Passo nebuloso",
  "Modify Memory": "Modificar memória", "Moonbeam": "Raio de luar", "Move Earth": "Mover terra",
  "Nondetection": "Não detecção", "Pass without Trace": "Passar sem rastro", "Passwall": "Passa-parede",
  "Phantasmal Force": "Força fantasmagórica", "Phantasmal Killer": "Assassino fantasmagórico",
  "Phantom Steed": "Montaria fantasmagórica", "Planar Ally": "Aliado planar", "Planar Binding": "Vínculo planar",
  "Plane Shift": "Mudança de plano", "Plant Growth": "Crescimento vegetal", "Poison Spray": "Spray venenoso",
  "Polymorph": "Metamorfose", "Power Word Heal": "Palavra de poder: curar", "Power Word Kill": "Palavra de poder: matar",
  "Power Word Stun": "Palavra de poder: atordoar", "Prayer of Healing": "Oração de cura",
  "Prestidigitation": "Prestidigitação", "Prismatic Spray": "Spray prismático", "Prismatic Wall": "Muralha prismática",
  "Private Sanctum": "Santuário particular", "Produce Flame": "Criar chamas", "Programmed Illusion": "Ilusão programada",
  "Project Image": "Projetar imagem", "Protection from Energy": "Proteção contra energia",
  "Protection from Evil and Good": "Proteção contra o bem e o mal", "Protection from Poison": "Proteção contra veneno",
  "Purify Food and Drink": "Purificar alimentos e bebidas", "Raise Dead": "Reviver os mortos",
  "Ray of Enfeeblement": "Raio do enfraquecimento", "Ray of Frost": "Raio de gelo", "Ray of Sickness": "Raio nauseante",
  "Regenerate": "Regenerar", "Reincarnate": "Reencarnar", "Remove Curse": "Remover maldição",
  "Resilient Sphere": "Esfera resiliente", "Resistance": "Resistência", "Resurrection": "Ressurreição",
  "Revivify": "Revivificar", "Rope Trick": "Truque da corda", "Sacred Flame": "Chama sagrada", "Sanctuary": "Santuário",
  "Scorching Ray": "Raio ardente", "Scrying": "Vidência", "Searing Smite": "Golpe ardente",
  "See Invisibility": "Ver o invisível", "Seeming": "Aparência", "Sequester": "Isolar", "Shapechange": "Mudar de forma",
  "Shatter": "Despedaçar", "Shield": "Escudo arcano", "Shield of Faith": "Escudo da fé", "Shocking Grasp": "Toque chocante",
  "Silence": "Silêncio", "Silent Image": "Imagem silenciosa", "Simulacrum": "Simulacro", "Sleep": "Sono", "Slow": "Lentidão",
  "Spare the Dying": "Poupar os moribundos", "Speak with Animals": "Falar com animais",
  "Speak with Dead": "Falar com os mortos", "Speak with Plants": "Falar com plantas", "Spider Climb": "Escalada de aranha",
  "Spike Growth": "Crescimento de espinhos", "Spirit Guardians": "Espíritos guardiões", "Spiritual Weapon": "Arma espiritual",
  "Stinking Cloud": "Nuvem fedorenta", "Stone Shape": "Moldar rochas", "Stoneskin": "Pele-rocha",
  "Storm of Vengeance": "Tempestade da vingança", "Suggestion": "Sugestão", "Sunbeam": "Raio solar",
  "Sunburst": "Explosão solar", "Symbol": "Símbolo", "Telekinesis": "Telecinésia", "Telepathic Bond": "Vínculo telepático",
  "Teleport": "Teletransporte", "Teleportation Circle": "Círculo de teletransporte", "Thaumaturgy": "Taumaturgia",
  "Thunderwave": "Onda trovejante", "Time Stop": "Parar o tempo", "Tiny Hut": "Cabana minúscula", "Tongues": "Línguas",
  "Transport via Plants": "Transporte via plantas", "True Polymorph": "Metamorfose verdadeira",
  "True Resurrection": "Ressurreição verdadeira", "True Seeing": "Visão da verdade", "True Strike": "Golpe verdadeiro",
  "Tsunami": "Tsunami", "Unseen Servant": "Servo invisível", "Vampiric Touch": "Toque vampírico",
  "Vicious Mockery": "Zombaria perversa", "Vitriolic Sphere": "Esfera vitriólica", "Wall of Fire": "Muralha de fogo",
  "Wall of Force": "Muralha de energia", "Wall of Ice": "Muralha de gelo", "Wall of Stone": "Muralha de pedra",
  "Wall of Thorns": "Muralha de espinhos", "Warding Bond": "Vínculo protetor", "Water Breathing": "Respirar na água",
  "Water Walk": "Caminhar sobre as águas", "Web": "Teia", "Wind Walk": "Caminhar no vento", "Wind Wall": "Muralha de vento",
  "Wish": "Desejo", "Word of Recall": "Palavra de recordação", "Zone of Truth": "Zona da verdade",
};

const virgula = (n) => String(n).replace(".", ",");

function alcance(txt) {
  const fixos = { Self: "Pessoal", Touch: "Toque", Sight: "Visão", Special: "Especial", Unlimited: "Ilimitado" };
  if (fixos[txt]) return fixos[txt];
  const m = /^(\d+) (feet|miles?)$/.exec(txt);
  if (!m) throw new Error(`alcance desconhecido: ${txt}`);
  const n = Number(m[1]);
  if (m[2] === "feet") return `${virgula(Math.round(n * 0.3 * 10) / 10)} m`;
  return `${virgula(Math.round(n * 1.5 * 10) / 10)} km`;
}

function duracao(txt, concentracao) {
  const fixos = {
    instantaneous: "Instantânea", special: "Especial", "until dispelled": "Até ser dissipada",
    "until dispelled or triggered": "Até ser dissipada ou ativada",
  };
  let base = fixos[txt];
  if (!base) {
    const m = /^(\d+) (round|minute|hour|day)s?$/.exec(txt);
    if (!m) throw new Error(`duração desconhecida: ${txt}`);
    const [um, varios] = UNIDADES[m[2]];
    base = `${m[1]} ${Number(m[1]) === 1 ? um : varios}`;
  }
  return concentracao ? `Concentração, até ${base.toLowerCase()}` : base;
}

function componentes(s, material) {
  const c = [];
  if (s.verbal) c.push("V");
  if (s.somatic) c.push("S");
  if (s.material) c.push(material ? `M (${material})` : "M");
  return c.join(", ");
}

function teste(s) {
  const partes = [];
  if (s.attack_roll) partes.push("Ataque de magia");
  if (s.saving_throw_ability) {
    const a = ATRIBUTOS[s.saving_throw_ability];
    if (!a) throw new Error(`atributo desconhecido: ${s.saving_throw_ability}`);
    partes.push(`Salvaguarda de ${a}`);
  }
  return partes.join(" + ");
}

function dano(s) {
  if (!s.damage_roll) return "";
  const tipos = (s.damage_types ?? []).map((t) => {
    if (!DANOS[t]) throw new Error(`tipo de dano desconhecido: ${t}`);
    return DANOS[t];
  });
  return [s.damage_roll, ...tipos].join(" ").trim();
}

/** Tradução do texto das regras (scripts/magias-ptbr.json, feita com a skill de tradução e
 *  conferida por importar-traducao-magias.mjs). Sem o arquivo, o texto fica em inglês. */
async function carregarTraducao() {
  try {
    return JSON.parse(await readFile(fileURLToPath(new URL("./magias-ptbr.json", import.meta.url)), "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

export function converter(s, trad = null) {
  if (!ESCOLAS[s.school.name]) throw new Error(`escola desconhecida: ${s.school.name}`);
  if (!TEMPOS[s.casting_time]) throw new Error(`tempo desconhecido: ${s.casting_time}`);
  if (!String(s.desc ?? "").trim() && !TEXTO_FALTANTE[s.name]) throw new Error(`${s.name}: a fonte veio sem descrição`);
  const nome = NOMES[s.name] ?? s.name;
  if (!NOMES[s.name]) SEM_NOME_EM_PT.add(s.name);
  return {
    en: s.name,
    nome,
    nivel: s.level,
    escola: ESCOLAS[s.school.name],
    tempo: TEMPOS[s.casting_time],
    alcance: alcance(s.range_text),
    duracao: duracao(s.duration, s.concentration),
    componentes: componentes(s, trad?.material ?? s.material_specified),
    concentracao: s.concentration === true,
    ritual: s.ritual === true,
    classes: s.classes.map((c) => CLASSES[c.name] ?? c.name),
    teste: teste(s),
    dano: dano(s),
    gatilho: trad ? (trad.gatilho ?? "") : (s.reaction_condition ?? ""),
    texto: trad?.texto ?? (String(s.desc ?? "").trim() || TEXTO_FALTANTE[s.name] || ""),
    superior: trad ? (trad.superior ?? "") : String(s.higher_level ?? "").trim(),
  };
}

async function carregar(arquivo) {
  if (arquivo) return JSON.parse(await readFile(arquivo, "utf8"));
  const todas = [];
  let url = FONTE;
  while (url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    const j = await r.json();
    todas.push(...j.results);
    url = j.next;
  }
  return todas;
}

async function principal() {
  const fonte = await carregar(process.argv[2]);
  if (fonte.length !== TOTAL_SRD_2024) {
    throw new Error(`a fonte tem ${fonte.length} magias; esperava ${TOTAL_SRD_2024}. Confira o documento e TOTAL_SRD_2024.`);
  }
  const traducao = await carregarTraducao();
  if (traducao) {
    const faltam = fonte.filter((s) => !traducao[s.name]).map((s) => s.name);
    if (faltam.length > 0) throw new Error(`scripts/magias-ptbr.json não tem: ${faltam.join(", ")}`);
  }
  const magias = fonte.map((s) => converter(s, traducao ? traducao[s.name] : null)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const saida =
    `// GERADO por scripts/gerar-magias-srd.mjs a partir do SRD 5.2 (D&D 2024,\n` +
    `// CC-BY-4.0, Wizards of the Coast), via open5e. NÃO EDITE À MÃO — rode o\n` +
    `// gerador de novo. Dados em português; texto das regras no original, em inglês.\n` +
    `import type { MagiaCatalogo } from "./magiasSrd";\n\n` +
    `export const MAGIAS_GERADAS: MagiaCatalogo[] = [\n` +
    magias.map((m) => `  ${JSON.stringify(m)},`).join("\n") +
    `\n];\n`;
  const destino = fileURLToPath(new URL("../src/lib/magiasSrdGerados.ts", import.meta.url));
  await writeFile(destino, saida, "utf8");
  console.log(`${magias.length} magias gravadas em ${destino}`);
  console.log(`${SEM_NOME_EM_PT.size} ficaram com o nome original:`, [...SEM_NOME_EM_PT].sort().join(", "));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await principal();
