-- Painel de Mesa — mapas (cenas) com névoa de guerra, ao vivo pra mesa toda.
-- Rode DEPOIS de 0017_erros.sql, no SQL Editor do Supabase.
--
-- Uma CENA é um mapa: a imagem (já reduzida pelo aparelho do Mestre antes de
-- subir), a grade (tamanho do quadradinho e onde ela começa), e qual cena a
-- mesa está vendo agora (`na_mesa`: no máximo uma por sala).
--
-- A NÉVOA é uma lista de pinceladas, em ordem: cada linha de `cena_nevoa` é
-- "revelar" ou "esconder" uma forma (retângulos ou um traço de pincel). Pra
-- saber o que a mesa enxerga, o aparelho desenha a cena inteira coberta
-- (se `nevoa_ligada`) e aplica as pinceladas uma a uma. Desfazer = apagar a
-- última linha. Coordenadas são sempre em pixels da imagem da cena, nunca da
-- tela, e os retângulos NÃO dependem da grade: recalibrar a grade depois não
-- desloca o que já foi revelado.
--
-- Segredo: a névoa esconde NA TELA, como o NPC oculto e o PV de inimigo já
-- fazem — o mapa inteiro está no banco. Decisão combinada em 01/10/2026
-- (modelo aberto do app, ver README, seção "Segurança"; a alternativa de
-- "segredo de verdade" não deixaria peão se mexer nem visão automática).

-- ── Onde ficam as imagens ────────────────────────────────────────────────
-- Bucket público (a imagem é lida por link, sem login). Nomes são
-- <sala>/<uuid>.jpg, impossíveis de chutar. O limite de 8 MB protege o plano
-- gratuito (1 GB): o app reduz a imagem pra ~1-3 MB antes de subir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mapas', 'mapas', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 8388608,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists mapas_ler on storage.objects;
create policy mapas_ler on storage.objects
  for select to anon, authenticated using (bucket_id = 'mapas');

drop policy if exists mapas_enviar on storage.objects;
create policy mapas_enviar on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'mapas');

drop policy if exists mapas_apagar on storage.objects;
create policy mapas_apagar on storage.objects
  for delete to anon, authenticated using (bucket_id = 'mapas');

-- ── Cenas ────────────────────────────────────────────────────────────────
create table if not exists public.cenas (
  id           uuid primary key default gen_random_uuid(),
  room_code    text not null references public.rooms(code) on delete cascade,
  nome         text not null default '' check (char_length(nome) <= 60),
  imagem       text,                                   -- caminho no bucket "mapas"
  largura      integer not null default 0 check (largura between 0 and 8192),
  altura       integer not null default 0 check (altura between 0 and 8192),
  grade_ligada boolean not null default true,
  grade_px     numeric not null default 70 check (grade_px between 8 and 2000),
  grade_dx     numeric not null default 0,             -- onde a grade começa (px)
  grade_dy     numeric not null default 0,
  metros       numeric not null default 1.5 check (metros > 0 and metros <= 100),
  nevoa_ligada boolean not null default true,          -- a cena nasce coberta
  na_mesa      boolean not null default false,         -- é a que a mesa vê agora
  camera       jsonb,                                  -- {x,y,w,h} que a mesa enquadra; null = mapa todo
  created_at   timestamptz not null default now()
);

create index if not exists cenas_room_idx on public.cenas (room_code);

-- No máximo uma cena na mesa por sala. Trocar de cena = tirar a antiga e pôr
-- a nova (duas escritas; se a segunda falhar, a mesa fica sem mapa — nunca
-- com dois).
create unique index if not exists cenas_uma_na_mesa
  on public.cenas (room_code) where na_mesa;

-- ── Névoa ────────────────────────────────────────────────────────────────
create table if not exists public.cena_nevoa (
  id         uuid primary key default gen_random_uuid(),
  cena_id    uuid not null references public.cenas(id) on delete cascade,
  room_code  text not null references public.rooms(code) on delete cascade,
  modo       text not null check (modo in ('revelar', 'esconder')),
  forma      text not null check (forma in ('retangulos', 'pincel')),
  dados      jsonb not null check (pg_column_size(dados) < 32768),
  seq        bigint generated always as identity,      -- ordem das pinceladas
  created_at timestamptz not null default now()
);

create index if not exists cena_nevoa_cena_idx on public.cena_nevoa (cena_id, seq);
create index if not exists cena_nevoa_room_idx on public.cena_nevoa (room_code);

-- ── Acesso: mesmo modelo aberto das outras tabelas (0001, README) ────────
alter table public.cenas enable row level security;
alter table public.cena_nevoa enable row level security;

grant select, insert, update, delete on public.cenas to anon, authenticated;
grant select, insert, update, delete on public.cena_nevoa to anon, authenticated;

drop policy if exists acesso_aberto_cenas on public.cenas;
create policy acesso_aberto_cenas on public.cenas
  for all to anon, authenticated using (true) with check (true);

drop policy if exists acesso_aberto_cena_nevoa on public.cena_nevoa;
create policy acesso_aberto_cena_nevoa on public.cena_nevoa
  for all to anon, authenticated using (true) with check (true);

-- ── Tempo real ───────────────────────────────────────────────────────────
-- `replica identity full`: sem isso, o apagamento (desfazer uma pincelada,
-- esconder tudo, tirar a cena da mesa) NÃO chega nos outros aparelhos quando
-- o canal filtra por sala — o banco só mandaria o id da linha apagada. É a
-- limitação das outras tabelas que o AGENTS.md descreve; aqui está resolvida.
alter table public.cenas replica identity full;
alter table public.cena_nevoa replica identity full;

do $$
declare
  t text;
begin
  foreach t in array array['cenas', 'cena_nevoa'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
