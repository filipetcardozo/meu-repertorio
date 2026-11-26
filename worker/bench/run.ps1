# Uma rodada por processo, sem credenciais e com o checkpoint montado só para leitura.
param(
  [string]$Run = (Get-Date -Format 'yyyyMMdd-HHmmss'),
  [string[]]$Cases = @('baseline', 'overlap1', 'threads10', 'threads8', 'threads6',
    'interop1', 'omp-mkl', 'half-chunk', 'cpu-loop', 'batch2', 'int8', 'onnx',
    'jit', 'compile', 'baseline-repeat')
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$bench = Join-Path $root 'worker/out/bench'
if ($Run -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Identificador de rodada inválido' }
$dir = Join-Path $bench $Run
$null = New-Item -ItemType Directory -Force -Path $dir
$variants = @{
  baseline = @('--save-reference')
  'baseline-repeat' = @()
  overlap1 = @('--overlap', '1')
  threads10 = @('--threads', '10')
  threads8 = @('--threads', '8')
  threads6 = @('--threads', '6')
  interop1 = @('--interop', '1')
  'omp-mkl' = @()
  'half-chunk' = @('--chunk', '294400')
  'cpu-loop' = @('--cpu-loop')
  batch2 = @('--cpu-loop', '--batch', '2')
  int8 = @('--backend', 'int8')
  jit = @('--backend', 'jit')
  compile = @('--backend', 'compile')
  onnx = @('--backend', 'onnx')
}

function Test-PlaybackActive {
  $entries = @(docker ps --no-trunc --format '{{.ID}}|{{.Command}}|{{.Names}}')
  if ($LASTEXITCODE) { throw 'Falha ao consultar o Docker' }
  foreach ($entry in $entries) {
    $id, $cmd, $name = $entry -split '\|', 3
    if ($cmd -match '\bworker\.py\b') { return $true }
    if ($cmd -match 'local_listener\.py' -or $name -eq 'meu-repertorio-worker-local') {
      $processes = @(docker top $id -eo pid,args)
      if ($LASTEXITCODE) { throw 'Falha ao consultar os processos do listener' }
      if ($processes -match '\bworker\.py\b') { return $true }
    }
  }
  return $false
}

foreach ($case in $Cases) {
  if (-not $variants.ContainsKey($case)) { throw "Caso desconhecido: $case" }
  $out = Join-Path $dir $case
  if (Test-Path (Join-Path $out 'profile.json')) { continue }
  $null = New-Item -ItemType Directory -Force -Path $out
  $argsDocker = @('run', '--detach', '--network', 'none', '--memory', '10g', '--memory-swap', '10g',
    '--name', 'meu-repertorio-roformer-benchmark', '--entrypoint', 'python',
    '-e', 'STEMS_MODEL=bs-roformer-sw', '-e', "OUT_DIR=/out/$case",
    '-v', 'meu-repertorio-roformer:/models/roformer:ro', '-v', "${root}/public/samples:/samples:ro",
    '-v', "${PSScriptRoot}/roformer_cpu.py:/app/roformer_cpu.py:ro", '-v', "${dir}:/out")
  if ($case -eq 'omp-mkl') {
    $argsDocker += @('-e', 'OMP_NUM_THREADS=12', '-e', 'MKL_NUM_THREADS=12')
  }
  if ($case -eq 'onnx') {
    $onnx = Join-Path $bench 'bs_roformer_sw_6stem_fp32.onnx'
    if ((Get-FileHash $onnx).Hash -ne '224f5f54a7ff9ff0e487aabca0a365d94513d51a6cdb7778152f2371716f2b68') {
      throw 'SHA-256 inesperado para o export ONNX FP32'
    }
    $argsDocker += @('-v', "${onnx}:/out/bs_roformer_sw_6stem_fp32.onnx:ro")
  }
  $argsDocker += @('meu-repertorio-worker', 'roformer_cpu.py') + $variants[$case]
  do {
    $retry = $false
    if (Test-PlaybackActive) {
      Write-Host "[$(Get-Date -Format T)] Aguardando o término do playback antes de $case"
      do { Start-Sleep -Seconds 10 } while (Test-PlaybackActive)
    }
    $id = docker @argsDocker
    if ($LASTEXITCODE) { throw "Falha ao iniciar $case" }
    Write-Host "[$(Get-Date -Format T)] $case"
    try {
      do {
        Start-Sleep -Seconds 2
        if (Test-PlaybackActive) {
          # Um novo upload tem prioridade. Descartar a medição contaminada e repetir.
          $null = docker kill $id
          $retry = $true
          break
        }
        $running = docker inspect --format '{{.State.Running}}' $id
        if ($LASTEXITCODE) { throw "Falha ao consultar $case" }
      } while ($running -eq 'true')
      # No Windows PowerShell, avisos da biblioteca em stderr viram NativeCommandError.
      $ErrorActionPreference = 'Continue'
      docker logs $id *> (Join-Path $out 'run.log')
      $ErrorActionPreference = 'Stop'
      $state = docker inspect --format '{{json .State}}' $id
      $state | Set-Content -Encoding utf8 (Join-Path $out 'state.json')
      Write-Host "[$(Get-Date -Format T)] $case exit=$(($state | ConvertFrom-Json).ExitCode)"
    } finally {
      $null = docker rm --force $id
    }
    if ($case -eq 'baseline' -and -not $retry -and -not (Test-Path (Join-Path $out 'profile.json'))) {
      throw 'Referência falhou. Ver baseline/run.log'
    }
  } while ($retry)
}
