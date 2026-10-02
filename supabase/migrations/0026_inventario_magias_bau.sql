-- Painel de Mesa — inventário e moedas de cada personagem, lista de magias e
-- o baú do grupo (o espólio que ainda não é de ninguém).
-- Rode DEPOIS de 0025_quadro_extras.sql, no SQL Editor do Supabase.
--
-- Na linha do personagem (igual `ficha_secoes`, 0012 — sincroniza com o resto da
-- ficha e viaja no backup sem ninguém lembrar de nada):
--   moedas     {pc, pp, pe, po, pl} — cobre, prata, electro, ouro e platina.
--   inventario lista de itens: nome, qtd, peso (kg por unidade), descrição, se é
--              mágico, raridade, se está equipado e a sintonização.
--   magias     lista de magias conhecidas/preparadas: nome, nível, se está
--              preparada, concentração, ritual e o texto.
--
-- Baú do grupo (`bau_itens`): uma linha por item. As moedas do baú são linhas
-- também (`moeda` preenchida, uma por tipo por sala) — assim guardar ou tirar
-- moeda é "troco a quantidade só se ninguém mexeu antes", sem trava nem função
-- no banco. Cada celular escreve só a linha que mexeu.
--
-- Coluna nova em tabela que já existe não precisa de GRANT (ver 0012).

alter table public.characters
  add column if not exists moedas jsonb not null default '{"pc":0,"pp":0,"pe":0,"po":0,"pl":0}'::jsonb
    check (jsonb_typeof(moedas) = 'object'),
  add column if not exists inventario jsonb not null default '[]'::jsonb
    check (jsonb_typeof(inventario) = 'array' and jsonb_array_length(inventario) <= 300),
  add column if not exists magias jsonb not null default '[]'::jsonb
    check (jsonb_typeof(magias) = 'array' and jsonb_array_length(magias) <= 300);

create table if not exists public.bau_itens (
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null references public.rooms(code) on delete cascade,
  nome       text not null default '' check (char_length(nome) <= 80),
  qtd        integer not null default 1 check (qtd >= 0 and qtd <= 1000000),
  peso       numeric(8, 2) not null default 0 check (peso >= 0 and peso <= 100000),
  descricao  text not null default '' check (char_length(descricao) <= 500),
  magico     boolean not null default false,
  raridade   text not null default '' check (char_length(raridade) <= 20),
  moeda      text check (moeda in ('pc', 'pp', 'pe', 'po', 'pl')),
  created_at timestamptz not null default now()
);

create index if not exists bau_itens_room_idx on public.bau_itens (room_code, created_at);
-- Uma linha de moeda por tipo e por sala; o app depende disso pra não duplicar.
create unique index if not exists bau_itens_moeda_idx on public.bau_itens (room_code, moeda)
  where moeda is not null;

alter table public.bau_itens enable row level security;

grant select, insert, update, delete on public.bau_itens to anon, authenticated;

drop policy if exists acesso_aberto_bau_itens on public.bau_itens;
create policy acesso_aberto_bau_itens on public.bau_itens
  for all to anon, authenticated using (true) with check (true);

-- Sem isso o item tirado do baú não some nos outros aparelhos (ver 0018).
alter table public.bau_itens replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bau_itens'
  ) then
    alter publication supabase_realtime add table public.bau_itens;
  end if;
end $$;
