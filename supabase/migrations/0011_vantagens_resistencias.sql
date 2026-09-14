-- Painel de Mesa — campo próprio pra vantagem em teste / resistência a dano.
-- Rode DEPOIS de 0010_combate_sem_corrida.sql, no SQL Editor do Supabase.
--
-- Até aqui isso ficava misturado nas "Notas rápidas" (texto livre pra
-- qualquer coisa). Separado, fica sempre visível na ficha do jogador sem se
-- perder junto com lembretes soltos. Só pra personagem de jogador — NPC já
-- tem o campo de notas de tática na biblioteca pra isso ("resistente a
-- fogo"...).
--
-- Coluna nova em tabela que já existe não precisa de GRANT: o privilégio é
-- da tabela e alcança as colunas futuras. O GRANT explícito do 0001 só é
-- necessário quando a TABELA é nova.

alter table public.characters
  add column if not exists vantagens_resistencias text not null default '';
