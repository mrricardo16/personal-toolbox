# AI 文档助手｜打包、配置与部署

> 2026-11-17；发行包版本 **0.2.0**。支持 Windows 便携运行与 Linux/Windows Web 服务器运行。两者共用 Vue3 + ASP.NET Core 代码；仅托管前端静态文件不能使用模型调用与 DOCX 服务。

## 1. 下载已经构建的发行包

最近核实成功的 GitHub Actions：[AI Document Writer build #44027389276](https://github.com/mrricardo16/personal-toolbox/actions/runs/44027389276)。在页面 **Artifacts** 中：

| Artifact | 对应压缩包 | 用途 |
| --- | --- | --- |
| `ai-document-writer-win-x64` | `AI-Document-Writer-v0.2.0-win-x64.zip` | Windows x64 双击本机使用 |
| `ai-document-writer-linux-x64` | `AI-Document-Writer-v0.2.0-linux-x64.zip` | Linux x64 运行 Web 服务 |

GitHub 下载的是外层归档，**先解压外层，再解压脚本生成的发行 ZIP**。Artifacts 有过期时间，过期后可在 Actions 重新执行工作流或自行构建。

## 2. Windows 便携使用（目标用户无需开发环境）

1. 双重解压后，直接运行 `AiDocumentWriter.exe`。
2. 程序默认监听本机 `127.0.0.1` 的随机端口，并尝试打开默认浏览器。
3. 首次进入页面，选择 Key 来源：后端 JSON、本机已保存或页面临时输入。
4. 上传 DOCX 或填写事实材料，再选择常规写作或年度/多月总结。
5. 生成后可直接编辑结果，并下载 MD、TXT 或 DOCX。

目标电脑 **无需**安装 .NET Runtime、Node.js、Python 或 Microsoft Word；但需要兼容的 Windows x64、现代浏览器和模型 API 网络。关闭启动的控制台程序即可停止本地服务，不能只关闭浏览器标签页。

## 3. API Key 配置（不要把实际密钥提交到 GitHub）

### 3.1 发行包内 JSON

在发行包的 `config/appsettings.local.json` 中配置（以下为示例占位内容）：

```json
{
  "AiProvider": { "ApiKey": "" },
  "Hosting": { "Mode": "Desktop", "OpenBrowser": true }
}
```

填写 `AiProvider.ApiKey` 即可。Windows 服务器可将 `Hosting.Mode` 改为 `Server`，Linux 的默认发行包已采用 `Server` 模式。**不要将填过真实 Key 的配置复制到分发包、仓库或日志中。**

### 3.2 页面临时 Key / 本机保存

- 临时 Key：只用于对应请求，不通过页面持久化。
- 本机保存：仅 Desktop 模式可用；由后端使用 ASP.NET Core Data Protection 保护并写入当前用户应用数据目录。Windows 典型路径为 `%LOCALAPPDATA%\AiDocumentWriter\apikey.protected`，密钥环位于同一数据目录下的 `keyring`。
- 服务端：页面不能将所有用户的 Key 保存为一个共享文件；使用环境变量或受限配置文件提供服务器 Key。

本地 Key 和 Data Protection 密钥环均为敏感文件，**不要把有系统账户访问权限的攻击者视为隔离对象**。当前实现不提供专用密钥保管服务，也不能将 Data Protection 的使用等同于对密钥环的完整静态加密保证。建议检查文件权限和系统备份策略。

### 3.3 服务端环境变量

```powershell
$env:AIWRITER_AiProvider__ApiKey = "<在本机安全填写实际 Key>"
$env:AIWRITER_Hosting__Mode = "Server"
```

生产环境不要把真实 Key 写在脚本仓库或 GitHub Actions 输出里，使用环境变量注入或专用密钥管理方案。

## 4. 构建 Windows ZIP（开发电脑）

需要 Windows + PowerShell 5.1+、**.NET 10 SDK**、**Node.js 22/npm**、可访问 npm/NuGet 的网络。

在 `ai-document-writer/` 目录执行：

```powershell
.\scripts\build.bat
```

或：

```powershell
.\scripts\build.ps1 -Target win-x64
```

输出位置：`dist/AI-Document-Writer-v0.2.0-win-x64.zip`。

该脚本会安装前端依赖、从旧版提取文档技能规则、构建 Vue、复制旧 `index.html` 为 `legacy.html`、执行 .NET 自包含发布、写入不含 Key 的默认配置并压缩。若发现后端仓库配置中存在真实 Key，构建会拒绝继续。

校验压缩包结构并启动本地服务：

```powershell
.\scripts\verify-package.ps1 -Target win-x64 -SmokeTest
```

## 5. 构建和部署 Linux 服务器 ZIP

构建机要求 PowerShell、.NET 10 SDK 与 Node.js 22。进入项目根目录：

```powershell
.\scripts\build.ps1 -Target linux-x64 -Mode Server
```

生成：`dist/AI-Document-Writer-v0.2.0-linux-x64.zip`。在 Linux 服务器解压后，进入发布目录：

```bash
chmod +x ./AiDocumentWriter
ASPNETCORE_URLS=http://127.0.0.1:5080 ./AiDocumentWriter
```

可以先在服务器本机用 `curl http://127.0.0.1:5080/api/health` 验证返回状态。再配置 systemd 常驻服务，Nginx 负责 HTTPS、认证和访问速率限制。**不要在未配置认证的情况下直接将后端端口暴露公网**。

服务器版没有应用内账号系统、多租户隔离与 API 配额控制；不满足直接作为公共 SaaS 对外服务的条件。Linux 自包含包不要求服务器另装 .NET Runtime，但仍需要兼容系统环境。

## 6. 本地源码开发

使用两个终端，均从 `ai-document-writer/` 开始。后端：

```powershell
$env:AIWRITER_Hosting__Mode = "Server"
dotnet run --project .\backend\AiDocumentWriter --urls http://127.0.0.1:5080
```

前端（另一个终端）：

```powershell
cd frontend
npm install
npm run dev
```

访问 Vite 输出的本地地址。开发代理会将 `/api` 转发到 `http://127.0.0.1:5080`。首次安装依赖需要网络；构建机依赖与分发包运行时依赖应分开理解。

## 7. 安全要求与使用规模

- 桌面模式只监听回环地址，并校验 Host/Origin；服务器模式的公网边界由部署者负责。
- 最多 15 份 DOCX（单文件默认 8MB、合计 60MB）；单篇年度提取文本最多 150,000 字符，事实台账最多 250 项。
- 每次模型请求仍限制用户 Prompt 最多 100,000 字符；超大归并资料可能无法一次完成。
- 不支持 PDF/OCR/图片识别或任意复杂 Word 排版复刻。
- 上传的业务资料会由模型调用接口发送给配置的 AI 服务。请确认数据授权与合规要求。
- 发布到公网前必须增加 HTTPS、认证、限流、API 费用保护以及日志脱敏。**当前无公网真实部署验收**。

## 8. 参考资料

- [项目说明](../README.md)
- [进度与交付评估](STATUS.md)
- [自动和真实业务验收](ACCEPTANCE.md)
- [开发路线](ROADMAP.md)
