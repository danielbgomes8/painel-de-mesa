import path from "node:path";
import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança em todas as páginas. O painel é uma tela de ação
 * (mexe em PV, condições, combate) usada num link aberto — impedir que seja
 * embutido noutro site evita clique enganado.
 *
 * `connect-src` precisa liberar o Supabase: a URL do projeto (REST) e o
 * WebSocket do Realtime (wss). Como o host muda por projeto, lê de
 * NEXT_PUBLIC_SUPABASE_URL em tempo de build.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseHost = supabaseUrl.replace(/^https?:\/\//, "");
const conectaSupabase = supabaseHost
  ? `https://${supabaseHost} wss://${supabaseHost}`
  : "https://*.supabase.co wss://*.supabase.co";

const csp = [
  "default-src 'self'",
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${conectaSupabase}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: path.join(__dirname) },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
