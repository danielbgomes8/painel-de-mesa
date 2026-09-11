import type { EntradaDiario, EstadoCombate, LinhaLog, ModeloNpc, Personagem } from "./tipos";

/** Junta tudo da sala num objeto simples — puro, testável. */
export function montarBackup(dados: {
  rotulo: string;
  personagens: Personagem[];
  combate: EstadoCombate;
  notasMestre: string;
  modelosNpc: ModeloNpc[];
  log: LinhaLog[];
  diario: EntradaDiario[];
}) {
  return {
    exportado_em: new Date().toISOString(),
    sala: dados.rotulo,
    personagens: dados.personagens,
    combate: dados.combate,
    notas_mestre: dados.notasMestre,
    modelos_npc: dados.modelosNpc,
    log: dados.log,
    diario: dados.diario,
  };
}

/** Dispara o download de um JSON no navegador — só roda no cliente. */
export function baixarJson(dados: unknown, nomeArquivo: string): void {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
