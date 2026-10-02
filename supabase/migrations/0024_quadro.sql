-- Painel de Mesa — Quadro da Campanha (cartões de NPC, vilão, local, pista...).
-- Rode DEPOIS de 0023_aura_peao.sql, no SQL Editor do Supabase.
--
-- Cada cartão tem foto, texto que a mesa lê e um segredo que só o Mestre vê.
--   revelacao: 'escondido' (só o Mestre), 'silhueta' (a mesa vê a foto escura e
--              "???") ou 'revelado' (a mesa vê tudo).
--   dono:      nulo = cartão da mesa (o Mestre controla); preenchido = cartão
--              pessoal de um jogador (slug da ficha). Pessoal 'escondido' = só
--              o dono vê; 'revelado' = compartilhado com a mesa.
--   destaque_em: o Mestre tocou em "mostrar à mesa agora" — quem está com o app
--              aberto recebe a foto em tela cheia.
--
-- Como a névoa e as marcas, o segredo esconde NA TELA (o app é aberto, ver
-- README, "Segurança"). A foto vai pro bucket `mapas` (já existe), em
-- <sala>/quadro/.

create table if not exists public.quadro_cartoes (
  id          uuid primary key default gen_random_uuid(),
  room_code   text not null references public.rooms(code) on delete cascade,
  tipo        text not null default 'npc'
              check (tipo in ('npc', 'vilao', 'local', 'faccao', 'item', 'pista', 'missao', 'outro')),
  titulo      text not null default '' check (char_length(titulo) <= 80),
  subtitulo   text not null default '' check (char_length(subtitulo) <= 80),
  foto        text,
  texto       text not null default '' check (char_length(texto) <= 1500),
  segredo     text not null default '' check (char_length(segredo) <= 1500),
  revelacao   text not null default 'escondido' check (revelacao in ('escondido', 'silhueta', 'revelado')),
  dono        text,
  coluna      text not null default '' check (char_length(coluna) <= 30),
  destaque_em timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists quadro_cartoes_room_idx on public.quadro_cartoes (room_code, created_at);

alter table public.quadro_cartoes enable row level security;

grant select, insert, update, delete on public.quadro_cartoes to anon, authenticated;

drop policy if exists acesso_aberto_quadro_cartoes on public.quadro_cartoes;
create policy acesso_aberto_quadro_cartoes on public.quadro_cartoes
  for all to anon, authenticated using (true) with check (true);

-- Sem isso o cartão apagado não some nos outros aparelhos (ver 0018).
alter table public.quadro_cartoes replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quadro_cartoes'
  ) then
    alter publication supabase_realtime add table public.quadro_cartoes;
  end if;
end $$;
