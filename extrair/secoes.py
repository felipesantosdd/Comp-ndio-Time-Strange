"""Decodificação das tabelas do jogo em dados do Compêndio.

Cada função lê CSVs já desempacotados (via pacotes.Jogo) e devolve estruturas
simples. Colunas: índice 0 = primeira coluna do CSV. O que não está provado
fica de fora ou sai cru, nunca chutado.
"""
import csv
import io
import os
import re

# ---------------------------------------------------------------------------
# utilidades


def linhas(caminho):
    with open(caminho, encoding="utf-8", newline="") as h:
        r = csv.reader(h)
        next(r, None)  # 1ª linha só tem os tipos das colunas
        return [x for x in r if x]


def num(v, padrao=0):
    try:
        return int(v)
    except (TypeError, ValueError):
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return padrao


def dlc_de(nome):
    m = re.search(r"_dlc(\d+)$", nome)
    return m.group(1) if m else None


def planilhas(jogo, base, folha):
    """[(dlc|None, linhas)] da tabela base e das variantes _dlcNN, base primeiro."""
    out = []
    for nome in [base] + jogo.nomes_dados(re.escape(base) + r"_dlc\d+"):
        t = jogo.dado(nome)
        if t and folha in t:
            out.append((dlc_de(nome), linhas(t[folha])))
    return out


def textos(jogo, base):
    """Texto base mais os _dlcNN do mesmo nome."""
    out = dict(jogo.texto(base))
    for nome in jogo.nomes_textos(re.escape(base) + r"_dlc\d+"):
        out.update(jogo.texto(nome))
    return out


def limpa(t):
    """Tira as tags de formatação do texto do jogo ({is28}, {image(...)}, {color...})."""
    if not t:
        return ""
    t = re.sub(r"\{image\([^)]*\)\}", "", t)
    t = re.sub(r"\{[^{}]*\}", "", t)
    t = t.replace("\r\n", "\n").replace("\r", "\n")
    return t.strip()


def corrido(t):
    """Texto de várias linhas do jogo (quebra fixa) em parágrafo corrido."""
    t = limpa(t)
    partes = [re.sub(r"\s*\n\s*", " ", p).strip() for p in re.split(r"\n\s*\n", t)]
    return "\n".join(p for p in partes if p)


def enum_texto(jogo, nome, limite=None):
    d = jogo.texto(nome)
    out = {}
    for k, v in d.items():
        if k.isdigit() and (limite is None or int(k) < limite):
            out[int(k)] = limpa(v)
    return out


# ---------------------------------------------------------------------------
# espécies (digimon_status)
#
# Colunas provadas (ver README, seção "Como os dados foram decifrados"):
#   0 id da espécie  2 "char_CHAVE" (nome pt-BR em char_name)  3 modelo "chrNNN"
#   4 estágio (generation_name)  6 tipo (digimon_type: Vacina, Dados, ...)
#   8..17 resistência aos elementos 1..10 (0 normal, 1 fraco, 2 muito fraco,
#         3 resistente, 4 imune; multiplicadores na battle_waek_point_ratio)
#   19..60 famílias (digimon_class_name 0..41; a col 51 é int 0/1)
#   61 personalidade base  64..70 atributos base (col 63 = 99)
#   72+3k especiais (k 0..11)   72+3k / 74+3k golpe aprendido e nível (k 12..15)
#   128..130 cor RGB  131 nº do Guia de Campo (-1 = não colecionável)
#   132 linha da tabela de condição de evolução


def _especie(x, dlc, nomes, perfis):
    chave = x[2][5:] if x[2].startswith("char_") else x[2]
    m = re.match(r"chr(\d{3})", x[3])
    familias = []
    for i in range(19, 61):
        v = x[i]
        if v == "true" or (i == 51 and v not in ("", "0", "false")):
            familias.append(i - 19)
    especiais = [num(x[72 + 3 * k]) for k in range(12) if num(x[72 + 3 * k]) > 0]
    aprende = []
    for k in range(12, 16):
        s, nv = num(x[72 + 3 * k]), num(x[74 + 3 * k])
        if s > 0:
            aprende.append([nv, s])
    id_ = num(x[0])
    return {
        "id": id_,
        "dex": num(x[131], -1),
        "nome": limpa(nomes.get(x[2], "")) or chave.title(),
        "chave": chave,
        "estagio": num(x[4]),
        "tipo": num(x[6]),
        "pers": num(x[61]),
        "familias": familias,
        "res": [num(v) for v in x[8:18]],
        "base": [num(v) for v in x[64:71]] if x[63] == "99" else None,
        "cor": "#%02x%02x%02x" % (num(x[128]) & 255, num(x[129]) & 255, num(x[130]) & 255),
        "especiais": especiais,
        "aprende": aprende,
        "cond": num(x[132], -1),
        "img": int(m.group(1)) if m else None,
        "dlc": dlc,
        "perfil": corrido(perfis.get("digimon_%04d_profile" % id_, "")),
    }


def especies(jogo):
    nomes = textos(jogo, "char_name")
    perfis = textos(jogo, "digimon_profile")
    todas = {}
    for dlc, rows in planilhas(jogo, "digimon_status", "digimon_status_data"):
        for x in rows:
            if len(x) < 133:
                continue
            e = _especie(x, dlc, nomes, perfis)
            if dlc and e["id"] in todas:
                continue  # DLC só acrescenta espécie nova
            todas[e["id"]] = e
    # Uma entrada por número do Guia de Campo. Mesma espécie com outro id (o
    # Agumon do DLC 06, o Dorumon do DLC 03) vira apelido da entrada principal:
    # prefere a linha da base e a que é dona da própria linha de condição.
    por_dex = {}
    for e in sorted(todas.values(), key=lambda e: (e["dlc"] is not None, e["cond"] != e["id"], e["id"])):
        if e["dex"] < 0:
            continue
        por_dex.setdefault(e["dex"], e)
    canon = {}
    for e in todas.values():
        if e["dex"] >= 0:
            canon[e["id"]] = por_dex[e["dex"]]["id"]
    lista = sorted(por_dex.values(), key=lambda e: e["dex"])
    return lista, todas, canon


# ---------------------------------------------------------------------------
# evolução (evolution: evolution_to, evolution_condition)
#   evolution_to: col 1 origem, 3 destino, 5 = 2 troca de modo, 6 item da lista
#   evolution_condition: uma linha por destino (id = col 132 do destino)
#     2 patente de agente  3 nível  4..10 PV PH ATQ DEF INT ESP VEL
#     11 talento  12 elo %  22 item em posse  24/27 parceiros da DNA
#     26/29 personalidade exigida de cada parceiro (texto 1285 "A personalidade
#     de {d0} é {d1}"; bate com a personalidade base da espécie)
#     13..16 valor 46 em evoluções especiais: não decifrado, sai como aviso.

COND_CONHECIDAS = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 22, 24, 26, 27, 29}


def evolucoes(jogo, canon, ids_validos):
    cond = {}
    para = {}
    for dlc, rows in planilhas(jogo, "evolution", "evolution_condition"):
        for x in rows:
            cond[num(x[0])] = x
    for dlc, rows in planilhas(jogo, "evolution", "evolution_to"):
        for x in rows:
            a, b = canon.get(num(x[1]), num(x[1])), canon.get(num(x[3]), num(x[3]))
            if a not in ids_validos or b not in ids_validos or a == b:
                continue
            lst = para.setdefault(a, [])
            if any(e["para"] == b for e in lst):
                continue
            ev = {"para": b}
            if num(x[5]) == 2:
                ev["modo"] = 1
            if num(x[6], -1) >= 0:
                ev["item"] = num(x[6])
            lst.append(ev)
    return para, cond


def condicao(x):
    if x is None:
        return None
    c = {}
    if num(x[2]):
        c["patente"] = num(x[2])
    if num(x[3]):
        c["nivel"] = num(x[3])
    st = [num(v) for v in x[4:11]]
    if any(st):
        c["st"] = st
    if num(x[11]):
        c["talento"] = num(x[11])
    if num(x[12]):
        c["elo"] = num(x[12])
    if num(x[22]):
        c["item"] = num(x[22])
    dna = [[num(x[24]), num(x[26])], [num(x[27]), num(x[29])]]
    dna = [d for d in dna if d[0] > 0]
    if dna:
        c["dna"] = dna
    if any(num(x[i]) for i in (13, 14, 15, 16)):
        c["especial"] = 1
    crus = ["col %d = %s" % (i, v) for i, v in enumerate(x) if i not in COND_CONHECIDAS and v not in ("", "0")]
    if crus:
        c["cru"] = crus
    return c


# ---------------------------------------------------------------------------


def montar(jogo, log=print):
    from secoes_extra import golpes, itens, locais, personalidade  # decifrado à parte

    lista, todas, canon = especies(jogo)
    ids = {e["id"] for e in lista}
    log("espécies: %d no Guia de Campo (%d linhas na tabela)" % (len(lista), len(todas)))
    para, cond = evolucoes(jogo, canon, ids)
    condicoes = {}
    for e in lista:
        c = condicao(cond.get(e["cond"]))
        if c is not None:
            condicoes[e["id"]] = c
    n_ev = sum(len(v) for v in para.values())
    log("evoluções: %d ligações, %d condições" % (n_ev, len(condicoes)))

    for e in lista:
        e.pop("cond", None)
        e.pop("chave", None)

    enums = {
        "estagios": enum_texto(jogo, "generation_name"),
        "tipos": {k: v for k, v in enum_texto(jogo, "digimon_type").items() if k < 100},
        "elementos": {k - 100: v for k, v in enum_texto(jogo, "element").items() if 100 <= k <= 110},
        "familias": enum_texto(jogo, "digimon_class_name"),
        "personalidades": {k: v for k, v in enum_texto(jogo, "personality_name").items() if k > 0},
        "status": enum_texto(jogo, "status_name"),
        "resist": resist_mult(jogo),
    }

    dados = {"enums": enums, "digimon": lista, "evolucoes": para, "condicoes": condicoes}
    dados.update(golpes(jogo, lista, log))
    dados.update(itens(jogo, log))
    dados.update(locais(jogo, canon, ids, log))
    dados.update(personalidade(jogo, log))
    # nome do lojista Digimon pelo modelo chrNNN
    por_modelo = {}
    for e in sorted(todas.values(), key=lambda e: (e["dex"] < 0, e["id"])):
        if e["img"] is not None:
            por_modelo.setdefault(e["img"], e["nome"])
    for loja in dados.get("lojas", []):
        if "lojista" in loja:
            loja["lojistaNome"] = por_modelo.get(loja.pop("lojista"), "")
    # nomes dos itens citados nas condições, se a seção de itens não trouxe
    nomes_item = textos(jogo, "item_name")
    dados.setdefault("itens", {})
    for c in condicoes.values():
        if "item" in c and str(c["item"]) not in dados["itens"]:
            dados["itens"][str(c["item"])] = {"nome": limpa(nomes_item.get(str(c["item"]), "")) or "Item %d" % c["item"]}
    return dados


def resist_mult(jogo):
    """Multiplicador de dano por nível de resistência (battle_waek_point_ratio,
    linhas com afinidade de tipo neutra: col 2 = 0, col 3 = 0)."""
    t = jogo.dado("battle_calculate")
    out = {}
    if t and "battle_waek_point_ratio" in t:
        for x in linhas(t["battle_waek_point_ratio"]):
            if num(x[2]) == 0 and num(x[3]) == 0:
                out[num(x[1])] = num(x[4]) / 100.0
    return out


def resumo(d):
    return {
        "digimon": len(d.get("digimon", [])),
        "evoluções": sum(len(v) for v in d.get("evolucoes", {}).values()),
        "golpes": len(d.get("golpes", {})),
        "itens": len(d.get("itens", {})),
        "receitas": len(d.get("receitas", [])),
        "decomposição": len(d.get("decomposicao", [])),
        "lojas": len(d.get("lojas", [])),
        "locais": sum(1 for v in d.get("locais", {}).values() if v),
    }


# ---------------------------------------------------------------------------
# imagens


def imagens(jogo, dados, pasta, log=print, lado=96):
    from PIL import Image

    os.makedirs(os.path.join(pasta, "ui"), exist_ok=True)

    def abrir(nome):
        interno = "images/%s.img" % nome
        if interno not in jogo.imagens:
            return None
        caminho = jogo.arquivo(interno, jogo.imagens[interno])
        return Image.open(caminho).convert("RGBA")

    feitos = falhas = 0
    for e in dados["digimon"]:
        if e["img"] is None:
            continue
        dst = os.path.join(pasta, "%03d.webp" % e["img"])
        if os.path.exists(dst):
            feitos += 1
            continue
        try:
            im = abrir("ui_chara_icon_1%03d" % e["img"])
            if im is None:
                e["img"] = None
                continue
            im.thumbnail((lado, lado), Image.LANCZOS)
            im.save(dst, "WEBP", quality=82, method=6)
            feitos += 1
        except Exception as ex:  # formato que o Pillow não abre
            falhas += 1
            e["img"] = None
            log("  retrato %s falhou: %s" % (e["img"], ex))
    for i in range(0, 11):
        _icone(abrir, "ui_icon_skill_%03d" % i, os.path.join(pasta, "ui", "elem%d.png" % i))
    for i in range(0, 7):
        _icone(abrir, "ui_icon_type_%03d" % (i * 20), os.path.join(pasta, "ui", "tipo%d.png" % i))
    log("retratos: %d prontos, %d falharam" % (feitos, falhas))


def _icone(abrir, nome, dst, lado=40):
    if os.path.exists(dst):
        return
    try:
        im = abrir(nome)
        if im is None:
            return
        im.thumbnail((lado, lado))
        im.save(dst, optimize=True)
    except Exception:
        pass
