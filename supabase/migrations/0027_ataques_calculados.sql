-- Painel de Mesa — ataques calculados na ficha do jogador.
-- Rode DEPOIS de 0026_inventario_magias_bau.sql, no SQL Editor do Supabase.
--
-- Uma lista por personagem (igual `magias`, 0026): cada item guarda COMO o ataque se
-- calcula — nome, atributo, se tem proficiência, bônus extra de acerto e de dano, dado e
-- tipo de dano — e o app tira o acerto e o dano dos atributos e do nível na hora. O campo
-- livre `ataque` (0008) continua existindo e continua valendo.
--
-- Coluna nova em tabela que já existe não precisa de GRANT (ver 0012).

alter table public.characters
  add column if not exists ataques jsonb not null default '[]'::jsonb
    check (jsonb_typeof(ataques) = 'array' and jsonb_array_length(ataques) <= 30);
