import { TITULO_DA_SILHUETA, type CartaoVisto, type Revelacao } from "@/lib/quadro";

export const ROTULO_REVELACAO: Record<Revelacao, { emoji: string; curto: string; ajuda: string }> = {
  escondido: { emoji: "🔒", curto: "Escondido", ajuda: "só você vê" },
  silhueta: { emoji: "🌫️", curto: "Silhueta", ajuda: "a mesa vê a foto escura e ???" },
  revelado: { emoji: "👁", curto: "Revelado", ajuda: "a mesa vê tudo" },
};

export function tituloVisto(v: CartaoVisto): string {
  return v.visao === "silhueta" ? TITULO_DA_SILHUETA : v.cartao.titulo || "Sem nome";
}
