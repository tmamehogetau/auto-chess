[CmdletBinding()]
param(
  [string]$ConfigPath = "scripts/unit-portraits/unit-portrait-config.json",
  [string]$OutputRoot = "pics/processed",
  [int]$TileSize = 256,
  [int]$Columns = 4,
  [int]$Padding = 24,
  [int]$LabelHeight = 40
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function Get-AbsolutePath {
  param([string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }

  return [System.IO.Path]::GetFullPath((Join-Path -Path (Get-Location) -ChildPath $Path))
}

function New-ReviewBitmap {
  param(
    [int]$Width,
    [int]$Height
  )

  $bitmap = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::FromArgb(255, 26, 28, 34))
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

  return @{
    Bitmap = $bitmap
    Graphics = $graphics
  }
}

function Save-ReviewBitmap {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [System.Drawing.Graphics]$Graphics,
    [string]$OutputPath
  )

  try {
    $directory = Split-Path -Parent $OutputPath
    if (-not (Test-Path -LiteralPath $directory)) {
      New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    $Bitmap.Save((Get-AbsolutePath -Path $OutputPath), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $Graphics.Dispose()
    $Bitmap.Dispose()
  }
}

function Draw-StatusBadge {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Status,
    [float]$X,
    [float]$Y
  )

  if ([string]::IsNullOrWhiteSpace($Status) -or $Status -eq "default") {
    return
  }

  $brush = if ($Status -eq "flagged") {
    New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 180, 70, 70))
  } else {
    New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 190, 150, 70))
  }
  $textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)

  try {
    $label = $Status.ToUpperInvariant()
    $size = $Graphics.MeasureString($label, $font)
    $rect = [System.Drawing.RectangleF]::new($X, $Y, ($size.Width + 16), ($size.Height + 6))
    $Graphics.FillRectangle($brush, $rect)
    $Graphics.DrawString($label, $font, $textBrush, $X + 8, $Y + 3)
  } finally {
    $brush.Dispose()
    $textBrush.Dispose()
    $font.Dispose()
  }
}

function Draw-SingleSheet {
  param(
    [System.Collections.IEnumerable]$Units,
    [string]$Direction,
    [string]$OutputPath,
    [int]$TileSize,
    [int]$Columns,
    [int]$Padding,
    [int]$LabelHeight,
    [string]$OutputRoot
  )

  $unitArray = @($Units)
  $rows = [Math]::Ceiling($unitArray.Count / [double]$Columns)
  $sheetWidth = ($Columns * ($TileSize + $Padding)) + $Padding
  $sheetHeight = ($rows * ($TileSize + $LabelHeight + $Padding)) + $Padding + 48

  $reviewSurface = New-ReviewBitmap -Width $sheetWidth -Height $sheetHeight
  $bitmap = $reviewSurface.Bitmap
  $graphics = $reviewSurface.Graphics

  $titleFont = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
  $labelFont = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Regular)
  $titleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $labelBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 224, 224, 230))
  $slotBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 48, 52, 61))

  try {
    $graphics.DrawString("{0} review sheet" -f $Direction, $titleFont, $titleBrush, $Padding, 8)

    for ($index = 0; $index -lt $unitArray.Count; $index++) {
      $unit = $unitArray[$index]
      $row = [Math]::Floor($index / $Columns)
      $column = $index % $Columns
      $x = $Padding + ($column * ($TileSize + $Padding))
      $y = $Padding + 48 + ($row * ($TileSize + $LabelHeight + $Padding))

      $graphics.FillRectangle($slotBrush, $x, $y, $TileSize, $TileSize)

      $imagePath = Join-Path -Path $OutputRoot -ChildPath ("{0}/{1}.png" -f $Direction, $unit.name)
      if (Test-Path -LiteralPath $imagePath) {
        $image = [System.Drawing.Bitmap]::FromFile((Get-AbsolutePath -Path $imagePath))
        try {
          $graphics.DrawImage($image, $x, $y, $TileSize, $TileSize)
        } finally {
          $image.Dispose()
        }
      }

      Draw-StatusBadge -Graphics $graphics -Status ([string]$unit.reviewStatus) -X ($x + 10) -Y ($y + 10)
      $graphics.DrawString([string]$unit.name, $labelFont, $labelBrush, $x, $y + $TileSize + 6)
    }
  } finally {
    $titleFont.Dispose()
    $labelFont.Dispose()
    $titleBrush.Dispose()
    $labelBrush.Dispose()
    $slotBrush.Dispose()
    Save-ReviewBitmap -Bitmap $bitmap -Graphics $graphics -OutputPath $OutputPath
  }
}

function Draw-FlaggedSheet {
  param(
    [System.Collections.IEnumerable]$Units,
    [string]$OutputPath,
    [int]$TileSize,
    [int]$Padding,
    [int]$LabelHeight,
    [string]$OutputRoot
  )

  $unitArray = @($Units)
  if ($unitArray.Count -eq 0) {
    if (Test-Path -LiteralPath $OutputPath) {
      Remove-Item -LiteralPath $OutputPath -Force
    }
    return
  }

  $rows = $unitArray.Count
  $sheetWidth = ($TileSize * 2) + ($Padding * 3)
  $sheetHeight = ($rows * ($TileSize + $LabelHeight + $Padding)) + $Padding + 48
  $reviewSurface = New-ReviewBitmap -Width $sheetWidth -Height $sheetHeight
  $bitmap = $reviewSurface.Bitmap
  $graphics = $reviewSurface.Graphics

  $titleFont = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
  $labelFont = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Regular)
  $titleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $labelBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 224, 224, 230))
  $slotBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 48, 52, 61))

  try {
    $graphics.DrawString("flagged candidates", $titleFont, $titleBrush, $Padding, 8)

    for ($index = 0; $index -lt $unitArray.Count; $index++) {
      $unit = $unitArray[$index]
      $y = $Padding + 48 + ($index * ($TileSize + $LabelHeight + $Padding))
      $frontX = $Padding
      $backX = $Padding + $TileSize + $Padding

      $graphics.FillRectangle($slotBrush, $frontX, $y, $TileSize, $TileSize)
      $graphics.FillRectangle($slotBrush, $backX, $y, $TileSize, $TileSize)

      foreach ($direction in @("front", "back")) {
        $slotX = if ($direction -eq "front") { $frontX } else { $backX }
        $imagePath = Join-Path -Path $OutputRoot -ChildPath ("{0}/{1}.png" -f $direction, $unit.name)
        if (Test-Path -LiteralPath $imagePath) {
          $image = [System.Drawing.Bitmap]::FromFile((Get-AbsolutePath -Path $imagePath))
          try {
            $graphics.DrawImage($image, $slotX, $y, $TileSize, $TileSize)
          } finally {
            $image.Dispose()
          }
        }
      }

      Draw-StatusBadge -Graphics $graphics -Status ([string]$unit.reviewStatus) -X ($frontX + 10) -Y ($y + 10)
      $graphics.DrawString([string]$unit.name, $labelFont, $labelBrush, $frontX, $y + $TileSize + 6)
    }
  } finally {
    $titleFont.Dispose()
    $labelFont.Dispose()
    $titleBrush.Dispose()
    $labelBrush.Dispose()
    $slotBrush.Dispose()
    Save-ReviewBitmap -Bitmap $bitmap -Graphics $graphics -OutputPath $OutputPath
  }
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "Config not found: $ConfigPath"
}

$config = Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json
$columnsToUse = if ($Columns -gt 0) { $Columns } else { [int]$config.reviewSheetColumns }
$reviewRoot = Join-Path -Path $OutputRoot -ChildPath "review"
$sortedUnits = @($config.units | Sort-Object name)
$flaggedUnits = @($sortedUnits | Where-Object { $_.reviewStatus -eq "flagged" })

Draw-SingleSheet `
  -Units $sortedUnits `
  -Direction "front" `
  -OutputPath (Join-Path -Path $reviewRoot -ChildPath "front-sheet.png") `
  -TileSize $TileSize `
  -Columns $columnsToUse `
  -Padding $Padding `
  -LabelHeight $LabelHeight `
  -OutputRoot $OutputRoot

Draw-SingleSheet `
  -Units $sortedUnits `
  -Direction "back" `
  -OutputPath (Join-Path -Path $reviewRoot -ChildPath "back-sheet.png") `
  -TileSize $TileSize `
  -Columns $columnsToUse `
  -Padding $Padding `
  -LabelHeight $LabelHeight `
  -OutputRoot $OutputRoot

Draw-FlaggedSheet `
  -Units $flaggedUnits `
  -OutputPath (Join-Path -Path $reviewRoot -ChildPath "flagged-candidates.png") `
  -TileSize $TileSize `
  -Padding $Padding `
  -LabelHeight $LabelHeight `
  -OutputRoot $OutputRoot

Write-Output ("Built review sheets for {0} units." -f $sortedUnits.Count)
