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
* **Papel no time**: cada Digimon recebe DPS, Controle, Equilíbrio, Tanque ou Suporte, com uma linha de motivo e o foco sugerido no Monster Arena. Dá para filtrar por papel na lista e nas sugestões da comparação. A regra está na seção "Papel no time".
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

Calculado no próprio app (`app\papel.js`) a partir de dados que o extrator já gera: natureza, alvo, buffs e descrição de cada golpe (`battle_skill`) e os atributos base da espécie. Não usa dado de partida, nível nem treino. Conta só os golpes da espécie (especiais e aprendidos), não os Discos de Habilidade.

**1. Efeito de cada golpe.** Aparece na coluna "Efeito" da tabela de golpes.

| Efeito | Quando |
|---|---|
| Dano | natureza física, mágica, dano fixo, dano em % de PV ou Cross Arts (col 22 = 1, 2, 4, 5, 11), mesmo que também aplique debuff |
| Cura | natureza cura, cura fixa ou reviver (col 22 = 8, 9, 10) |
| Limpeza | natureza suporte com alvo aliado, sem buff, e descrição do jogo com "Remove" (Meditação, Normalizar, Dissipar, Restaurar) |
| Buff | natureza suporte com alvo aliado e buff_set no alvo (Carga, Campo, Barreira, redução de dano recebido) |
| Debuff | natureza suporte com alvo inimigo e buff_set no alvo (Vinculação, Ruptura, estados), ou descrição com "Remove bônus" ou "Rouba" |
| Defesa própria | natureza suporte com alvo no próprio usuário: Provocação, contra-ataque, reflexo, anular dano |
| Incerto | o resto. Hoje são 4 golpes: Bomba Milagrosa e Virar Barricada (sem descrição nem buff no jogo), Braço Triplo (efeito aleatório) e Reversão de Personagem (alvo inimigo ou aliado). Não são chutados |

**2. Perfil dos atributos.** Razão = maior entre ATQ e INT, dividido pela média de DEF e ESP. Razão de 1,5 ou mais é perfil ofensivo ("ATQ alto" ou "INT alto"). Razão de 1,0 ou menos é defensivo ("DEF e ESP altos"). O meio é "atributos equilibrados". PV conta à parte: "PV alto para o estágio" é PV base 15% ou mais acima da média do mesmo estágio.

**3. Pontos.** Cura vale +2, buff +1, limpeza +1, debuff +0,5, golpe de dano −1. Perfil ofensivo soma −1 e defensivo +1. Defesa própria e incerto valem 0.

**4. Papel**, na primeira regra que bater:

1. **Tanque**: tem golpe de defesa própria e perfil defensivo.
2. **Suporte**: pontos 0 ou mais e pelo menos 1 golpe de cura, buff ou limpeza.
3. **Tanque**: golpe de defesa própria com razão abaixo de 1,25, ou perfil defensivo com PV alto para o estágio.
4. **Controle**: 2 ou mais golpes de debuff, e não menos debuff que cura, buff e limpeza somados.
5. **DPS**: pontos −2 ou menos.
6. **Equilíbrio**: o resto, quem tem um pouco de cada.

Quase todo Digimon tem 2 ou 3 golpes de dano, por isso dano pesa menos que cura: sem isso, só quem não tem especial de dano viraria Suporte.

**Rótulo incerto.** Se o Digimon tem golpe de efeito incerto, o app refaz a conta lendo esses golpes como cura e depois como dano. Se o papel muda em algum dos dois casos, a ficha mostra "?" no rótulo e um aviso.

**Foco sugerido no Monster Arena.** Lido em `bridge\timestranger\ma_realtime.lua` do Monster Arena (`MA_foco`): o foco Suporte cura primeiro e põe na frente dos ataques todo golpe que não é dano nem cura, debuff e Provocação inclusive. Por isso: DPS vai para Ataque. Suporte, Controle e Tanque vão para Suporte. Equilíbrio fica em Equilíbrio. A sugestão vem da leitura do código, não de teste em luta.

Resultado com os dados atuais: 253 DPS, 81 Equilíbrio, 80 Suporte, 32 Controle, 30 Tanque, 21 com rótulo incerto. Conferidos à mão: Agumon (DPS), WarGreymon (DPS), Seraphimon (Suporte), Angewomon (Equilíbrio, 3 golpes mágicos de dano e INT 1.280 pesam mais que Aura e Normalizar), Craniamon e BigMamemon (Tanque), Piedmon e Puppetmon (Controle).

Rodar a regra fora do navegador, para conferir:

```
node -e "global.window={};require('./app/dados/dados.js');const P=require('./app/papel.js');console.log(P.calcular(window.DADOS).get(27))"
```

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
