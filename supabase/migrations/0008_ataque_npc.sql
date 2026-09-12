-- Painel de Mesa — linha de ataque do monstro/NPC.
-- Rode DEPOIS de 0007_bastiao_gestao.sql, no SQL Editor do Supabase.
--
-- Texto livre com acerto e dano ("Cimitarra +4, 1d6+2 cortante"), pra o
-- Mestre ler no turno do bicho sem abrir o livro. É só consulta: o app não
-- rola nem calcula nada disso. Vale pro modelo salvo na biblioteca e pra
-- criatura que já está em cena, porque o Mestre ajusta na hora (um chefe
-- com arma mágica, um capanga enfraquecido).
--
-- Coluna nova em tabela que já existe não precisa de GRANT: o privilégio é
-- da tabela e alcança as colunas futuras. O GRANT explícito do 0001 só é
-- necessário quando a TABELA é nova.

alter table public.npc_templates
  add column if not exists ataque text not null default '';

alter table public.characters
  add column if not exists ataque text not null default '';
