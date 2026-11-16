"""Golpes, itens (criação, decomposição, lojas), locais e personalidade."""
import re

from secoes import limpa, corrido, textos, planilhas, linhas, num


# ---------------------------------------------------------------------------
# golpes: battle_skill (battle_skill_list, buff_set) e as variantes _dlcNN
#   0 id   4 id do nome (skill_name)   6 id da explicação (skill_explanation)
#   22 natureza: 1 físico (ATQ), 2 mágico (INT), 4 dano fixo, 5 dano em % de PV,
#      8 cura, 9 cura fixa, 10 reviver/cura %, 11 Cross Arts; 0 suporte
#   23 poder por acerto   28 elemento (-1 nenhum)   33 alvo (skill_auto_explanation 1..13)
#   34/35 acertos mín./máx.   36 custo de PH (padrão numérico, sem rótulo no jogo)
#   39 sempre acerta   40 precisão %   41 pode crítico   42 taxa de crítico %
#   54 buff_set no alvo   56 buff_set no usuário
#   buff_set: a partir da col 6, grupos de 5 [buff (buff_name), chance %, valor %, turnos, vazio]

NATUREZA = {0: "Suporte", 1: "Físico", 2: "Mágico", 4: "Dano fixo", 5: "Dano em % de PV",
            6: "Velocidade", 8: "Cura", 9: "Cura fixa", 10: "Reviver/cura em %", 11: "Cross Arts"}


def _buffs(sets, bid, nomes):
    out = []
    x = sets.get(bid)
    if not x:
        return out
    for c in range(6, len(x) - 3, 5):
        b = num(x[c])
        if b <= 0:
            continue
        nome = limpa(nomes.get(str(b), "")) or "efeito %d" % b
        out.append([nome, num(x[c + 1]), num(x[c + 2]), num(x[c + 3]) or 3])
    return out


def golpes(jogo, lista, log):
    nomes = textos(jogo, "skill_name")
    desc = textos(jogo, "skill_explanation")
    bnomes = textos(jogo, "buff_name")
    auto = jogo.texto("skill_auto_explanation")
    linhas_sk, sets = {}, {}
    for _, rows in planilhas(jogo, "battle_skill", "battle_skill_list"):
        for x in rows:
            linhas_sk[num(x[0])] = x
    for _, rows in planilhas(jogo, "battle_skill", "buff_set"):
        for x in rows:
            sets[num(x[0])] = x

    ids = set()
    for e in lista:
        ids.update(e["especiais"])
        ids.update(s for _, s in e["aprende"])
    # discos de habilidade (item categoria 3: col 13 = golpe)
    for _, rows in planilhas(jogo, "item", "item_parameter"):
        for x in rows:
            if num(x[6]) == 3 and num(x[13]) > 0:
                ids.add(num(x[13]))

    out = {}
    for i in sorted(ids):
        x = linhas_sk.get(i)
        g = {"nome": limpa(nomes.get(x[4] if x else str(i), "") or nomes.get(str(i), "")) or "Golpe %d" % i}
        if x:
            d = corrido(desc.get(x[6], "")) if num(x[6]) > 0 else ""
            if d:
                g["desc"] = d
            g["nat"] = num(x[22])
            g["el"] = num(x[28], -1)
            g["pod"] = num(x[23])
            g["ac"] = [num(x[34]), num(x[35])]
            g["ph"] = num(x[36])
            g["alvo"] = num(x[33])
            g["prec"] = num(x[40])
            if num(x[39]):
                g["sempre"] = 1
            g["crit"] = num(x[42]) if num(x[41]) else 0
            b = _buffs(sets, num(x[54]), bnomes)
            if b:
                g["bufAlvo"] = b
            b = _buffs(sets, num(x[56]), bnomes)
            if b:
                g["bufUsu"] = b
        out[str(i)] = g
    alvos = {}
    for k in range(1, 14):
        t = limpa(auto.get(str(k), ""))
        alvos[k] = re.sub(r"^\[?Alvo:\s*|\]$", "", t)
    log("golpes: %d (%d com linha na battle_skill)" % (len(out), sum(1 for v in out.values() if "nat" in v)))
    return {"golpes": out, "alvos": alvos, "naturezas": NATUREZA}


# ---------------------------------------------------------------------------
# itens: item (item_parameter, equip_parameter) + item_dlcNN
#   item_parameter: 0 id  4 id do nome (item_name)  5 id da explicação (0 = sem)
#     6 categoria  9 compra (-1 não vende)  10 venda  13 golpe (discos: categoria 3)
#   equip_parameter: 0 id  2..11 bônus PV PH ATQ DEF INT ESP VEL PREC EVAS CRÍT
#     12..22 proteção contra elemento 0..10   35 estado anulado (buff_name)
#     36 efeito especial: item_auto_explanation[36 + 56] com {d0}=37, {d1}=38
#   develop_item (criação): 1 resultado  5 custo  pares (item, qtd) em (6,8) .. (24,26)
#   decomposition_item: 1 item de origem  pares (item, qtd) a partir de (5,7) de 3 em 3
#   shop_parameter: 0 loja  2 grupo da vitrine  8 lojista (1000 + chrNNN para Digimon)
#   shop_lineup: 1 grupo  3 item  5 compra única  6 preço (-1 = o do item)  8 condição de história

CATEGORIAS = {0: "Recuperação", 1: "Melhorias", 2: "Especial", 3: "Discos de Habilidade", 4: "Equipamento",
              5: "Materiais", 6: "Fazenda", 7: "Roupas", 8: "Itens de valor", 9: "Cartas"}


def _fmt(t, vals):
    for i, v in enumerate(vals):
        t = t.replace("{d%d}" % i, str(v))
    return t


def itens(jogo, log):
    nomes = textos(jogo, "item_name")
    expl = textos(jogo, "item_explanation")
    auto = jogo.texto("item_auto_explanation")
    snome = textos(jogo, "skill_name")
    bnomes = textos(jogo, "buff_name")
    tipos = jogo.texto("digimon_type")
    sets = {}
    for _, rows in planilhas(jogo, "battle_skill", "buff_set"):
        for x in rows:
            sets[num(x[0])] = x
    sk_nome = {}
    for _, rows in planilhas(jogo, "battle_skill", "battle_skill_list"):
        for x in rows:
            sk_nome[num(x[0])] = x[4]

    itens_ = {}
    for dlc, rows in planilhas(jogo, "item", "item_parameter"):
        for x in rows:
            i, cat = num(x[0]), num(x[6])
            if cat == 3:
                s = num(x[13])
                nome = limpa(snome.get(sk_nome.get(s, str(s)), ""))
            else:
                nome = limpa(nomes.get(x[4], ""))
            if not nome or nome in ("-", "{d0}"):
                continue
            it = {"nome": nome, "cat": cat}
            d = corrido(expl.get(x[5], "")) if num(x[5]) > 0 else ""
            if d:
                it["desc"] = d
            if num(x[9]) > 0:
                it["compra"] = num(x[9])
            if num(x[10]) > 0:
                it["venda"] = num(x[10])
            if cat == 3:
                it["golpe"] = num(x[13])
            if dlc:
                it["dlc"] = dlc
            itens_[str(i)] = it
    for _, rows in planilhas(jogo, "item", "equip_parameter"):
        for x in rows:
            it = itens_.get(x[0])
            if not it:
                continue
            st = [num(v) for v in x[2:12]]
            if any(st):
                it["st"] = st
            prot = [e for e in range(11) if num(x[12 + e])]
            if prot:
                it["prot"] = prot
            ef = []
            if num(x[35]) > 0:
                n = limpa(bnomes.get(x[35], ""))
                if n:
                    ef.append("Anula " + n)
            tipo_ef = num(x[36])
            if tipo_ef > 0:
                t = auto.get(str(tipo_ef + 56), "")
                vals = [x[37], x[38]]
                b = _buffs(sets, num(x[40]), bnomes) if len(x) > 40 else []
                if tipo_ef == 16 and b:      # "Dá {d0} de chance de causar {d1}"
                    vals = ["%d%%" % b[0][1], b[0][0]]
                elif tipo_ef == 34 and b:    # "Adiciona {d1} ao usuário"
                    vals = [x[37], b[0][0]]
                elif tipo_ef == 33:          # "Dano de Digimon de Atributo {d0}"
                    vals = [re.sub(r"^Digimon ", "", tipos.get(x[37], x[37])), x[38]]
                t = corrido(_fmt(t, vals))
                if t and "{" not in t:
                    ef.append(t)
            if ef:
                it["efeito"] = ef

    def pares(x, ini, fim, passo=3):
        out = []
        for c in range(ini, min(fim, len(x) - 2), passo):
            item, qtd = num(x[c]), num(x[c + 2])
            if item > 0 and qtd > 0:
                out.append([item, qtd])
        return out

    receitas = []
    for _, rows in planilhas(jogo, "develop", "develop_item"):
        for x in rows:
            r = {"res": num(x[1]), "custo": num(x[5]), "mat": pares(x, 6, 27)}
            if str(r["res"]) in itens_:
                receitas.append(r)
    decomp = []
    for _, rows in planilhas(jogo, "decomposition", "decomposition_item"):
        for x in rows:
            r = {"de": num(x[1]), "da": pares(x, 5, len(x))}
            if r["da"] and str(r["de"]) in itens_:
                decomp.append(r)

    lojas = _lojas(jogo, itens_)
    log("itens: %d, receitas %d, decomposição %d, lojas %d" % (len(itens_), len(receitas), len(decomp), len(lojas)))
    return {"itens": itens_, "categorias": CATEGORIAS, "receitas": receitas, "decomposicao": decomp, "lojas": lojas}


def _lojas(jogo, itens_):
    t = jogo.dado("shop")
    if not t:
        return []
    vitrine = {}
    for x in linhas(t["shop_lineup"]):
        it = num(x[3])
        if str(it) not in itens_:
            continue
        v = [it, num(x[6], -1)]
        if num(x[5]) == 1:
            v.append(1)
        cond = x[8].strip() if len(x) > 8 else ""
        if cond:
            while len(v) < 3:
                v.append(0)
            v.append(cond)
        vitrine.setdefault(num(x[1]), []).append(v)
    # mapa de cada lojista Digimon: NPC "shop..." do field_npc com o modelo chrNNN
    nomes_mapa = jogo.texto("field_name")
    onde = {}
    for nome in jogo.nomes_dados(r"field_npc_\w+"):
        m = re.match(r"field_npc_(?:dep\d+)?([tdhe])(\d{4})", nome)
        tt = jogo.dado(nome)
        if not m or not tt or "field_npc" not in tt:
            continue
        pref = {"t": "1", "d": "2", "h": "3", "e": "4"}[m.group(1)]
        mapa = limpa(nomes_mapa.get(pref + m.group(2), ""))
        if not mapa:
            continue
        for x in linhas(tt["field_npc"]):
            if len(x) > 5 and "shop" in x[2] and x[5].startswith("chr"):
                onde.setdefault(x[5][:6], set()).add(mapa)
    especies = textos(jogo, "char_name")
    lojas = []
    vistos = set()
    for x in linhas(t["shop_parameter"]):
        grupo = num(x[2])
        if grupo not in vitrine:
            continue
        lojista = num(x[8].strip('"'))
        chave = (grupo, lojista)
        if chave in vistos:
            continue
        vistos.add(chave)
        loja = {"id": num(x[0]), "itens": vitrine[grupo]}
        if 1000 <= lojista < 2000:
            chr_ = "chr%03d" % (lojista - 1000)
            loja["lojista"] = lojista - 1000
            loja["mapas"] = sorted(onde.get(chr_, []))
        lojas.append(loja)
    return lojas


# ---------------------------------------------------------------------------
# locais: field_battle_<mapa> (+ _dlcNN dos DLCs)
#   field_symbol_enemy: 1 grupo de encontro  3 padrão de aparição (-1 sempre,
#     99 nunca tem condição: inativo)
#   field_symbol_enemy_conditions: linha com id % 1000 == padrão; cols 1..16 são
#     pares (de, até) em OU: "Common" = sempre; "A2020_dbef_120" = era 2020/2028 e
#     capítulo da história; "DLC00N_..." = episódio de DLC
#   battle_enemy encount_group: 2, 14, 26 = até 3 enemy_parameter; 85 = tipo
#     (2 selvagem, 0 história, 1 especial; 6 grupo genérico sem uso: ignorado)
#   enemy_parameter: 2 = espécie
#   Nome: field_name com chave {t:1,d:2,h:3} + 4 dígitos; mapas de DLC em
#     field_name_dlcNN, chave base (dlc01 100000, dlc02 140000, dlc03 180000)
#     + {t:0,d:1}*10000 + número. Mapas "h" (Masmorra Externa) levam o título
#     da missão secundária (quest_sub col 19 = mapa, col 0 = quest_title).

def _janela(cond):
    """Resumo da condição: (eras, depende_da_historia, dlc)."""
    if cond is None:
        return set(), False, False
    eras, hist, dlc = set(), False, False
    for i in range(1, 17, 2):
        a = cond[i]
        if not a:
            continue
        if a == "Common":
            return set(), False, False
        m = re.match(r"[A-Z](2020|2028)_", a)
        if m:
            eras.add(m.group(1))
            hist = True
        elif a.startswith("DLC"):
            dlc = True
        else:
            hist = True
    if any(c.startswith("FLAG") for c in cond[21:52]):
        hist = True
    return eras, hist, dlc


def locais(jogo, canon, ids, log):
    grupos, params = {}, {}
    for _, rows in planilhas(jogo, "battle_enemy", "encount_group"):
        for x in rows:
            grupos[x[0]] = x
    for _, rows in planilhas(jogo, "battle_enemy", "enemy_parameter"):
        for x in rows:
            params[x[0]] = num(x[2])
    fn = textos(jogo, "field_name")
    qt = jogo.texto("quest_title")
    hq = {}
    t = jogo.dado("quest_sub")
    if t and "sub_quest_list" in t:
        for x in linhas(t["sub_quest_list"]):
            if len(x) > 19 and x[19].startswith("h"):
                hq.setdefault(x[19], limpa(qt.get(x[0], "")))
    base_dlc = {"01": 100000, "02": 140000, "03": 180000}

    def nome_mapa(mapa, dlc):
        m = re.search(r"([tdh])(\d{4})$", mapa)
        if not m:
            return mapa
        tp, n = m.group(1), m.group(2)
        nome = limpa(fn.get(str({"t": 1, "d": 2, "h": 3}[tp]) + n, ""))
        if dlc in base_dlc and tp in "td" and "dep" in mapa:
            nome = limpa(fn.get(str(base_dlc[dlc] + {"t": 0, "d": 1}[tp] * 10000 + int(n)), "")) or nome
        if tp == "h" and hq.get(tp + n):
            nome = "%s (%s)" % (nome or "Masmorra Externa", hq[tp + n])
        return nome or mapa

    loc = {}
    for nome in jogo.nomes_dados(r"field_battle_\w+"):
        dlc = None
        m = re.match(r"field_battle_(\w+?)(?:_dlc(\d+))?$", nome)
        mapa, dlc = m.group(1), m.group(2)
        tt = jogo.dado(nome)
        if not tt or "field_symbol_enemy" not in tt:
            continue
        conds = {}
        for x in linhas(tt.get("field_symbol_enemy_conditions", "")) if "field_symbol_enemy_conditions" in tt else []:
            conds[num(x[0]) % 1000] = x
        nm = nome_mapa(mapa, dlc)
        for x in linhas(tt["field_symbol_enemy"]):
            pad = num(x[3])
            if pad == 99 or (pad != -1 and pad not in conds):
                continue  # padrão sem condição: não aparece
            g = grupos.get(x[1])
            if not g or len(g) < 86:
                continue
            tipo = num(g[85])
            if tipo == 6:
                continue
            eras, hist, edlc = _janela(conds.get(pad) if pad != -1 else None)
            for c in (2, 14, 26):
                if g[c] in ("-1", "0", ""):
                    continue
                sp = params.get(g[c])
                if sp is None:
                    continue
                sp = canon.get(sp, sp)
                if sp not in ids:
                    continue
                chave = (nm, mapa)
                reg = loc.setdefault(sp, {}).setdefault(chave, {"mapa": nm, "eras": set(), "hist": True, "ev": True, "dlc": bool(dlc or edlc)})
                if not eras:
                    reg["eras"].add("*")
                reg["eras"] |= eras
                reg["hist"] = reg["hist"] and hist
                reg["ev"] = reg["ev"] and tipo != 2
    out = {}
    for sp, regs in loc.items():
        lst = []
        for r in sorted(regs.values(), key=lambda r: (r["ev"], r["mapa"])):
            e = sorted(r["eras"])
            item = {"mapa": r["mapa"]}
            if "*" not in e and e:
                item["eras"] = e
            if r["hist"]:
                item["hist"] = 1
            if r["ev"]:
                item["evento"] = 1
            if r["dlc"]:
                item["dlc"] = 1
            if item not in lst:
                lst.append(item)
        out[str(sp)] = lst
    log("locais: %d espécies com local no campo" % len(out))
    return {"locais": out}


def personalidade(jogo, log):
    """Redução dos requisitos de evolução por habilidade de agente.

    TamerSkill (app_0 tamer_skill.mbe): col 16 = 13 é o efeito "Condições de
    Digievolução reduzidas" (common_message icon_info_description_05_18).
    col 18 = porcentagem ({d0} do texto), col 38 = categoria de personalidade,
    col 39 = personalidade única (0 = a categoria toda), col 15 = custo, col 1 =
    id do nome. Vale quando a personalidade atual do Digimon é igual à
    personalidade base do alvo (texto da habilidade e common_message 1284).
    Categoria de cada personalidade: personality_category col 0 -> col 2.
    """
    from secoes import linhas, num
    out = {"persCat": {}, "persCatNomes": {}, "reducao": []}
    t = jogo.dado("personality_category")
    if t:
        for x in linhas(t["personality_category"]):
            out["persCat"][num(x[0])] = num(x[2])
    cm = jogo.texto("common_message")
    for c in range(1, 5):
        nome = limpa(cm.get("icon_info_description_05_%02d" % (c + 1), ""))
        out["persCatNomes"][c] = re.sub(r"^Personalidade \((.*)\)$", r"\1", nome) or "Categoria %d" % c
    t = jogo.dado("tamer_skill")
    nomes = textos(jogo, "tamer_skill_name")
    grupos = {}
    if t:
        for x in linhas(t["TamerSkill"]):
            if num(x[16]) != 13:
                continue
            g = grupos.setdefault((num(x[38]), num(x[39]), num(x[18])), {
                "cat": num(x[38]), "pers": num(x[39]), "pct": num(x[18]), "custo": num(x[15]),
                "nome": limpa(nomes.get(x[1], "")), "copias": 0})
            g["copias"] += 1
    out["reducao"] = sorted(grupos.values(), key=lambda g: (g["cat"], g["pers"]))
    log("redução por personalidade: %d habilidades" % len(out["reducao"]))
    return out
