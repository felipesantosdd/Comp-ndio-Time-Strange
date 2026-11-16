# Compêndio Digimon Story: Time Stranger

App de consulta dos Digimon de Digimon Story: Time Stranger, todo em português do Brasil, feito com os dados extraídos do próprio jogo instalado. É uma página web estática: abre direto do disco, sem servidor, sem internet e sem instalar nada.

Peso: cerca de 0,8 MB de dados e 3,5 MB de retratos. O ANAMNESIS tem 120 MB.

## Usar

1. Gere os dados uma vez (precisa do jogo instalado e do Python com Pillow):
   ```
   python -I extrair\extrair.py
   ```
   ou dê dois cliques em `Atualizar dados.bat`.
2. Abra `app\index.html` no navegador, ou dê dois cliques em `Abrir Compêndio.bat`.

Depois de atualização do jogo ou DLC nova, rode `python -I extrair\extrair.py --limpar`. Isso apaga o cache e os dados gerados e extrai tudo do zero.

Opções do extrator: `--jogo` (pasta do jogo, padrão a da Steam), `--mvgltools` (caminho do `MVGLToolsCLI.exe`, padrão o do projeto vizinho Monster Arena), `--sem-imagens`. As variáveis `DSTS_JOGO` e `MVGLTOOLS` fazem o mesmo.

## O que tem

* **Digimon**: os 476 números do Guia de Campo (base e DLCs 01, 02, 03, 06 e 17), com estágio, tipo, personalidade base, famílias, atributos base, resistências com multiplicador, golpes especiais e aprendidos, perfil, locais, de onde evolui e para onde evolui com todos os requisitos.
* **Papel no Monster Arena**: cada Digimon recebe DPS, Controle, Equilíbrio, Tanque ou Suporte para a rinha em tempo real do mod, com uma linha de motivo e o foco sugerido. Dá para filtrar por papel na lista e nas sugestões da comparação. A regra está na seção "Papel no time".
* **Árvore de evolução** centrada em qualquer Digimon, com profundidade de 1 a 6 e marca de obtido.
* **Caminho mais curto** entre dois Digimon, com filtro por estágio, patente de agente máxima, só obtidos, e De-digievolução ligada ou não.
* **Comparação** lado a lado de até 9 Digimon.
* **Redução por personalidade**: você escolhe a personalidade do seu Digimon e quantas cópias da habilidade de agente comprou, e os requisitos aparecem já reduzidos.
* **Itens**: todos os itens com preço e efeito, criação (receitas), decomposição, Discos de Habilidade agrupados por elemento e lojas.
* **Coleção e metas** marcadas à mão (Desconhecido, Visto, Obtido), guardadas no navegador, com backup em JSON.
* **Modo sem spoiler**: esconde nome, retrato e ficha do que você ainda não marcou como visto.

## O que ficou de fora, e por quê

* Leitura da memória do jogo, overlay, atalhos F2, F4 e F5, elenco ao vivo, controles da fazenda, leitura e escrita de save e identificação de save. Fora do escopo pedido: o app não toca no jogo nem no save.
* Por consequência, coleção, metas e personalidade são manuais. O ANAMNESIS lê do save.
* Raridade de item: não existe coluna no jogo, só aparece no texto de alguns itens.
* Local de cada loja: nenhuma tabela liga loja a mapa. O app deduz pelo NPC lojista quando ele é um Digimon, o que pode listar mais de uma cidade. Lojas de lojista humano aparecem só pelo número.
* Encontros disparados por script de missão não estão nas tabelas de campo, então esses Digimon aparecem como "obtido por evolução, evento ou missão".

## Incertezas conhecidas

Nada foi chutado em silêncio. O que não está provado aparece marcado no app ou foi deixado de fora.

* **Cópias da habilidade de redução**: o tabuleiro de agente tem 4 cópias de cada "Digievolução de <categoria>", todas com 20%. Se elas somam não dá para provar pelos dados. Com 1 cópia o cálculo é seguro; acima disso o app soma e avisa.
* **Ordem das resistências**: as colunas seguem a ordem dos ids de elemento (Fogo, Gelo, Planta, Água, Eletricidade, Aço, Vento, Terra, Luz, Trevas), a mesma dos efeitos de resistência do jogo. Conferir num Digimon no jogo fecha a questão.
* **Custo de PH e precisão dos golpes**: decifrados por padrão numérico (crescem com o nível do golpe e batem com os valores típicos), sem rótulo no jogo que prove.
* **Condição especial**: algumas evoluções (Chronomon, Jupitermon, Aegiochusmon, Elo) têm um valor 46 em colunas não decifradas. O app mostra "condição especial de história".
* Categorias de item 2 (Especial) e 8 (Itens de valor) podem estar trocadas entre si.

## Papel no time

O papel é para o **Monster Arena**, o mod que troca o turno do jogo por rinha em tempo real. Ele segue o que o laço do mod faz hoje (`bridge\timestranger\ma_realtime.lua` do projeto Monster Arena, lido em 16/11/2026 no commit `79435f0`), não o combate por turno. Se o mod mudar a conta de dano, cura ou estados, a regra precisa mudar junto. Nada aqui foi testado em luta.

Calculado no próprio app (`app\papel.js`) com dados que o extrator já gera: natureza, alvo, buffs e descrição de cada golpe (`battle_skill`) e os atributos base. Conta os golpes da espécie (especiais e aprendidos). O mod usa os golpes equipados de verdade quando o jogo responde, então disco de habilidade equipado muda o kit.

**Como o mod resolve a luta** (o que pesa na regra):

* Dano: PV máximo do alvo × 6,5% × 2·ATQ/(ATQ + DEF do alvo), com especial 2,2×. Só ATQ e DEF contam. INT e ESP não entram, nem em golpe mágico. PV alto não protege, porque cada golpe tira a mesma fração dele.
* Cura: potência/2 % do PV máximo do alvo (Cura, potência 40: 20%). Nenhum atributo entra, então qualquer Digimon com cura cura igual.
* Buffs e debuffs que mudam algo: ATQ ↑ e VEL ↑ deixam o lutador 1,25× mais rápido por 20 s, e ATQ ↓ e VEL ↓ deixam 1,25× mais lento (`MA_vel_atualiza`). Confusão, Paralisia, Sono, Caótico, Imobilização, Sono Profundo e Cristalização tiram a ação por 5 s. Veneno e Veneno Mortal tiram 6% do PV a cada 5 s até o fim da luta.
* Sem efeito na luta, só aparece no card: buffs e debuffs de DEF, INT, ESP, PREC, EVAS e CRÍT, resistências, Provocação, contra-ataque, reflexo, redução de dano, imunidades e limpeza de estado.
* Golpe recarrega em 4 + 0,12 × PH segundos. Sem golpe pronto, sai ataque comum, então todo mundo bate o tempo todo.

**1. Efeito de cada golpe no mod** (coluna "Efeito no mod" na tabela de golpes):

| Efeito | Quando |
|---|---|
| Dano | natureza de dano (col 22 = 1, 2, 4, 5, 11). "Dano + estado" quando também aplica um estado que vale no mod |
| Cura | natureza de cura (col 22 = 8, 9, 10) |
| Buff de ATQ ou VEL | natureza suporte em aliado ou em si com Aumento de ATQ ou de VEL (Carga e Campo de Ataque e de Velocidade) |
| Controle | natureza suporte em inimigo com estado que vale no mod (lista acima) |
| Sem efeito no mod | natureza suporte cujo efeito o mod ignora |
| Incerto | sem dado para decidir. Hoje 4 golpes: Bomba Milagrosa, Virar Barricada, Braço Triplo e Reversão de Personagem. Não são chutados |

**2. Atributos.** ATQ e DEF comparados com a média do mesmo estágio: "ATQ alto" é 15% ou mais acima, "DEF alta" é 20% ou mais acima.

**3. Papel**, na primeira regra que bater (apoio = 2 por cura + 1 por buff de ATQ ou VEL; controle conta golpe de controle e golpe de dano com estado):

1. **Suporte**: apoio 3 ou mais, ou apoio 2 ou mais sem ATQ alto.
2. **Controle**: 2 ou mais golpes de controle, sem ATQ alto.
3. **Tanque**: DEF alta, sem ATQ alto.
4. **DPS**: ATQ alto, ou nada de apoio nem controle no kit.
5. **Equilíbrio**: o resto.

**Rótulo incerto.** Com golpe de efeito incerto, o app refaz a conta lendo esses golpes como cura e depois como dano. Se o papel muda, a ficha mostra "?" e um aviso.

**Foco sugerido** (lido em `MA_foco` e `pick_skill`): o foco Suporte cura com aliado abaixo de 80% e põe na frente todo golpe de apoio, que no mod é o de alvo aliado ou si mesmo. Debuff em inimigo conta como ataque, então o Suporte não o adianta. Por isso: DPS vai para Ataque, Suporte para Suporte, e Controle, Tanque e Equilíbrio para Equilíbrio. Quando um Suporte tem golpe sem efeito no mod, a ficha avisa que no foco Suporte ele gasta tempo lançando esse golpe.

Resultado com os dados atuais: 244 DPS, 98 Equilíbrio, 65 Suporte, 49 Tanque, 20 Controle, 20 com rótulo incerto. Conferidos à mão: Agumon e WarGreymon (DPS, ATQ alto), Venusmon e Sakuyamon (Suporte, cura sem depender de atributo), Craniamon e UltimateBrachiomon (Tanque, DEF alta e ATQ baixo), Sukamon (Controle: Bolha de Ócio e Cocô com veneno), Omnimon (Equilíbrio: 1 buff que vale e 3 golpes sem efeito no mod).

Rodar a regra fora do navegador, para conferir:

```
node -e "global.window={};require('./app/dados/dados.js');const P=require('./app/papel.js');console.log(P.calcular(window.DADOS).get(27))"
```

### Nota: cura no jogo base

No combate por turno do jogo, a cura escala com ESP. Provado na tabela `battle_calculate` / `battle_formula`, que traz as fórmulas em texto. A linha 8 (natureza Cura) é `行動精神*(1+行動補正値１)/30 × 威力 × (1+対象回復補正/100) × 揺らぎ`: ESP do usuário com buff de ESP, dividido por 30, vezes a potência, vezes o bônus de recuperação do alvo, vezes a variação. INT não aparece. As linhas 9 (cura fixa) e 10 (cura em % do PV máximo) não usam atributo. Nenhum golpe de cura de espécie usa 9 ou 10. Guias e jogadores dizem o mesmo ([Game8](https://game8.co/games/Digimon-Story-Time-Stranger/archives/556236), [Grindosaur](https://www.grindosaur.com/en/games/digimon-story-time-stranger/stats), [TheGamer](https://www.thegamer.com/digimon-story-time-stranger-best-digimon-lategame-endgame-plutomon-apocalymon-venusmon-guide/), [GameFAQs](https://gamefaqs.gamespot.com/boards/513530-digimon-story-time-stranger/81050942)). No Monster Arena isso não vale, porque a cura é calculada pelo mod.

A mesma tabela confirma que a col 22 da `battle_skill` é a linha da fórmula: 1 físico (ATQ contra DEF), 2 mágico (INT contra ESP), 4 dano fixo, 5 % do PV atual, 8 cura, 11 Cross Arts (ATQ + INT). A linha 3 usa VEL contra VEL e a linha 6 é % do PV máximo. O rótulo "Velocidade" que o extrator dá à natureza 6 está trocado, mas nenhum golpe de espécie usa 3 ou 6.

## Estrutura

```
app\index.html, app.css, app.js   o app (HTML, CSS e JS puros)
app\papel.js                      regra do papel no time (também roda no Node)
app\dados\                        gerado pelo extrator (fora do git)
extrair\extrair.py                ponto de entrada
extrair\pacotes.py                índice dos .mvgl e chamada do MVGLToolsCLI
extrair\secoes.py                 espécies, evolução, imagens
extrair\secoes_extra.py           golpes, itens, criação, lojas, locais, personalidade
cache\                            tabelas brutas e CSV extraídos (fora do git)
```

Os dados gerados e o cache ficam fora do git: são arquivos do jogo, e cada um regera os seus a partir da própria cópia.

## Como os dados foram decifrados

Os `.mvgl` são lidos na ordem de prioridade patch, DLCs (addcont do maior para o menor) e app_0. Só os arquivos necessários são tirados de dentro dos pacotes (`unpack-mvgl-file`) e convertidos em CSV (`unpack-mbe`). Textos vêm dos pacotes `*_text07` (pt-BR), juntando app e patch, com o patch vencendo. Cada função em `extrair\secoes*.py` tem no comentário as colunas usadas e a prova.

Resumo das tabelas:

| Dado | Tabela | Prova |
|---|---|---|
| Espécie, estágio, tipo, famílias, atributos, resistências, golpes | `digimon_status` (+ `_dlcNN`) | textos `generation_name`, `digimon_type`, `digimon_class_name`, `element` |
| Multiplicador de resistência | `battle_calculate` / `battle_waek_point_ratio` | 0 ×1, 1 ×1,5, 2 ×2, 3 ×0,5, 4 ×0 |
| Evolução e requisitos | `evolution` (+ `_dlcNN`) | lista de textos `common_message` 1250 a 1285 |
| Golpes | `battle_skill` | descrições do jogo e `skill_auto_explanation` |
| Itens, equipamento, discos | `item` | `item_name`, `item_explanation`, `item_auto_explanation` |
| Criação, decomposição | `develop`, `decomposition` | nomes dos itens das receitas |
| Lojas | `shop`, `field_npc_*` | lojista pelo modelo do NPC |
| Locais | `field_battle_*`, `battle_enemy`, `quest_sub` | `field_name`, `quest_title` |
| Redução por personalidade | `tamer_skill`, `personality_category` | `tamer_skill_explanation`, `common_message` 1284 |

Este projeto não usa código, banco nem recursos do ANAMNESIS. Digimon é marca da Bandai Namco Entertainment.
