# Generate Cangjie Dictionary icons (16/48/128 px) with "倉" glyph on blue circle.
# Uses System.Drawing (Windows-only). Run from project root.

Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot "..\src\icons"
$blue = [System.Drawing.Color]::FromArgb(66, 133, 244)   # #4285f4 (matches popup icon)
$white = [System.Drawing.Color]::White

function New-Icon {
    param([int]$Size, [string]$Path)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    $g.Clear([System.Drawing.Color]::Transparent)

    # Blue filled circle, slight inset so anti-aliased edges don't get clipped
    $inset = if ($Size -le 16) { 0 } else { 1 }
    $brush = New-Object System.Drawing.SolidBrush($blue)
    $g.FillEllipse($brush, $inset, $inset, $Size - 2 * $inset, $Size - 2 * $inset)
    $brush.Dispose()

    # White "倉" centred. Smaller canvases need a larger ratio for legibility.
    $ratio = switch ($Size) {
        16  { 0.78 }
        48  { 0.68 }
        128 { 0.62 }
        default { 0.65 }
    }
    $fontSize = [int]($Size * $ratio)
    $fontFamilies = @("Microsoft JhengHei", "PMingLiU", "Microsoft YaHei", "SimSun")
    $font = $null
    foreach ($name in $fontFamilies) {
        try {
            $font = New-Object System.Drawing.Font($name, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
            break
        } catch {}
    }
    if (-not $font) {
        $font = New-Object System.Drawing.Font([System.Drawing.FontFamily]::GenericSansSerif, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    }

    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    $textBrush = New-Object System.Drawing.SolidBrush($white)
    # Slight vertical nudge — CJK glyphs sit a hair below visual centre
    $rect = New-Object System.Drawing.RectangleF(0, -($Size * 0.04), $Size, $Size)
    $g.DrawString("倉", $font, $textBrush, $rect, $sf)

    $textBrush.Dispose()
    $font.Dispose()
    $sf.Dispose()
    $g.Dispose()

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "wrote $Path ($Size x $Size)"
}

New-Icon -Size 16  -Path (Join-Path $outDir "icon16.png")
New-Icon -Size 48  -Path (Join-Path $outDir "icon48.png")
New-Icon -Size 128 -Path (Join-Path $outDir "icon128.png")
