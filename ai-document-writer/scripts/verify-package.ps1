param(
  [string]$Target = 'win-x64',
  [string]$Version = '0.1.0',
  [switch]$SmokeTest
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$archive = Join-Path $root ("dist/AI-Document-Writer-v$Version-$Target.zip")
if (-not (Test-Path $archive)) { throw "压缩包不存在：$archive" }
$temp = Join-Path $root 'dist/package-check'
if (Test-Path $temp) { Remove-Item -Recurse -Force $temp }
Expand-Archive -Path $archive -DestinationPath $temp
foreach ($file in @('wwwroot/index.html','wwwroot/legacy.html','appsettings.json','config/appsettings.local.json','README.md')) {
  if (-not (Test-Path (Join-Path $temp $file))) { throw "压缩包缺失：$file" }
}
if ($Target.StartsWith('win')) {
  $exe = Join-Path $temp 'AiDocumentWriter.exe'
  if (-not (Test-Path $exe)) { throw '压缩包缺失 AiDocumentWriter.exe' }
  if ($SmokeTest) {
    $env:AIWRITER_Hosting__OpenBrowser = 'false'
    $log = Join-Path $temp 'smoke.log'
    $process = Start-Process -FilePath $exe -PassThru -RedirectStandardOutput $log
    try {
      $address = $null
      for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Path $log) {
          $content = Get-Content $log -Raw -ErrorAction SilentlyContinue
          if ($content -match 'http://127\.0\.0\.1:\d+') {
            $address = $Matches[0]
            break
          }
        }
        if ($process.HasExited) { throw '进程提前退出' }
      }
      if (-not $address) { throw '启动后未发现监听地址' }
      $health = Invoke-RestMethod -Uri "$address/api/health" -TimeoutSec 5
      if ($health.status -ne 'ok') { throw '健康检查失败' }

      $settings = Invoke-RestMethod -Uri "$address/api/settings/status" -TimeoutSec 5
      if ($null -eq $settings.serverKeyConfigured) { throw '配置状态 API 响应无效' }
      $boundary = '----DocxSmokeTest' + [Guid]::NewGuid().ToString('N')
      $crlf = [string][char]13 + [char]10
      $formBody = @(
        "--$boundary",
        'Content-Disposition: form-data; name="title"',
        '',
        'CI 检查',
        "--$boundary",
        'Content-Disposition: form-data; name="content"',
        '',
        '# 一、测试',
        '这是测试正文。',
        "--$boundary--",
        ''
      ) -join $crlf
      $wordOut = Join-Path $temp 'word-smoke.docx'
      Invoke-WebRequest -Method Post -Uri "$address/api/documents/export" -TimeoutSec 20 -UseBasicParsing -Headers @{ 'X-Writer-Client' = 'ai-document-writer' } -ContentType "multipart/form-data; boundary=$boundary" -Body ([System.Text.Encoding]::UTF8.GetBytes($formBody)) -OutFile $wordOut
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      $archiveDoc = [System.IO.Compression.ZipFile]::OpenRead($wordOut)
      try {
        $entry = $archiveDoc.GetEntry('word/document.xml')
        if ($null -eq $entry) { throw '导出的 DOCX 缺少主文档 XML' }
        $reader = [System.IO.StreamReader]::new($entry.Open(), [System.Text.Encoding]::UTF8)
        try {
          $documentXml = $reader.ReadToEnd()
          if (-not $documentXml.Contains('这是测试正文')) { throw '导出的 Word 正文不正确' }
        }
        finally { $reader.Dispose() }
      }
      finally { $archiveDoc.Dispose() }
      Write-Host "冒烟测试通过：$address，Word 导出正常"

    }
    finally {
      if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force }
      Remove-Item Env:AIWRITER_Hosting__OpenBrowser -ErrorAction SilentlyContinue
    }
  }
}
Write-Host "压缩包结构检查通过：$archive"
