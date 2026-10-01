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
 * uma lista de linhas por tabela. É uma cópia BRUTA do banco: serve de rede de
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
import { fileURLToPath } from "node:url";

/** Tabelas das migrations que NÃO entram na cópia: não são dado da campanha.
 *  `erros` (0017) é o relato do que deu errado nos aparelhos. */
export const TABELAS_FORA_DO_BACKUP = ["erros"];

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
];

/** Uma linha por sala, sem `id`/`created_at`: sem ordem estável, ler em
 *  páginas podia repetir ou pular linha se algo mudasse no meio. */
const UMA_LINHA_POR_SALA = new Set(["combat_state", "dm_notes", "bastiao"]);

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
  console.log(`${copias.length} sala(s) copiada(s) em ${pasta}/`);
}

// Só roda quando chamado direto (o teste importa este arquivo sem disparar nada).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal().catch((erro) => {
    console.error(`BACKUP FALHOU: ${erro.message}`);
    process.exit(1);
  });
}
