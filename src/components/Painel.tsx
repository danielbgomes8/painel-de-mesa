"use client";

import { useMemo, useState } from "react";
import { useSala } from "@/hooks/useSala";
import { useCodigoSala } from "@/hooks/useCodigoSala";
import { useIdentidade } from "@/hooks/useIdentidade";
import { useModoTelao } from "@/hooks/useModoTelao";
import {
  limparIdentidade,
  salvarIdentidade,
  type Identidade,
} from "@/lib/identidade";
import { rotuloDaSala } from "@/lib/sala";
import { baixarJson, montarBackup } from "@/lib/backup";
import { Portao } from "@/components/Portao";
import { RastreadorCombate } from "@/components/RastreadorCombate";
import { AcoesEmMassa } from "@/components/AcoesEmMassa";
import { NotasDoMestre } from "@/components/NotasDoMestre";
import { FichaPersonagem } from "@/components/FichaPersonagem";
import { BannerSuaVez } from "@/components/BannerSuaVez";
import { LogCombate } from "@/components/LogCombate";
import { BibliotecaNpcs } from "@/components/BibliotecaNpcs";
import { DiarioCampanha } from "@/components/DiarioCampanha";
import { PainelBastiao } from "@/components/PainelBastiao";
import { Telao } from "@/components/Telao";
import { BarraAbas, type Aba } from "@/components/BarraAbas";

export function Painel() {
  const codigo = useCodigoSala();
  // key=codigo: se a sala mudar (só acontece na resolução inicial de
  // `?sala=`), remonta do zero em vez de o hook ter que se resetar sozinho.
  return <PainelSala key={codigo} codigo={codigo} />;
}

function PainelSala({ codigo }: { codigo: string }) {
  const sala = useSala(codigo);
  const identidade = useIdentidade(codigo);
  const telao = useModoTelao();
  const rotulo = rotuloDaSala(codigo);

  function entrar(id: Identidade) {
    salvarIdentidade(codigo, id);
  }
  function trocar() {
    limparIdentidade(codigo);
  }
  function abrirTelao() {
    const params = new URLSearchParams(window.location.search);
    params.set("telao", "1");
    window.open(`${window.location.pathname}?${params.toString()}`, "_blank");
  }
  function baixarBackup() {
    const dados = montarBackup({
      rotulo,
      personagens: sala.personagens,
      combate: sala.combate,
      notasMestre: sala.notasMestre,
      modelosNpc: sala.modelosNpc,
      log: sala.log,
      diario: sala.diario,
    });
    baixarJson(dados, `painel-de-mesa-${codigo}-${new Date().toISOString().slice(0, 10)}.json`);
  }

  const souMestre = identidade?.tipo === "mestre";
  const [aba, setAba] = useState<Aba>("diario");
  const abaEfetiva: Aba = aba === "mestre" && !souMestre ? "diario" : aba;

  const meuPersonagem = useMemo(() => {
    if (identidade?.tipo !== "jogador") return null;
    return sala.personagens.find((p) => p.slug === identidade.slug) ?? null;
  }, [identidade, sala.personagens]);

  if (sala.erro) {
    return (
      <div className="tela-centro">
        <h1>Não deu pra abrir a sala</h1>
        <p>{sala.erro}</p>
      </div>
    );
  }

  if (sala.carregando) {
    return (
      <div className="tela-centro">
        <h1>Painel de Mesa</h1>
        <p>Conectando à sala…</p>
      </div>
    );
  }

  if (telao) {
    return <Telao sala={sala} rotulo={rotulo} />;
  }

  if (!identidade) {
    return <Portao sala={sala} rotulo={rotulo} onEntrar={entrar} />;
  }

  const quem =
    identidade.tipo === "mestre" ? "Mestre" : meuPersonagem?.name ?? identidade.slug;

  const personagemSumiu =
    identidade.tipo === "jogador" && sala.conectado && !meuPersonagem;

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <h1>Painel de Mesa</h1>
          <span className="tag">{rotulo}</span>
        </div>
        <div className="whoami">
          <span className={`synctag${sala.conectado ? " on" : ""}`}>
            {sala.conectado ? "sincronizado" : "offline"}
          </span>
          <span>
            Entrou como <b>{quem}</b>
          </span>
          {souMestre && (
            <>
              <button className="linkbtn" type="button" onClick={abrirTelao}>
                📺 modo telão
              </button>
              <button className="linkbtn" type="button" onClick={baixarBackup}>
                ⬇ backup
              </button>
            </>
          )}
          <button className="linkbtn" type="button" onClick={trocar}>
            trocar
          </button>
        </div>
      </div>

      {sala.avisoFalha && (
        <div className="avisofalha" role="alert" aria-live="polite">
          <span>⚠ {sala.avisoFalha}</span>
          <button type="button" onClick={sala.limparAvisoFalha} aria-label="Dispensar aviso">
            ✕
          </button>
        </div>
      )}

      {identidade.tipo === "jogador" && (
        <BannerSuaVez combate={sala.combate} meuSlug={identidade.slug} />
      )}

      <BarraAbas aba={abaEfetiva} onMudar={setAba} souMestre={souMestre} />

      {abaEfetiva === "diario" && <DiarioCampanha sala={sala} souMestre={souMestre} />}

      {abaEfetiva === "bastiao" && <PainelBastiao sala={sala} />}

      {abaEfetiva === "combate" && (
        <>
          <RastreadorCombate sala={sala} souMestre={souMestre} meuPersonagem={meuPersonagem} />
          {souMestre && <AcoesEmMassa sala={sala} />}
          <LogCombate log={sala.log} />
        </>
      )}

      {abaEfetiva === "mestre" && souMestre && (
        <>
          <BibliotecaNpcs sala={sala} />
          <NotasDoMestre valor={sala.notasMestre} onSalvar={sala.definirNotasMestre} />
        </>
      )}

      {abaEfetiva === "fichas" &&
        (personagemSumiu ? (
          <div className="tela-centro">
            <h1>Seu personagem não está mais na sala</h1>
            <p>
              O Mestre pode ter removido ou renomeado. Toque em <b>trocar</b> no
              topo pra escolher de novo.
            </p>
          </div>
        ) : (
          <div className="grid">
            {souMestre
              ? sala.personagens.map((p) => (
                  <FichaPersonagem
                    key={p.id}
                    personagem={p}
                    editavel
                    souMestre
                    ehMinha={false}
                    sala={sala}
                  />
                ))
              : meuPersonagem && (
                  <FichaPersonagem
                    key={meuPersonagem.id}
                    personagem={meuPersonagem}
                    editavel
                    souMestre={false}
                    ehMinha
                    sala={sala}
                  />
                )}
          </div>
        ))}
    </>
  );
}
