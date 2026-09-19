-- Painel de Mesa — encontros preparados antes da sessão.
-- Rode DEPOIS de 0015_bastiao_sem_corrida.sql, no SQL Editor do Supabase.
--
-- Um encontro é um grupo inimigo montado com antecedência ("Emboscada na
-- ponte: 3 Goblins + 1 Chefe goblin"). Na hora da luta, um toque cria todos os
-- NPCs e joga cada um na iniciativa — em vez de adicionar um por um no meio
-- da sessão, com a mesa esperando.
--
-- Cada item de `grupos` é uma CÓPIA da ficha do monstro no momento em que
-- entrou no encontro (nome, classe, CA, PV, deslocamento, iniciativa, ataque,
-- notas) mais a `quantidade` — não um link pra biblioteca. Mesma decisão da
-- biblioteca em relação ao catálogo do SRD: depois de copiado, mexer no
-- original não muda o que já foi preparado, e apagar um modelo da biblioteca
-- não quebra encontro nenhum.
--
-- A tabela já existia em produção (criada numa sessão que não chegou a subir
-- o código). Este arquivo é escrito pra ser seguro de rodar por cima dela:
-- tudo é "se ainda não existir". O que ele acrescenta de fato lá é a linha do
-- tempo real no fim — sem ela, um encontro montado no notebook só aparecia no
-- celular depois de recarregar (conferido: zero eventos chegavam).

create table if not exists public.encontros (
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null references public.rooms(code) on delete cascade,
  name       text not null default '',
  grupos     jsonb not null default '[]'::jsonb,   -- [{name, cls, ac, hp_max, speed, init_mod, ataque, notes, quantidade}]
  created_at timestamptz not null default now()
);

create index if not exists encontros_room_idx on public.encontros (room_code);

alter table public.encontros enable row level security;

-- Mesmo modelo aberto das outras tabelas — ver 0001_inicial.sql e o README,
-- seção "Segurança". Sem o grant explícito o anon leva "permission denied"
-- mesmo com a policy certa.
grant select, insert, update, delete on public.encontros to anon, authenticated;

drop policy if exists acesso_aberto_encontros on public.encontros;
create policy acesso_aberto_encontros on public.encontros
  for all to anon, authenticated using (true) with check (true);

-- `alter publication ... add table` dá erro se a tabela já estiver lá; o
-- teste antes deixa o arquivo rodar duas vezes sem susto.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'encontros'
  ) then
    alter publication supabase_realtime add table public.encontros;
  end if;
end $$;
