-- Painel de Mesa — paredes, portas e visão automática no mapa.
-- Rode DEPOIS de 0020_sem_apagar_sala.sql, no SQL Editor do Supabase.
--
-- O Mestre desenha PAREDES e PORTAS sobre a cena (segmentos de reta, em pixels
-- da imagem, como a névoa e os peões). Com a "visão automática" ligada na cena,
-- cada aparelho calcula o que o grupo enxerga a partir da posição dos peões dos
-- jogadores e dessas paredes, e abre a névoa sozinho: parede e porta fechada
-- bloqueiam a vista; porta aberta deixa passar.
--
-- Como a névoa, isso esconde NA TELA (o app é aberto, ver README, "Segurança"):
-- as paredes e o que já foi explorado estão no banco, legíveis por qualquer
-- aparelho. Decisão de 01/10/2026: visão do GRUPO (telão e celulares veem o que
-- qualquer jogador enxerga), com o que já foi visto ficando escurecido.
--
-- `cenas.explorado` guarda o que o grupo já viu (uma máscara de quadradinhos
-- compactada em texto; ver lib/visao.ts). Só o aparelho do Mestre grava.

create table if not exists public.cena_paredes (
  id         uuid primary key default gen_random_uuid(),
  cena_id    uuid not null references public.cenas(id) on delete cascade,
  room_code  text not null references public.rooms(code) on delete cascade,
  tipo       text not null default 'parede' check (tipo in ('parede', 'porta')),
  x1         numeric not null,
  y1         numeric not null,
  x2         numeric not null,
  y2         numeric not null,
  -- Só importa pra porta: aberta deixa a vista passar. Parede ignora.
  aberta     boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists cena_paredes_cena_idx on public.cena_paredes (cena_id);
create index if not exists cena_paredes_room_idx on public.cena_paredes (room_code);

alter table public.cena_paredes enable row level security;

grant select, insert, update, delete on public.cena_paredes to anon, authenticated;

drop policy if exists acesso_aberto_cena_paredes on public.cena_paredes;
create policy acesso_aberto_cena_paredes on public.cena_paredes
  for all to anon, authenticated using (true) with check (true);

-- Sem isso a parede apagada não some nos outros aparelhos (ver 0018).
alter table public.cena_paredes replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cena_paredes'
  ) then
    alter publication supabase_realtime add table public.cena_paredes;
  end if;
end $$;

-- Ajustes da cena: a visão automática liga e desliga por mapa (desligada, tudo
-- funciona como antes), o alcance em metros (nulo = vê até onde as paredes
-- deixarem) e o que já foi explorado.
alter table public.cenas
  add column if not exists visao_ligada  boolean not null default false,
  add column if not exists visao_alcance numeric check (visao_alcance is null or (visao_alcance > 0 and visao_alcance <= 1000)),
  add column if not exists explorado     text not null default '' check (char_length(explorado) <= 20000);
