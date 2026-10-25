Add-Type -AssemblyName System.Drawing

function New-IconPng {
    param([int]$Size, [string]$Out)
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # 圆角矩形背景
    $rect = New-Object System.Drawing.Rectangle 0, 0, $Size, $Size
    $radius = [int]($Size * 0.22)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($rect.X, $rect.Y, $radius, $radius, 180, 90)
    $path.AddArc($rect.Right - $radius, $rect.Y, $radius, $radius, 270, 90)
    $path.AddArc($rect.Right - $radius, $rect.Bottom - $radius, $radius, $radius, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $radius, $radius, $radius, 90, 90)
    $path.CloseFigure()
    $rectBrush = New-Object System.Drawing.RectangleF 0, 0, $Size, $Size
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rectBrush, [System.Drawing.Color]::FromArgb(255, 30, 215, 96), [System.Drawing.Color]::FromArgb(255, 15, 168, 71), 90)
    $g.FillPath($brush, $path)

    # 中心 ¥ 符号
    $fontSize = [int]($Size * 0.5)
    $font = New-Object System.Drawing.Font "Segoe UI", $fontSize, ([System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $textRect = New-Object System.Drawing.RectangleF 0, ([int]($Size * 0.05)), $Size, ([int]($Size * 0.9))
    $g.DrawString("¥", $font, $textBrush, $textRect, $sf)

    $g.Dispose()
    $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated: $Out"
}

$here = $PSScriptRoot
$iconsDir = Join-Path (Split-Path $here -Parent) "assets\icons"
New-IconPng -Size 192 -Out (Join-Path $iconsDir "icon-192.png")
New-IconPng -Size 512 -Out (Join-Path $iconsDir "icon-512.png")
