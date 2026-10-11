-- Painel de Mesa — luzes que acabam (tocha, lamparina...) e armadilhas no mapa.
-- Rode DEPOIS de 0035_efeitos_do_combate.sql, no SQL Editor do Supabase.
--
-- LUZES. Um mapa pode ser "escuro" (`cenas.escura`): com a visão automática ligada, cada jogador só
-- enxerga até onde a luz que ele carrega alcança (ou 1,5 m, se não tem luz). A luz fica no peão, em três
-- colunas: o nome ("Tocha"), o alcance em METROS (claro + penumbra) e quantos MINUTOS ainda faltam
-- (nulo = não acaba, como a visão no escuro; 0 = apagada). O Mestre passa o tempo com botões; quando
-- chega a 0, a visão do portador encolhe.
--
-- ARMADILHAS. Uma tabela só. Fica ESCONDIDA da mesa enquanto `estado = 'armada'` (esconde NA TELA, como
-- a névoa e as paredes, ver README "Segurança"). Quando um peão pisa, só o Mestre é avisado.
--
-- Coluna nova em tabela que já existe não precisa de GRANT (ver 0012). `cena_pecas` e `cenas` já estão
-- no tempo real, então ligar, passar o tempo e apagar chegam nos outros aparelhos sozinhos.

alter table public.cenas
  add column if not exists escura boolean not null default false;

alter table public.cena_pecas
  add column if not exists luz_nome text
    check (luz_nome is null or char_length(luz_nome) <= 30),
  add column if not exists luz_alcance numeric
    check (luz_alcance is null or (luz_alcance > 0 and luz_alcance <= 120)),
  add column if not exists luz_minutos integer
    check (luz_minutos is null or (luz_minutos >= 0 and luz_minutos <= 10080));

create table if not exists public.cena_armadilhas (
  id          uuid primary key default gen_random_uuid(),
  cena_id     uuid not null references public.cenas(id) on delete cascade,
  room_code   text not null references public.rooms(code) on delete cascade,
  nome        text not null default '' check (char_length(nome) <= 40),
  -- Centro, em px da IMAGEM da cena.
  x           numeric not null,
  y           numeric not null,
  -- Raio da zona que dispara, em metros, a partir do centro (0,75 m = o quadradinho de 1,5 m).
  raio        numeric not null default 0.75 check (raio > 0 and raio <= 60),
  -- O que o Mestre recebe de aviso: "DES", CD 13, "2d6 perfurante".
  salvaguarda text not null default '' check (char_length(salvaguarda) <= 20),
  cd          integer check (cd is null or (cd >= 1 and cd <= 40)),
  dano        text not null default '' check (char_length(dano) <= 40),
  nota        text not null default '' check (char_length(nota) <= 140),
  -- armada = escondida e vigiando; revelada = a mesa vê e ela ainda vigia;
  -- disparada = já foi; desarmada = neutralizada. Só 'armada' é escondida da mesa.
  estado      text not null default 'armada' check (estado in ('armada', 'revelada', 'disparada', 'desarmada')),
  created_at  timestamptz not null default now()
);

create index if not exists cena_armadilhas_cena_idx on public.cena_armadilhas (cena_id);
create index if not exists cena_armadilhas_room_idx on public.cena_armadilhas (room_code);

alter table public.cena_armadilhas enable row level security;

grant select, insert, update, delete on public.cena_armadilhas to anon, authenticated;

drop policy if exists acesso_aberto_cena_armadilhas on public.cena_armadilhas;
create policy acesso_aberto_cena_armadilhas on public.cena_armadilhas
  for all to anon, authenticated using (true) with check (true);

-- Sem isso a armadilha apagada não some nos outros aparelhos (ver 0018).
alter table public.cena_armadilhas replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cena_armadilhas'
  ) then
    alter publication supabase_realtime add table public.cena_armadilhas;
  end if;
end $$;
