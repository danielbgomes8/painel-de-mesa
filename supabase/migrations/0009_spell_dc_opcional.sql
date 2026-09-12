-- Painel de Mesa — CD de magia vira opcional (null = "não preenchido").
-- Rode DEPOIS de 0008_ataque_npc.sql, no SQL Editor do Supabase.
--
-- spell_dc nasceu "not null default 10", e a tela usava esse 10 como sinal
-- de "o Mestre ainda não preencheu" pra esconder a seção de saves/CD de
-- magia do NPC (menos números frios na tela no meio do combate). Só que um
-- NPC cujo CD de magia É 10 de verdade (bem comum pra conjurador fraco)
-- caía no mesmo sinal e ficava escondido à toa, sem ninguém ter mexido em
-- nada. Sem um jeito de distinguir "nunca preenchido" de "preenchido com o
-- mesmo número do padrão", a coluna vira nullable: null passa a ser o único
-- sinal de "não preenchido" (mesma ideia do cache de identidade.ts, que já
-- teve esse mesmo tipo de problema).
--
-- Personagens já existentes ficam com spell_dc = 10 como está — não dá pra
-- saber retroativamente quais eram "10 de verdade" e quais eram só o
-- padrão nunca tocado. Só personagem criado dali pra frente nasce com
-- spell_dc null até o Mestre preencher; o app já sabe ler os dois casos.

alter table public.characters
  alter column spell_dc drop not null,
  alter column spell_dc drop default;
