import { CONDICOES, EFEITOS_CONDICAO, EFEITOS_EXAUSTAO, ICONE_CONDICAO, ICONE_EXAUSTAO, type IconeDeCondicao } from "@/lib/condicoes";

/** A bolinha colorida com o emoji, igual à que o canvas desenha no peão. */
function Bolinha({ icone }: { icone: IconeDeCondicao }) {
  return (
    <span className="icone-cond" style={{ background: icone.cor }} aria-hidden="true">
      {icone.emoji}
    </span>
  );
}

/** "O que significam os ícones nos peões": recolhido, porque o jogador só
 *  precisa dele quando vê um ícone que não conhece. Os textos são os da ficha
 *  (lib/condicoes.ts), então um conserto lá vale aqui. Não lista peão nenhum —
 *  só o que cada desenho quer dizer —, então não entrega inimigo oculto nem
 *  quem está sob a névoa. */
export function LegendaIconesPeao() {
  return (
    <details className="condguia legenda-icones">
      <summary>O que significam os ícones nos peões</summary>
      {CONDICOES.map((nome) => (
        <div key={nome} className="condexplica">
          <div className="condexplicatopo">
            <Bolinha icone={ICONE_CONDICAO[nome]} />
            <b>{nome}</b>
          </div>
          <ul>
            {EFEITOS_CONDICAO[nome].map((e, i) => (
              <li key={i}>
                <b>{e.titulo}:</b> {e.texto}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="condexplica">
        <div className="condexplicatopo">
          <Bolinha icone={ICONE_EXAUSTAO} />
          <b>Exaustão</b>
          <span className="condexplicadetalhe">o número ao lado é o nível</span>
        </div>
        <ul>
          {EFEITOS_EXAUSTAO.map((e, i) => (
            <li key={i}>
              <b>{e.titulo}:</b> {e.texto}
            </li>
          ))}
        </ul>
      </div>
      <p className="condexplicadetalhe">
        Jogador a 0 PV aparece com 💤 Inconsciente. Mais de quatro condições no mesmo peão viram um “+N”.
      </p>
    </details>
  );
}
