[CmdletBinding()]
param(
  [string]$ConfigPath = "scripts/unit-portraits/unit-portrait-config.json",
  [string]$SourceDir = "pics/真",
  [string]$OutputRoot = "pics/processed",
  [int]$AlphaThreshold = 16,
  [int]$HorizontalPadding = 24,
  [int]$TopPadding = 24,
  [int]$BottomPadding = 16
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Drawing.Common

function Get-AbsolutePath {
  param([string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }

  return [System.IO.Path]::GetFullPath((Join-Path -Path (Get-Location) -ChildPath $Path))
}

function Get-AlphaBounds {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [System.Drawing.Rectangle]$CropRect,
    [int]$Threshold
  )

  $minX = $CropRect.Right
  $minY = $CropRect.Bottom
  $maxX = -1
  $maxY = -1

  for ($y = $CropRect.Top; $y -lt $CropRect.Bottom; $y++) {
    for ($x = $CropRect.Left; $x -lt $CropRect.Right; $x++) {
      if ($Bitmap.GetPixel($x, $y).A -gt $Threshold) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  if ($maxX -lt 0 -or $maxY -lt 0) {
    throw "No visible pixels detected inside crop rect $CropRect."
  }

  return [System.Drawing.Rectangle]::FromLTRB($minX, $minY, $maxX + 1, $maxY + 1)
}

function New-DestinationRect {
  param(
    [System.Drawing.Rectangle]$SourceRect,
    [int]$CanvasSize,
    [double]$Scale,
    [int]$OffsetX,
    [int]$OffsetY,
    [int]$HorizontalPadding,
    [int]$TopPadding,
    [int]$BottomPadding
  )

  $availableWidth = [double]($CanvasSize - ($HorizontalPadding * 2))
  $availableHeight = [double]($CanvasSize - $TopPadding - $BottomPadding)

  if ($availableWidth -le 0 -or $availableHeight -le 0) {
    throw "Canvas padding leaves no drawable area."
  }

  $widthScale = $availableWidth / [double]$SourceRect.Width
  $heightScale = $availableHeight / [double]$SourceRect.Height
  $fitScale = [Math]::Min($widthScale, $heightScale) * $Scale

  $destWidth = [Math]::Max(1, [int][Math]::Round($SourceRect.Width * $fitScale))
  $destHeight = [Math]::Max(1, [int][Math]::Round($SourceRect.Height * $fitScale))
  $destX = [int][Math]::Round((($CanvasSize - $destWidth) / 2.0) + $OffsetX)
  $destY = [int][Math]::Round(($CanvasSize - $BottomPadding - $destHeight) + $OffsetY)

  return [System.Drawing.Rectangle]::new($destX, $destY, $destWidth, $destHeight)
}

function Export-Portrait {
  param(
    [System.Drawing.Bitmap]$SourceBitmap,
    [object]$SideConfig,
    [string]$DestinationPath,
    [int]$CanvasSize,
    [int]$Threshold,
    [int]$HorizontalPadding,
    [int]$TopPadding,
    [int]$BottomPadding
  )

  $crop = $SideConfig.crop
  $cropRect = [System.Drawing.Rectangle]::new(
    [int]$crop.x,
    [int]$crop.y,
    [int]$crop.width,
    [int]$crop.height
  )

  $visibleRect = Get-AlphaBounds -Bitmap $SourceBitmap -CropRect $cropRect -Threshold $Threshold
  $destinationRect = New-DestinationRect `
    -SourceRect $visibleRect `
    -CanvasSize $CanvasSize `
    -Scale ([double]$SideConfig.scale) `
    -OffsetX ([int]$SideConfig.offsetX) `
    -OffsetY ([int]$SideConfig.offsetY) `
    -HorizontalPadding $HorizontalPadding `
    -TopPadding $TopPadding `
    -BottomPadding $BottomPadding

  $canvas = New-Object System.Drawing.Bitmap $CanvasSize, $CanvasSize, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage($SourceBitmap, $destinationRect, $visibleRect, [System.Drawing.GraphicsUnit]::Pixel)

    $destinationDirectory = Split-Path -Parent $DestinationPath
    if (-not (Test-Path -LiteralPath $destinationDirectory)) {
      New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    }

    $canvas.Save((Get-AbsolutePath -Path $DestinationPath), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $canvas.Dispose()
  }
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "Config not found: $ConfigPath"
}

$sourceRoot = Get-AbsolutePath -Path $SourceDir
if (-not (Test-Path -LiteralPath $sourceRoot)) {
  throw "SourceDir not found: $SourceDir"
}

$config = Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json
$canvasSize = [int]$config.canvasSize

foreach ($unit in $config.units) {
  $sourcePath = Join-Path -Path $sourceRoot -ChildPath $unit.source
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Source asset missing: $sourcePath"
  }

  $bitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)
  try {
    Export-Portrait `
      -SourceBitmap $bitmap `
      -SideConfig $unit.front `
      -DestinationPath (Join-Path -Path $OutputRoot -ChildPath ("front/{0}.png" -f $unit.name)) `
      -CanvasSize $canvasSize `
      -Threshold $AlphaThreshold `
      -HorizontalPadding $HorizontalPadding `
      -TopPadding $TopPadding `
      -BottomPadding $BottomPadding

    Export-Portrait `
      -SourceBitmap $bitmap `
      -SideConfig $unit.back `
      -DestinationPath (Join-Path -Path $OutputRoot -ChildPath ("back/{0}.png" -f $unit.name)) `
      -CanvasSize $canvasSize `
      -Threshold $AlphaThreshold `
      -HorizontalPadding $HorizontalPadding `
      -TopPadding $TopPadding `
      -BottomPadding $BottomPadding
  } finally {
    $bitmap.Dispose()
  }
}

Write-Output ("Exported {0} unit portrait pairs to {1}" -f $config.units.Count, (Get-AbsolutePath -Path $OutputRoot))
