-- Dados da primeira sala — campanha "Sétimo Raio".
-- Rode DEPOIS de 0001_inicial.sql. Idempotente: pode rodar de novo sem duplicar.

insert into public.rooms (code)
values ('setimo-raio')
on conflict (code) do nothing;

insert into public.combat_state (room_code)
values ('setimo-raio')
on conflict (room_code) do nothing;

insert into public.dm_notes (room_code)
values ('setimo-raio')
on conflict (room_code) do nothing;

-- Tibério Vaz — Feiticeiro 7, Linhagem Draconiana (Relâmpago).
-- Os demais jogadores se cadastram sozinhos pelo painel (digitando o nome).
insert into public.characters
  (room_code, slug, name, cls, ac, init_mod, speed, hp, hp_max, is_npc)
values
  ('setimo-raio', 'tiberio', 'Tibério Vaz',
   'Feiticeiro 7 · Linhagem Draconiana (Relâmpago)', 16, 1, 9, 65, 65, false)
on conflict (room_code, slug) do update set
  name     = excluded.name,
  cls      = excluded.cls,
  ac       = excluded.ac,
  init_mod = excluded.init_mod,
  speed    = excluded.speed;
