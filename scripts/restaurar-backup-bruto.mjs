#!/usr/bin/env node
/**
 * Devolve ao banco uma sala a partir do backup DIÁRIO bruto
 * (`backup/<sala>.json`, gerado por scripts/backup-salas.mjs).
 *
 * Quando usar: o projeto do Supabase se perdeu ou ficou vazio e o botão
 * "restaurar" do app não tem o que restaurar. É o plano B — o plano A é o
 * arquivo que o Mestre baixa no app.
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/restaurar-backup-bruto.mjs backup/setimo-raio.json
 *   (acrescente --executar pra valer; sem ele só mostra o que faria)
 *
 * É SEGURO rodar por cima de uma sala que já tem dados: cada linha é inserida
 * com "ignorar duplicata" (pelo `id`), então o que já existe fica como está, o
 * que falta volta, e rodar duas vezes não duplica nada. Pra "voltar o banco
 * como estava", apague antes as linhas da sala (as tabelas filhas, ou a sala
 * inteira no SQL Editor) e rode este script.
 *
 * As imagens dos mapas ficam no Storage, não no banco: o backup as guarda em
 * `mapas/` ao lado do .json (`backup/mapas/...`) e este script as devolve ao
 * bucket (sem sobrescrever o que já está lá). Sem essa pasta, a cena volta sem
 * a imagem, até alguém subir de novo o arquivo original.
 */
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BUCKET_DOS_MAPAS, TABELAS_COM_SALA, caminhoSeguroDaImagem } from "./backup-salas.mjs";

/** Colunas que o banco gera sozinho e RECUSA receber (`generated always`). */
export const COLUNAS_GERADAS = { cena_nevoa: ["seq"] };

const TAMANHO_LOTE = 200;

/** Ordem de inserção: a sala primeiro; cenas antes da névoa, dos peões e das paredes delas
 *  (chave estrangeira). O resto vem na ordem do backup. */
const COM_CHAVE_ESTRANGEIRA = ["cenas", "cena_nevoa", "cena_pecas", "cena_paredes", "cena_marcas"];

export function ordemDeRestauracao() {
  const resto = TABELAS_COM_SALA.filter((t) => !COM_CHAVE_ESTRANGEIRA.includes(t));
  return ["rooms", ...resto, ...COM_CHAVE_ESTRANGEIRA.filter((t) => TABELAS_COM_SALA.includes(t))];
}

/** Linhas prontas pra inserir: sem colunas geradas, e a névoa na ordem em que
 *  foi pintada (`seq`) — o banco dá um `seq` novo na ordem de chegada. */
export function prepararLinhas(tabela, linhas) {
  const fora = new Set(COLUNAS_GERADAS[tabela] ?? []);
  const ordenadas = tabela === "cena_nevoa" ? [...linhas].sort((a, b) => Number(a.seq) - Number(b.seq)) : linhas;
  return ordenadas.map((linha) => Object.fromEntries(Object.entries(linha).filter(([coluna]) => !fora.has(coluna))));
}

export function emLotes(lista, tamanho = TAMANHO_LOTE) {
  const lotes = [];
  for (let i = 0; i < lista.length; i += tamanho) lotes.push(lista.slice(i, i + tamanho));
  return lotes;
}

/** Quantas linhas o arquivo tem em cada tabela (só as que têm alguma). */
export function resumirArquivo(dados) {
  return ordemDeRestauracao()
    .map((t) => [t, Array.isArray(dados[t]) ? dados[t].length : 0])
    .filter(([, n]) => n > 0);
}

/** Valida o arquivo antes de encostar no banco. Devolve a lista de problemas. */
export function problemasDoArquivo(dados) {
  const problemas = [];
  if (!dados || typeof dados !== "object") return ["o arquivo não é um backup do painel"];
  if (typeof dados.sala !== "string" || !dados.sala) problemas.push("falta o código da sala (campo `sala`)");
  if (!Array.isArray(dados.rooms) || dados.rooms.length === 0) problemas.push("falta a linha da sala (campo `rooms`)");
  for (const t of ordemDeRestauracao()) {
    if (t !== "rooms" && dados[t] !== undefined && !Array.isArray(dados[t])) problemas.push(`\`${t}\` não é uma lista`);
  }
  return problemas;
}

async function inserir({ url, chave, tabela, linhas, buscar = fetch }) {
  for (const lote of emLotes(linhas)) {
    const r = await buscar(`${url}/rest/v1/${tabela}`, {
      method: "POST",
      headers: {
        apikey: chave,
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
        // "ignorar duplicata": o que já está no banco fica como está.
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(lote),
    });
    if (!r.ok) throw new Error(`${tabela}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  }
}

/** Restaura as tabelas de um backup. `executar: false` só conta. */
export async function restaurar({ dados, url, chave, executar, buscar = fetch, aoAndar = () => {} }) {
  const problemas = problemasDoArquivo(dados);
  if (problemas.length > 0) throw new Error(`arquivo inválido: ${problemas.join("; ")}`);
  const feitas = [];
  for (const tabela of ordemDeRestauracao()) {
    const linhas = prepararLinhas(tabela, dados[tabela] ?? []);
    if (linhas.length === 0) continue;
    if (executar) await inserir({ url, chave, tabela, linhas, buscar });
    feitas.push([tabela, linhas.length]);
    aoAndar(tabela, linhas.length);
  }
  return feitas;
}

/** Devolve ao Storage as imagens dos mapas que o backup guardou em `<pasta>/mapas/`.
 *  Nunca sobrescreve (`x-upsert: false`): imagem que já está lá fica como está.
 *  `executar: false` só confere o que existe na pasta. */
export async function restaurarImagens({ dados, pasta, url, chave, executar, buscar = fetch, ler = (arquivo) => readFile(arquivo) }) {
  const resultado = { enviadas: 0, jaExistiam: 0, semArquivo: [] };
  for (const cena of dados.cenas ?? []) {
    const caminho = caminhoSeguroDaImagem(cena.imagem);
    if (!caminho) continue;
    let conteudo;
    try {
      conteudo = await ler(`${pasta}/mapas/${caminho}`);
    } catch {
      resultado.semArquivo.push(caminho);
      continue;
    }
    if (!executar) {
      resultado.enviadas++;
      continue;
    }
    const r = await buscar(`${url}/storage/v1/object/${BUCKET_DOS_MAPAS}/${caminho.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "image/jpeg", "x-upsert": "false" },
      body: conteudo,
    });
    if (r.ok) resultado.enviadas++;
    else {
      const texto = await r.text();
      // O Storage responde 400/409 "Duplicate" quando o arquivo já existe.
      if ((r.status === 400 || r.status === 409) && /duplicate|already exists/i.test(texto)) resultado.jaExistiam++;
      else throw new Error(`imagem ${caminho}: HTTP ${r.status} ${texto.slice(0, 200)}`);
    }
  }
  return resultado;
}

async function principal() {
  const args = process.argv.slice(2);
  const executar = args.includes("--executar");
  const arquivo = args.find((a) => !a.startsWith("--"));
  const url = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
  const chave = process.env.SUPABASE_ANON_KEY ?? "";
  if (!arquivo) throw new Error("uso: node scripts/restaurar-backup-bruto.mjs <backup/sala.json> [--executar]");
  if (!url || !chave) throw new Error("faltam SUPABASE_URL e SUPABASE_ANON_KEY no ambiente");
  const dados = JSON.parse(await readFile(arquivo, "utf-8"));
  console.log(`${executar ? "RESTAURANDO" : "SIMULAÇÃO (nada será gravado; use --executar)"}: sala ${dados.sala}, backup de ${dados.feito_em ?? "data desconhecida"}`);
  const feitas = await restaurar({
    dados,
    url,
    chave,
    executar,
    aoAndar: (tabela, n) => console.log(`  ${tabela}: ${n} linha(s)`),
  });
  const imagens = await restaurarImagens({ dados, pasta: dirname(arquivo), url, chave, executar });
  if (imagens.enviadas + imagens.jaExistiam + imagens.semArquivo.length > 0) {
    console.log(
      `  imagens de mapas: ${imagens.enviadas} ${executar ? "enviada(s)" : "a enviar"}, ${imagens.jaExistiam} já estava(m) lá` +
        (imagens.semArquivo.length ? `, ${imagens.semArquivo.length} sem arquivo em ${dirname(arquivo)}/mapas/ (suba de novo o original)` : ""),
    );
  }
  console.log(feitas.length === 0 ? "nada pra restaurar" : `${executar ? "restaurado" : "restauraria"}: ${feitas.map(([t, n]) => `${t}=${n}`).join(", ")}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal().catch((erro) => {
    console.error(`RESTAURAÇÃO FALHOU: ${erro.message}`);
    process.exit(1);
  });
}
