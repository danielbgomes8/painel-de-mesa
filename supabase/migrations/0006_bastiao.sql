-- Painel de Mesa — painel do Bastião (DMG 2024, cap. 8), compartilhado pela mesa.
-- Rode DEPOIS de 0005_saves_cd_magia.sql, no SQL Editor do Supabase.

create table if not exists public.bastiao (
  room_code  text primary key references public.rooms(code) on delete cascade,
  turno      int not null default 1,
  tesouro_po int not null default 0,
  defensores int not null default 0,
  notes      text not null default ''
);

create table if not exists public.bastiao_instalacoes (
  id          uuid primary key default gen_random_uuid(),
  room_code   text not null references public.rooms(code) on delete cascade,
  name        text not null,
  categoria   text not null default 'basica',  -- 'basica' | 'especial'
  tamanho     text not null default 'Apertado', -- 'Apertado' | 'Amplo' | 'Vasto'
  nivel_min   int  not null default 5,
  ordem       text not null default '',         -- Fabricar/Fortalecer/Colher/Recrutar/Pesquisar/Comerciar ('' pra básica)
  contratado  text not null default '',
  ativa       boolean not null default true,
  notes       text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists bastiao_instalacoes_room_idx on public.bastiao_instalacoes (room_code);

create table if not exists public.bastiao_log (
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null references public.rooms(code) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);

create index if not exists bastiao_log_room_idx on public.bastiao_log (room_code, created_at desc);

alter publication supabase_realtime add table public.bastiao;
alter publication supabase_realtime add table public.bastiao_instalacoes;
alter publication supabase_realtime add table public.bastiao_log;

alter table public.bastiao              enable row level security;
alter table public.bastiao_instalacoes  enable row level security;
alter table public.bastiao_log          enable row level security;

grant select, insert, update, delete on public.bastiao, public.bastiao_instalacoes, public.bastiao_log
  to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['bastiao', 'bastiao_instalacoes', 'bastiao_log']
  loop
    execute format('drop policy if exists %I on public.%I', 'acesso_aberto_' || t, t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
      'acesso_aberto_' || t, t
    );
  end loop;
end $$;
