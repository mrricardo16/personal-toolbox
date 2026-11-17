param(
    [ValidateSet('win-x64', 'win-arm64', 'linux-x64')]
    [string]$Target = 'win-x64',
    [string]$Version = '0.2.0',
    [ValidateSet('Auto', 'Desktop', 'Server')]
    [string]$Mode = 'Auto'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$frontend = Join-Path $root 'frontend'
$backend = Join-Path $root 'backend/AiDocumentWriter'
$publish = Join-Path $root ('dist/staging/' + $Target)
$dist = Join-Path $root 'dist'
$zip = Join-Path $dist ("AI-Document-Writer-v$Version-$Target.zip")
$webroot = Join-Path $backend 'wwwroot'

function Require-Tool([string]$command, [string]$install) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "缺少构建工具 $command。请安装 $install，然后重新运行脚本。"
    }
}
Require-Tool 'dotnet' '.NET 10 SDK'
Require-Tool 'node' 'Node.js 22 LTS'
Require-Tool 'npm' 'Node.js 内附的 npm'

$backendSettings = (Get-Content (Join-Path $backend 'appsettings.json') -Raw | ConvertFrom-Json)
if (-not [string]::IsNullOrWhiteSpace($backendSettings.AiProvider.ApiKey)) {
    throw '拒绝打包：后端 appsettings.json 中包含 API Key。请移入本地 config/appsettings.local.json 或环境变量。'
}
New-Item -ItemType Directory -Force -Path $dist | Out-Null
if (Test-Path $publish) { Remove-Item -Recurse -Force $publish }
if (Test-Path $webroot) { Remove-Item -Recurse -Force $webroot }

Push-Location $frontend
try {
    if (Test-Path 'package-lock.json') {
        & npm ci --no-audit --no-fund
    } else {
        & npm install --no-audit --no-fund
    }
    if ($LASTEXITCODE -ne 0) { throw 'npm 依赖安装失败' }
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Vue 构建失败' }
}
finally { Pop-Location }

New-Item -ItemType Directory -Force -Path $webroot | Out-Null
Copy-Item -Path (Join-Path $frontend 'dist/*') -Destination $webroot -Recurse -Force
Copy-Item -Path (Join-Path $root 'index.html') -Destination (Join-Path $webroot 'legacy.html') -Force

$publishArgs = @('publish', (Join-Path $backend 'AiDocumentWriter.csproj'), '-c', 'Release',
    '-r', $Target, '--self-contained', 'true',
    '-p:PublishSingleFile=true', '-p:PublishTrimmed=false',
    '-p:IncludeNativeLibrariesForSelfExtract=true', '-o', $publish)
& dotnet @publishArgs
if ($LASTEXITCODE -ne 0) { throw '.NET 发布失败' }
New-Item -ItemType Directory -Force -Path (Join-Path $publish 'config') | Out-Null
$effectiveMode = if ($Mode -eq 'Auto') {
    if ($Target -eq 'linux-x64') { 'Server' } else { 'Desktop' }
} else { $Mode }
$config = Get-Content (Join-Path $root 'config/appsettings.local.example.json') -Raw | ConvertFrom-Json
$config.Hosting.Mode = $effectiveMode
$config.Hosting.OpenBrowser = ($effectiveMode -eq 'Desktop')
$configurationPath = Join-Path $publish 'config/appsettings.local.json'
[System.IO.File]::WriteAllText($configurationPath, ($config | ConvertTo-Json -Depth 10),
    [System.Text.UTF8Encoding]::new($false))
Copy-Item (Join-Path $root 'README.md') (Join-Path $publish 'README.md') -Force
Copy-Item (Join-Path $root 'docs/DEPLOYMENT.md') (Join-Path $publish 'DEPLOYMENT.md') -Force
if (-not (Test-Path (Join-Path $publish 'wwwroot/index.html'))) { throw '缺少前端资源，拒绝打包' }
if (Test-Path $zip) { Remove-Item -Force $zip }
Compress-Archive -Path (Join-Path $publish '*') -DestinationPath $zip -CompressionLevel Optimal
Write-Host "打包完成：$zip"
