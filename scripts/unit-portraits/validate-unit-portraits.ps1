[CmdletBinding()]
param(
  [string]$ConfigPath = "scripts/unit-portraits/unit-portrait-config.json",
  [string]$OutputRoot = "pics/processed"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function Add-ValidationError {
  param(
    [System.Collections.Generic.List[string]]$Errors,
    [string]$Message
  )

  $Errors.Add($Message)
}

function Assert-OutputImage {
  param(
    [string]$Path,
    [int]$ExpectedSize,
    [System.Collections.Generic.List[string]]$Errors
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    Add-ValidationError -Errors $Errors -Message "Missing output: $Path"
    return
  }

  $image = [System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath $Path))
  try {
    if ($image.Width -ne $ExpectedSize -or $image.Height -ne $ExpectedSize) {
      Add-ValidationError -Errors $Errors -Message "Invalid size for $Path. Expected ${ExpectedSize}x${ExpectedSize}, got $($image.Width)x$($image.Height)"
    }

    $hasVisiblePixel = $false
    for ($y = 0; $y -lt $image.Height -and -not $hasVisiblePixel; $y++) {
      for ($x = 0; $x -lt $image.Width; $x++) {
        if ($image.GetPixel($x, $y).A -gt 0) {
          $hasVisiblePixel = $true
          break
        }
      }
    }

    if (-not $hasVisiblePixel) {
      Add-ValidationError -Errors $Errors -Message "Image is fully transparent: $Path"
    }
  } finally {
    $image.Dispose()
  }
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "Config not found: $ConfigPath"
}

$config = Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json

if (-not $config.canvasSize) {
  throw "Config must include canvasSize."
}

if (-not $config.units -or $config.units.Count -eq 0) {
  throw "Config must include at least one unit entry."
}

$errors = New-Object 'System.Collections.Generic.List[string]'
$seenNames = New-Object 'System.Collections.Generic.HashSet[string]'

foreach ($unit in $config.units) {
  if (-not $unit.name) {
    Add-ValidationError -Errors $errors -Message "Unit entry is missing a name."
    continue
  }

  if (-not $seenNames.Add([string]$unit.name)) {
    Add-ValidationError -Errors $errors -Message "Duplicate unit name in config: $($unit.name)"
  }

  $frontPath = Join-Path -Path $OutputRoot -ChildPath ("front/{0}.png" -f $unit.name)
  $backPath = Join-Path -Path $OutputRoot -ChildPath ("back/{0}.png" -f $unit.name)

  Assert-OutputImage -Path $frontPath -ExpectedSize ([int]$config.canvasSize) -Errors $errors
  Assert-OutputImage -Path $backPath -ExpectedSize ([int]$config.canvasSize) -Errors $errors
}

if ($errors.Count -gt 0) {
  $errors | ForEach-Object { Write-Error $_ }
  exit 1
}

Write-Output ("Validated {0} unit portrait pairs at {1}x{1}." -f $config.units.Count, $config.canvasSize)
