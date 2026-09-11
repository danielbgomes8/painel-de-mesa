-- Painel de Mesa — notas na biblioteca de NPCs.
-- Rode DEPOIS de 0002_recursos_e_registro.sql, no SQL Editor do Supabase.
--
-- Permite ao Mestre preparar a mesa com antecedência: cada NPC/monstro
-- salvo na biblioteca ganha um campo de notas (tática, resistências,
-- gatilho de fuga...), pra revisar antes da sessão.

alter table public.npc_templates
  add column if not exists notes text not null default '';
