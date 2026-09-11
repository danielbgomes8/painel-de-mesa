-- Painel de Mesa — segunda leva de recursos.
-- Rode DEPOIS de 0001_inicial.sql, no SQL Editor do Supabase.
--
-- Adiciona: PV temporário, ocultar nome de NPC até revelar, inspiração,
-- concentração, dados de vida, recursos genéricos por classe (Fúria, Ki,
-- espaços de magia, Surto de Ação, Canalizar Divindade — cada jogador nomeia
-- o que a classe dele usa), biblioteca de NPCs reaproveitável e log curto
-- de combate.

-- ─────────────────────────────────────────────────────────────────────────────
-- Colunas novas em characters
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.characters
  add column if not exists hp_temp          int     not null default 0,
  add column if not exists revealed         boolean not null default false,
  add column if not exists inspiration      boolean not null default false,
  add column if not exists concentration    boolean not null default false,
  add column if not exists concentration_on text    not null default '',
  add column if not exists hd_max           int     not null default 0,
  add column if not exists hd_cur           int     not null default 0,
  add column if not exists hd_die           text    not null default 'd8',
  add column if not exists resources        jsonb   not null default '[]'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tabelas novas
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.npc_templates (
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null references public.rooms(code) on delete cascade,
  name       text not null,
  cls        text not null default '',
  ac         int  not null default 12,
  hp_max     int  not null default 10,
  speed      int  not null default 9,
  init_mod   int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists npc_templates_room_idx on public.npc_templates (room_code);

create table if not exists public.combat_log (
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null references public.rooms(code) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);

create index if not exists combat_log_room_idx on public.combat_log (room_code, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime — mesmas três tabelas antigas já estão na publicação; adiciona as novas.
-- ─────────────────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.npc_templates;
alter publication supabase_realtime add table public.combat_log;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS + grants — mesma policy aberta das outras tabelas (ver README, "Segurança").
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.npc_templates enable row level security;
alter table public.combat_log    enable row level security;

grant select, insert, update, delete on public.npc_templates, public.combat_log
  to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['npc_templates', 'combat_log']
  loop
    execute format('drop policy if exists %I on public.%I', 'acesso_aberto_' || t, t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
      'acesso_aberto_' || t, t
    );
  end loop;
end $$;
