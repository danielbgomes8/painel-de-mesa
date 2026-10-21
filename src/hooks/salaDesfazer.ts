import type { Dispatch, SetStateAction } from "react";
import { supabase } from "@/lib/supabase";
import { relatarErro } from "@/lib/relatarErro";
import { desfazerPecas, tirarPecasDasFichas } from "@/lib/pecasNoBanco";
import {
  camposConferiveis,
  mesmoCombate,
  podeDesfazer,
  type AcaoDesfazivel,
} from "@/lib/desfazer";
import type { EstadoCombate, Personagem } from "@/lib/tipos";
import { AVISO_FALHA_ESCRITA, MAX_TENTATIVAS_VERSAO, comoCombate, gravarSeVersaoBater } from "./salaBanco";
import type { LinhaCombate, ResultadoDesfazer } from "./salaTipos";

/** O que o desfazer precisa do hook: o estado MAIS NOVO (lido na hora, não
 *  uma cópia de quando a função começou) e os jeitos de mexer na tela. */
export type DependenciasDoDesfazer = {
  codigo: string;
  atual: () => { personagens: Personagem[]; combate: EstadoCombate; combateVersao: number };
  setCombate: (combate: EstadoCombate) => void;
  setCombateVersao: (versao: number) => void;
  setPersonagens: (mudar: (lista: Personagem[]) => Personagem[]) => void;
  setPilhaDesfazer: Dispatch<SetStateAction<AcaoDesfazivel[]>>;
  setAvisoFalha: (aviso: string | null) => void;
  registrarLog: (texto: string) => Promise<void>;
};

/** Desfaz `acao` (a mais nova da pilha), conferindo o banco antes. O hook já
 *  cuidou de "não há nada" e "sem internet". */
export async function desfazerAcao(acao: AcaoDesfazivel, deps: DependenciasDoDesfazer): Promise<ResultadoDesfazer> {
  const { codigo, atual: lerEstado, setCombate, setCombateVersao, setPersonagens, setPilhaDesfazer, setAvisoFalha, registrarLog } = deps;
  // Desistir limpa a pilha inteira: se a ação mais nova não volta, as de
  // antes dela ficariam desfeitas fora de ordem.
  const desistir = (motivo: string): ResultadoDesfazer => {
    setPilhaDesfazer([]);
    return { ok: false, motivo };
  };

  const veredito = podeDesfazer(acao, lerEstado().personagens, lerEstado().combate);
  if (!veredito.ok) return desistir(veredito.motivo);

  // 1. Ordem de iniciativa: mesma trava de versão do definirCombate, mas
  //    em vez de refazer a conta em cima do que outro celular gravou, só
  //    volta se o que está lá ainda for exatamente o que a ação deixou.
  if (acao.combate) {
    let atual = lerEstado().combate;
    let versao = lerEstado().combateVersao;
    let voltou = false;
    for (let tentativa = 0; tentativa < MAX_TENTATIVAS_VERSAO && !voltou; tentativa++) {
      if (!mesmoCombate(atual, acao.combate.depois)) {
        return desistir("a ordem de iniciativa mudou depois disso");
      }
      const { antes } = acao.combate;
      const r = await gravarSeVersaoBater<LinhaCombate>("combat_state", codigo, versao, {
        round: antes.round,
        turn: antes.turn,
        order_json: antes.order,
      });
      if (r.tipo === "erro") {
        relatarErro("desfazer (combate)", r.causa);
        setAvisoFalha(AVISO_FALHA_ESCRITA);
        // A pilha fica: foi a conexão, dá pra tentar de novo.
        return { ok: false, motivo: "não salvou — confira a conexão e tente de novo" };
      }
      atual = comoCombate(r.linha);
      versao = r.linha.version;
      setCombate(atual);
      setCombateVersao(versao);
      voltou = r.tipo === "gravou";
    }
    if (!voltou) return desistir("a ordem de iniciativa não parou de mudar");
  }

  // 2. Fichas: o UPDATE só pega se os números e marcações ainda forem os
  //    que a ação gravou (texto e mapa de condições já foram conferidos em
  //    podeDesfazer, contra o estado que o tempo real mantém em dia).
  const naoVoltaram: string[] = [];
  for (const m of acao.personagens) {
    let consulta = supabase.from("characters").update(m.antes).eq("id", m.id);
    for (const [coluna, valor] of camposConferiveis(m.depois)) consulta = consulta.eq(coluna, valor);
    const { data, error } = await consulta.select("id");
    if (error || !data || data.length === 0) {
      if (error) relatarErro("desfazer (ficha)", error);
      naoVoltaram.push(m.nome);
      continue;
    }
    setPersonagens((lista) => lista.map((p) => (p.id === m.id ? { ...p, ...m.antes } : p)));
  }

  // 3. Fichas que a ação criou (NPC novo, encontro) — já saíram da ordem
  //    no passo 1.
  if (acao.criados.length > 0) {
    const slugsCriados = lerEstado().personagens.filter((p) => acao.criados.includes(p.id)).map((p) => p.slug);
    const { error } = await supabase.from("characters").delete().in("id", acao.criados);
    if (error) {
      relatarErro("desfazer (criados)", error);
      naoVoltaram.push("as fichas criadas");
    } else {
      setPersonagens((lista) => lista.filter((p) => !acao.criados.includes(p.id)));
      // Ficha apagada não deixa peão órfão em mapa nenhum.
      void tirarPecasDasFichas(codigo, slugsCriados, null);
    }
  }

  // 4. Peões que a ação pôs ou tirou do mapa junto com a ordem. Como tudo do
  //    mapa, é melhor esforço: se um não voltar, aparece no mapa e o Mestre
  //    arruma na mão — não vira "desfeito em parte" do combate.
  if (acao.pecas) await desfazerPecas(acao.pecas);

  setPilhaDesfazer((pilha) => pilha.filter((a) => a.id !== acao.id));
  if (acao.textoLog) registrarLog(acao.textoLog);
  if (naoVoltaram.length > 0) {
    setPilhaDesfazer([]);
    return { ok: false, motivo: `desfeito em parte — ${naoVoltaram.join(", ")} mudou no meio, ajuste na ficha` };
  }
  return { ok: true, rotulo: acao.rotulo };
}
