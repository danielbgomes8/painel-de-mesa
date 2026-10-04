-- Painel de Mesa — tempo da campanha: o dia em que a mesa está e os efeitos que duram dias.
-- Rode DEPOIS de 0027_ataques_calculados.sql, no SQL Editor do Supabase.
--
-- campanha_tempo   uma linha por sala (a chave é a própria sala). `dia` é um contador que
--                  começa em 1; a data de calendário (Harptos, nas Forgotten Realms) sai dele
--                  e da âncora `inicio_dia_do_ano` + `inicio_ano` (em que dia do ano e em que
--                  ano caiu o dia 1), então corrigir a data de hoje não mexe no contador. O
--                  app avança o dia com "troco só se ninguém mexeu antes" (`update ... where
--                  dia = o que li`), sem função no banco.
-- campanha_efeitos um efeito por linha (maldição, viagem, rito...): vale `duracao` dias a partir
--                  de `inicio_dia`.
--
-- Mesmo molde do baú (0026): acesso aberto como o resto do app, replica identity full e Realtime.

create table if not exists public.campanha_tempo (
  room_code         text primary key references public.rooms(code) on delete cascade,
  dia               integer not null default 1 check (dia >= 1 and dia <= 100000),
  calendario        text not null default 'dias' check (calendario in ('dias', 'harptos')),
  inicio_dia_do_ano integer not null default 1 check (inicio_dia_do_ano >= 1 and inicio_dia_do_ano <= 365),
  inicio_ano        integer not null default 1492 check (inicio_ano >= -10000 and inicio_ano <= 100000),
  updated_at        timestamptz not null default now()
);

create table if not exists public.campanha_efeitos (
  id          uuid primary key default gen_random_uuid(),
  room_code   text not null references public.rooms(code) on delete cascade,
  nome        text not null default '' check (char_length(nome) <= 80),
  alvo        text not null default '' check (char_length(alvo) <= 60),
  inicio_dia  integer not null default 1 check (inicio_dia >= 1 and inicio_dia <= 100000),
  duracao     integer not null default 1 check (duracao >= 1 and duracao <= 36500),
  nota        text not null default '' check (char_length(nota) <= 300),
  created_at  timestamptz not null default now()
);

create index if not exists campanha_efeitos_room_idx on public.campanha_efeitos (room_code, created_at);

alter table public.campanha_tempo enable row level security;
alter table public.campanha_efeitos enable row level security;

grant select, insert, update, delete on public.campanha_tempo to anon, authenticated;
grant select, insert, update, delete on public.campanha_efeitos to anon, authenticated;

drop policy if exists acesso_aberto_campanha_tempo on public.campanha_tempo;
create policy acesso_aberto_campanha_tempo on public.campanha_tempo
  for all to anon, authenticated using (true) with check (true);

drop policy if exists acesso_aberto_campanha_efeitos on public.campanha_efeitos;
create policy acesso_aberto_campanha_efeitos on public.campanha_efeitos
  for all to anon, authenticated using (true) with check (true);

-- Sem isso o efeito removido não some nos outros aparelhos (ver 0018).
alter table public.campanha_tempo replica identity full;
alter table public.campanha_efeitos replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campanha_tempo'
  ) then
    alter publication supabase_realtime add table public.campanha_tempo;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campanha_efeitos'
  ) then
    alter publication supabase_realtime add table public.campanha_efeitos;
  end if;
end $$;
