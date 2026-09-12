-- Painel de Mesa — combat_state ganha um contador de versão pra fechar a
-- corrida de escrita de vez.
-- Rode DEPOIS de 0009_spell_dc_opcional.sql, no SQL Editor do Supabase.
--
-- definirCombate hoje lê o estado mais recente conhecido no cliente, monta o
-- próximo estado e manda um UPDATE cego (sobrescreve round/turn/order_json
-- inteiros). Se dois clientes fazem isso quase ao mesmo tempo — dois
-- jogadores entrando na iniciativa juntos, o Mestre avançando o turno
-- enquanto um NPC é adicionado — o segundo UPDATE a chegar no Postgres
-- sobrescreve o primeiro por inteiro, mesmo que os dois tenham partido do
-- mesmo estado "atual". Resolver contra `ref.current` (feito numa revisão
-- anterior) encurta a janela mas não fecha: os dois podem estar com o
-- request em voo ao mesmo tempo, cada um sem saber do outro.
--
-- A trava de verdade tem que morar no banco, numa única instrução atômica.
-- Em vez de reescrever a lógica de combate (ordenar por iniciativa, turno
-- após remover...) em PL/pgSQL — duplicando regra que já vive em
-- src/lib/regras.ts, exatamente o que o projeto evita — a saída é controle
-- de concorrência otimista: o UPDATE só é aceito se a versão que o cliente
-- leu ainda for a versão atual da linha; senão, zero linhas são afetadas, o
-- cliente busca o estado de verdade e tenta de novo em cima dele. A regra de
-- negócio continua só em JS; o banco só garante que ninguém escreve por cima
-- de uma versão que já mudou.

alter table public.combat_state
  add column if not exists version integer not null default 0;
