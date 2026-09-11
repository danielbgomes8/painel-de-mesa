-- Painel de Mesa — CD de magia e bônus de resistência de atributo (saves).
-- Rode DEPOIS de 0004_prazos_itens_diario.sql, no SQL Editor do Supabase.
--
-- Só consulta rápida (o app não calcula nada disso sozinho) — igual à
-- percepção passiva: cada um digita o número já calculado da própria ficha.

alter table public.characters
  add column if not exists spell_dc int not null default 10,
  add column if not exists save_str int not null default 0,
  add column if not exists save_dex int not null default 0,
  add column if not exists save_con int not null default 0,
  add column if not exists save_int int not null default 0,
  add column if not exists save_wis int not null default 0,
  add column if not exists save_cha int not null default 0;
