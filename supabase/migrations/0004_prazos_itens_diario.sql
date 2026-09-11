-- Painel de Mesa — condição com prazo, percepção passiva, munição/equipamento
-- e diário de campanha.
-- Rode DEPOIS de 0003_biblioteca_notas.sql, no SQL Editor do Supabase.

alter table public.characters
  add column if not exists cond_prazo jsonb not null default '{}'::jsonb, -- {"Amedrontado": 2} = rodadas restantes
  add column if not exists pp         int   not null default 10,          -- percepção passiva
  add column if not exists items      jsonb not null default '[]'::jsonb; -- munição/equipamento: [{name,max,cur}], não reseta em descanso

-- ─────────────────────────────────────────────────────────────────────────────
-- Diário da campanha — entradas visíveis pra todo mundo, o Mestre escreve.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.diario (
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null references public.rooms(code) on delete cascade,
  title      text not null default '',
  text       text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists diario_room_idx on public.diario (room_code, created_at desc);

alter publication supabase_realtime add table public.diario;

alter table public.diario enable row level security;

grant select, insert, update, delete on public.diario to anon, authenticated;

drop policy if exists acesso_aberto_diario on public.diario;
create policy acesso_aberto_diario on public.diario
  for all to anon, authenticated using (true) with check (true);
