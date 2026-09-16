import { ImageResponse } from "next/og";

/** Ícone pra "adicionar à tela de início" no iOS — mesmo desenho do icon.tsx,
 *  mas quadrado até a borda (o próprio iOS arredonda os cantos sozinho). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function IconeApple() {
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
            border: "6px solid #d99a4e",
            color: "#d99a4e",
            fontSize: 76,
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
