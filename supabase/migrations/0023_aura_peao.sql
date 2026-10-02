-- Painel de Mesa — aura (emanação) no peão.
-- Rode DEPOIS de 0022_marcas.sql, no SQL Editor do Supabase.
--
-- No D&D 2024, "emanação" é uma área que parte de uma criatura e se estende em
-- volta dela até uma distância (Aura de Proteção do Paladino, Guardiões
-- Espirituais...). Ela anda junto com a criatura. Aqui é uma coluna no peão:
-- o raio em METROS, medido a partir da borda do espaço da criatura; nulo =
-- sem aura. Fica ligada até alguém desligar. A tabela `cena_peca` já está no
-- tempo real (0019), então ligar/mover/desligar chega nos outros aparelhos sozinho.

alter table public.cena_pecas
  add column if not exists aura numeric check (aura is null or (aura > 0 and aura <= 120));
