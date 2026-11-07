"use client";

import { useMemo } from "react";
import { desenharQr } from "@/lib/qr";

/**
 * QR do link do telão: o Mestre aponta a câmera da TV/tablet pra ele em vez de mandar o link por
 * WhatsApp. Fundo branco com margem de 4 módulos (a "zona de silêncio" que o leitor precisa),
 * mesmo no tema escuro; sem imagem nem rede, é só um desenho calculado na hora.
 */
export function QrDoTelao({ link }: { link: string }) {
  const { lado, caminho } = useMemo(() => desenharQr(link), [link]);
  const margem = 4;
  const total = lado + margem * 2;
  return (
    <div style={{ margin: "10px 0" }}>
      <svg
        role="img"
        aria-label="QR code do link do telão"
        viewBox={`0 0 ${total} ${total}`}
        shapeRendering="crispEdges"
        style={{ width: "min(100%, 260px)", height: "auto", display: "block", background: "#fff", borderRadius: 6 }}
      >
        <rect width={total} height={total} fill="#fff" />
        <path d={caminho} fill="#000" transform={`translate(${margem} ${margem})`} />
      </svg>
      <p className="bkpexplica">Aponte a câmera do aparelho da TV (ou do tablet) pra este quadrado.</p>
    </div>
  );
}
