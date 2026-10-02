/**
 * Prepara a imagem do mapa NO APARELHO antes de subir: reduz pro tamanho que
 * o app usa (ver `LADO_MAXIMO_IMAGEM`) e salva como JPEG. Uma foto de mapa de
 * 8 MB vira ~1–3 MB — é o que não deixa o upload pendurar no 4G e o celular
 * dos jogadores não gastar a franquia de dados baixando.
 */
import { LADO_MAXIMO_IMAGEM, tamanhoReduzido } from "./cenas";

/** Acima disso o JPEG é refeito com mais compressão, e depois menor. */
const ALVO_BYTES = 3.5 * 1024 * 1024;
const LIMITE_BYTES = 7.5 * 1024 * 1024; // o bucket recusa mais de 8 MB

export type ImagemPronta = { blob: Blob; largura: number; altura: number };

/** Erro cuja mensagem já está pronta pra mostrar na tela. */
export class ErroDeImagem extends Error {}

type Fonte = { fonte: CanvasImageSource; largura: number; altura: number; liberar: () => void };

async function abrir(arquivo: File): Promise<Fonte> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(arquivo);
      return { fonte: bmp, largura: bmp.width, altura: bmp.height, liberar: () => bmp.close() };
    } catch {
      // cai no <img>: alguns formatos o createImageBitmap não abre
    }
  }
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((ok, falha) => {
      img.onload = () => ok();
      img.onerror = () => falha(new Error("imagem ilegível"));
      img.src = url;
    });
    return {
      fonte: img,
      largura: img.naturalWidth,
      altura: img.naturalHeight,
      liberar: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function paraJpeg(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob | null> {
  return new Promise((ok) => canvas.toBlob(ok, "image/jpeg", qualidade));
}

/** Devolve o JPEG reduzido e o tamanho final. Lança `ErroDeImagem`, com a
 *  mensagem em português pronta pra tela. */
export async function prepararImagem(arquivo: File, ladoMaximo: number = LADO_MAXIMO_IMAGEM): Promise<ImagemPronta> {
  if (!arquivo.type.startsWith("image/")) throw new ErroDeImagem("Esse arquivo não é uma imagem.");

  let origem: Fonte;
  try {
    origem = await abrir(arquivo);
  } catch {
    throw new ErroDeImagem("Não consegui abrir essa imagem. Tente um JPG ou PNG, ou uma versão menor.");
  }

  try {
    if (!origem.largura || !origem.altura) throw new Error("Imagem sem tamanho.");
    let lado = ladoMaximo;
    // Até três tentativas: qualidade normal, qualidade menor, e imagem menor.
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const { largura, altura } = tamanhoReduzido(origem.largura, origem.altura, lado);
      const canvas = document.createElement("canvas");
      canvas.width = largura;
      canvas.height = altura;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("sem canvas");
      // Fundo branco: PNG com transparência viraria preto no JPEG.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, largura, altura);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(origem.fonte, 0, 0, largura, altura);

      const blob = await paraJpeg(canvas, tentativa === 0 ? 0.85 : 0.72);
      // O canvas pode falhar em silêncio (memória do aparelho) devolvendo null.
      if (!blob) throw new Error("sem blob");
      const aceito = blob.size <= ALVO_BYTES || (tentativa === 2 && blob.size <= LIMITE_BYTES);
      if (aceito) return { blob, largura, altura };
      if (tentativa === 1) lado = Math.round(lado * 0.75);
    }
    throw new ErroDeImagem("Essa imagem ficou grande demais mesmo reduzida. Tente uma menor.");
  } catch (e) {
    if (e instanceof ErroDeImagem) throw e;
    throw new ErroDeImagem("Não deu pra preparar essa imagem neste aparelho. Tente uma versão menor.");
  } finally {
    origem.liberar();
  }
}
