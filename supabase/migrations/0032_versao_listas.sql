-- Painel de Mesa — contador de versão pras listas da ficha (inventário, magias e moedas).
-- Rode DEPOIS de 0031_companheiros.sql, no SQL Editor do Supabase.
--
-- O problema: `inventario`, `magias` e `moedas` viajam como a lista INTEIRA, montada a partir da
-- cópia que o aparelho tem na memória. Quando o Mestre passa um item do baú pro inventário de um
-- jogador no mesmo instante em que o jogador edita o dele, quem gravar por último apaga a mudança
-- do outro. É a mesma corrida que as migrations 0010 (combate) e 0015 (Bastião) fecharam.
--
-- A trava é a mesma: o UPDATE dessas três colunas só é aceito se `versao_listas` ainda for a que o
-- aparelho leu; senão zero linhas mudam, o aparelho relê a ficha e refaz a conta em cima da lista de
-- verdade. Nenhuma regra de jogo desce pro banco. Só quem mexe nessas três colunas confere e soma a
-- versão — o resto da ficha (PV, condições, notas...) continua escrevendo só a coluna que mudou.
--
-- Coluna nova em tabela que já existe não precisa de GRANT (ver 0012).

alter table public.characters
  add column if not exists versao_listas integer not null default 0;
