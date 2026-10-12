-- Painel de Mesa — relógios de tensão, loja, percepção passiva nas armadilhas e portas trancadas/secretas.
-- Rode DEPOIS de 0037_perigos_e_folhas.sql, no SQL Editor do Supabase.
--
-- RELÓGIOS. Um círculo com 4, 6, 8, 10 ou 12 fatias que o Mestre enche aos poucos ("o ritual termina", "a guarda
-- chega"). A mesa vê encher; a `consequencia` só é lida por ela quando o relógio fecha. `visivel = false` = só o
-- Mestre vê (preparo de sessão). Esconde NA TELA, como o resto (o app é aberto, ver README "Segurança").

create table if not exists public.relogios (
  id           uuid primary key default gen_random_uuid(),
  room_code    text not null references public.rooms(code) on delete cascade,
  nome         text not null default '' check (char_length(nome) <= 60),
  fatias       integer not null default 6 check (fatias in (4, 6, 8, 10, 12)),
  cheias       integer not null default 0 check (cheias >= 0 and cheias <= fatias),
  visivel      boolean not null default true,
  consequencia text not null default '' check (char_length(consequencia) <= 140),
  created_at   timestamptz not null default now()
);

create index if not exists relogios_room_idx on public.relogios (room_code);

alter table public.relogios enable row level security;

grant select, insert, update, delete on public.relogios to anon, authenticated;

drop policy if exists acesso_aberto_relogios on public.relogios;
create policy acesso_aberto_relogios on public.relogios
  for all to anon, authenticated using (true) with check (true);

-- Sem isso o relógio apagado não some nos outros aparelhos (ver 0018).
alter table public.relogios replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'relogios'
  ) then
    alter publication supabase_realtime add table public.relogios;
  end if;
end $$;

-- LOJA. O Mestre monta lojas (`lojas`) com itens (`loja_itens`) e abre pra mesa (`aberta`). O jogador compra pelo
-- celular: o dinheiro sai da ficha dele, o item entra no inventário, o estoque baixa. O preço é guardado em PEÇAS DE
-- COBRE (`preco_pc`, inteiro; 1 PO = 100 PC): sem centavo quebrado. `estoque` nulo = sempre tem. Loja fechada é
-- invisível pra mesa (esconde NA TELA, como o resto).

create table if not exists public.lojas (
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null references public.rooms(code) on delete cascade,
  nome       text not null default '' check (char_length(nome) <= 60),
  aberta     boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.loja_itens (
  id         uuid primary key default gen_random_uuid(),
  loja_id    uuid not null references public.lojas(id) on delete cascade,
  room_code  text not null references public.rooms(code) on delete cascade,
  nome       text not null default '' check (char_length(nome) <= 80),
  descricao  text not null default '' check (char_length(descricao) <= 300),
  preco_pc   integer not null default 0 check (preco_pc >= 0 and preco_pc <= 1000000000),
  estoque    integer check (estoque is null or (estoque >= 0 and estoque <= 100000)),
  peso       numeric not null default 0 check (peso >= 0 and peso <= 100000),
  magico     boolean not null default false,
  raridade   text not null default '' check (char_length(raridade) <= 20),
  created_at timestamptz not null default now()
);

create index if not exists lojas_room_idx on public.lojas (room_code);
create index if not exists loja_itens_loja_idx on public.loja_itens (loja_id);
create index if not exists loja_itens_room_idx on public.loja_itens (room_code);

alter table public.lojas enable row level security;
alter table public.loja_itens enable row level security;

grant select, insert, update, delete on public.lojas to anon, authenticated;
grant select, insert, update, delete on public.loja_itens to anon, authenticated;

drop policy if exists acesso_aberto_lojas on public.lojas;
create policy acesso_aberto_lojas on public.lojas
  for all to anon, authenticated using (true) with check (true);

drop policy if exists acesso_aberto_loja_itens on public.loja_itens;
create policy acesso_aberto_loja_itens on public.loja_itens
  for all to anon, authenticated using (true) with check (true);

-- Sem isso o que é apagado não some nos outros aparelhos (ver 0018).
alter table public.lojas replica identity full;
alter table public.loja_itens replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lojas'
  ) then
    alter publication supabase_realtime add table public.lojas;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'loja_itens'
  ) then
    alter publication supabase_realtime add table public.loja_itens;
  end if;
end $$;

-- PERCEPÇÃO PASSIVA NAS ARMADILHAS. O Mestre dá a uma armadilha escondida uma `cd_achar`: se a Percepção passiva da
-- ficha de um jogador for igual ou maior e ele chegar a 4,5 m, só o Mestre recebe o aviso "Ana percebe algo".
-- Nulo = ninguém repara sozinho.
alter table public.cena_armadilhas
  add column if not exists cd_achar integer
    check (cd_achar is null or (cd_achar >= 1 and cd_achar <= 40));

-- PORTAS TRANCADAS E SECRETAS. Só vale pra `tipo = 'porta'` (o app ignora nas paredes):
--   trancada = o Mestre vê o cadeado e a CD (`cd`) pra arrombar; a porta não abre com um toque sem destrancar;
--   secreta  = ninguém sabe dela; com `cd_achar`, a Percepção passiva de quem chega perto avisa o Mestre.
-- A mesa nunca vê paredes nem portas (esconde NA TELA, como o resto).
alter table public.cena_paredes
  add column if not exists trancada boolean not null default false,
  add column if not exists secreta boolean not null default false,
  add column if not exists cd integer
    check (cd is null or (cd >= 1 and cd <= 40)),
  add column if not exists cd_achar integer
    check (cd_achar is null or (cd_achar >= 1 and cd_achar <= 40));
