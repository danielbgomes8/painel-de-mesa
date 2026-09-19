-- Painel de Mesa — o Bastião ganha o mesmo contador de versão do combate.
-- Rode DEPOIS de 0014_multiclasse.sql, no SQL Editor do Supabase.
--
-- Mesma corrida que a migration 0010 fechou pro combat_state, e pelo mesmo
-- motivo: `definirBastiao` lê o estado conhecido, calcula o próximo e grava.
-- "Próximo turno" é `turno + 1` calculado no cliente, então dois aparelhos
-- avançando quase juntos leem 3, os dois calculam 4, os dois gravam 4 — e um
-- turno inteiro do Bastião some da contagem sem ninguém perceber. O Bastião é
-- recurso do grupo (Mestre e jogadores mexem igual, por decisão de produto),
-- então mais de um aparelho mexendo ao mesmo tempo é o caso comum, não o raro.
--
-- A trava é a mesma: o UPDATE só é aceito se a versão que o cliente leu ainda
-- for a atual da linha; se não for, zero linhas mudam, o cliente relê o
-- estado de verdade e refaz o cálculo em cima dele. Nenhuma regra de jogo
-- desce pro banco — ele só garante que ninguém escreve por cima de uma versão
-- que já mudou.

alter table public.bastiao
  add column if not exists version integer not null default 0;
