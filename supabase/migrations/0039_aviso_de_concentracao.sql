-- Painel de Mesa — aviso de teste de concentração pro Mestre.
-- Rode DEPOIS de 0038_relogios_loja_percepcao_portas.sql, no SQL Editor do Supabase.
--
-- Quando quem está concentrado leva dano, o Mestre recebe um aviso fixo no topo do combate ("Ana · teste de
-- Constituição, CD 12") que fica ali até ele marcar "Feito". O app não rola nada: a mesa joga os dados de verdade.
-- O aviso é uma linha de `combate_eventos` com `tipo = 'concentracao'` (o personagem vai em `slugs`, a CD no `texto`),
-- então reaproveita o canal, a limpeza ao encerrar o combate e o "só o Mestre vê" dos eventos do combate (0034).
--
-- Só muda a trava de `tipo`: ela aceitava 'rodada' e 'pv' e exigia `rodada` ou `pct` preenchido.

do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.combate_eventos'::regclass
      and contype = 'c'
      and (pg_get_constraintdef(oid) like '%tipo%')
  loop
    execute format('alter table public.combate_eventos drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.combate_eventos
  add constraint combate_eventos_tipo_check
  check (tipo in ('rodada', 'pv', 'concentracao'));

alter table public.combate_eventos
  add constraint combate_eventos_gatilho_check
  check (
    (tipo = 'rodada' and rodada is not null)
    or (tipo = 'pv' and pct is not null)
    or tipo = 'concentracao'
  );
