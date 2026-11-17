@echo off
rem Publica a pasta app\ na Vercel como site estatico (com os dados gerados localmente).
rem A pasta app\dados fica fora do git, por isso o deploy sai daqui e nao de um push.
rem Primeira vez: a Vercel pede login e o nome do projeto; depois e so rodar de novo.
cd /d "%~dp0"
if not exist "app\dados\dados.js" (
  echo Os dados ainda nao foram gerados. Rode "Atualizar dados.bat" primeiro.
  pause
  exit /b 1
)
call npx --yes vercel@latest deploy app --prod
pause
