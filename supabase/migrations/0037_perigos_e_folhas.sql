-- Painel de Mesa — perigos contínuos no mapa e folhas de entrega.
-- Rode DEPOIS de 0036_luzes_e_armadilhas.sql, no SQL Editor do Supabase.
--
-- PERIGOS. Uma armadilha passa a ter um `tipo`: 'armadilha' (dispara uma vez ao ser pisada, como até agora) ou
-- 'perigo' (fogo, gás, ácido, água gelada: uma zona que continua ali; o Mestre é avisado quando alguém entra e no
-- início do turno de quem está dentro).
--
-- FOLHAS. Cartas, pergaminhos, o mapa do tesouro: o Mestre escreve, escolhe pra quem vai (`para` = o slug de um
-- jogador, ou nulo = a mesa toda) e entrega (`entregue_em`; nulo = rascunho, só o Mestre vê). Esconde NA TELA, como o
-- resto (o app é aberto, ver README "Segurança"). A foto fica no bucket "mapas", em `<sala>/folhas/`.

alter table public.cena_armadilhas
  add column if not exists tipo text not null default 'armadilha'
    check (tipo in ('armadilha', 'perigo'));

create table if not exists public.folhas (
  id          uuid primary key default gen_random_uuid(),
  room_code   text not null references public.rooms(code) on delete cascade,
  titulo      text not null default '' check (char_length(titulo) <= 80),
  texto       text not null default '' check (char_length(texto) <= 2000),
  foto        text check (foto is null or char_length(foto) <= 300),
  para        text check (para is null or char_length(para) <= 80),
  entregue_em timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists folhas_room_idx on public.folhas (room_code);

alter table public.folhas enable row level security;

grant select, insert, update, delete on public.folhas to anon, authenticated;

drop policy if exists acesso_aberto_folhas on public.folhas;
create policy acesso_aberto_folhas on public.folhas
  for all to anon, authenticated using (true) with check (true);

-- Sem isso a folha apagada não some nos outros aparelhos (ver 0018).
alter table public.folhas replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'folhas'
  ) then
    alter publication supabase_realtime add table public.folhas;
  end if;
end $$;
