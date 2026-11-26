<#
.SYNOPSIS
  App local apontando para PRODUÇÃO (banco, Storage, login, Functions), com o processamento dos mp3
  enviados rodando neste PC com o BS-RoFormer em vez do Cloud Run.

.DESCRIPTION
  yarn dev:local                       app em http://localhost:3000 + worker local (BS-RoFormer)
  yarn dev:local -Separador demucs     worker local com o Demucs (o mesmo de produção)
  yarn dev:local -Rebuild              recompila a imagem local do worker antes

  Abre uma janela com o worker local (worker/local_listener.py, no Docker) e roda o app aqui mesmo
  (Ctrl+C para parar; feche a janela do worker quando terminar). Só os uploads feitos por este app,
  com uma conta admin, vão para o PC (functions/main.py, _dispatch); o site e as outras contas
  continuam no Cloud Run com o Demucs. Precisa do login do gcloud com acesso ao projeto
  (gcloud auth application-default login).
#>
param(
  [ValidateSet('roformer', 'demucs')]
  [string]$Separador = 'roformer',
  [switch]$Rebuild
)
# 'Continue': no Windows PowerShell 5.1, 'Stop' transforma em erro fatal qualquer saída de erro de
# comandos externos (docker), mesmo redirecionada; os passos conferem $LASTEXITCODE e usam throw.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$image = 'meu-repertorio-worker'
$project = 'avid-bricolage-313721'
$worker = 'meu-repertorio-worker-local'

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

Step 'Login do Google Cloud (para o worker gravar em produção)'
$adc = Join-Path $env:APPDATA 'gcloud\application_default_credentials.json'
if (-not (Test-Path $adc)) {
  throw "Falta o login do gcloud: rode 'gcloud auth application-default login' e tente de novo."
}

Step 'Docker'
docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Abrindo o Docker Desktop...'
  Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  $ready = $false
  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 2
    docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  }
  if (-not $ready) { throw 'O Docker não respondeu em 3 minutos.' }
}

Step 'Imagem local do worker (Demucs + BS-RoFormer)'
$hasLocal = $false
docker image inspect $image 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  docker run --rm --entrypoint python $image -c "import bs_roformer, local_listener" 2>$null | Out-Null
  $hasLocal = ($LASTEXITCODE -eq 0)
}
if ($Rebuild -or -not $hasLocal) {
  docker build -f worker/Dockerfile --target local -t $image .
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar a imagem do worker.' }
} else {
  Write-Host 'Imagem já existe (use -Rebuild depois de mudar o worker).'
}

$busy = Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue
if ($busy) { throw 'A porta 3000 já está em uso: feche o "npm run dev" e rode de novo.' }

Step "Worker local ($Separador) numa janela à parte"
$stems = if ($Separador -eq 'roformer') { 'bs-roformer-sw' } else { 'htdemucs_6s' }
docker rm -f $worker 2>$null | Out-Null
$cmd = "`$host.UI.RawUI.WindowTitle='Worker local ($Separador)'; docker run --rm -it --name $worker " +
  "-v `"$env:APPDATA\gcloud:/root/.config/gcloud:ro`" -v meu-repertorio-roformer:/models/roformer " +
  "-e GOOGLE_CLOUD_PROJECT=$project -e GOOGLE_CLOUD_QUOTA_PROJECT=$project " +
  "-e STORAGE_BUCKET=$project.appspot.com -e STEMS_MODEL=$stems " +
  "--entrypoint python $image local_listener.py"
Start-Process powershell -WorkingDirectory $root -ArgumentList '-NoExit', '-Command', $cmd

Step 'App em http://localhost:3000 (produção; uploads processados no PC)'
Write-Host "Separador: $Separador. Com o BS-RoFormer, uma música de 4 min leva ~1 h neste PC."
$env:NEXT_PUBLIC_LOCAL_WORKER = '1'
yarn next dev -p 3000
