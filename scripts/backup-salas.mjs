#!/usr/bin/env node
/**
 * Cópia de segurança de TODAS as salas do Painel de Mesa — só leitura.
 *
 * Roda todo dia no GitHub (.github/workflows/backup-diario.yml) e também dá
 * pra rodar à mão:
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/backup-salas.mjs [pasta]
 *
 * Grava um arquivo por sala (`<pasta>/<codigo>.json`, padrão `backup/`) com
 * uma lista de linhas por tabela, e copia a IMAGEM de cada mapa (o Storage) pra
 * `<pasta>/mapas/<caminho no bucket>`. É uma cópia BRUTA do banco: serve de rede de
 * segurança se o projeto do Supabase se perder (o plano gratuito não faz
 * backup nenhum). O backup que o app sabe restaurar sozinho é o botão
 * "backup" do Mestre — este aqui é o plano B, reinserível por REST.
 *
 * Quebra alto (exit 1) em qualquer erro, de propósito: um backup que falha em
 * silêncio é pior que nenhum. Ler o banco todo dia também conta como uso do
 * projeto, o que ajuda a evitar a pausa do plano gratuito por inatividade.
 *
 * ATENÇÃO: cada tabela nova com `room_code` precisa entrar em
 * TABELAS_COM_SALA. O teste `backupBruto.test.ts` compara esta lista com as
 * migrations e falha o `npm run verificar` se faltar alguma.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Tabelas das migrations que NÃO entram na cópia: não são dado da campanha.
 *  `erros` (0017) é o relato do que deu errado nos aparelhos; `uso` (0033), o
 *  que a mesa abre (telas e ações, sem conteúdo); `combate_eventos` (0034), os
 *  avisos do combate de agora (estado de um combate; os preparados vivem em
 *  `encontros.eventos` e vão no backup com o encontro); `combate_efeitos` (0035),
 *  os efeitos com duração do combate de agora. */
export const TABELAS_FORA_DO_BACKUP = ["erros", "uso", "combate_eventos", "combate_efeitos"];

/** Todas as tabelas penduradas em `rooms` (a própria `rooms` vai à parte). */
export const TABELAS_COM_SALA = [
  "characters",
  "combat_state",
  "dm_notes",
  "npc_templates",
  "combat_log",
  "diario",
  "bastiao",
  "bastiao_instalacoes",
  "bastiao_log",
  "encontros",
  // Mapas (0018): as linhas e a névoa. A IMAGEM de cada mapa fica no Storage
  // do Supabase e não entra nesta cópia — guarde o arquivo original do mapa.
  "cenas",
  "cena_nevoa",
  "cena_pecas",
  // Paredes e portas (0021). O que já foi explorado vai junto, na coluna `explorado` de `cenas`.
  "cena_paredes",
  // Desenhos e notas do mapa (0022).
  "cena_marcas",
  // Quadro da Campanha (0024). A foto de cada cartão fica no Storage e vai na
  // cópia das imagens, ao lado das dos mapas.
  "quadro_cartoes",
  // Ligações e anotações do Quadro (0025).
  "quadro_ligacoes",
  "quadro_notas",
  // Baú do grupo (0026): itens e moedas que ainda não são de ninguém.
  "bau_itens",
  // Tempo da campanha (0028): o dia (uma linha por sala, sem id) e os efeitos que duram dias.
  "campanha_tempo",
  "campanha_efeitos",
];

/** Uma linha por sala, sem `id`/`created_at`: sem ordem estável, ler em
 *  páginas podia repetir ou pular linha se algo mudasse no meio. */
const UMA_LINHA_POR_SALA = new Set(["combat_state", "dm_notes", "bastiao", "campanha_tempo"]);

const TAMANHO_PAGINA = 1000;

/** Lê uma tabela inteira, página por página (o Supabase devolve até 1000
 *  linhas por pedido e o log do combate passa disso). */
export async function lerTudo({ url, chave, caminho, buscar = fetch }) {
  const linhas = [];
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const resposta = await buscar(`${url}/rest/v1/${caminho}`, {
      headers: {
        apikey: chave,
        Authorization: `Bearer ${chave}`,
        Range: `${inicio}-${inicio + TAMANHO_PAGINA - 1}`,
      },
    });
    if (!resposta.ok) {
      throw new Error(`${caminho}: HTTP ${resposta.status} ${(await resposta.text()).slice(0, 200)}`);
    }
    const pagina = await resposta.json();
    if (!Array.isArray(pagina)) throw new Error(`${caminho}: resposta inesperada do banco`);
    linhas.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) return linhas;
  }
}

/** Copia todas as salas. Devolve `[{ codigo, dados }]`. */
export async function copiarSalas({ url, chave, buscar = fetch }) {
  const salas = await lerTudo({ url, chave, caminho: "rooms?select=*&order=code.asc", buscar });
  if (salas.length === 0) {
    // Projeto pausado/vazio devolve erro ou lista vazia — nunca gravar
    // "backup" de nada e deixar todo mundo achando que está protegido.
    throw new Error("nenhuma sala encontrada no banco — projeto pausado ou vazio?");
  }
  const copias = [];
  for (const { code: codigo } of salas) {
    const dados = { sala: codigo, rooms: salas.filter((s) => s.code === codigo) };
    for (const tabela of TABELAS_COM_SALA) {
      const ordem = UMA_LINHA_POR_SALA.has(tabela) ? "" : "&order=created_at.asc,id.asc";
      dados[tabela] = await lerTudo({
        url,
        chave,
        caminho: `${tabela}?room_code=eq.${encodeURIComponent(codigo)}${ordem}`,
        buscar,
      });
    }
    copias.push({ codigo, dados });
  }
  return copias;
}

/** Bucket das imagens dos mapas (migration 0018): público, lido por link. */
export const BUCKET_DOS_MAPAS = "mapas";

/** O caminho da imagem, só se for seguro de gravar numa pasta local (vem do banco,
 *  que é aberto): nada de `..`, de caminho absoluto ou de barra invertida. */
export function caminhoSeguroDaImagem(imagem) {
  if (typeof imagem !== "string" || !imagem) return null;
  if (imagem.startsWith("/") || imagem.includes("\\") || imagem.includes("\0")) return null;
  const partes = imagem.split("/");
  if (partes.some((p) => p === "" || p === "." || p === "..")) return null;
  return partes.join("/");
}

/** Baixa a imagem de cada mapa de cada sala pra `<pasta>/mapas/...`. Erro de rede
 *  ou do servidor derruba o backup (como o resto); imagem que o banco cita mas o
 *  Storage não tem (404) vira aviso, não falha: não adianta o backup ficar
 *  vermelho todo dia por causa de um arquivo que já não existe. */
export async function copiarImagens({ url, copias, pasta, buscar = fetch, gravar = gravarArquivo, aviso = console.warn }) {
  let baixadas = 0;
  const faltando = [];
  const vistas = new Set();
  for (const { dados } of copias) {
    // A imagem de cada mapa e a foto de cada cartão do Quadro: mesmo bucket.
    const citadas = [
      ...(dados.cenas ?? []).map((cena) => cena.imagem),
      ...(dados.quadro_cartoes ?? []).map((cartao) => cartao.foto),
    ];
    for (const citada of citadas) {
      if (!citada || vistas.has(citada)) continue;
      vistas.add(citada);
      const caminho = caminhoSeguroDaImagem(citada);
      if (!caminho) {
        aviso(`imagem ignorada (caminho suspeito): ${JSON.stringify(citada)}`);
        continue;
      }
      const endereco = `${url}/storage/v1/object/public/${BUCKET_DOS_MAPAS}/${caminho.split("/").map(encodeURIComponent).join("/")}`;
      const r = await buscar(endereco);
      if (r.status === 404 || r.status === 400) {
        faltando.push(caminho);
        aviso(`imagem de mapa que o banco cita mas o Storage não tem: ${caminho}`);
        continue;
      }
      if (!r.ok) throw new Error(`imagem ${caminho}: HTTP ${r.status}`);
      await gravar(`${pasta}/mapas/${caminho}`, Buffer.from(await r.arrayBuffer()));
      baixadas++;
    }
  }
  return { baixadas, faltando };
}

async function gravarArquivo(arquivo, conteudo) {
  await mkdir(dirname(arquivo), { recursive: true });
  await writeFile(arquivo, conteudo);
}

async function principal() {
  const url = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
  const chave = process.env.SUPABASE_ANON_KEY ?? "";
  if (!url || !chave) {
    throw new Error("faltam SUPABASE_URL e SUPABASE_ANON_KEY no ambiente");
  }
  const pasta = process.argv[2] ?? "backup";
  const copias = await copiarSalas({ url, chave });
  await mkdir(pasta, { recursive: true });
  const feitoEm = new Date().toISOString();
  for (const { codigo, dados } of copias) {
    const arquivo = `${pasta}/${codigo}.json`;
    await writeFile(arquivo, JSON.stringify({ feito_em: feitoEm, ...dados }, null, 1), "utf-8");
    const resumo = TABELAS_COM_SALA.filter((t) => dados[t].length > 0)
      .map((t) => `${t}=${dados[t].length}`)
      .join(", ");
    console.log(`${codigo}: ${resumo || "(vazia)"}`);
  }
  const imagens = await copiarImagens({ url, copias, pasta });
  console.log(`imagens de mapas: ${imagens.baixadas} copiada(s)${imagens.faltando.length ? `, ${imagens.faltando.length} que o Storage não tem` : ""}`);
  console.log(`${copias.length} sala(s) copiada(s) em ${pasta}/`);
}

// Só roda quando chamado direto (o teste importa este arquivo sem disparar nada).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal().catch((erro) => {
    console.error(`BACKUP FALHOU: ${erro.message}`);
    process.exit(1);
  });
}
