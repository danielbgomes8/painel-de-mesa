alter table public.characters
  add column if not exists nivel int not null default 1,
  add column if not exists atributos jsonb not null default
    '{"for":10,"des":10,"con":10,"int":10,"sab":10,"car":10}',
  add column if not exists proficiencias jsonb not null default
    '{"saves":[],"pericias":{}}',
  add column if not exists conjurador text not null default 'nenhum',
  add column if not exists atributo_conjuracao text,
  add column if not exists classe_base text,
  add column if not exists modificadores jsonb not null default '[]';
