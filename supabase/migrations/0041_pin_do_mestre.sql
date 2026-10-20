-- Painel de Mesa — PIN do Mestre (um por campanha).
-- Rode DEPOIS de 0040_cartoes_varias_fotos.sql, no SQL Editor do Supabase.
--
-- Guarda só a "impressão digital" (SHA-256) do PIN, nunca o PIN em si. Sem PIN
-- (coluna vazia) o botão "Sou o Mestre" entra direto, como sempre foi — cada
-- campanha liga o seu na aba Mestre > Sala. É trava contra toque sem querer, não
-- contra ataque: o banco continua aberto de propósito (ver README, "Segurança").

alter table public.rooms
  add column if not exists mestre_pin_hash text;
