# AI 文档助手

V2 正在独立分支迭代。原版 index.html **保持不变**，仍然可以直接在浏览器打开使用。

## V2 当前已接入功能

- Vue3 + ASP.NET Core（.NET 10）基础架构，由后端调用 DeepSeek
- 从原版 index.html 自动提取 13 种写作技能及原始 Prompt 规则
- 事实约束、名词保护、初稿生成、二次审校（失败保留初稿）
- Markdown、TXT 导出，旧版入口 /legacy.html
- API Key：后端 JSON、网页临时输入、桌面本机持久化保存
- DOCX 多文件上传：解析正文和表格，每份文件指定事实或风格用途
- Windows 自包含 ZIP 构建脚本

当前尚未实现：年度总结结构化归并、关键冲突确认、Word 模板复用和 DOCX 导出。详见 docs/ROADMAP.md。

## 便携包构建

开发电脑安装 .NET 10 SDK、Node.js 22，然后在本项目目录执行：

    .\scripts\build.bat

生成 dist/AI-Document-Writer-v0.1.0-win-x64.zip，解压后双击 AiDocumentWriter.exe。目标电脑不用额外安装 .NET、Node.js 或 Word。

完整源码运行、配置和服务器部署说明参见 docs/DEPLOYMENT.md。

## API Key

默认后端配置文件为 backend/AiDocumentWriter/appsettings.json。便携包使用 config/appsettings.local.json 配置 AiProvider.ApiKey；页面也支持临时 Key 和仅限桌面本机模式的加密持久化。

**请勿向 GitHub 提交真实 API Key。**

## 原版使用方式

原有 index.html 仍是单文件工具。浏览器打开后输入 DeepSeek Key，选择文档技能，生成/审校并复制或下载 Markdown/TXT。原版直接从浏览器向 DeepSeek 发送材料。

不要上传涉密资料、未经授权对外传输的内部材料。使用 API 的费用由使用者承担。
