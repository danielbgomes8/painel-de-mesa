-- Painel de Mesa — mais de uma foto por cartão do Quadro.
-- Rode DEPOIS de 0039_aviso_de_concentracao.sql, no SQL Editor do Supabase.
--
-- `foto` continua sendo a capa (miniatura do quadro). `fotos` guarda as extras,
-- na ordem; o app limita a 6 no total (capa incluída). Cartões antigos ficam
-- com lista vazia e seguem funcionando.

alter table public.quadro_cartoes
  add column if not exists fotos text[] not null default '{}';
