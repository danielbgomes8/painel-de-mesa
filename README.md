# Painel de Mesa

Painel de combate e fichas pra mesa de **D&D 5.5** (regras 2024, SRD 5.2) do
Daniel — campanha **"Sétimo Raio"**, jogada presencialmente com cada pessoa no
seu aparelho.

Não é ficha completa de personagem: é o punhado de coisas que muda o tempo todo
durante a sessão — PV, exaustão, condições, testes de morte, iniciativa — com
tudo sincronizando na hora entre celular, tablet e notebook.

**Sem login.** Cada pessoa abre o link e diz quem é (Mestre, um personagem da
lista, ou digita um nome novo). Essa escolha fica salva só no navegador dela.

---

## O que cada um vê

**Jogador** — só o próprio card:
PV atual/máx com +/− e ajuste do máximo · CA, Iniciativa e Deslocamento
editáveis · Exaustão 0–6 em pips, com o efeito calculado em texto · testes de
resistência contra a morte · aviso de "Caído" quando o PV zera · as 14 condições
do 2024 como chips · notas rápidas · banner **"É a sua vez!"** no turno dele ·
rastreador de combate em modo leitura.

**Mestre** — tudo:
todos os cards, editáveis · rastreador de iniciativa (adicionar personagem
cadastrado ou NPC/monstro avulso, ordenar por iniciativa, reordenar na mão,
marcar o turno, avançar rodada, reiniciar) · **ações em massa** (selecionar
vários e aplicar dano/cura ou uma condição de uma vez) · **notas privadas** que
só o Mestre enxerga · remover personagens e NPCs.

---

## Regras de negócio (fechadas — não reinventar)

Estão em [`src/lib/regras.ts`](src/lib/regras.ts), cada uma pura e coberta por
[`src/lib/regras.test.ts`](src/lib/regras.test.ts).

- **Exaustão 2024**: trilha única 0–6. Penalidade de **−2 em todo teste de D20**
  por nível (perícia, ataque, resistência) e **−1,5 m de deslocamento** por
  nível. Nível 6 = morte. Descanso longo tira **1 nível** (não zera).
- **Testes de morte** zeram sozinhos assim que a criatura recupera **qualquer PV
  acima de 0**.
- **PV** nunca passa do máximo nem fica negativo (trava em 0).

---

## Stack

Next.js 16 (App Router) · Supabase (Postgres + Realtime) · Vercel · TypeScript.
Tudo roda no navegador: não há backend próprio nem segredo de servidor.

```
src/
  app/            layout, página única, globals.css (tema "taverna")
  components/     Painel (orquestra) · Portao · RastreadorCombate ·
                  AcoesEmMassa · NotasDoMestre · FichaPersonagem · BannerSuaVez
  hooks/useSala   carrega a sala + assina o Realtime + expõe as mutações
  lib/            regras · condicoes · identidade · sala · supabase · tipos
supabase/
  migrations/     0001_inicial.sql  (tabelas, triggers, Realtime, RLS)
  seed.sql        dados da sala "setimo-raio" (Tibério Vaz)
```

---

## Rodar no computador

```bash
npm install
cp .env.example .env.local   # e preencha as duas variáveis do Supabase
npm run dev                   # http://localhost:3000
```

Sem o `.env.local` o app abre, mas mostra um aviso em vez do painel.

Outros comandos: `npm run build`, `npm run lint`, `npm run teste`
(regras de negócio), `npm run teste:assistir`.

Para abrir outra mesa no mesmo deploy, use `?sala=<codigo>` na URL
(ex.: `/?sala=nova-campanha`). A sala é criada sozinha no primeiro acesso.

---

## Segurança — por que o RLS é uma policy aberta

O app **não tem autenticação**. A saída mais simples, e suficiente pra uma mesa
de amigos, é: RLS ligado nas quatro tabelas, com uma policy **`for all` que
libera leitura e escrita pro papel `anon`** (ver o fim de
[`0001_inicial.sql`](supabase/migrations/0001_inicial.sql)).

Na prática: **quem tem o link e o código da sala lê e escreve as linhas daquela
sala.** É a mesma confiança que o grupo já tem entre si na mesa física. Não se
guarda nada sensível aqui — PV, condições e anotações de RPG. As notas do Mestre
ficam "privadas" só no cliente (o painel não as mostra a quem entrou como
jogador); não é segredo criptográfico, é combinado entre amigos.

A chave `anon` do Supabase é **pública por natureza** — vai no bundle do
navegador. Ela não é o segredo; o "segredo" é o código da sala não ser divulgado.

Se um dia a mesa quiser isolamento de verdade, o caminho é adicionar auth do
Supabase (magic link, sem senha) e trocar as policies por filtros que amarrem
`room_code` a quem está logado.

---

## Publicar (passos do Daniel, fora do Claude)

Pré-requisito: `gh auth login` e `vercel login` já feitos.

1. **GitHub** — criar o repositório e subir:
   ```bash
   gh repo create painel-de-mesa --private --source=. --remote=origin --push
   ```
2. **Supabase** — criar um projeto novo (conta separada do gb-reserva, plano
   gratuito). Em *Project Settings → Data API*, copiar **Project URL** e a chave
   **anon / public**.

   O plano gratuito é mais que suficiente pra uma mesa (500 MB de banco, muito
   acima do que fichas de RPG ocupam). A única pegadinha: **projeto sem uso por
   ~1 semana pausa sozinho.** Como a mesa não joga todo dia, antes de uma sessão
   depois de um tempo parado, abra o painel do Supabase e clique em
   *Restore/Unpause* — leva menos de um minuto e evita surpresa em cima da hora.
3. **Migrations** — no *SQL Editor* do Supabase, rodar
   [`supabase/migrations/0001_inicial.sql`](supabase/migrations/0001_inicial.sql)
   e depois [`supabase/seed.sql`](supabase/seed.sql).
4. **Realtime** — o `0001_inicial.sql` já faz `alter publication`. Confirmar em
   *Database → Replication* que `characters`, `combat_state` e `dm_notes` estão
   na publicação `supabase_realtime`.
5. **Vercel**:
   ```bash
   vercel link
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   vercel --prod
   ```
   (adicionar as duas variáveis nos três ambientes: Production, Preview e Development.)

Depois é só mandar o link pra mesa. Pro grupo, a URL pode ser a raiz mesmo — a
sala `setimo-raio` é o padrão e nem aparece pro jogador.
