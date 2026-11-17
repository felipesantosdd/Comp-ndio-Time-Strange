@echo off
rem Publica a pasta app\ na Vercel como site estatico (com os dados gerados localmente).
rem A pasta app\dados fica fora do git, por isso o deploy sai daqui e nao de um push.
rem Projeto: compendio-time-stranger (time felipesantosdds-projects), ligado em app\.vercel.
rem Sem esse vinculo (outro PC), rode antes dentro de app\:
rem   npx vercel link --project compendio-time-stranger --scope felipesantosdds-projects
rem e apague o app\.env.local que o link cria (token, o site nao usa).
rem Nao ligue o GitHub ao projeto: o repositorio nao tem app\dados e o site sairia vazio.
cd /d "%~dp0"
if not exist "app\dados\dados.js" (
  echo Os dados ainda nao foram gerados. Rode "Atualizar dados.bat" primeiro.
  pause
  exit /b 1
)
cd app
call npx --yes vercel@latest deploy --prod --yes
pause
