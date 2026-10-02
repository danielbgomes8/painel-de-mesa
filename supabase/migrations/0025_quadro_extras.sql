-- Painel de Mesa — Quadro da Campanha, parte 2: ligações entre cartões,
-- anotações dos jogadores nos cartões e cartões marcados em cada sessão.
-- Rode DEPOIS de 0024_quadro.sql, no SQL Editor do Supabase.
--
-- Ligações: "Barão Vael → serve a → Culto". Aparece pra quem enxerga os dois cartões.
-- Anotações: qualquer pessoa comenta num cartão que enxerga; todos leem. `autor` é
--   o slug do jogador ou 'mestre'.
-- Diário: `cartoes` guarda os ids dos cartões que apareceram naquela sessão.
-- Como o resto do Quadro, quem vê o quê é decidido NA TELA (app aberto, ver README).

create table if not exists public.quadro_ligacoes (
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null references public.rooms(code) on delete cascade,
  de         uuid not null references public.quadro_cartoes(id) on delete cascade,
  para       uuid not null references public.quadro_cartoes(id) on delete cascade,
  rotulo     text not null default '' check (char_length(rotulo) <= 40),
  created_at timestamptz not null default now(),
  check (de <> para)
);
create index if not exists quadro_ligacoes_room_idx on public.quadro_ligacoes (room_code);

create table if not exists public.quadro_notas (
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null references public.rooms(code) on delete cascade,
  cartao_id  uuid not null references public.quadro_cartoes(id) on delete cascade,
  autor      text not null,
  texto      text not null default '' check (char_length(texto) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists quadro_notas_room_idx on public.quadro_notas (room_code);
create index if not exists quadro_notas_cartao_idx on public.quadro_notas (cartao_id);

alter table public.diario
  add column if not exists cartoes jsonb not null default '[]'::jsonb
  check (jsonb_typeof(cartoes) = 'array' and jsonb_array_length(cartoes) <= 50);

do $$
declare t text;
begin
  foreach t in array array['quadro_ligacoes', 'quadro_notas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
    execute format('drop policy if exists %I on public.%I', 'acesso_aberto_' || t, t);
    execute format('create policy %I on public.%I for all to anon, authenticated using (true) with check (true)', 'acesso_aberto_' || t, t);
    -- Sem isso o apagamento não chega nos outros aparelhos (ver 0018).
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
