@echo off
rem Extrai do jogo instalado tudo do zero (apaga cache e dados gerados antes).
cd /d "%~dp0"
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
python -I extrair\extrair.py --limpar
pause
