Add-Type -AssemblyName System.Drawing
function New-IconPng {
    param([int]$Size, [string]$Out)
    $s = $Size / 512.0
    function p([double]$v) { return [int][Math]::Round($v * $s) }
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    # 深色圆角底（rx = 112/512）
    $r = p 112
    $d = 2 * $r
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc($Size - $d, 0, $d, $d, 270, 90)
    $path.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
    $path.AddArc(0, $Size - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 18, 18, 18))
    $g.FillPath($bg, $path)
    # 白色几何（线宽 36/512，圆头）
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), (p 36)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    # 日历框（x132 y148 w248 h228 rx36）
    $cr = p 36
    $cx = p 132; $cy = p 148; $cw = p 248; $ch = p 228
    $cd = 2 * $cr
    $cpath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $cpath.AddArc($cx, $cy, $cd, $cd, 180, 90)
    $cpath.AddArc($cx + $cw - $cd, $cy, $cd, $cd, 270, 90)
    $cpath.AddArc($cx + $cw - $cd, $cy + $ch - $cd, $cd, $cd, 0, 90)
    $cpath.AddArc($cx, $cy + $ch - $cd, $cd, $cd, 90, 90)
    $cpath.CloseFigure()
    $g.DrawPath($pen, $cpath)
    # 分隔线
    $g.DrawLine($pen, (p 132), (p 232), (p 380), (p 232))
    # 顶部两挂耳
    $g.DrawLine($pen, (p 204), (p 118), (p 204), (p 172))
    $g.DrawLine($pen, (p 308), (p 118), (p 308), (p 172))
    # 品牌绿点（r30 @ 256,316）
    $dot = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 29, 185, 84))
    $dr = p 30
    $g.FillEllipse($dot, (p 256) - $dr, (p 316) - $dr, 2 * $dr, 2 * $dr)
    $g.Dispose()
    $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated: $Out"
}
$here = $PSScriptRoot
$iconsDir = Join-Path (Split-Path $here -Parent) "assets\icons"
New-IconPng -Size 192 -Out (Join-Path $iconsDir "icon-192.png")
New-IconPng -Size 512 -Out (Join-Path $iconsDir "icon-512.png")
