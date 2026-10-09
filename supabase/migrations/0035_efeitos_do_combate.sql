-- Painel de Mesa — efeitos com duração no combate.
-- Rode DEPOIS de 0034_eventos_do_combate.sql, no SQL Editor do Supabase.
--
-- "Bênção, 10 rodadas", "Escudo da Fé", "Proteção contra o Bem": efeito que NÃO
-- é uma condição (as condições já têm prazo próprio, em `characters.cond_prazo`).
-- Cada linha é um relógio preso a um personagem da ordem de iniciativa.
--
-- Guarda a rodada em que o efeito ACABA (`termina_rodada`), não uma contagem
-- regressiva: "acaba na rodada 14" nunca se perde se o turno pular ou dois
-- celulares tocarem juntos. Acabar = no início do turno de quem lançou
-- (`lancador_slug`; sem lançador, no início da rodada). Isso é decidido na tela.
--
-- Fica FORA do backup diário (é estado de um combate, não dado da campanha).
-- Encerrar ou reiniciar o combate apaga todos.

create table if not exists public.combate_efeitos (
  id              uuid primary key default gen_random_uuid(),
  room_code       text not null references public.rooms(code) on delete cascade,
  nome            text not null check (char_length(nome) between 1 and 60),
  -- Em quem o efeito está (slug do personagem na ordem).
  alvo_slug       text not null check (char_length(alvo_slug) between 1 and 80),
  -- Quem lançou (slug); null = acaba no início da rodada.
  lancador_slug   text check (lancador_slug is null or char_length(lancador_slug) between 1 and 80),
  termina_rodada  integer not null check (termina_rodada between 1 and 2000),
  created_at      timestamptz not null default now()
);

create index if not exists combate_efeitos_room_idx on public.combate_efeitos (room_code);

alter table public.combate_efeitos enable row level security;

-- Mesmo modelo aberto das outras tabelas — ver README, seção "Segurança".
grant select, insert, update, delete on public.combate_efeitos to anon, authenticated;

drop policy if exists acesso_aberto_combate_efeitos on public.combate_efeitos;
create policy acesso_aberto_combate_efeitos on public.combate_efeitos
  for all to anon, authenticated using (true) with check (true);

-- Tempo real, com a linha antiga inteira (o apagamento ao encerrar o combate
-- precisa chegar nos outros aparelhos com o canal filtrado por sala).
alter table public.combate_efeitos replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'combate_efeitos'
  ) then
    alter publication supabase_realtime add table public.combate_efeitos;
  end if;
end $$;
