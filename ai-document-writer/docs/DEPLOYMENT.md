# AI 文档助手 V2 — 发布与部署

## A. 一键 Windows 便携包

构建机要求：
- Windows + PowerShell 5.1 或更高
- .NET 10 SDK
- Node.js 22 及 npm
- 能访问 npm 与 NuGet

在 ai-document-writer 目录执行：

    .\scripts\build.bat

或 PowerShell：

    .\scripts\build.ps1 -Target win-x64

脚本自动安装前端依赖、从原版提取 Prompt、构建 Vue、复制原版为 legacy.html、执行自包含 .NET 发布，并生成 dist/AI-Document-Writer-v0.1.0-win-x64.zip。

分发这个 ZIP 即可。目标 Windows x64 电脑解压后双击 AiDocumentWriter.exe，无需安装 .NET、Node、Python 或 Word；需现代浏览器和能连接 DeepSeek API 的网络。

首次使用：
1. 程序自动开启本地服务并尝试打开浏览器
2. 选择后端 JSON、本机持久化或临时输入 Key
3. 选择常规写作/年度总结模式，填写写作要求并上传 DOCX
4. 若使用年度总结，先分析材料、核查事项与冲突，再生成结果
5. 修改文稿后，可下载 Markdown、TXT 或 Word DOCX

可运行：

    .\scripts\verify-package.ps1 -SmokeTest

验证打包内容及程序启动情况。GitHub Actions 自动执行对应检查，并提供 ZIP 下载。

## B. API Key 配置

默认配置在 backend/AiDocumentWriter/appsettings.json，分发包可覆盖 config/appsettings.local.json；其中 AiProvider.ApiKey 可设置个人 Key。**不要把填过真实 Key 的配置文件重新上传 GitHub 或发送给别人。**

桌面模式允许通过页面保存 Key 至用户应用数据目录，ASP.NET Core Data Protection 在 Windows 上使用系统数据保护机制；此方式不能对抗用户账户被控制。服务器模式禁用页面持久化 Key，建议使用环境变量 AIWRITER_AiProvider__ApiKey。

## C. 源码开发运行

在 ai-document-writer 根目录打开两个终端。

后端：

    $env:AIWRITER_Hosting__Mode = "Server"
    dotnet run --project .\backend\AiDocumentWriter --urls http://127.0.0.1:5080

前端：

    cd frontend
    npm install
    npm run dev

访问 Vite 输出的地址。原版仍可直接打开根目录 index.html。

## D. 服务器部署

Vue 构建产物由 ASP.NET Core 提供静态文件。将 Hosting.Mode 设置为 Server，并通过 ASPNETCORE_URLS 指定监听地址；可以使用 win-x64 或 linux-x64 自包含发布。

部署时必须在反向代理层加入 HTTPS、访问认证、上传大小/速率限制；本版本不提供多用户隔离和在线账户系统，**不得把模型付费接口暴露为匿名公网服务**。服务器上不需要 Node.js 或 .NET Runtime（使用自包含发布时）。

## E. 当前边界

- 上传至多 15 个 DOCX、每个 8MB、合计 60MB；每篇用于年度分析的文字上限 70000 字符
- 年度事实台账上限 250 项，单次模型写作限制输入 100000 字符，过长时需要拆分处理
- Word 排版复用以常见段落、表格、页面设置为目标；复杂浮动图文混排不保证
- 图片/OCR、PDF、Excel 与多人协作未实现
- 自动测试不等于真实 DeepSeek 输出与 Word/WPS 人工视觉验收
