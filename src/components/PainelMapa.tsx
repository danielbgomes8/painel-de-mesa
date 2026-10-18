"use client";

import { CartaoDoFoco, FocoDoTelao, itensDoFoco, type ItemDoFoco } from "@/components/FocoDoTelao";
import { useVistaMestre } from "@/hooks/useVistaMestre";
import { vistaMestreAoAbrir } from "@/lib/vistaMestre";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Cenas } from "@/hooks/useCenas";
import type { Sala } from "@/hooks/useSala";
import { useNevoa } from "@/hooks/useNevoa";
import { useParedes } from "@/hooks/useParedes";
import { useMarcas } from "@/hooks/useMarcas";
import { EditorDeDesenho, ListaDeNotas, NovaNota } from "@/components/MarcasDoMapa";
import { COR_MARCA_PADRAO, marcasVisiveis, type ModoMarca } from "@/lib/marcas";
import { usePecas } from "@/hooks/usePecas";
import { useArmadilhas } from "@/hooks/useArmadilhas";
import { PainelDeArmadilhas, type RascunhoDeArmadilha } from "@/components/ArmadilhasDoMapa";
import { LuzesNaMesa, PainelDeLuzes } from "@/components/LuzesDoMapa";
import { AvisoDePortaTrancada, EditorDePorta } from "@/components/PortasDoMapa";
import { usePing, type QuemPinga } from "@/hooks/usePing";
import { encaixarNaGrade, montarPecasNaTela, pecasQueAcompanham, posicoesIniciais, regiaoEmTornoDe, tamanhoPeloTipo, type Peca } from "@/lib/pecas";
import { segmentosQueBloqueiam, type ModoParede, type Parede } from "@/lib/paredes";
import type { ModoRegua } from "@/lib/regua";
import { MODELO_INICIAL, type ModeloArea } from "@/lib/area";
import {
  cameraValida,
  gradeUsavel,
  nomeDaCenaPeloArquivo,
  type Cena,
  type Ponto,
  type ModoNevoa,
  type TamanhoPincel,
} from "@/lib/cenas";
import { CartaoDoPeao } from "@/components/CartaoDoPeao";
import { CenaMapa, type CenaMapaApi, type Ferramenta } from "@/components/CenaMapa";
import { IconeMapa } from "@/components/IconesMapa";
import { LegendaIconesPeao } from "@/components/LegendaIconesPeao";
import { PalcoDoMapa, type FerramentaDoPalco } from "@/components/PalcoDoMapa";
import { registrarUso } from "@/lib/registrarUso";
import {
  PainelCena,
  PainelDesenhos,
  PainelMedir,
  PainelMesa,
  PainelNevoa,
  PainelParedes,
  PainelPecas,
} from "@/components/PainelMapaPaineis";

/** Move um peão e, se `juntos`, os dos companheiros dele o mesmo tanto (`pecasQueAcompanham`). */
function moverPeao(
  banco: ReturnType<typeof usePecas>,
  cena: Parameters<typeof pecasQueAcompanham>[0]["cena"],
  personagens: Sala["personagens"],
  paredes: readonly Parede[],
  juntos: boolean,
  id: string,
  x: number,
  y: number,
) {
  const donos: Record<string, string> = {};
  if (juntos) for (const f of personagens) if (f.dono) donos[f.slug] = f.dono;
  const seguem = pecasQueAcompanham({ cena, pecas: banco.pecas, movida: { id, x, y }, donos, bloqueios: segmentosQueBloqueiam(paredes) });
  void banco.atualizar(id, { x, y });
  for (const c of seguem) void banco.atualizar(c.id, { x: c.x, y: c.y });
}

/** O peão com o cartão de ações aberto e a ficha dele — só se ainda existem
 *  (peão tirado, ficha apagada ou marcador avulso: nada a abrir). */
function cartaoAberto(id: string | null, pecas: readonly Peca[], sala: Sala) {
  const peca = id ? pecas.find((p) => p.id === id) : undefined;
  const ficha = peca?.slug ? sala.personagens.find((f) => f.slug === peca.slug) : undefined;
  if (!peca || !ficha) return null;
  return {
    peca,
    ficha,
    vez: sala.combate.order[sala.combate.turn]?.slug === ficha.slug,
    naOrdem: sala.combate.order.some((o) => o.slug === ficha.slug),
  };
}

const ZOOM_PASSO = 1.3;

/**
 * A mesa vendo o mapa: o que o Mestre pôs na tela, com a névoa. Usado na aba
 * Mapa dos jogadores e, em tela cheia e sem toque, no telão.
 */
export function VisorDaMesa({
  cena,
  codigo,
  urlDaImagem,
  sala,
  quem = null,
  meuSlug = null,
  telao = false,
  controle = false,
  aoVoltarAEditar,
}: {
  cena: Cena;
  codigo: string;
  urlDaImagem: (c: Cena) => string | null;
  sala: Sala;
  /** Quem está olhando: com isso a pessoa também pinga. O telão só recebe. */
  quem?: QuemPinga | null;
  /** A ficha de quem joga (move o peão dela); null no telão. */
  meuSlug?: string | null;
  telao?: boolean;
  /** O Mestre conduzindo a Vista Mestre: vê o mapa como a mesa vê, e o zoom e
   *  o arrasto dele vão pra todo aparelho com a Vista Mestre ligada. */
  controle?: boolean;
  aoVoltarAEditar?: () => void;
}) {
  const nevoa = useNevoa(cena.id, codigo);
  const ping = usePing(cena, quem);
  const banco = usePecas(cena.id, codigo);
  // As paredes não aparecem pra mesa: só decidem o que a visão automática alcança.
  const muros = useParedes(cena.id, codigo);
  const desenhos = useMarcas(cena.id, codigo);
  const arm = useArmadilhas(cena.id, codigo);
  const mapaRef = useRef<CenaMapaApi>(null);

  // Vista Mestre (ver lib/vistaMestre.ts): cada aparelho liga ou desliga a sua;
  // o link `?vista=mestre` já abre ligada (TV sem teclado).
  const chaveVista = `mesa-vista-mestre:${codigo}`;
  const [vistaLigada, setVistaLigada] = useState(() => {
    let lembrada: string | null = null;
    try {
      lembrada = localStorage.getItem(chaveVista);
    } catch {
      /* aba privada / storage bloqueado: segue sem lembrar */
    }
    return vistaMestreAoAbrir(window.location.search, lembrada);
  });
  function alternarVista() {
    const nova = !vistaLigada;
    setVistaLigada(nova);
    try {
      localStorage.setItem(chaveVista, nova ? "1" : "0");
    } catch {
      /* idem */
    }
  }
  const seguindoMestre = !controle && vistaLigada;
  const canalVista = useVistaMestre(cena, controle ? "controle" : seguindoMestre ? "espectador" : null);
  const { enviarRegiao, enviarFoco } = canalVista;
  // Sem nada do Mestre ainda (ele não abriu o controle), a câmera da mesa.
  const vistaGuiada = seguindoMestre
    ? (canalVista.recebida?.regiao ?? cena.camera ?? { x: 0, y: 0, w: cena.largura, h: cena.altura })
    : null;
  const [seguirVez, setSeguirVez] = useState(true);
  /** O peão que tocaram no HUD, e em que turno (o "seguir a vez" passa por cima no turno seguinte). */
  const [escolhido, setEscolhido] = useState<{ id: string | null; turno: string } | null>(null);
  const turno = `${sala.combate.round}:${sala.combate.turn}:${sala.combate.order.length}`;

  // O que o toque faz no mapa: mexer, medir (régua ou área de magia) ou pingar.
  const [uso, setUso] = useState<"mover" | "medir" | "ping">("mover");
  useEffect(() => {
    registrarUso(`mapa:${uso}`);
  }, [uso]);
  const [painelAberto, setPainelAberto] = useState(true);
  const [medirQue, setMedirQue] = useState<"regua" | "area">("regua");
  const [juntos, setJuntos] = useState(true);
  const [modoRegua, setModoRegua] = useState<ModoRegua>("grade");
  const [modeloArea, setModeloArea] = useState<ModeloArea>(MODELO_INICIAL);
  // O jogador só consegue tocar no próprio peão (ver CenaMapa), então o cartão é sempre o dele.
  const [cartao, setCartao] = useState<string | null>(null);
  const aberto = telao ? null : cartaoAberto(cartao, banco.pecas, sala);
  // Sempre do ponto de vista de jogador: o telão e os celulares nunca veem o
  // nome de um inimigo ainda não revelado (ver lib/pecas.ts).
  const pecas = useMemo(
    () =>
      montarPecasNaTela({
        pecas: banco.pecas,
        cena,
        fichas: sala.personagens,
        vezDe: sala.combate.order[sala.combate.turn]?.slug ?? null,
        slugsDosJogadores: sala.personagens.filter((p) => !p.is_npc).map((p) => p.slug),
        visao: { mestre: false, meuSlug },
        selecionadaId: null,
      }),
    [banco.pecas, cena, sala.personagens, sala.combate, meuSlug],
  );
  const itens: ItemDoFoco[] = itensDoFoco(pecas, (id) => {
    const slug = banco.pecas.find((p) => p.id === id)?.slug;
    return slug ? (sala.personagens.find((f) => f.slug === slug) ?? null) : null;
  });
  const daVez = itens.find((i) => i.peca.vez) ?? null;
  // No controle com "seguir a vez", o turno novo põe quem joga em foco até o Mestre tocar em outro.
  const focoLocal = controle && seguirVez && daVez && escolhido?.turno !== turno ? daVez.peca.id : (escolhido?.id ?? null);
  // Seguindo o Mestre, o cartão é o que ele abriu.
  const focoId = seguindoMestre ? (canalVista.recebida?.foco ?? null) : focoLocal;
  const itemEmFoco = itens.find((i) => i.peca.id === focoId) ?? null;
  const itensRef = useRef(itens);
  useEffect(() => {
    itensRef.current = itens;
  });
  // "Seguir a vez": no turno novo de um jogador, desliza até ele uma vez — depois o Mestre mexe à vontade.
  // Vez de inimigo não mexe a vista (não entrega onde ele está).
  // Depende também do id do peão da vez: ao abrir o controle os peões ainda
  // estão chegando do banco, e o foco tem de esperar o peão aparecer.
  const idDaVez = daVez?.peca.id ?? null;
  useEffect(() => {
    if (!controle || !seguirVez || !idDaVez) return;
    const vez = itensRef.current.find((i) => i.peca.id === idDaVez);
    if (vez) mapaRef.current?.focar(vez.peca.x, vez.peca.y);
  }, [controle, seguirVez, turno, idDaVez]);
  useEffect(() => {
    if (controle) enviarFoco(focoId);
  }, [controle, focoId, enviarFoco]);
  function focarPeca(p: ItemDoFoco["peca"]) {
    setEscolhido({ id: p.id, turno });
    mapaRef.current?.focar(p.x, p.y);
  }

  // O tempo das luzes que a mesa enxerga: de jogador e de marcador visível (nunca de inimigo, oculto ou não).
  const luzesDaMesa = banco.pecas.flatMap((p) => {
    if (!p.luz || p.oculto) return [];
    const ficha = p.slug ? sala.personagens.find((f) => f.slug === p.slug) : undefined;
    if (p.slug && (!ficha || ficha.is_npc)) return [];
    return [{ id: p.id, quem: ficha?.name || p.nome || "alguém", luz: p.luz }];
  });
  const minhaFicha = meuSlug ? sala.personagens.find((p) => p.slug === meuSlug) : undefined;
  const semMeuPeao = Boolean(minhaFicha) && !banco.pecas.some((p) => p.slug === meuSlug);
  const temCompanheiros = sala.personagens.some((f) => f.dono);
  const ferramentaMapa: Ferramenta = uso === "medir" ? medirQue : uso;

  function porMeuPeao() {
    if (!minhaFicha) return;
    const [x, y] = posicoesIniciais(cena, 1, mapaRef.current?.regiaoVisivel() ?? null, banco.pecas.map((p) => [p.x, p.y]))[0];
    void banco.adicionar([{ slug: minhaFicha.slug, nome: "", x, y }]);
  }

  const mapa = (
    <CenaMapa
      ref={mapaRef}
      cena={cena}
      imagemUrl={urlDaImagem(cena)}
      regras={nevoa.regras}
      mestre={false}
      seguirCamera
      vistaGuiada={vistaGuiada}
      aoMudarVista={controle ? enviarRegiao : undefined}
      pings={ping.pings}
      aoPingar={quem ? ping.enviar : undefined}
      ferramenta={telao ? "mover" : ferramentaMapa}
      modoRegua={modoRegua}
      corRegua={quem?.cor}
      reguas={ping.reguas}
      aoMedir={quem ? ping.enviarRegua : undefined}
      modeloArea={modeloArea}
      areas={ping.areas}
      aoAreaar={quem ? ping.enviarArea : undefined}
      paredes={muros.paredes}
      marcas={desenhos.marcas}
      armadilhas={arm.armadilhas}
      visaoPronta={!muros.carregando && !banco.carregando}
      pecas={pecas}
      aoMoverPeca={telao || controle ? undefined : (id, x, y) => moverPeao(banco, cena, sala.personagens, muros.paredes, juntos, id, x, y)}
      aoAbrirPeca={telao || controle ? undefined : setCartao}
    />
  );

  if (telao) {
    return (
      <div className="mapa-visor mapa-visor--telao">
        {mapa}
        <FocoDoTelao
          itens={itens}
          focado={focoId}
          aoFocar={focarPeca}
          aoVoltar={() => mapaRef.current?.reenquadrar()}
          vistaMestre={{ ligada: vistaLigada, aoAlternar: alternarVista }}
        />
        {itemEmFoco && <CartaoDoFoco item={itemEmFoco} aoFechar={seguindoMestre ? undefined : () => setEscolhido(null)} />}
        <ListaDeNotas marcas={marcasVisiveis(desenhos.marcas, false)} telao />
        <LuzesNaMesa itens={luzesDaMesa} telao />
      </div>
    );
  }

  const ferramentas: FerramentaDoPalco[] = [{ id: "mover", rotulo: "Mover", icone: "mover" }];
  if (quem) ferramentas.push({ id: "medir", rotulo: "Medir", icone: "medir" });

  const painel =
    uso === "medir"
      ? {
          titulo: "Medir",
          conteudo: (
            <PainelMedir
              oQue={medirQue}
              aoMudarOQue={setMedirQue}
              modoRegua={modoRegua}
              aoMudarRegua={setModoRegua}
              modeloArea={modeloArea}
              aoMudarArea={setModeloArea}
              metrosPorQuadrado={cena.metros}
            />
          ),
        }
      : uso === "mover" && quem && temCompanheiros
        ? {
            titulo: "Mover",
            conteudo: (
              <div className="mapa-ferr">
                <button type="button" className="chip alvo" aria-pressed={juntos} onClick={() => setJuntos(!juntos)}>
                  🐾 companheiros junto
                </button>
              </div>
            ),
          }
        : null;

  const dica =
    uso === "ping"
      ? "Toque no mapa pra mostrar um ponto pra mesa."
      : uso === "medir"
        ? medirQue === "regua"
          ? "Arraste de um ponto a outro. Começando no seu peão, diz se cabe no seu deslocamento."
          : "Escolha a forma e arraste no mapa. A mesa vê a figura por alguns segundos."
        : "Arraste o seu peão. Toque nele pra dano, cura e passar a vez. Segure o dedo parado pra pingar.";

  return (
    <div className="mapa-visor">
      <PalcoDoMapa
        mapa={
          controle ? (
            <>
              {mapa}
              <FocoDoTelao itens={itens} focado={focoId} aoFocar={focarPeca} lado="direita" />
              {itemEmFoco && <CartaoDoFoco item={itemEmFoco} lado="esquerda" aoFechar={() => setEscolhido({ id: null, turno })} />}
            </>
          ) : (
            mapa
          )
        }
        nome={cena.nome || "Mapa"}
        estado={controle ? "Conduzindo a mesa" : seguindoMestre ? "Vista Mestre" : "Na mesa"}
        estadoLigado={controle || seguindoMestre}
        cantoAlto={controle || (Boolean(quem) && semMeuPeao && !cena.visao_ligada)}
        canto={
          controle ? (
            <>
              <button type="button" className="chip alvo palco-vidro" aria-pressed={seguirVez} onClick={() => setSeguirVez(!seguirVez)}>
                🎯 seguir a vez
              </button>
              <button type="button" className="btn palco-vidro" onClick={aoVoltarAEditar}>
                ✎ voltar a editar
              </button>
            </>
          ) : (
          <>
            {quem && (
              <div className="palco-voce palco-vidro">
                <span className="mapa-cor" style={{ background: quem.cor }} aria-hidden="true" />
                Sua cor
              </div>
            )}
            {semMeuPeao && !cena.visao_ligada && (
              <button type="button" className="btn palco-vidro" onClick={porMeuPeao}>
                pôr meu peão no mapa
              </button>
            )}
          </>
          )
        }
        ferramentas={ferramentas}
        ativa={uso}
        aoEscolher={(id) => {
          if (id === uso) setPainelAberto((a) => !a);
          else {
            setUso(id as "mover" | "medir");
            setPainelAberto(true);
          }
        }}
        painel={painel}
        painelAberto={painelAberto}
        aoFecharPainel={() => setPainelAberto(false)}
        ping={quem ? { ativo: uso === "ping", aoAlternar: () => setUso(uso === "ping" ? "mover" : "ping") } : undefined}
        zoom={{
          aproximar: () => mapaRef.current?.aproximar(ZOOM_PASSO),
          afastar: () => mapaRef.current?.aproximar(1 / ZOOM_PASSO),
          enquadrar: () => mapaRef.current?.reenquadrar(),
          rotuloEnquadrar: "Voltar à visão da mesa",
        }}
        extraEmbaixo={
          controle ? undefined : (
            <button
              type="button"
              className="palco-ferr pequeno palco-vista"
              aria-pressed={vistaLigada}
              title={vistaLigada ? "Vista Mestre ligada: a tela segue o Mestre" : "Vista Mestre: seguir o que o Mestre mostra"}
              aria-label="Vista Mestre"
              onClick={alternarVista}
            >
              👁
            </button>
          )
        }
        dica={
          controle
            ? "O que você mostra aqui vai pra todo telão e celular com a Vista Mestre ligada. Toque num ícone pra focar o jogador."
            : seguindoMestre
              ? "Vista Mestre: a tela segue o Mestre. Toque no 👁 pra voltar à sua."
              : dica
        }
      />
      <ListaDeNotas marcas={marcasVisiveis(desenhos.marcas, false)} />
      <LuzesNaMesa itens={luzesDaMesa} />
      {aberto && aberto.ficha.slug === meuSlug && (
        <CartaoDoPeao
          key={aberto.peca.id}
          sala={sala}
          personagem={aberto.ficha}
          souMestre={false}
          vez={aberto.vez}
          naOrdem={aberto.naOrdem}
          aura={aberto.peca.aura}
          aoMudarAura={(m) => void banco.atualizar(aberto.peca.id, { aura: m })}
          aoFechar={() => setCartao(null)}
        />
      )}
      {semMeuPeao && cena.visao_ligada && (
        <p className="fc-sub">Com a visão automática ligada, quem põe o seu peão no mapa é o Mestre: o lugar dele abre a névoa.</p>
      )}
      {banco.aviso && (
        <p className="mapa-erro" role="alert">
          {banco.aviso}
        </p>
      )}
      <LegendaIconesPeao />
    </div>
  );
}

/** Conteúdo da aba Mapa: o Mestre edita; os jogadores só veem o que está na mesa. */
export function PainelMapa({
  cenas,
  codigo,
  souMestre,
  quem,
  sala,
  meuSlug,
}: {
  cenas: Cenas;
  codigo: string;
  souMestre: boolean;
  quem: QuemPinga | null;
  sala: Sala;
  meuSlug: string | null;
}) {
  if (cenas.indisponivel) {
    return (
      <section className="combat" aria-label="Mapa">
        <div className="combat-head">
          <h2>Mapa</h2>
        </div>
        <p className="bkpexplica">
          {souMestre
            ? "Os mapas ainda não estão ligados no banco: falta rodar a migration 0018_cenas.sql no SQL Editor do Supabase. Até lá, o resto do painel funciona normalmente."
            : "O Mestre ainda não ligou os mapas."}
        </p>
      </section>
    );
  }

  if (!souMestre) {
    return (
      <section className="combat" aria-label="Mapa">
        {cenas.naMesa ? (
          <VisorDaMesa
            cena={cenas.naMesa}
            codigo={codigo}
            urlDaImagem={cenas.urlDaImagem}
            sala={sala}
            quem={quem}
            meuSlug={meuSlug}
          />
        ) : (
          <>
            <div className="combat-head">
              <h2>Mapa</h2>
            </div>
            <p className="empty-note">O Mestre ainda não pôs um mapa na tela.</p>
          </>
        )}
      </section>
    );
  }

  return <MapaDoMestre cenas={cenas} codigo={codigo} quem={quem} sala={sala} />;
}

/** O Mestre alterna entre editar o mapa e conduzir a Vista Mestre (controle remoto da câmera da mesa). */
function MapaDoMestre({ cenas, codigo, quem, sala }: { cenas: Cenas; codigo: string; quem: QuemPinga | null; sala: Sala }) {
  const [conduzindo, setConduzindo] = useState(false);
  const naMesa = cenas.naMesa;
  if (conduzindo && naMesa) {
    return (
      <section className="combat" aria-label="Conduzir a vista da mesa">
        <VisorDaMesa
          cena={naMesa}
          codigo={codigo}
          urlDaImagem={cenas.urlDaImagem}
          sala={sala}
          quem={quem}
          controle
          aoVoltarAEditar={() => setConduzindo(false)}
        />
      </section>
    );
  }
  return <EditorDoMestre cenas={cenas} codigo={codigo} quem={quem} sala={sala} aoConduzir={naMesa ? () => setConduzindo(true) : undefined} />;
}

type Uso = "mover" | "nevoa" | "medir" | "desenhar" | "peoes" | "luz" | "armadilhas" | "paredes" | "grade" | "ping" | "mesa";
type FormaNevoa = "pincel" | "retangulo" | "quadradinhos";

const ROTULO_DO_USO: Record<Exclude<Uso, "ping" | "mesa">, FerramentaDoPalco> = {
  mover: { id: "mover", rotulo: "Mover", icone: "mover" },
  nevoa: { id: "nevoa", rotulo: "Névoa", icone: "nevoa" },
  medir: { id: "medir", rotulo: "Medir", icone: "medir" },
  desenhar: { id: "desenhar", rotulo: "Desenhar", icone: "desenhar" },
  peoes: { id: "peoes", rotulo: "Peões", icone: "peoes" },
  luz: { id: "luz", rotulo: "Escuridão e luzes", icone: "luz" },
  armadilhas: { id: "armadilhas", rotulo: "Armadilhas", icone: "armadilha" },
  paredes: { id: "paredes", rotulo: "Paredes e portas", icone: "paredes" },
  grade: { id: "grade", rotulo: "Cena e grade", icone: "grade" },
};

function EditorDoMestre({
  cenas,
  codigo,
  quem,
  sala,
  aoConduzir,
}: {
  cenas: Cenas;
  codigo: string;
  quem: QuemPinga | null;
  sala: Sala;
  /** Abre o controle da Vista Mestre (só com mapa na mesa). */
  aoConduzir?: () => void;
}) {
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const cena = cenas.cenas.find((c) => c.id === escolhida) ?? cenas.naMesa ?? cenas.cenas[0] ?? null;

  /** Preparar (antes da sessão) × Jogar (durante). Sem escolha, segue o mapa: na mesa = Jogar. */
  const [fase, setFase] = useState<"preparar" | "jogar" | null>(null);
  const [uso, setUso] = useState<Uso>("mover");
  const [painelAberto, setPainelAberto] = useState(true);
  const [formaNevoa, setFormaNevoa] = useState<FormaNevoa>("pincel");
  const [medirQue, setMedirQue] = useState<"regua" | "area">("regua");
  const [modo, setModo] = useState<ModoNevoa>("revelar");
  const [pincel, setPincel] = useState<TamanhoPincel>("m");
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const mapaRef = useRef<CenaMapaApi>(null);

  const nevoa = useNevoa(cena?.id ?? null, codigo);
  const ping = usePing(cena, quem);
  const banco = usePecas(cena?.id ?? null, codigo);
  const [juntos, setJuntos] = useState(true);
  const muros = useParedes(cena?.id ?? null, codigo);
  const [modoParede, setModoParede] = useState<ModoParede>("parede");
  /** A porta que o Mestre tocou no modo "propriedades" (pra editar trancada, secreta e as CDs). */
  const [portaSelecionada, setPortaSelecionada] = useState<string | null>(null);
  /** A porta trancada em que o Mestre tocou pra abrir: espera ele destrancar (ou deixar). */
  const [portaTrancadaId, setPortaTrancadaId] = useState<string | null>(null);
  const desenhos = useMarcas(cena?.id ?? null, codigo);
  const arm = useArmadilhas(cena?.id ?? null, codigo);
  /** Armadilha preparada, esperando um toque no mapa pra dizer onde fica. */
  const [rascunhoArm, setRascunhoArm] = useState<RascunhoDeArmadilha | null>(null);
  const [modoMarca, setModoMarca] = useState<ModoMarca>("livre");
  const [corMarca, setCorMarca] = useState<string>(COR_MARCA_PADRAO);
  const [marcaParaMesa, setMarcaParaMesa] = useState(true);
  /** Modo editar: o desenho selecionado (só vale enquanto existir e o modo estiver ligado). */
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);
  /** Onde o Mestre tocou com o modo nota: espera o texto. */
  const [notaPendente, setNotaPendente] = useState<Ponto | null>(null);
  /** Nota que espera um toque no mapa pra mudar de lugar. */
  const [movendoNota, setMovendoNota] = useState<string | null>(null);
  const [verInimigos, setVerInimigos] = useState(false);
  /** Esperando o Mestre tocar no mapa pra dizer onde o grupo (ou os inimigos) entra. */
  const [colocando, setColocando] = useState<"grupo" | "inimigos" | null>(null);
  // Ferramenta "Cena e grade": ligado, um dedo arrasta a grade por cima do mapa (desligado, arrasta o mapa).
  const [alinhandoGrade, setAlinhandoGrade] = useState(false);
  const [pecaSelecionada, setPecaSelecionada] = useState<string | null>(null);
  /** Peão com o cartão de ações aberto (tocou e soltou sem arrastar, ou tocou o nome na lista). */
  const [cartao, setCartao] = useState<string | null>(null);
  const aberto = cartaoAberto(cartao, banco.pecas, sala);
  const [modoRegua, setModoRegua] = useState<ModoRegua>("grade");
  const [modeloArea, setModeloArea] = useState<ModeloArea>(MODELO_INICIAL);
  const pecas = useMemo(
    () =>
      cena
        ? montarPecasNaTela({
            pecas: banco.pecas,
            cena,
            fichas: sala.personagens,
            vezDe: sala.combate.order[sala.combate.turn]?.slug ?? null,
            slugsDosJogadores: sala.personagens.filter((p) => !p.is_npc).map((p) => p.slug),
            visao: { mestre: true, meuSlug: null },
            selecionadaId: pecaSelecionada,
          })
        : [],
    [banco.pecas, cena, sala.personagens, sala.combate, pecaSelecionada],
  );

  /** Onde cair um peão novo: o meio do que o Mestre está vendo. */
  function regiaoAtual() {
    return mapaRef.current?.regiaoVisivel() ?? null;
  }

  /** Onde já tem peão (pra os novos não caírem em cima). */
  function lugaresOcupados(): [number, number][] {
    return banco.pecas.map((p) => [p.x, p.y]);
  }

  function porOGrupo(regiao: ReturnType<typeof regiaoAtual> = regiaoAtual()) {
    if (!cena) return;
    const faltam = sala.personagens.filter((p) => !p.is_npc && !banco.pecas.some((x) => x.slug === p.slug));
    const lugares = posicoesIniciais(cena, faltam.length, regiao, lugaresOcupados());
    void banco.adicionar(faltam.map((p, i) => ({ slug: p.slug, nome: "", x: lugares[i][0], y: lugares[i][1] })));
  }

  /** Os inimigos que estão na iniciativa e ainda não têm peão. Entram OCULTOS:
   *  o Mestre mostra quando quiser (igual ao NPC oculto da ficha). */
  function porOsInimigos(regiao: ReturnType<typeof regiaoAtual> = regiaoAtual()) {
    if (!cena) return;
    const naOrdem = new Set(sala.combate.order.map((o) => o.slug));
    const faltam = sala.personagens.filter((p) => p.is_npc && naOrdem.has(p.slug) && !banco.pecas.some((x) => x.slug === p.slug));
    const lugares = posicoesIniciais(cena, faltam.length, regiao, lugaresOcupados());
    void banco.adicionar(
      faltam.map((p, i) => ({ slug: p.slug, nome: "", x: lugares[i][0], y: lugares[i][1], oculto: true, tamanho: tamanhoPeloTipo(p.cls) })),
    );
  }

  /** O Mestre tocou no mapa: o grupo (ou os inimigos) entra em volta desse ponto. */
  function colocarOnde(ponto: Ponto) {
    if (movendoNota) {
      // Fora da imagem não vale: o alfinete fica preso na borda.
      const [x, y] = cena ? [Math.min(cena.largura, Math.max(0, ponto[0])), Math.min(cena.altura, Math.max(0, ponto[1]))] : ponto;
      void desenhos.atualizar(movendoNota, { x, y });
      setMovendoNota(null);
      return;
    }
    if (rascunhoArm && cena) {
      // A armadilha cai no centro do quadradinho tocado (sem grade, no ponto exato) e nasce escondida.
      const [x, y] = encaixarNaGrade(cena, ponto[0], ponto[1], 1);
      void arm.adicionar({ ...rascunhoArm, x, y });
      setRascunhoArm(null);
      return;
    }
    if (!cena || !colocando) return;
    const regiao = regiaoEmTornoDe(cena, ponto);
    if (colocando === "grupo") porOGrupo(regiao);
    else porOsInimigos(regiao);
    setColocando(null);
  }

  function porMarcador(nomeDigitado: string) {
    if (!cena) return;
    const nome = nomeDigitado.trim().slice(0, 30);
    if (!nome) return;
    const [x, y] = posicoesIniciais(cena, 1, regiaoAtual(), lugaresOcupados())[0];
    void banco.adicionar([{ slug: null, nome, x, y }]);
  }

  async function aoEscolherArquivo(arquivos: FileList | null) {
    const arquivo = arquivos?.[0];
    if (arquivoRef.current) arquivoRef.current.value = "";
    if (!arquivo) return;
    setErroEnvio(null);
    setEnviando("Preparando…");
    const r = await cenas.criarCena(arquivo, setEnviando);
    setEnviando(null);
    if (!r.ok) {
      setErroEnvio(r.erro);
      return;
    }
    // O nome vem do arquivo; o Mestre troca depois, se quiser.
    await cenas.atualizarCena(r.cena.id, { nome: nomeDaCenaPeloArquivo(arquivo.name) });
    setEscolhida(r.cena.id);
    setUso("mover");
    setFase("preparar");
  }

  async function levarCamera(tudo: boolean) {
    if (!cena) return;
    if (tudo) {
      await cenas.atualizarCena(cena.id, { camera: null });
      return;
    }
    const regiao = mapaRef.current?.regiaoVisivel();
    const camera = regiao ? cameraValida(regiao, cena) : null;
    if (camera) await cenas.atualizarCena(cena.id, { camera });
  }

  async function cobrirTudo() {
    if (!cena) return;
    if (!confirm("Cobrir o mapa inteiro de névoa de novo? As pinceladas feitas até agora são apagadas.")) return;
    if (!(await nevoa.limpar())) return;
    // Com a visão ligada o "já explorado" é guardado à parte das pinceladas: sem
    // esquecê-lo, o mapa continuaria aberto onde o grupo já passou.
    if (cena.visao_ligada) mapaRef.current?.reiniciarMemoria();
    await cenas.atualizarCena(cena.id, cena.visao_ligada ? { nevoa_ligada: true, explorado: "" } : { nevoa_ligada: true });
  }

  async function revelarTudo() {
    if (!cena) return;
    if (!confirm("Revelar o mapa inteiro pra mesa? As pinceladas feitas até agora são apagadas.")) return;
    if (await nevoa.limpar()) await cenas.atualizarCena(cena.id, { nevoa_ligada: false });
  }

  const podeQuadradinhos = cena ? gradeUsavel(cena) : false;
  const faseAtual = fase ?? (cena?.na_mesa ? "jogar" : "preparar");

  // As ferramentas de cada fase. Paredes e desenhos somem quando o banco ainda não tem as tabelas.
  const idsDaFase: Exclude<Uso, "ping" | "mesa">[] =
    faseAtual === "jogar"
      ? ["mover", "nevoa", "medir", "desenhar", "peoes", "luz", "armadilhas"]
      : ["mover", "nevoa", "paredes", "peoes", "luz", "armadilhas", "desenhar", "grade"];
  const idsVisiveis = idsDaFase.filter(
    (id) => !(id === "desenhar" && desenhos.indisponivel) && !(id === "paredes" && muros.indisponivel) && !(id === "armadilhas" && arm.indisponivel),
  );
  const usoAtivo: Uso = uso === "ping" || uso === "mesa" || (idsVisiveis as Uso[]).includes(uso) ? uso : "mover";
  useEffect(() => {
    registrarUso(`mapa:${usoAtivo}`);
  }, [usoAtivo]);

  // O que o toque faz no mapa (as ferramentas internas do CenaMapa) a partir do ícone escolhido.
  const formaDaNevoa: FormaNevoa = formaNevoa === "quadradinhos" && !podeQuadradinhos ? "pincel" : formaNevoa;
  const ferramentaMapa: Ferramenta =
    colocando || movendoNota || rascunhoArm
      ? "colocar"
      : usoAtivo === "nevoa"
        ? formaDaNevoa
        : usoAtivo === "medir"
          ? medirQue
          : usoAtivo === "desenhar"
            ? "marca"
            : usoAtivo === "paredes"
              ? "parede"
              : usoAtivo === "grade" && alinhandoGrade
                ? "grade"
                : usoAtivo === "ping"
                  ? "ping"
                  : "mover";
  const desenhoSelecionado = ferramentaMapa === "marca" && modoMarca === "editar" ? (desenhos.marcas.find((m) => m.tipo === "traco" && m.id === idSelecionado) ?? null) : null;

  /** Trocar de ferramenta desiste de "onde eu toco"; tocar na que já está ativa abre/fecha o painel. */
  function escolher(id: Uso) {
    setColocando(null);
    setRascunhoArm(null);
    setPortaSelecionada(null);
    setPortaTrancadaId(null);
    setNotaPendente(null);
    setMovendoNota(null);
    if (id === usoAtivo) setPainelAberto((a) => !a);
    else {
      setUso(id);
      setPainelAberto(true);
    }
  }
  function trocarFase(f: "preparar" | "jogar") {
    setFase(f);
    setColocando(null);
    setRascunhoArm(null);
    setNotaPendente(null);
    setMovendoNota(null);
  }
  const avisos = [cenas.aviso, nevoa.aviso, banco.aviso, desenhos.aviso, muros.aviso, arm.aviso].filter((a): a is string => Boolean(a));

  const painel = (() => {
    if (!cena) return null;
    switch (usoAtivo) {
      case "mover":
        return sala.personagens.some((f) => f.dono)
          ? {
              titulo: "Mover",
              conteudo: (
                <div className="mapa-ferr">
                  <button type="button" className="chip alvo" aria-pressed={juntos} onClick={() => setJuntos(!juntos)}>
                    🐾 companheiros junto
                  </button>
                </div>
              ),
            }
          : null;
      case "nevoa":
        return {
          titulo: "Névoa",
          conteudo: (
            <PainelNevoa
              forma={formaDaNevoa}
              aoMudarForma={setFormaNevoa}
              podeQuadradinhos={podeQuadradinhos}
              modo={modo}
              aoMudarModo={setModo}
              pincel={pincel}
              aoMudarPincel={setPincel}
              temRegras={nevoa.regras.length > 0}
              aoDesfazer={() => void nevoa.desfazerUltima()}
              aoRevelarTudo={() => void revelarTudo()}
              aoCobrirTudo={() => void cobrirTudo()}
            />
          ),
        };
      case "medir":
        return {
          titulo: "Medir",
          conteudo: (
            <PainelMedir
              oQue={medirQue}
              aoMudarOQue={setMedirQue}
              modoRegua={modoRegua}
              aoMudarRegua={setModoRegua}
              modeloArea={modeloArea}
              aoMudarArea={setModeloArea}
              metrosPorQuadrado={cena.metros}
            />
          ),
        };
      case "desenhar":
        return {
          titulo: "Desenhar",
          larga: true,
          conteudo: (
            <PainelDesenhos
              desenhos={desenhos}
              modo={modoMarca}
              aoMudarModo={(m) => {
                setModoMarca(m);
                setNotaPendente(null);
                setIdSelecionado(null);
              }}
              cor={corMarca}
              aoMudarCor={setCorMarca}
              paraMesa={marcaParaMesa}
              aoMudarParaMesa={setMarcaParaMesa}
              movendoNota={movendoNota}
              aoMoverNota={setMovendoNota}
            />
          ),
        };
      case "peoes":
        return {
          titulo: "Peões",
          larga: true,
          conteudo: (
            <PainelPecas
              banco={banco}
              pecas={pecas}
              pecaSelecionada={pecaSelecionada}
              aoSelecionar={setPecaSelecionada}
              aoAbrirCartao={setCartao}
              colocando={colocando}
              aoColocando={setColocando}
              juntos={juntos}
              aoJuntos={setJuntos}
              temCompanheiros={sala.personagens.some((f) => f.dono)}
              aoPorGrupo={() => porOGrupo()}
              aoPorInimigos={() => porOsInimigos()}
              aoPorMarcador={porMarcador}
            />
          ),
        };
      case "luz":
        return { titulo: "Escuridão e luzes", larga: true, conteudo: <PainelDeLuzes cena={cena} banco={banco} sala={sala} cenas={cenas} /> };
      case "armadilhas":
        return {
          titulo: "Armadilhas",
          larga: true,
          conteudo: <PainelDeArmadilhas arm={arm} colocando={rascunhoArm !== null} aoColocar={setRascunhoArm} aoCancelarColocar={() => setRascunhoArm(null)} />,
        };
      case "paredes":
        return {
          titulo: "Paredes e visão",
          larga: true,
          conteudo: (
            <PainelParedes
              cena={cena}
              cenas={cenas}
              muros={muros}
              modoParede={modoParede}
              aoMudarModoParede={setModoParede}
              verInimigos={verInimigos}
              aoVerInimigos={setVerInimigos}
              aoCobrirExplorado={() => {
                mapaRef.current?.reiniciarMemoria();
                void cenas.atualizarCena(cena.id, { explorado: "" });
              }}
            />
          ),
        };
      case "grade":
        return { titulo: "Cena e grade", larga: true, conteudo: <PainelCena cena={cena} cenas={cenas} alinhando={alinhandoGrade} aoAlinhar={setAlinhandoGrade} /> };
      case "mesa":
        return {
          titulo: "A mesa",
          conteudo: <PainelMesa cena={cena} cenas={cenas} aoLevarCamera={(tudo) => void levarCamera(tudo)} aoVerTudo={() => mapaRef.current?.enquadrarTudo()} />,
        };
      default:
        return null;
    }
  })();

  const dica = (() => {
    if (colocando) return `Toque no mapa no lugar onde ${colocando === "grupo" ? "o grupo entra" : "os inimigos entram"}.`;
    if (movendoNota) return "Toque no mapa no lugar novo da nota.";
    if (rascunhoArm) return "Toque no mapa no lugar onde a armadilha fica. Ela nasce escondida da mesa.";
    switch (ferramentaMapa) {
      case "grade":
        return "Arraste no mapa pra andar a grade até ela casar com a do desenho. Dois dedos movem o mapa.";
      case "ping":
        return "Toque num ponto: a mesa vê um pulso ali, com o seu nome.";
      case "pincel":
        return `Passe o dedo no mapa pra ${modo === "revelar" ? "revelar" : "esconder"}. A mesa vê na hora.`;
      case "retangulo":
        return `Arraste um retângulo pra ${modo === "revelar" ? "revelar" : "esconder"}.`;
      case "quadradinhos":
        return `Toque ou arraste sobre os quadradinhos pra ${modo === "revelar" ? "revelar" : "esconder"}.`;
      case "regua":
        return "Arraste de um ponto a outro. A mesa vê a distância. Começando num peão, diz se cabe no deslocamento.";
      case "area":
        return "Arraste no mapa: a mesa vê a figura por alguns segundos, com o seu nome.";
      case "parede":
        return modoParede === "apagar"
          ? "Toque numa parede ou porta pra apagar, ou passe o dedo por cima de várias."
          : modoParede === "propriedades"
            ? "Toque numa porta pra marcar como trancada ou secreta e dar a CD. Só você vê o cadeado e o 🕵️."
          : modoParede === "curva"
            ? "Passe o dedo acompanhando a curva: o traço vira uma parede de vários trechos."
            : modoParede === "comodo"
              ? "Arraste de um canto ao canto oposto: saem as quatro paredes."
              : `Arraste de um ponto a outro pra desenhar ${modoParede === "porta" ? "uma porta" : "uma parede"}. A mesa nunca vê.`;
      case "marca":
        return modoMarca === "apagar"
          ? "Toque num desenho ou nota pra apagar, ou passe o dedo por cima de vários."
          : modoMarca === "editar"
            ? "Toque num desenho e arraste pra mover. Alças: canto = tamanho, bolinha = girar."
            : modoMarca === "nota"
              ? "Toque no ponto do mapa e escreva a nota."
              : "Arraste no mapa pra desenhar. Dois dedos movem o mapa sem riscar.";
      case "mover":
        if (usoAtivo === "peoes") return "Arraste um peão (ele encaixa no quadradinho). Toque nele pra abrir as ações.";
        if (usoAtivo === "grade" || usoAtivo === "mesa") return undefined;
        return "Arraste os peões ou o mapa. Toque num peão pra dano, condições e a vez. Toque numa porta pra abrir.";
      default:
        return undefined;
    }
  })();

  const ferramentas: FerramentaDoPalco[] = idsVisiveis.map((id) => ROTULO_DO_USO[id]);

  return (
    <section className="combat" aria-label="Mapa">
      <div className="combat-head">
        <h2>Mapa</h2>
        <div className="combatctrls">
          <button type="button" className="btn primary" disabled={enviando !== null} onClick={() => arquivoRef.current?.click()}>
            {enviando ?? "+ nova cena"}
          </button>
          <input ref={arquivoRef} type="file" accept="image/*" hidden onChange={(e) => void aoEscolherArquivo(e.target.files)} />
        </div>
      </div>

      {erroEnvio && (
        <p className="mapa-erro" role="alert">
          {erroEnvio}
        </p>
      )}
      {avisos.map((a) => (
        <p key={a} className="mapa-erro" role="alert">
          {a}
        </p>
      ))}

      {cenas.carregando ? (
        <p className="empty-note">Carregando os mapas…</p>
      ) : cenas.cenas.length === 0 ? (
        <p className="bkpexplica">
          Nenhum mapa ainda. Toque em <b>+ nova cena</b> e escolha a imagem (a arte do mapa, um print ou uma foto). O
          app reduz o tamanho sozinho antes de enviar. Depois é só pintar o que a mesa pode ver.
        </p>
      ) : (
        <>
          {cenas.cenas.length > 1 && (
            <div className="mapa-cenas" role="group" aria-label="Cenas">
              {cenas.cenas.map((c) => (
                <button key={c.id} type="button" className="chip alvo" aria-pressed={c.id === cena?.id} onClick={() => setEscolhida(c.id)}>
                  {c.nome || "Sem nome"}
                  {c.na_mesa ? " · na mesa" : ""}
                </button>
              ))}
            </div>
          )}

          {cena && (
            <>
              <PalcoDoMapa
                nome={cena.nome || "Sem nome"}
                estado={cena.na_mesa ? "Na mesa" : "Em preparo"}
                estadoLigado={cena.na_mesa}
                cantoAlto={!cena.na_mesa || Boolean(cena.na_mesa && aoConduzir)}
                canto={
                  <>
                    <div className="palco-modo palco-vidro" role="group" aria-label="Modo">
                      <button type="button" aria-pressed={faseAtual === "preparar"} onClick={() => trocarFase("preparar")}>
                        Preparar
                      </button>
                      <button type="button" aria-pressed={faseAtual === "jogar"} onClick={() => trocarFase("jogar")}>
                        Jogar
                      </button>
                    </div>
                    {!cena.na_mesa && (
                      <button type="button" className="btn primary" onClick={() => void cenas.mandarParaMesa(cena.id)}>
                        levar a mesa pra este mapa
                      </button>
                    )}
                    {cena.na_mesa && aoConduzir && (
                      <button type="button" className="btn palco-vidro" onClick={aoConduzir} title="Controlar o que o telão e a Vista Mestre mostram">
                        📺 conduzir a mesa
                      </button>
                    )}
                  </>
                }
                ferramentas={ferramentas}
                ativa={usoAtivo}
                aoEscolher={(id) => escolher(id as Uso)}
                painel={painel}
                painelAberto={painelAberto}
                aoFecharPainel={() => setPainelAberto(false)}
                ping={quem ? { ativo: usoAtivo === "ping", aoAlternar: () => setUso(usoAtivo === "ping" ? "mover" : "ping") } : undefined}
                zoom={{
                  aproximar: () => mapaRef.current?.aproximar(ZOOM_PASSO),
                  afastar: () => mapaRef.current?.aproximar(1 / ZOOM_PASSO),
                  enquadrar: () => mapaRef.current?.enquadrarTudo(),
                  rotuloEnquadrar: "Ver o mapa todo",
                }}
                extraEmbaixo={
                  <button
                    type="button"
                    className="palco-ferr pequeno"
                    title="A mesa: o que ela vê e pra onde olha"
                    aria-label="A mesa"
                    aria-pressed={usoAtivo === "mesa"}
                    onClick={() => {
                      setColocando(null);
                      setUso(usoAtivo === "mesa" ? "mover" : "mesa");
                      setPainelAberto(true);
                    }}
                  >
                    <IconeMapa nome="mesa" />
                  </button>
                }
                dica={dica}
                mapa={
                  <CenaMapa
                    ref={mapaRef}
                    cena={cena}
                    imagemUrl={cenas.urlDaImagem(cena)}
                    regras={nevoa.regras}
                    mestre
                    ferramenta={ferramentaMapa}
                    modoNevoa={modo}
                    pincel={pincel}
                    aoPintar={(nova) => void nevoa.adicionar(nova)}
                    pings={ping.pings}
                    aoPingar={quem ? ping.enviar : undefined}
                    modoRegua={modoRegua}
                    corRegua={quem?.cor}
                    reguas={ping.reguas}
                    aoMedir={quem ? ping.enviarRegua : undefined}
                    modeloArea={modeloArea}
                    areas={ping.areas}
                    aoAreaar={quem ? ping.enviarArea : undefined}
                    paredes={muros.paredes}
                    modoParede={modoParede}
                    aoCriarParedes={(novas) => void muros.adicionar(novas)}
                    aoApagarParede={(id) => void muros.remover(id)}
                    marcas={desenhos.marcas}
                    armadilhas={arm.armadilhas}
                    modoMarca={modoMarca}
                    corMarca={corMarca}
                    aoCriarTraco={(pontos) => void desenhos.adicionar({ tipo: "traco", cor: corMarca, pontos, visivel: marcaParaMesa })}
                    aoEscolherNota={setNotaPendente}
                    aoApagarMarca={(id) => void desenhos.remover(id)}
                    marcaSelecionada={desenhoSelecionado?.id ?? null}
                    aoSelecionarMarca={setIdSelecionado}
                    aoTransformarMarca={(id, pontos) => void desenhos.atualizar(id, { pontos })}
                    aoAlternarPorta={(id) => {
                      // Porta trancada e fechada não abre com um toque: pergunta antes (a CD vai no aviso).
                      const p = muros.paredes.find((x) => x.id === id);
                      if (p && p.tipo === "porta" && p.trancada && !p.aberta) setPortaTrancadaId(id);
                      else void muros.alternarPorta(id);
                    }}
                    aoSelecionarPorta={setPortaSelecionada}
                    portaSelecionada={portaSelecionada}
                    verVisaoDosInimigos={verInimigos}
                    visaoPronta={!muros.carregando && !banco.carregando}
                    aoExplorar={muros.indisponivel ? undefined : (texto) => void cenas.atualizarCena(cena.id, { explorado: texto })}
                    aoEscolherPonto={colocarOnde}
                    aoAlinharGrade={(grade_dx, grade_dy) => void cenas.atualizarCena(cena.id, { grade_dx, grade_dy })}
                    pecas={pecas}
                    aoMoverPeca={(id, x, y) => cena && moverPeao(banco, cena, sala.personagens, muros.paredes, juntos, id, x, y)}
                    aoTocarPeca={setPecaSelecionada}
                    aoAbrirPeca={setCartao}
                  />
                }
              />
              <EditorDeDesenho marca={desenhoSelecionado} edicao={desenhos} aoFechar={() => setIdSelecionado(null)} />
              {ferramentaMapa === "parede" && modoParede === "propriedades" && (
                <EditorDePorta porta={muros.paredes.find((x) => x.id === portaSelecionada) ?? null} muros={muros} aoFechar={() => setPortaSelecionada(null)} />
              )}
              <AvisoDePortaTrancada
                porta={muros.paredes.find((x) => x.id === portaTrancadaId) ?? null}
                muros={muros}
                aoFechar={() => setPortaTrancadaId(null)}
                registrar={(texto) => void sala.registrarLog(texto)}
              />
              {notaPendente && ferramentaMapa === "marca" && (
                <NovaNota
                  ponto={notaPendente}
                  aoPor={(texto) => desenhos.adicionar({ tipo: "nota", cor: corMarca, x: notaPendente[0], y: notaPendente[1], texto, visivel: marcaParaMesa })}
                  aoCancelar={() => setNotaPendente(null)}
                />
              )}
              {aberto && (
                <CartaoDoPeao
                  key={aberto.peca.id}
                  sala={sala}
                  personagem={aberto.ficha}
                  souMestre
                  vez={aberto.vez}
                  naOrdem={aberto.naOrdem}
                  oculto={aberto.peca.oculto}
                  aoAlternarOculto={() => void banco.atualizar(aberto.peca.id, { oculto: !aberto.peca.oculto })}
                  aura={aberto.peca.aura}
                  aoMudarAura={(m) => void banco.atualizar(aberto.peca.id, { aura: m })}
                  aoFechar={() => setCartao(null)}
                />
              )}
              <LegendaIconesPeao />
            </>
          )}
        </>
      )}
    </section>
  );
}
