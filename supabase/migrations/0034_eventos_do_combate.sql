-- Painel de Mesa — eventos do combate.
-- Rode DEPOIS de 0033_uso.sql, no SQL Editor do Supabase.
--
-- O Mestre deixa avisos programados pro combate: "na rodada 3 o teto começa a
-- desabar", "quando o dragão chegar a 50% de PV ele levanta voo". Quando o
-- gatilho acontece, o aviso aparece pra ele (só pra ele; o texto só vai pro log
-- público se ele marcar "contar à mesa").
--
-- Duas peças:
--   * `encontros.eventos` — os avisos preparados junto do encontro (modelo:
--     rodada ou PV de um GRUPO do encontro). Viajam no backup com o encontro.
--   * `combate_eventos` — os avisos valendo no combate de agora. Ao começar um
--     encontro, o app copia os modelos pra cá trocando "grupo" pelos slugs dos
--     monstros criados. O Mestre também cria avisos avulsos direto no combate.
--     Encerrar ou reiniciar o combate apaga todos.
--
-- Se o gatilho já disparou ou não é decidido na tela, a partir da rodada e do PV
-- (nada de rodar regra no banco); a coluna `feito` só guarda "já tratei isso".
-- Fica FORA do backup diário (é estado de um combate, não dado da campanha).

alter table public.encontros
  add column if not exists eventos jsonb not null default '[]'::jsonb
  check (jsonb_typeof(eventos) = 'array' and jsonb_array_length(eventos) <= 30);

create table if not exists public.combate_eventos (
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null references public.rooms(code) on delete cascade,
  tipo       text not null check (tipo in ('rodada', 'pv')),
  rodada     integer check (rodada between 1 and 99),
  -- Só 'pv': a que monstros o gatilho olha (basta UM chegar lá). Lista de slugs.
  slugs      jsonb not null default '[]'::jsonb
             check (jsonb_typeof(slugs) = 'array' and jsonb_array_length(slugs) <= 40),
  pct        integer check (pct between 0 and 100),
  texto      text not null default '' check (char_length(texto) between 1 and 200),
  -- Verdadeiro: ao marcar "feito", o texto vai pro log público.
  publico    boolean not null default false,
  feito      boolean not null default false,
  created_at timestamptz not null default now(),
  check ((tipo = 'rodada' and rodada is not null) or (tipo = 'pv' and pct is not null))
);

create index if not exists combate_eventos_room_idx on public.combate_eventos (room_code);

alter table public.combate_eventos enable row level security;

-- Mesmo modelo aberto das outras tabelas — ver README, seção "Segurança".
grant select, insert, update, delete on public.combate_eventos to anon, authenticated;

drop policy if exists acesso_aberto_combate_eventos on public.combate_eventos;
create policy acesso_aberto_combate_eventos on public.combate_eventos
  for all to anon, authenticated using (true) with check (true);

-- Tempo real, com a linha antiga inteira: sem isso o apagamento (encerrar o
-- combate) não chega nos outros aparelhos com o canal filtrado por sala.
alter table public.combate_eventos replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'combate_eventos'
  ) then
    alter publication supabase_realtime add table public.combate_eventos;
  end if;
end $$;
