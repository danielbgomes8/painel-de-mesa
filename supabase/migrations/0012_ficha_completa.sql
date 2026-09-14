-- Painel de Mesa — ficha completa (história, características, magias,
-- trejeitos...) vivendo na mesma linha do personagem, pra ela sincronizar
-- com o resumo que o Mestre já vê hoje, em vez de ficar numa ficha separada.
-- Rode DEPOIS de 0011_vantagens_resistencias.sql, no SQL Editor do Supabase.
--
-- Genérico de propósito, igual `resources`/`items`: em vez de uma coluna por
-- conceito de D&D (magias, itens mágicos, talentos...), uma lista de seções
-- que cada jogador preenche do jeito que a própria ficha precisar — texto
-- corrido (história) ou lista de título+tag+descrição (características,
-- magias, itens mágicos, trejeitos, lista de desejos...). O app não sabe
-- regra nenhuma sobre o que tem dentro. Só pra personagem de jogador (mesmo
-- corte de `vantagens_resistencias`, 0011) — NPC já tem notas de tática na
-- biblioteca.
--
-- Coluna nova em tabela que já existe não precisa de GRANT: o privilégio é
-- da tabela e alcança as colunas futuras. O GRANT explícito do 0001 só é
-- necessário quando a TABELA é nova.

alter table public.characters
  add column if not exists ficha_epiteto text not null default '',
  add column if not exists ficha_secoes jsonb not null default '[]';
