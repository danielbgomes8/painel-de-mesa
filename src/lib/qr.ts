import qrcode from "qrcode-generator";

/** Desenho de um QR code: `lado` módulos por lado e `caminho` no formato do atributo `d` de um <path>. */
export type DesenhoQr = { lado: number; caminho: string };

/**
 * Monta o QR de um texto (o link do telão) sem depender de rede: cada módulo preto vira um
 * quadradinho 1x1 num único caminho SVG, então a tela só precisa de um <svg viewBox="0 0 lado lado">.
 * Correção de erro "M" (~15%): sobra margem pra TV com reflexo ou foto torta, e o link do telão cabe
 * numa versão pequena, que dá módulos grandes e fáceis de ler de longe.
 */
export function desenharQr(texto: string): DesenhoQr {
  const qr = qrcode(0, "M");
  qr.addData(texto);
  qr.make();
  const lado = qr.getModuleCount();
  let caminho = "";
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      if (qr.isDark(y, x)) caminho += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { lado, caminho };
}
