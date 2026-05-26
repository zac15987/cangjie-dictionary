# Generate Cangjie Dictionary icons (16/48/128 px) — K2 "seal-classical" design.
# Source of truth: src/icons/icon.svg. This script reproduces the same layout
# in System.Drawing because Chrome MV3 manifest icons require PNG, not SVG.
# Windows-only (System.Drawing). Run from project root.

Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot "..\src\icons"

# K2 palette
$paper    = [System.Drawing.Color]::FromArgb(244, 232, 208)         # #f4e8d0
$ink      = [System.Drawing.Color]::FromArgb(26, 22, 20)            # #1a1614
$cinnabar = [System.Drawing.Color]::FromArgb(204, 162, 56, 41)      # #a23829 @ 80%
$grain    = [System.Drawing.Color]::FromArgb(56, 201, 180, 137)     # #c9b489 @ ~22%

$fontFamilies = @("Noto Serif TC", "Source Han Serif TC", "Songti TC",
                  "SimSun", "PMingLiU", "Microsoft JhengHei")

function New-RoundedRectPath {
    param([float]$X, [float]$Y, [float]$W, [float]$H, [float]$R)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $R * 2
    $path.AddArc($X, $Y, $d, $d, 180, 90)
    $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
    $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
    $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-SerifFont {
    param([float]$Size)
    foreach ($name in $fontFamilies) {
        try {
            return New-Object System.Drawing.Font($name, $Size,
                [System.Drawing.FontStyle]::Bold,
                [System.Drawing.GraphicsUnit]::Pixel)
        } catch {}
    }
    return New-Object System.Drawing.Font(
        [System.Drawing.FontFamily]::GenericSerif, $Size,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel)
}

function New-Icon {
    param([int]$Size, [string]$Path)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Transparent)

    # Scale factor from 128-unit design space to actual pixel size
    $s = $Size / 128.0

    # 1. Cream rounded-rect body (rx=22 in design space)
    $bgPath = New-RoundedRectPath -X 0 -Y 0 -W $Size -H $Size -R (22 * $s)
    $bgBrush = New-Object System.Drawing.SolidBrush($paper)
    $g.FillPath($bgBrush, $bgPath)
    $bgBrush.Dispose()
    $bgPath.Dispose()

    # 2. Paper-grain dots (only visible at 48+; sub-pixel at 16)
    if ($Size -ge 48) {
        $grainBrush = New-Object System.Drawing.SolidBrush($grain)
        $dots = @(
            @(32, 44, 0.7), @(88, 40, 0.7), @(46, 88, 0.7), @(82, 96, 0.6),
            @(22, 72, 0.6), @(102, 78, 0.6), @(60, 22, 0.5), @(70, 106, 0.5)
        )
        foreach ($d in $dots) {
            $cx = [float]$d[0] * $s
            $cy = [float]$d[1] * $s
            $r  = [float]$d[2] * $s
            $g.FillEllipse($grainBrush, $cx - $r, $cy - $r, $r * 2, $r * 2)
        }
        $grainBrush.Dispose()
    }

    # 3. Outer ink frame (rect 9..119 in design, rx=15, stroke 2.5)
    $outerW = [Math]::Max(2.5 * $s, 1.0)
    $outerPath = New-RoundedRectPath -X (9 * $s) -Y (9 * $s) -W (110 * $s) -H (110 * $s) -R (15 * $s)
    $outerPen = New-Object System.Drawing.Pen($ink, $outerW)
    $g.DrawPath($outerPen, $outerPath)
    $outerPen.Dispose()
    $outerPath.Dispose()

    # 4. Inner cinnabar frame (rect 14..114 in design, rx=11, stroke 1 @ 80%)
    if ($Size -ge 32) {
        $innerW = [Math]::Max(1.0 * $s, 0.6)
        $innerPath = New-RoundedRectPath -X (14 * $s) -Y (14 * $s) -W (100 * $s) -H (100 * $s) -R (11 * $s)
        $innerPen = New-Object System.Drawing.Pen($cinnabar, $innerW)
        $g.DrawPath($innerPen, $innerPath)
        $innerPen.Dispose()
        $innerPath.Dispose()
    }

    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    # 5. Corner cangjie radicals 人戈日口 (skip at 16px — would be sub-pixel)
    if ($Size -ge 48) {
        $cornerFont = New-SerifFont -Size (13 * $s)
        $cornerBrush = New-Object System.Drawing.SolidBrush($ink)
        $corners = @(
            @("人",  26,  26),
            @("戈", 102,  26),
            @("日",  26, 102),
            @("口", 102, 102)
        )
        $half = 12 * $s
        foreach ($c in $corners) {
            $cx = [float]$c[1] * $s
            $cy = [float]$c[2] * $s
            $rect = New-Object System.Drawing.RectangleF(($cx - $half), ($cy - $half), ($half * 2), ($half * 2))
            $g.DrawString($c[0], $cornerFont, $cornerBrush, $rect, $sf)
        }
        $cornerBrush.Dispose()
        $cornerFont.Dispose()
    }

    # 6. Center 倉 (large; ratio adjusted per size for legibility)
    $centerRatio = switch ($Size) {
        16  { 0.72 }
        48  { 0.62 }
        128 { 0.56 }
        default { 0.58 }
    }
    $centerFontSize = $Size * $centerRatio
    $centerFont = New-SerifFont -Size $centerFontSize
    $centerBrush = New-Object System.Drawing.SolidBrush($ink)
    # CJK glyph optical centering: slight upward nudge
    $rect = New-Object System.Drawing.RectangleF(0, -($Size * 0.04), $Size, $Size)
    $g.DrawString("倉", $centerFont, $centerBrush, $rect, $sf)
    $centerBrush.Dispose()
    $centerFont.Dispose()

    $sf.Dispose()
    $g.Dispose()

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "wrote $Path ($Size x $Size)"
}

New-Icon -Size 16  -Path (Join-Path $outDir "icon16.png")
New-Icon -Size 48  -Path (Join-Path $outDir "icon48.png")
New-Icon -Size 128 -Path (Join-Path $outDir "icon128.png")
