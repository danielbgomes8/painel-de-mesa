#!/usr/bin/env node
/**
 * Lê o markdown traduzido das magias (feito com a skill baoyu-translate a partir
 * do texto em inglês do SRD 5.2) e grava scripts/magias-ptbr.json, que o
 * gerador (gerar-magias-srd.mjs) usa no lugar do inglês.
 *
 * O markdown tem um bloco por magia:
 *   ## Nome em inglês            <- a chave, intacta
 *   ### texto | superior | gatilho | material
 *
 *   node scripts/importar-traducao-magias.mjs traducao.md
 *
 * Confere que cada magia da fonte está lá e que nenhuma seção sumiu: tradução pela
 * metade é pior que nenhuma (a magia ficaria com regra em dois idiomas misturados).
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SECOES = ["texto", "superior", "gatilho", "material"];

export function lerTraducao(md) {
  const resultado = {};
  const blocos = md.replace(/\r\n/g, "\n").split(/^## /m).slice(1);
  for (const bloco of blocos) {
    const quebra = bloco.indexOf("\n");
    const nome = bloco.slice(0, quebra).trim();
    const secoes = {};
    const partes = bloco.slice(quebra + 1).split(/^### /m).slice(1);
    for (const parte of partes) {
      const q = parte.indexOf("\n");
      const campo = parte.slice(0, q).trim();
      if (!SECOES.includes(campo)) throw new Error(`${nome}: seção desconhecida "${campo}"`);
      secoes[campo] = parte.slice(q + 1).trim();
    }
    if (resultado[nome]) throw new Error(`${nome}: magia repetida na tradução`);
    resultado[nome] = secoes;
  }
  return resultado;
}

/** Compara a tradução com a fonte em inglês: mesmas magias e mesmas seções. Devolve a lista de problemas. */
export function conferir(traducao, fonte) {
  const problemas = [];
  const esperadas = new Map(fonte.map((s) => [s.name, s]));
  for (const nome of esperadas.keys()) if (!traducao[nome]) problemas.push(`falta a magia: ${nome}`);
  for (const nome of Object.keys(traducao)) if (!esperadas.has(nome)) problemas.push(`magia que não existe na fonte: ${nome}`);
  for (const [nome, s] of esperadas) {
    const t = traducao[nome];
    if (!t) continue;
    const precisa = {
      texto: true,
      superior: Boolean((s.higher_level ?? "").trim()),
      gatilho: Boolean(s.reaction_condition),
      material: Boolean(s.material && s.material_specified),
    };
    for (const campo of SECOES) {
      if (campo === "texto" && !(s.desc ?? "").trim() && nome !== "Greater Invisibility") continue;
      if (precisa[campo] && !t[campo]) problemas.push(`${nome}: falta a seção ${campo}`);
      if (!precisa[campo] && t[campo]) problemas.push(`${nome}: seção ${campo} que não existia na fonte`);
    }
    // Dados que não podem mudar na tradução: toda expressão de dado (ex.: 8d6) do inglês tem de continuar lá.
    const dados = (x) => (x.match(/\b\d+d\d+(?:\s*[+-]\s*\d+)?/g) ?? []).map((d) => d.replace(/\s+/g, "")).sort().join(",");
    const original = [s.desc, s.higher_level].join(" ");
    const traduzido = [t.texto, t.superior].filter(Boolean).join(" ");
    if (dados(original) !== dados(traduzido)) problemas.push(`${nome}: os dados de rolagem mudaram (${dados(original)} → ${dados(traduzido)})`);
    // Sobrou "feet"/"mile" em inglês? A conversão pra metros não aconteceu.
    if (/\b(feet|foot|miles?)\b/i.test(traduzido)) problemas.push(`${nome}: ainda tem medida em pés/milhas`);
  }
  return problemas;
}

async function principal() {
  const [arquivo, fonteArquivo] = process.argv.slice(2);
  if (!arquivo || !fonteArquivo) {
    console.error("uso: node scripts/importar-traducao-magias.mjs traducao.md fonte.json");
    process.exit(1);
  }
  const traducao = lerTraducao(await readFile(arquivo, "utf8"));
  const fonte = JSON.parse(await readFile(fonteArquivo, "utf8"));
  const problemas = conferir(traducao, fonte);
  if (problemas.length > 0) {
    console.error(`${problemas.length} problema(s):\n- ${problemas.join("\n- ")}`);
    process.exit(2);
  }
  const ordenado = Object.fromEntries(Object.keys(traducao).sort().map((k) => [k, traducao[k]]));
  const destino = fileURLToPath(new URL("./magias-ptbr.json", import.meta.url));
  await writeFile(destino, JSON.stringify(ordenado, null, 1) + "\n", "utf8");
  console.log(`${Object.keys(ordenado).length} magias traduzidas gravadas em ${destino}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await principal();
