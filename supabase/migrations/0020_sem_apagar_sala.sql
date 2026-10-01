-- Painel de Mesa — ninguém apaga uma sala inteira pelo app.
-- Rode no SQL Editor do Supabase (pode ser a qualquer hora, depois da 0019).
--
-- Todas as tabelas do app são abertas ao papel `anon` (ver README, "Segurança"),
-- e isso incluía APAGAR a linha da sala em `rooms` — o que, por causa do
-- `on delete cascade`, leva junto fichas, combate, diário, mapas, tudo. O app
-- nunca faz isso (só cria a sala, no primeiro acesso), então tirar o direito
-- de `delete` em `rooms` não muda nada pra quem usa; só impede que um aparelho
-- com a chave pública, por engano ou de propósito, apague uma campanha inteira.
--
-- O resto continua como está: apagar uma ficha, uma entrada do diário, uma cena
-- etc. segue funcionando. (Não protege contra alguém apagar ficha por ficha —
-- esse é o limite do modelo aberto, e o backup diário existe pra isso.)
--
-- Pra apagar uma sala de teste, agora é aqui no SQL Editor:
--   delete from public.rooms where code = 'teste-ui';
-- (as tabelas filhas somem junto, por `on delete cascade`)

revoke delete on public.rooms from anon;
