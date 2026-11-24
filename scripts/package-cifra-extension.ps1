$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

$repository = Split-Path -Parent $PSScriptRoot
$extension = Join-Path $repository 'browser-extension'
$manifest = Get-Content -LiteralPath (Join-Path $extension 'manifest.json') -Raw -Encoding utf8 | ConvertFrom-Json
$manifest.PSObject.Properties.Remove('key')
$manifest.externally_connectable.matches = @($manifest.externally_connectable.matches | Where-Object { $_ -like 'https://*' })

$outputDirectory = Join-Path $repository 'build'
[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
$package = Join-Path $outputDirectory "meu-repertorio-cifra-$($manifest.version).zip"
$stream = [System.IO.File]::Create($package)
try {
  $zip = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create, $true)
  try {
    $entry = $zip.CreateEntry('manifest.json')
    $writer = [System.IO.StreamWriter]::new($entry.Open(), [System.Text.UTF8Encoding]::new($false))
    try {
      $writer.Write((ConvertTo-Json -InputObject $manifest -Depth 10))
    } finally {
      $writer.Dispose()
    }

    $files = @($manifest.background.service_worker) + @($manifest.icons.PSObject.Properties.Value)
    foreach ($file in $files) {
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $extension $file), $file) | Out-Null
    }
  } finally {
    $zip.Dispose()
  }
} finally {
  $stream.Dispose()
}

Write-Output $package
