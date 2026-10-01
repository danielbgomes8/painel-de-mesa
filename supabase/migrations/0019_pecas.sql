-- Painel de Mesa — peões no mapa (cena_pecas).
-- Rode DEPOIS de 0018_cenas.sql, no SQL Editor do Supabase.
--
-- Um PEÃO é um círculo sobre a cena: a ficha de um personagem (`slug` aponta
-- pra `characters.slug`, e o nome, a cor e se o inimigo já foi revelado vêm da
-- ficha — nada disso é copiado pra cá, então revelar o inimigo na ficha também
-- revela o peão) ou um marcador avulso (`slug` nulo, com nome e cor próprios).
-- Posição `x`, `y` é o CENTRO, em pixels da imagem da cena, como a névoa.
--
-- Mesmo modelo aberto das outras tabelas (ver README, "Segurança"): o peão
-- `oculto` e o inimigo sob a névoa só são escondidos NA TELA.

create table if not exists public.cena_pecas (
  id         uuid primary key default gen_random_uuid(),
  cena_id    uuid not null references public.cenas(id) on delete cascade,
  room_code  text not null references public.rooms(code) on delete cascade,
  slug       text,
  nome       text not null default '' check (char_length(nome) <= 30),
  x          numeric not null,
  y          numeric not null,
  tamanho    smallint not null default 1 check (tamanho between 1 and 4),
  cor        text check (cor is null or cor ~ '^#[0-9a-fA-F]{6}$'),
  oculto     boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists cena_pecas_cena_idx on public.cena_pecas (cena_id);
create index if not exists cena_pecas_room_idx on public.cena_pecas (room_code);

-- Uma ficha tem no máximo um peão por cena (tocar duas vezes em "pôr o grupo"
-- não duplica ninguém). Marcadores avulsos (slug nulo) podem ser vários.
create unique index if not exists cena_pecas_uma_por_ficha
  on public.cena_pecas (cena_id, slug) where slug is not null;

alter table public.cena_pecas enable row level security;

grant select, insert, update, delete on public.cena_pecas to anon, authenticated;

drop policy if exists acesso_aberto_cena_pecas on public.cena_pecas;
create policy acesso_aberto_cena_pecas on public.cena_pecas
  for all to anon, authenticated using (true) with check (true);

-- Sem isso o peão tirado do mapa não some nos outros aparelhos (ver 0018).
alter table public.cena_pecas replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cena_pecas'
  ) then
    alter publication supabase_realtime add table public.cena_pecas;
  end if;
end $$;
