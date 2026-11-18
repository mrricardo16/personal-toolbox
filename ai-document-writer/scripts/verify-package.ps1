param(
  [string]$Target = 'win-x64',
  [string]$Version = '0.3.0',
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
foreach ($file in @('wwwroot/index.html','wwwroot/legacy.html','appsettings.json','config/appsettings.local.json','README.md','skills/draft-summary/SKILL.md','skills/revise-targeted/SKILL.md')) {
  if (-not (Test-Path (Join-Path $temp $file))) { throw "压缩包缺失：$file" }
}
if ($Target.StartsWith('win')) {
  $exe = Join-Path $temp 'AiDocumentWriter.exe'
  if (-not (Test-Path $exe)) { throw '压缩包缺失 AiDocumentWriter.exe' }
  if ($SmokeTest) {
    # The smoke test exercises key persistence. Isolate both the protected key and its key ring.
    $testData = Join-Path $temp 'isolated-local-data'
    $log = Join-Path $temp 'smoke.log'
    $process = Start-Process -FilePath $exe -PassThru -RedirectStandardOutput $log -WindowStyle Hidden -Environment @{
      AIWRITER_Hosting__OpenBrowser = 'false'
      AIWRITER_LOCAL_DATA_DIRECTORY = $testData
    }
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
      $catalog = Invoke-RestMethod -Uri "$address/api/skills" -TimeoutSec 5
      if ($catalog.skills.Count -ne 7) { throw 'Skill 目录加载异常' }
      # Browser-origin isolation on the desktop loopback listener.
      $http = [System.Net.Http.HttpClient]::new()
      try {
        $hostRequest = [System.Net.Http.HttpRequestMessage]::new(
          [System.Net.Http.HttpMethod]::Get, "$address/api/health")
        $hostRequest.Headers.Host = 'untrusted.example'
        $hostResponse = $http.SendAsync($hostRequest).GetAwaiter().GetResult()
        try {
          if ([int]$hostResponse.StatusCode -ne 403) { throw '恶意 Host 未被拦截' }
        }
        finally { $hostResponse.Dispose(); $hostRequest.Dispose() }
        $originRequest = [System.Net.Http.HttpRequestMessage]::new(
          [System.Net.Http.HttpMethod]::Get, "$address/api/health")
        $originRequest.Headers.TryAddWithoutValidation('Origin', 'http://untrusted.example') | Out-Null
        $originResponse = $http.SendAsync($originRequest).GetAwaiter().GetResult()
        try {
          if ([int]$originResponse.StatusCode -ne 403) { throw '跨站 Origin 未被拦截' }
        }
        finally { $originResponse.Dispose(); $originRequest.Dispose() }
      }
      finally { $http.Dispose() }

      $settings = Invoke-RestMethod -Uri "$address/api/settings/status" -TimeoutSec 5
      if ($null -eq $settings.serverKeyConfigured) { throw '配置状态 API 响应无效' }
      if ($settings.savedKeyConfigured -or !(Test-Path -LiteralPath $testData -PathType Container)) { throw '测试数据目录未隔离' }
      $writerHeaders = @{ 'X-Writer-Client' = 'ai-document-writer' }
      $testPayload = '{"apiKey":"CI-test-placeholder-do-not-use"}'
      Invoke-RestMethod -Uri "$address/api/settings/key" -Method Post -Headers $writerHeaders -ContentType 'application/json' -Body $testPayload -TimeoutSec 5 | Out-Null
      $savedStatus = Invoke-RestMethod -Uri "$address/api/settings/status" -TimeoutSec 5
      if (-not $savedStatus.savedKeyConfigured -or !(Test-Path -LiteralPath (Join-Path $testData 'apikey.protected')) -or !(Test-Path -LiteralPath (Join-Path $testData 'keyring'))) { throw '隔离目录 API Key 持久化检查失败' }
      Invoke-RestMethod -Uri "$address/api/settings/key" -Method Delete -Headers $writerHeaders -TimeoutSec 5 | Out-Null
      $clearedStatus = Invoke-RestMethod -Uri "$address/api/settings/status" -TimeoutSec 5
      if ($clearedStatus.savedKeyConfigured) { throw '本机 API Key 清理检查失败' }
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
    }
  }
}
Write-Host "压缩包结构检查通过：$archive"
