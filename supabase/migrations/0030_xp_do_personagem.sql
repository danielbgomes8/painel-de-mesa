-- Painel de Mesa — pontos de experiência (XP) do personagem.
-- Rode DEPOIS de 0028_tempo_da_campanha.sql, no SQL Editor do Supabase.
--
-- Um número por personagem, na própria linha (igual `moedas`/`magias`, 0026: sincroniza com a ficha e
-- viaja no backup sem ninguém lembrar de nada). Só o Mestre mexe, pela ficha ou pelas Ações em massa.
-- O XP não sobe o nível sozinho; só mostra quanto falta (campanha por marco simplesmente não usa).
--
-- Coluna nova em tabela que já existe não precisa de GRANT (ver 0012).

alter table public.characters
  add column if not exists xp integer not null default 0
    check (xp >= 0 and xp <= 10000000);
