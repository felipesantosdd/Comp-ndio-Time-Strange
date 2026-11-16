@echo off
if not exist "%~dp0app\dados\dados.js" (
  echo Os dados ainda nao foram gerados. Rode "Atualizar dados.bat" primeiro.
  pause
  exit /b 1
)
start "" "%~dp0app\index.html"
