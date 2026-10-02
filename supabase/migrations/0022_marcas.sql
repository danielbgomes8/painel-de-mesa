-- Painel de Mesa — desenhos e notas no mapa.
-- Rode DEPOIS de 0021_paredes.sql, no SQL Editor do Supabase.
--
-- O Mestre risca o mapa (traço livre ou linha reta) e põe notas (um alfinete
-- numerado com um texto curto: "armadilha aqui", "o ladrão foge por esta
-- porta"). Cada marca pode ficar só pro Mestre (`visivel = false`, preparo de
-- sessão) ou aparecer pra mesa inteira.
--
-- Como a névoa e as paredes, isso esconde NA TELA (o app é aberto, ver README,
-- "Segurança"): a marca oculta está no banco, legível por qualquer aparelho.
-- Coordenadas em px da IMAGEM da cena. Uma tabela só pros dois tipos:
--   'traco' = `pontos` (lista de [x, y], a linha reta tem dois),
--   'nota'  = `x`, `y` e `texto`.

create table if not exists public.cena_marcas (
  id         uuid primary key default gen_random_uuid(),
  cena_id    uuid not null references public.cenas(id) on delete cascade,
  room_code  text not null references public.rooms(code) on delete cascade,
  tipo       text not null check (tipo in ('traco', 'nota')),
  cor        text not null default '#f0c24b' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  -- Só traço: no máximo 400 pontos (o app simplifica o desenho antes de gravar).
  pontos     jsonb not null default '[]'::jsonb check (jsonb_typeof(pontos) = 'array' and jsonb_array_length(pontos) <= 400),
  -- Só nota: onde fica o alfinete e o que está escrito.
  x          numeric,
  y          numeric,
  texto      text not null default '' check (char_length(texto) <= 140),
  -- Falso = só o Mestre vê.
  visivel    boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists cena_marcas_cena_idx on public.cena_marcas (cena_id);
create index if not exists cena_marcas_room_idx on public.cena_marcas (room_code);

alter table public.cena_marcas enable row level security;

grant select, insert, update, delete on public.cena_marcas to anon, authenticated;

drop policy if exists acesso_aberto_cena_marcas on public.cena_marcas;
create policy acesso_aberto_cena_marcas on public.cena_marcas
  for all to anon, authenticated using (true) with check (true);

-- Sem isso a marca apagada não some nos outros aparelhos (ver 0018).
alter table public.cena_marcas replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cena_marcas'
  ) then
    alter publication supabase_realtime add table public.cena_marcas;
  end if;
end $$;
