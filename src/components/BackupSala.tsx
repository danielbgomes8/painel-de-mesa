"use client";

import { useRef, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import {
  baixarJson,
  lerBackup,
  montarBackup,
  nomeArquivoBackup,
  type LeituraBackup,
  type ResumoBackup,
} from "@/lib/backup";

/** Lê a sala inteira do banco e baixa o arquivo. Fora do componente porque o
 *  botão "⬇ backup" da barra de cima chama a mesma coisa. Devolve false
 *  quando não deu (o `useSala` já avisou na tela). */
export async function baixarBackupDaSala(
  sala: Sala,
  codigo: string,
  rotulo: string,
  sufixo = "",
): Promise<boolean> {
  const tudo = await sala.exportarSala();
  if (!tudo) return false;
  baixarJson(montarBackup({ rotulo, codigo, ...tudo }), nomeArquivoBackup(codigo, sufixo));
  return true;
}

function contar(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** "8 personagens (6 jogadores e 2 NPCs), 340 linhas de log…" — a frase que
 *  faz a pessoa reconhecer o que está prestes a perder ou a recuperar. */
function descrever(r: ResumoBackup): string {
  const partes = [
    contar(r.jogadores, "personagem de jogador", "personagens de jogador"),
    contar(r.npcs, "NPC", "NPCs"),
    contar(r.diario, "entrada de diário", "entradas de diário"),
    contar(r.log, "linha de log", "linhas de log"),
    contar(r.modelosNpc, "modelo na biblioteca", "modelos na biblioteca"),
  ];
  if (r.encontros !== null) partes.push(contar(r.encontros, "encontro preparado", "encontros preparados"));
  if (r.temBastiao) {
    partes.push(`Bastião no turno ${r.turnoBastiao} com ${contar(r.instalacoes, "instalação", "instalações")}`);
  }
  return `${partes.join(", ")} · combate na rodada ${r.rodada} com ${contar(r.naOrdem, "na ordem", "na ordem")}`;
}

type Estado =
  | { fase: "parado" }
  | { fase: "lendo" }
  | { fase: "confirmando"; leitura: Extract<LeituraBackup, { ok: true }>; nomeArquivo: string }
  | { fase: "restaurando" };

/**
 * Baixar a sala inteira e trazer de volta de um arquivo. Só o Mestre vê.
 *
 * Restaurar é a ação mais destrutiva do app: apaga o que está na sala e põe
 * o do arquivo no lugar. Por isso são três travas, nesta ordem — mostrar o
 * que o arquivo tem E o que a sala tem agora, exigir o código da sala
 * digitado à mão, e baixar sozinho um backup do estado atual antes de
 * encostar no banco.
 */
export function BackupSala({ sala, codigo, rotulo }: { sala: Sala; codigo: string; rotulo: string }) {
  const [estado, setEstado] = useState<Estado>({ fase: "parado" });
  const [confirmacao, setConfirmacao] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; falhou: boolean } | null>(null);
  const campoArquivo = useRef<HTMLInputElement>(null);
  const [baixando, setBaixando] = useState(false);

  const agora: ResumoBackup = {
    jogadores: sala.personagens.filter((p) => !p.is_npc).length,
    npcs: sala.personagens.filter((p) => p.is_npc).length,
    naOrdem: sala.combate.order.length,
    rodada: sala.combate.round,
    // O que está na tela é só o pedaço recente do log; o arquivo leva tudo.
    log: sala.log.length,
    diario: sala.diario.length,
    modelosNpc: sala.modelosNpc.length,
    instalacoes: sala.instalacoesBastiao.length,
    temBastiao: true,
    turnoBastiao: sala.bastiao.turno,
    encontros: sala.encontros.length,
  };

  async function baixar() {
    setBaixando(true);
    setAviso(null);
    const deuCerto = await baixarBackupDaSala(sala, codigo, rotulo);
    setBaixando(false);
    if (deuCerto) setAviso({ texto: "Backup baixado.", falhou: false });
  }

  function escolherArquivo(arquivo: File | null) {
    if (!arquivo) return;
    setAviso(null);
    setConfirmacao("");
    setEstado({ fase: "lendo" });
    // Relê a sala antes de comparar: o "a sala de agora tem…" precisa ser o
    // banco de verdade. O tempo real não entrega o que foi apagado em outro
    // aparelho, então a memória desta tela pode estar contando gente que já
    // não existe — logo antes de decidir apagar tudo, é o pior momento pra
    // mostrar número velho.
    sala.recarregarSala();
    const leitor = new FileReader();
    leitor.onerror = () => {
      setEstado({ fase: "parado" });
      setAviso({ texto: "Não consegui abrir esse arquivo.", falhou: true });
    };
    leitor.onload = () => {
      const leitura = lerBackup(String(leitor.result ?? ""), codigo);
      if (!leitura.ok) {
        setEstado({ fase: "parado" });
        setAviso({ texto: leitura.erro, falhou: true });
        return;
      }
      setEstado({ fase: "confirmando", leitura, nomeArquivo: arquivo.name });
    };
    leitor.readAsText(arquivo);
  }

  function cancelar() {
    setEstado({ fase: "parado" });
    setConfirmacao("");
    if (campoArquivo.current) campoArquivo.current.value = "";
  }

  async function restaurar() {
    if (estado.fase !== "confirmando") return;
    const backup = estado.leitura.backup;
    setEstado({ fase: "restaurando" });
    setAviso(null);

    // Rede de segurança: antes de encostar no banco, o estado de agora vira
    // arquivo. Se a restauração for a errada, dá pra voltar.
    const salvouAntes = await baixarBackupDaSala(sala, codigo, rotulo, "-antes-de-restaurar");
    if (!salvouAntes) {
      setEstado({ fase: "parado" });
      setConfirmacao("");
      setAviso({
        texto: "Não consegui baixar o backup de segurança da sala de agora, então não restaurei nada.",
        falhou: true,
      });
      return;
    }

    const r = await sala.restaurarBackup(backup);
    setEstado({ fase: "parado" });
    setConfirmacao("");
    if (campoArquivo.current) campoArquivo.current.value = "";
    setAviso(
      r.ok
        ? { texto: "Sala restaurada a partir do arquivo.", falhou: false }
        : { texto: r.erro ?? "Não consegui restaurar.", falhou: true },
    );
  }

  return (
    <div className="combat">
      <div className="combat-head">
        <h2>Backup e restauração</h2>
      </div>

      <p className="bkpexplica">
        O backup leva a sala inteira num arquivo: fichas, combate, o log completo, diário, biblioteca de
        NPCs, notas do Mestre e o Bastião. Guarde uma cópia depois de cada sessão.
      </p>
      <button type="button" className="btn primary" onClick={baixar} disabled={baixando}>
        {baixando ? "juntando tudo…" : "⬇ baixar backup completo"}
      </button>

      <h3 className="bkptitulo">Restaurar de um arquivo</h3>
      <p className="bkpexplica">
        Põe o arquivo no lugar do que está na sala hoje. <b>O que está aqui agora se perde</b> — por isso
        eu baixo um backup de segurança antes de trocar qualquer coisa.
      </p>

      <label className="bkparquivo">
        <span className="btn">escolher arquivo…</span>
        <input
          ref={campoArquivo}
          type="file"
          accept="application/json,.json"
          onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)}
          disabled={estado.fase === "lendo" || estado.fase === "restaurando"}
        />
      </label>

      {estado.fase === "confirmando" && (
        <div className="bkpconfirma">
          <p className="bkparquivonome">{estado.nomeArquivo}</p>
          <p>
            <b>O arquivo tem:</b> {descrever(estado.leitura.resumo)}
            {estado.leitura.backup.exportado_em && (
              <> · exportado em {estado.leitura.backup.exportado_em.slice(0, 10).split("-").reverse().join("/")}</>
            )}
          </p>
          <p>
            <b>A sala de agora tem:</b> {descrever(agora)}
          </p>
          {estado.leitura.avisos.map((a) => (
            <p key={a} className="bkpaviso">
              ⚠ {a}
            </p>
          ))}
          <label className="bkpcodigo">
            {/* Num só <span>: o label é flex-column, e texto solto com <b> no
                meio viraria três linhas soltas no celular. */}
            <span>
              Pra confirmar, digite o código da sala (<b>{codigo}</b>):
            </span>
            <input
              type="text"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={codigo}
            />
          </label>
          <div className="bkpbotoes">
            <button
              type="button"
              className="btn perigo"
              disabled={confirmacao.trim() !== codigo}
              onClick={restaurar}
            >
              restaurar por cima da sala
            </button>
            <button type="button" className="btn ghost" onClick={cancelar}>
              cancelar
            </button>
          </div>
        </div>
      )}

      {estado.fase === "restaurando" && <p className="bkpexplica">Restaurando… não feche o app.</p>}

      <p className={aviso?.falhou ? "catcopiado falhou" : "catcopiado"} aria-live="polite">
        {aviso?.texto ?? ""}
      </p>
    </div>
  );
}
