-- Painel de Mesa — erros dos aparelhos.
-- Rode DEPOIS de 0016_encontros.sql, no SQL Editor do Supabase.
--
-- Cada celular/notebook manda pra cá um resumo do que deu errado nele:
-- gravação recusada pelo banco, erro de programa, tela que quebrou. Antes
-- isso ficava só no console do aparelho e ninguém ficava sabendo. Queda de
-- internet NÃO vem pra cá — essa tem a fila própria (ver src/lib/offline.ts).
-- Quem manda é src/lib/relatarErro.ts, com freio: no máximo 20 relatos por
-- abertura do app, e o mesmo erro repetido só uma vez a cada 5 minutos.
--
-- Sem ligação com `rooms` de propósito: o relato não pode falhar porque a
-- sala ainda não existe (ou foi apagada), e apagar uma sala não apaga o
-- histórico do que deu errado nela. Também fica FORA do backup — não é dado
-- da campanha (ver TABELAS_FORA_DO_BACKUP em scripts/backup-salas.mjs).
--
-- Os limites de tamanho seguram um relato gigante (uma pilha de erro enorme,
-- ou alguém mandando lixo com a chave pública).

create table if not exists public.erros (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  room_code  text check (char_length(room_code) <= 100),
  quem       text check (char_length(quem) <= 100),         -- "Mestre", nome do personagem, "telão"
  onde       text not null check (char_length(onde) <= 100), -- ex.: "atualizarPersonagem", "tela quebrou"
  mensagem   text not null check (char_length(mensagem) <= 600),
  detalhe    text check (char_length(detalhe) <= 2500),      -- código do banco, dica, pilha do erro
  endereco   text check (char_length(endereco) <= 300),      -- ?sala=...&telao=1
  navegador  text check (char_length(navegador) <= 400),
  versao     text check (char_length(versao) <= 40)          -- commit publicado (7 letras) ou "local"
);

create index if not exists erros_created_at_idx on public.erros (created_at desc);

alter table public.erros enable row level security;

-- Mesmo modelo aberto das outras tabelas (README, seção "Segurança"), menos o
-- update: relato não se edita. O delete fica pra limpar relato de teste.
grant select, insert, delete on public.erros to anon, authenticated;

drop policy if exists erros_ler on public.erros;
create policy erros_ler on public.erros
  for select to anon, authenticated using (true);

drop policy if exists erros_inserir on public.erros;
create policy erros_inserir on public.erros
  for insert to anon, authenticated with check (true);

drop policy if exists erros_apagar on public.erros;
create policy erros_apagar on public.erros
  for delete to anon, authenticated using (true);
