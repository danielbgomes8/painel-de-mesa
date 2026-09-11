-- Painel de Mesa — gestão de turno do Bastião: marca se uma instalação
-- especial "trabalhou" no turno atual. Rode DEPOIS de 0006_bastiao.sql, no
-- SQL Editor do Supabase.

alter table public.bastiao_instalacoes
  add column if not exists ultimo_turno_executado int;

comment on column public.bastiao_instalacoes.ultimo_turno_executado is
  'Turno do Bastião em que essa instalação foi marcada como "trabalhando" pela última vez. NULL = não está trabalhando. "Trabalhando este turno" = (ultimo_turno_executado = bastiao.turno). Só é válido enquanto o turno nunca diminui.';
