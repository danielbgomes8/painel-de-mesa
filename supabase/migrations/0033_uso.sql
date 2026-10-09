-- Painel de Mesa — o que a mesa realmente usa.
-- Rode DEPOIS de 0032_versao_listas.sql, no SQL Editor do Supabase.
--
-- Cada aparelho marca, uma vez por abertura do app, as telas e ações que usou
-- ("aba:combate", "mapa:nevoa", "acao:desfazer"...). Serve pra decidir o que
-- vale polir e o que pode sair — o app tem muita coisa e ninguém sabe o que a
-- mesa abre de verdade. NÃO leva nome de pessoa nem conteúdo: só a sala, o
-- papel (mestre, jogador, telão), o nome da tela e um sorteio por abertura
-- (pra contar "em quantas sessões abriram" sem contar toque repetido).
--
-- Sem ligação com `rooms`, como a `erros` (0017): registrar uso nunca pode
-- falhar porque a sala não existe, e fica FORA do backup (não é dado da
-- campanha — ver TABELAS_FORA_DO_BACKUP em scripts/backup-salas.mjs).
-- Quem manda é src/lib/registrarUso.ts, com freio (80 por abertura).

create table if not exists public.uso (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  room_code  text not null check (char_length(room_code) <= 100),
  papel      text not null check (papel in ('mestre', 'jogador', 'telao')),
  tela       text not null check (char_length(tela) <= 60),
  abertura   text not null check (char_length(abertura) <= 40)
);

create index if not exists uso_sala_data_idx on public.uso (room_code, created_at desc);

alter table public.uso enable row level security;

-- Mesmo modelo aberto das outras tabelas (README, seção "Segurança"), menos o
-- update: registro não se edita. O delete fica pra limpar dado de teste.
grant select, insert, delete on public.uso to anon, authenticated;

drop policy if exists uso_ler on public.uso;
create policy uso_ler on public.uso
  for select to anon, authenticated using (true);

drop policy if exists uso_inserir on public.uso;
create policy uso_inserir on public.uso
  for insert to anon, authenticated with check (true);

drop policy if exists uso_apagar on public.uso;
create policy uso_apagar on public.uso
  for delete to anon, authenticated using (true);
