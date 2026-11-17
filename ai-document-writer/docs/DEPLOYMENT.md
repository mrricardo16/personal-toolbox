# AI 文档助手 — 构建与部署

## 1. Windows 便携包（默认交付）

构建机需要 .NET 10 SDK、Node.js 22、PowerShell 5.1+，并能访问 npm 和 NuGet。

在本项目目录执行下面的命令：

    .\scripts\build.bat

也可以在 PowerShell 中运行：

    .\scripts\build.ps1 -Target win-x64

脚本会安装前端依赖、提取旧版 Prompt 规则、构建 Vue 前端、复制原版 legacy.html、执行自包含 .NET 发布，并在 dist 下生成 ZIP。

目标电脑解压 ZIP 后双击 AiDocumentWriter.exe。应用监听 127.0.0.1 的随机端口并尝试自动打开浏览器。目标电脑无需 Node.js、.NET SDK/Runtime 或 Microsoft Word，但需要现代浏览器和访问 DeepSeek 的网络。

首次使用可在网页中输入 Key 后选择“保存至本机”，也可以直接编辑 config/appsettings.local.json 的 AiProvider.ApiKey。不要把带真实 Key 的配置文件重新分发。

网页持久化的 Key 位于当前系统用户应用数据目录，使用 ASP.NET Core Data Protection。保护密钥环也位于该用户目录；本机制不抵御控制系统账户或拥有管理员权限的攻击。

## 2. 源码开发运行

需要 .NET 10 SDK、Node.js 22。

终端 A（项目根目录）：

    $env:AIWRITER_Hosting__Mode = "Server"
    dotnet run --project .\backend\AiDocumentWriter --urls http://127.0.0.1:5080

终端 B：

    cd frontend
    npm install
    npm run dev

访问 Vite 提示的前端地址（通常为 http://localhost:5173）。

当前仓库没有提交 package-lock.json；首次 npm install 会生成锁文件。正式稳定发布前应固定并提交该文件。

## 3. 服务器网页部署

构建 Vue 前端并复制至后端 wwwroot，使用 dotnet publish -r linux-x64 --self-contained true 发布 Linux 服务端（Windows 服务器用 win-x64）。将 Hosting.Mode 设置为 Server，使用 ASPNETCORE_URLS 设置监听地址。

通过 Nginx/IIS 等反向代理配置 HTTPS 与访问认证，仅向可信用户开放。当前没有应用内用户登录、租户隔离或 API 配额控制，不能匿名暴露公网。

Server 模式禁用通过页面持久化全局 API Key。服务器 Key 应通过受限配置文件或环境变量注入；也可以通过网页临时提供当前请求的 Key（必须通过 HTTPS）。环境变量示例：AIWRITER_AiProvider__ApiKey。

## 4. 安全与限制

- 原始 DOCX 在请求内存中解析，不持久化。最多 15 个，单个 8MB，合计 60MB（支持调整配置）。
- 当前读取正文与表格，不包含 OCR、图片识别及复杂排版复刻。
- 当前单次模型请求上限 100000 字符；多月总结分段抽取、冲突确认和 Word 模板复用在 P2/P3 开发。
- 原版入口保留在 /legacy.html；原版仍直接从浏览器访问 DeepSeek API。
- 生产部署必须在代理层加入身份认证、HTTPS、上传限制及速率限制。
