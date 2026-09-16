import { ImageResponse } from "next/og";

/** Favicon/ícone do app — gerado em código (sem arquivo de imagem pra manter
 *  no repo), reaproveitando as cores do tema "taverna" de globals.css. Um
 *  círculo dourado com "20" no meio: lembra o d20, sem precisar de fonte
 *  externa carregada pro ImageResponse. */
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icone() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171310",
          borderRadius: 96,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "80%",
            height: "80%",
            borderRadius: "50%",
            border: "18px solid #d99a4e",
            color: "#d99a4e",
            fontSize: 220,
            fontWeight: 700,
          }}
        >
          20
        </div>
      </div>
    ),
    size,
  );
}
