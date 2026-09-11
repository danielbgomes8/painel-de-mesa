-- Painel de Mesa — esquema inicial
-- Rode no SQL Editor do Supabase (ou via `supabase db push`).
--
-- Modelo: uma "sala" por campanha (code memorizável). Personagens, estado de
-- combate e notas do Mestre penduram na sala por room_code.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tabelas
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.rooms (
  code       text primary key,          -- ex.: "setimo-raio"
  created_at timestamptz not null default now()
);

create table if not exists public.characters (
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null references public.rooms(code) on delete cascade,
  slug       text not null,
  name       text not null,
  cls        text not null default '',
  ac         int  not null default 12,
  init_mod   int  not null default 0,
  speed      int  not null default 9,   -- metros
  hp         int  not null default 10,
  hp_max     int  not null default 10,
  exh        int  not null default 0,   -- exaustão 0–6
  dss        int  not null default 0,   -- testes de morte: sucessos (0–3)
  dsf        int  not null default 0,   -- testes de morte: falhas   (0–3)
  cond       jsonb not null default '{}'::jsonb,   -- {"Cego": true, ...}
  notes      text not null default '',
  is_npc     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_code, slug)
);

create index if not exists characters_room_idx on public.characters (room_code);

create table if not exists public.combat_state (
  room_code  text primary key references public.rooms(code) on delete cascade,
  round      int  not null default 1,
  turn       int  not null default 0,
  order_json jsonb not null default '[]'::jsonb,   -- [{slug, name, init}]
  updated_at timestamptz not null default now()
);

create table if not exists public.dm_notes (
  room_code text primary key references public.rooms(code) on delete cascade,
  text      text not null default ''
);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at automático
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists characters_updated_at on public.characters;
create trigger characters_updated_at
  before update on public.characters
  for each row execute function public.tocar_updated_at();

drop trigger if exists combat_state_updated_at on public.combat_state;
create trigger combat_state_updated_at
  before update on public.combat_state
  for each row execute function public.tocar_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: o app assina mudanças destas três tabelas por room_code
-- ─────────────────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.characters;
alter publication supabase_realtime add table public.combat_state;
alter publication supabase_realtime add table public.dm_notes;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — decisão consciente: SEM login, policy ABERTA por tabela.
--
-- O app não tem autenticação. Quem tem o link (e o código da sala) lê e
-- escreve. É a mesma confiança que o grupo físico já tem entre si; não se
-- guarda nada sensível aqui. O "segredo" é o código da sala não ser público.
-- Racional completo no README, seção "Segurança".
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.rooms        enable row level security;
alter table public.characters   enable row level security;
alter table public.combat_state enable row level security;
alter table public.dm_notes     enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants — RLS sozinho não basta. Com "Automatically expose new tables"
-- desligado na criação do projeto (recomendação do próprio Supabase), tabela
-- nova não ganha privilégio nenhum pros papéis do Data API; sem isso o
-- Postgres barra antes de sequer avaliar a policy de RLS.
-- ─────────────────────────────────────────────────────────────────────────────

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.rooms, public.characters,
  public.combat_state, public.dm_notes to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['rooms', 'characters', 'combat_state', 'dm_notes']
  loop
    execute format('drop policy if exists %I on public.%I', 'acesso_aberto_' || t, t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
      'acesso_aberto_' || t, t
    );
  end loop;
end $$;
