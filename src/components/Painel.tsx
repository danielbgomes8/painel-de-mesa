"use client";

import { useEffect, useMemo, useState } from "react";
import { useSala } from "@/hooks/useSala";
import { useCodigoSala, useNoNavegador } from "@/hooks/useCodigoSala";
import { useIdentidade } from "@/hooks/useIdentidade";
import { useModoTelao } from "@/hooks/useModoTelao";
import {
  limparIdentidade,
  salvarIdentidade,
  type Identidade,
} from "@/lib/identidade";
import { lembrarSala, rotuloDaSala } from "@/lib/sala";
import { BackupSala, baixarBackupDaSala } from "@/components/BackupSala";
import { Portao } from "@/components/Portao";
import { RastreadorCombate } from "@/components/RastreadorCombate";
import { AcoesEmMassa } from "@/components/AcoesEmMassa";
import { NotasDoMestre } from "@/components/NotasDoMestre";
import { FichaPersonagem } from "@/components/FichaPersonagem";
import { BannerSuaVez } from "@/components/BannerSuaVez";
import { LogCombate } from "@/components/LogCombate";
import { BibliotecaNpcs } from "@/components/BibliotecaNpcs";
import { EncontrosPreparados } from "@/components/EncontrosPreparados";
import { DiarioCampanha } from "@/components/DiarioCampanha";
import { PainelBastiao } from "@/components/PainelBastiao";
import { Telao } from "@/components/Telao";
import { BarraAbas, type Aba } from "@/components/BarraAbas";
import { EscolherCampanha } from "@/components/EscolherCampanha";

export function Painel() {
  const codigo = useCodigoSala();
  const noNavegador = useNoNavegador();

  // No servidor e na hidratação a sala ainda não é conhecida: a página é
  // estática, e o código vem da URL ou da última sala deste aparelho (ver
  // escolherSala). Montar a sala antes disso abria a conexão da sala padrão
  // à toa — e o efeito que grava `?sala=` no endereço prendia a pessoa nela:
  // o app instalado caía na Sétimo Raio em vez da última campanha (achado
  // testando). O título neutro também é o que um preview de link (WhatsApp)
  // enxerga, em vez do nome de outra campanha.
  if (!noNavegador) {
    return (
      <>
        <title>Painel de Mesa</title>
        <div className="tela-centro">
          <h1>Painel de Mesa</h1>
          <p>Conectando à sala…</p>
        </div>
      </>
    );
  }

  // Aba do navegador com o nome da campanha aberta: o React 19 leva o <title>
  // pro <head>. Não fica no metadata do layout — lá é fixo e o Next o aplica
  // depois da montagem, por cima de um document.title (achado testando).
  // key=codigo: trocar de sala (link, botão de trocar campanha ou voltar)
  // remonta do zero — estado, conexão e tempo real da campanha anterior vão
  // embora juntos.
  return (
    <>
      <title>{`Painel de Mesa — ${rotuloDaSala(codigo)}`}</title>
      <PainelSala key={codigo} codigo={codigo} />
    </>
  );
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
  // O arquivo vem de uma leitura nova do banco (não do que está na tela), pra
  // levar o log inteiro e o Bastião — ver BackupSala.
  const [baixandoBackup, setBaixandoBackup] = useState(false);
  async function baixarBackup() {
    setBaixandoBackup(true);
    await baixarBackupDaSala(sala, codigo, rotulo);
    setBaixandoBackup(false);
  }

  const souMestre = identidade?.tipo === "mestre";
  const [aba, setAba] = useState<Aba>("diario");
  const abaEfetiva: Aba = aba === "mestre" && !souMestre ? "diario" : aba;

  const meuPersonagem = useMemo(() => {
    if (identidade?.tipo !== "jogador") return null;
    return sala.personagens.find((p) => p.slug === identidade.slug) ?? null;
  }, [identidade, sala.personagens]);

  const [trocandoCampanha, setTrocandoCampanha] = useState(false);

  // A sala vai pro endereço mesmo quando veio da "última sala" (ver
  // escolherSala): recarregar fica na mesma, e o link copiado dali leva
  // quem recebe pra campanha certa em vez de pra última sala DELE.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("sala")) return;
    url.searchParams.set("sala", codigo);
    window.history.replaceState(null, "", url);
  }, [codigo]);

  // Só lembra depois de entrar de verdade — um link com erro de digitação que
  // só foi espiado não vira a sala que o app instalado abre amanhã.
  useEffect(() => {
    if (identidade) lembrarSala(codigo);
  }, [codigo, identidade]);

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
    return <Portao sala={sala} codigo={codigo} rotulo={rotulo} onEntrar={entrar} />;
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
              <button className="linkbtn" type="button" onClick={baixarBackup} disabled={baixandoBackup}>
                {baixandoBackup ? "⬇ juntando…" : "⬇ backup"}
              </button>
            </>
          )}
          <button className="linkbtn" type="button" onClick={trocar}>
            trocar
          </button>
          <button
            className="linkbtn"
            type="button"
            aria-expanded={trocandoCampanha}
            onClick={() => setTrocandoCampanha((v) => !v)}
          >
            ⇄ trocar campanha
          </button>
        </div>
      </div>

      {trocandoCampanha && (
        <section className="combat" aria-label="Trocar de campanha">
          <div className="combat-head">
            <h2>Trocar de campanha</h2>
            <button className="linkbtn" type="button" onClick={() => setTrocandoCampanha(false)}>
              fechar
            </button>
          </div>
          <p className="bkpexplica">
            Cada campanha tem as fichas, o combate e o diário dela. Em cada uma você
            entra uma vez como Mestre ou personagem, e o aparelho lembra.
          </p>
          <EscolherCampanha atual={codigo} />
        </section>
      )}

      {sala.avisoFalha && (
        <div className="avisofalha" role="alert" aria-live="polite">
          <span>⚠ {sala.avisoFalha}</span>
          <button type="button" onClick={sala.limparAvisoFalha} aria-label="Dispensar aviso">
            ✕
          </button>
        </div>
      )}

      {identidade.tipo === "jogador" && (
        <BannerSuaVez sala={sala} meuSlug={identidade.slug} />
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
          <EncontrosPreparados sala={sala} />
          <BibliotecaNpcs sala={sala} />
          <NotasDoMestre valor={sala.notasMestre} onSalvar={sala.definirNotasMestre} />
          <BackupSala sala={sala} codigo={codigo} rotulo={rotulo} />
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
                  <FichaPersonagem key={p.id} personagem={p} souMestre ehMinha={false} sala={sala} />
                ))
              : meuPersonagem && (
                  <FichaPersonagem
                    key={meuPersonagem.id}
                    personagem={meuPersonagem}
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
