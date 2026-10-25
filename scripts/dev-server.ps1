# 启动本地开发服务器
# 用法：.\scripts\dev-server.ps1 [port]

param(
  [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $PSCommandPath
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  SubTrack Dev Server" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Root: $ProjectRoot"
Write-Host "  URL:  http://localhost:$Port/"
Write-Host ""
Write-Host "  按 Ctrl+C 停止" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
  & python -m http.server $Port
} else {
  Write-Host "[ERROR] 需要安装 Python 或 Node.js" -ForegroundColor Red
  exit 1
}
