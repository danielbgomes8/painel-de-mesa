import type { Metadata, Viewport } from "next";
import { Cinzel, IBM_Plex_Mono, Spectral } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--fonte-titulo",
});

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--fonte-corpo",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--fonte-mono",
});

export const metadata: Metadata = {
  title: "Painel de Mesa — Sétimo Raio",
  description:
    "Painel de combate e fichas da mesa de D&D 5.5 Sétimo Raio. Sincroniza entre celular, tablet e notebook.",
};

export const viewport: Viewport = {
  themeColor: "#171310",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${cinzel.variable} ${spectral.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
