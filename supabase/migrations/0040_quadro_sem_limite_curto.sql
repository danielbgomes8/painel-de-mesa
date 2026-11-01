-- Painel de Mesa — Quadro da Campanha: textos longos.
-- Rode DEPOIS de 0039_aviso_de_concentracao.sql, no SQL Editor do Supabase.
--
-- O texto e o segredo do cartão eram limitados a 1500 caracteres e a nota do
-- jogador a 300. Agora o app aceita 20000 (cartão) e 5000 (nota) e o banco
-- só segura o absurdo, com o mesmo teto.

alter table public.quadro_cartoes drop constraint if exists quadro_cartoes_texto_check;
alter table public.quadro_cartoes drop constraint if exists quadro_cartoes_segredo_check;
alter table public.quadro_notas drop constraint if exists quadro_notas_texto_check;

alter table public.quadro_cartoes add constraint quadro_cartoes_texto_check check (char_length(texto) <= 20000);
alter table public.quadro_cartoes add constraint quadro_cartoes_segredo_check check (char_length(segredo) <= 20000);
alter table public.quadro_notas add constraint quadro_notas_texto_check check (char_length(texto) <= 5000);
