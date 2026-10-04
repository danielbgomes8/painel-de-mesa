-- Painel de Mesa — companheiros e invocações ligados ao dono (familiar, montaria, animal companheiro).
-- Rode DEPOIS de 0030_xp_do_personagem.sql, no SQL Editor do Supabase.
--
-- Um companheiro é uma ficha de NPC (já revelada) com `dono` = o slug do personagem de quem ele é. Na
-- iniciativa ele entra junto do dono, logo depois, com a mesma contagem, e sai junto. Sem `dono` (null, o
-- padrão), tudo funciona como antes.
--
-- Coluna nova em tabela que já existe não precisa de GRANT (ver 0012).

alter table public.characters
  add column if not exists dono text
    check (dono is null or char_length(dono) <= 80);
