"""Gera os dados do Compêndio a partir dos arquivos do jogo instalado.

Uso:
    python -I extrair\\extrair.py [--jogo PASTA] [--mvgltools EXE] [--limpar]

Lê os .mvgl de Digimon Story: Time Stranger (patch, DLCs, app_0), extrai só as
tabelas e imagens necessárias para cache\\ com o MVGLToolsCLI e escreve:

    app\\dados\\dados.js        os dados (window.DADOS = {...})
    app\\dados\\img\\NNN.webp   retratos 96x96
    app\\dados\\img\\ui\\*.png  ícones de elemento e de tipo

Rodar de novo depois de atualização ou DLC nova: use --limpar para jogar fora o
cache e extrair tudo do zero. Nada no jogo é alterado.
"""
import argparse
import csv
import datetime
import io
import json
import os
import re
import shutil
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)

from pacotes import Jogo  # noqa: E402
import secoes  # noqa: E402

JOGO_PADRAO = r"C:\Program Files (x86)\Steam\steamapps\common\Digimon Story Time Stranger"
MVGL_PADRAO = os.path.join(os.path.dirname(RAIZ), "Monster Arena", "tools", "vendor", "mvgltools",
                           "bin", "MVGLTools-v2.2.0-win64", "MVGLToolsCLI.exe")


def achar_gamedata(pasta):
    for cand in (pasta, os.path.join(pasta, "gamedata")):
        if os.path.isfile(os.path.join(cand, "app_0.dx11.mvgl")):
            return cand
    raise SystemExit("Não achei app_0.dx11.mvgl em %s (use --jogo)" % pasta)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--jogo", default=os.environ.get("DSTS_JOGO", JOGO_PADRAO))
    ap.add_argument("--mvgltools", default=os.environ.get("MVGLTOOLS", MVGL_PADRAO))
    ap.add_argument("--cache", default=os.path.join(RAIZ, "cache"))
    ap.add_argument("--saida", default=os.path.join(RAIZ, "app", "dados"))
    ap.add_argument("--limpar", action="store_true", help="apaga o cache antes (extração do zero)")
    ap.add_argument("--sem-imagens", action="store_true")
    a = ap.parse_args()

    if not os.path.isfile(a.mvgltools):
        raise SystemExit("MVGLToolsCLI.exe não encontrado: %s (use --mvgltools)" % a.mvgltools)
    gamedata = achar_gamedata(a.jogo)
    if a.limpar:
        for pasta in (a.cache, a.saida):
            if os.path.isdir(pasta):
                shutil.rmtree(pasta)
    os.makedirs(a.cache, exist_ok=True)

    print("indexando pacotes em", gamedata)
    jogo = Jogo(gamedata, a.mvgltools, a.cache)
    print("  %d pacotes, %d tabelas, %d textos" % (len(jogo.pacotes), len(jogo.dados), len(jogo.textos)))

    dados = secoes.montar(jogo, log=print)
    dados["versao"] = {
        "gerado": datetime.datetime.now().isoformat(timespec="seconds"),
        "pacotes": sorted(jogo.pacotes),
    }

    os.makedirs(a.saida, exist_ok=True)
    if not a.sem_imagens:
        secoes.imagens(jogo, dados, os.path.join(a.saida, "img"), log=print)

    js = "window.DADOS=" + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n"
    alvo = os.path.join(a.saida, "dados.js")
    with open(alvo, "w", encoding="utf-8", newline="\n") as h:
        h.write(js)
    print("escrito %s (%.0f KB)" % (alvo, len(js.encode("utf-8")) / 1024))
    for k, v in secoes.resumo(dados).items():
        print("  %-14s %s" % (k, v))


if __name__ == "__main__":
    main()
