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

## Estrutura

```
app\index.html, app.css, app.js   o app (HTML, CSS e JS puros)
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
