@echo off
rem ==========================================================================
rem Publica o Portal na pasta `portal` do servidor por SFTP: build + envio da dist/.
rem Uso (de qualquer pasta):  deploy\publicar-portal.cmd
rem Mesma receita do app-phd (deploy\publicar-hub.cmd de la), com a pasta portal.
rem
rem 1. Confere se a branch nao esta atras de origin/main (README, secao Deploy:
rem    build de branch atrasada ja reintroduziu bug corrigido em producao).
rem 2. npm run build
rem 3. Envia a dist/ com os comandos de deploy\portal.sftp:
rem      cd portal primeiro -> se a pasta nao for achada, PARA antes de enviar
rem                            nada (as vizinhas hub, gerencia, charts... sao
rem                            outros sistemas);
rem      index.html por ultimo -> so entra no ar quando os assets ja chegaram.
rem    Arquivo novo em public/ precisa de uma linha `put` em deploy\portal.sftp.
rem
rem Entrar no servidor:
rem   - COM SENHA: arquivo .env.deploy na raiz deste repo contendo SO A SENHA, na
rem     primeira linha. O psftp (PuTTY) le direto do arquivo (-pwfile): a senha
rem     nunca passa pela linha de comando. O .gitignore ignora .env.deploy.
rem     NUNCA escreva a senha neste .cmd - ele esta no repositorio.
rem   - COM CHAVE SSH: sem .env.deploy, usa %USERPROFILE%\.ssh\phd_deploy.
rem ==========================================================================
setlocal
cd /d "%~dp0.."

set "SERVIDOR=sistema_phd@hst-1.phdengenharia.tech"

echo Conferindo se a branch esta em dia com origin/main...
git fetch --quiet origin main || goto :sem_origin
set "ATRAS="
for /f %%n in ('git rev-list --count HEAD..origin/main') do set "ATRAS=%%n"
if not defined ATRAS goto :sem_origin
if not "%ATRAS%"=="0" goto :atrasada

echo Gerando a build...
rem `call` e obrigatorio: npm e um .cmd, e sem `call` este script terminaria aqui.
call npm run build || goto :erro

echo.
echo Enviando para hst-1.phdengenharia.tech (pasta portal)...
if exist ".env.deploy" goto :com_senha

sftp -b deploy\portal.sftp -P 2222 -i "%USERPROFILE%\.ssh\phd_deploy" %SERVIDOR% || goto :erro
goto :ok

:com_senha
rem -batch: nunca pergunta nada (servidor desconhecido = falha, sem enviar).
psftp -batch -pwfile ".env.deploy" -b deploy\portal.sftp -P 2222 %SERVIDOR% || goto :erro

:ok
echo.
echo Publicado. Abra o Portal e de Ctrl+F5 para conferir.
exit /b 0

:atrasada
echo.
echo A branch esta %ATRAS% commit(s) atras de origin/main. Rode `git pull` e publique de novo.
goto :erro

:sem_origin
echo.
echo Nao consegui comparar a branch com origin/main (sem internet ou sem acesso ao GitHub?).
goto :erro

:erro
echo.
echo FALHOU - veja o erro acima. Nada foi publicado depois do erro; como o
echo index.html vai por ultimo, o Portal no ar continua sendo a versao anterior.
exit /b 1
