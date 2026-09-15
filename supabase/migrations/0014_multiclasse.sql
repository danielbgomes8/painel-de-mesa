alter table public.characters
  add column if not exists classes jsonb not null default '[]';

update public.characters
set classes = jsonb_build_array(
  jsonb_build_object(
    'classe', classe_base,
    'nivel', nivel,
    'conjurador', conjurador,
    'atributo_conjuracao', atributo_conjuracao
  )
)
where classe_base is not null;

alter table public.characters
  drop column if exists nivel,
  drop column if exists conjurador,
  drop column if exists atributo_conjuracao,
  drop column if exists classe_base;
