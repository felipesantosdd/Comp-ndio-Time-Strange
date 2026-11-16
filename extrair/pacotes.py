"""Acesso aos pacotes .mvgl do jogo: índice dos arquivos e extração pelo MVGLToolsCLI.

Nada aqui escreve no jogo. O que sai vai para a pasta de cache do projeto.

Prioridade quando o mesmo arquivo está em mais de um pacote: patch, depois os
DLCs (addcont_NN, do maior para o menor), depois app_0. Texto (pt-BR) vem dos
pacotes *_text07 na mesma ordem.
"""
import csv
import os
import re
import struct
import subprocess

# Registro de nome no cabeçalho MDB1: 4 bytes de extensão ("mbe ", "img ") e o caminho.
_NOME = re.compile(rb'([a-z0-9]{2,4}) ?((?:data|text|images)\\[A-Za-z0-9_.\-]+)\x00')


def _cabecalho(caminho):
    tam = os.path.getsize(caminho)
    with open(caminho, 'rb') as h:
        ini = h.read(32)
        if ini[:4] != b'MDB1':
            return b''
        # Campo 4 do cabeçalho é o início dos dados (fim da tabela de nomes).
        fim = struct.unpack('<I', ini[16:20])[0]
        if not (0 < fim <= tam) or fim < 1024:
            fim = 64 << 20
        h.seek(0)
        return h.read(min(tam, fim, 256 << 20))


def _ordem(nome):
    """Chave de prioridade: menor vem primeiro."""
    if nome.startswith('patch'):
        return (0, 0)
    m = re.match(r'addcont_(\d+)', nome)
    if m:
        return (1, -int(m.group(1)))
    return (2, 0)


class Jogo:
    def __init__(self, gamedata, mvgltools, cache):
        self.gamedata = gamedata
        self.cli = mvgltools
        self.cache = os.path.abspath(cache)  # o CLI roda em outra pasta
        self.dados = {}   # 'data/evolution.mbe' -> pacote
        self.textos = {}  # 'text/char_name.mbe' -> pacote (text07)
        self.imagens = {}
        self.pacotes = []
        self._indexar()

    def _indexar(self):
        nomes = [f for f in os.listdir(self.gamedata) if f.endswith('.dx11.mvgl') and 'voice' not in f]
        dados = sorted([f for f in nomes if '_text' not in f], key=_ordem)
        textos = sorted([f for f in nomes if f.endswith('_text07.dx11.mvgl')], key=_ordem)
        for f in dados + textos:
            p = os.path.join(self.gamedata, f)
            alvo = self.textos if f in textos else None
            for m in _NOME.finditer(_cabecalho(p)):
                ext = m.group(1).decode()
                interno = m.group(2).decode().replace('\\', '/') + '.' + ext
                if ext == 'img':
                    self.imagens.setdefault(interno, p)
                elif alvo is not None:
                    # texto: guarda todos os pacotes (o patch pode trazer só parte dos ids)
                    alvo.setdefault(interno, [])
                    if p not in alvo[interno]:
                        alvo[interno].append(p)
                else:
                    self.dados.setdefault(interno, p)
            self.pacotes.append(f)

    # ------------------------------------------------------------------
    def _rodar(self, *args):
        cwd = os.path.dirname(self.cli)  # o CLI procura a pasta structures/ no diretório atual
        r = subprocess.run([self.cli, '--game=dsts', *args], cwd=cwd, capture_output=True, text=True)
        if r.returncode != 0:
            raise RuntimeError('MVGLToolsCLI falhou (%d): %s %s' % (r.returncode, ' '.join(args), r.stderr or r.stdout))

    def arquivo(self, interno, pacote):
        """Copia um arquivo de dentro do pacote para o cache. Devolve o caminho local."""
        dst = os.path.join(self.cache, 'bruto', os.path.basename(pacote).split('.')[0], *interno.split('/'))
        if not os.path.exists(dst):
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            self._rodar('--mode=unpack-mvgl-file', '-i', pacote, '-o', dst, '--file', interno)
        return dst

    def tabela(self, interno, pacote):
        """Desempacota um .mbe em CSV. Devolve {nome_da_planilha: caminho_csv}."""
        mbe = self.arquivo(interno, pacote)
        base = os.path.join(self.cache, 'csv', os.path.basename(pacote).split('.')[0])
        nome = os.path.basename(interno)
        pasta = os.path.join(base, nome)  # o CLI cria <saida>/<nome>.mbe/
        if not os.path.isdir(pasta):
            os.makedirs(base, exist_ok=True)
            self._rodar('--mode=unpack-mbe', '-i', mbe, '-o', base)
        out = {}
        for f in sorted(os.listdir(pasta)):
            if f.endswith('.csv'):
                out[re.sub(r'^\d+_', '', f[:-4])] = os.path.join(pasta, f)
        return out

    def dado(self, nome):
        """Tabela de dados pelo nome (sem extensão): 'evolution', 'digimon_status_dlc17'."""
        interno = 'data/%s.mbe' % nome
        if interno not in self.dados:
            return None
        return self.tabela(interno, self.dados[interno])

    def texto(self, nome):
        """Texto pt-BR {id: frase}. Junta todos os pacotes; o de maior prioridade vence."""
        interno = 'text/%s.mbe' % nome
        out = {}
        for p in reversed(self.textos.get(interno, [])):
            for csvp in self.tabela(interno, p).values():
                with open(csvp, encoding='utf-8', newline='') as h:
                    r = csv.reader(h)
                    next(r, None)
                    for linha in r:
                        if len(linha) >= 2:
                            out[linha[0]] = linha[1]
        return out

    def nomes_dados(self, padrao):
        r = re.compile(padrao)
        out = []
        for k in self.dados:
            n = k[5:-4]
            if k.startswith('data/') and r.fullmatch(n):
                out.append(n)
        return sorted(out)

    def nomes_textos(self, padrao):
        r = re.compile(padrao)
        return sorted(k[5:-4] for k in self.textos if r.fullmatch(k[5:-4]))
