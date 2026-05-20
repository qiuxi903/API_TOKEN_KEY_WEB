# API Token Key - AI 模型测试工具

一个功能强大的 Web 工具，用于测试和管理多个 AI API 提供商的模型。支持自动检测 API 格式、模型测速、流式响应预览、性能可视化，以及 NewAPI 模型重定向配置。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-v14+-green.svg)

## 🌟 核心功能

### 📡 多 API 格式支持
自动检测并支持 **7+ 主流 AI API 格式**：
- **OpenAI 兼容** - OpenAI、Azure、OpenRouter、Together、DeepSeek、Moonshot、Groq、SiliconFlow 等
- **Google Gemini** - generativelanguage.googleapis.com
- **Anthropic Claude** - api.anthropic.com
- **Cohere** - api.cohere.com
- **Mistral** - api.mistral.ai
- **Zhipu/GLM** - open.bigmodel.cn
- **Qwen/DashScope** - dashscope.aliyuncs.com

### ⚡ 模型测速
- **单模型测试** - 实时流式响应，测量 TTFT（首字节延迟）、总耗时、吞吐量
- **批量测试** - 顺序测试多个模型，带进度条和实时流预览
- **性能指标** - 自动计算 Token/s、成本估算、输入/输出 Token 数

### 📊 可视化分析
- **延迟图表** - 水平条形图展示 TTFT 和总耗时对比
- **吞吐量图表** - 竖直条形图展示各模型 Token/s 排名
- **实时流预览** - 终端风格的响应内容预览

### 🔄 NewAPI 模型重定向
- **前缀配置** - 为模型名添加自定义前缀（如 `siteA/`）以区分来源
- **可视化编辑** - 直观的行编辑器，支持添加/删除/修改映射规则
- **JSON 导出** - 生成 NewAPI 兼容的重定向 JSON 配置
- **一键填充** - 生成真实模型名列表，可直接粘贴到 NewAPI 渠道设置

### 💾 历史管理
- **测试记录** - 自动保存测试结果到浏览器本地存储（最多 50 条）
- **导出功能** - 支持 JSON 和 CSV 格式导出
- **快速加载** - 点击历史记录快速查看之前的测试结果

### 🎨 用户界面
- **响应式设计** - 完美适配桌面、平板、手机屏幕
- **深色/浅色主题** - 一键切换，自动保存偏好
- **侧边栏导航** - 6 个功能标签页：连接、模型库、测速、结果、重定向、历史
- **实时搜索** - 快速搜索和筛选模型

## 📋 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **后端** | Node.js + Express | CORS 代理 + SSRF 防护 |
| **前端** | 原生 HTML/CSS/JS | ES 模块，无构建工具 |
| **图表** | Chart.js | 通过 CDN 加载 |
| **字体** | Inter + JetBrains Mono | Google Fonts |
| **存储** | localStorage | 浏览器本地存储 |

## 🚀 快速开始

### 前置要求
- Node.js v14 或更高版本
- npm 或 yarn

### 安装

```bash
# 克隆仓库
git clone https://github.com/qiuxi903/API_TOKEN_KEY_WEB.git
cd API_TOKEN_KEY_WEB

# 安装依赖
npm install
```

### 运行

```bash
# 启动开发服务器
npm start
```

服务器将在 `http://localhost:3000` 启动。在浏览器中打开此地址即可使用。

## 📖 使用指南

### 1. 连接 API

1. 在「连接」标签页输入 **Base URL** 和 **API Key**
2. 选择 API 提供商（或选择「自动检测」）
3. 点击「连接」按钮
4. 工具会自动获取该 API 的所有可用模型

**示例 URL：**
- OpenAI: `https://api.openai.com/v1`
- Azure: `https://{resource}.openai.azure.com/v1`
- Gemini: `https://generativelanguage.googleapis.com/v1beta`
- Claude: `https://api.anthropic.com/v1`

### 2. 测试模型

**单模型测试：**
- 在「模型库」标签页点击任意模型的 **TEST** 按钮
- 在「测速」标签页查看实时流式响应和性能指标

**批量测试：**
- 在「模型库」选中多个模型（勾选复选框）
- 点击「批量测试」或「全部测试」
- 在「测速」标签页查看进度条和实时流预览

### 3. 查看结果

- 「结果」标签页显示详细的测试结果表格
- 自动生成延迟和吞吐量图表
- 支持按 Token/s、延迟等指标排序

### 4. 配置 NewAPI 重定向

**场景：** 你有多个 AI API 渠道，想在 NewAPI 中统一管理，用前缀区分来源。

**步骤：**

1. **设置前缀**
   - 在「重定向」标签页输入自定义前缀（如 `siteA/`）
   - 点击「生成重定向」

2. **填充渠道模型**
   - 复制「渠道模型（真实名称）」中的逗号分隔列表
   - 在 NewAPI 渠道设置中，粘贴到「自定义模型名称」输入框
   - 点击「填入」按钮

3. **配置重定向映射**
   - 复制「重定向 JSON」内容
   - 在 NewAPI 渠道设置中，粘贴到「模型重定向」字段
   - 保存设置

**效果：** 用户请求 `siteA/gpt-4o` 时，NewAPI 自动转换为 `gpt-4o` 发送给上游 API。

### 5. 导出和历史

- **导出** - 在「结果」标签页点击「导出 JSON」或「导出 CSV」
- **历史** - 在「历史」标签页查看之前的测试记录，点击「VIEW」快速加载

## 🔒 安全特性

- **SSRF 防护** - 代理仅允许 HTTPS 连接，阻止访问本地/私有 IP
- **速率限制** - 每个 IP 限制 120 请求/分钟
- **API Key 保护** - Key 仅在浏览器端使用，不存储在服务器

## 📁 项目结构

```
API_TOKEN_KEY_WEB/
├── package.json                    # 项目配置
├── server.js                       # Express 服务器 + 代理端点
├── .gitignore                      # Git 忽略文件
├── README.md                       # 本文件
└── public/
    ├── index.html                  # SPA 主页面
    ├── css/
    │   └── style.css               # 样式表（深色/浅色主题）
    └── js/
        ├── app.js                  # 主应用逻辑 + 事件绑定
        ├── api-providers.js        # 7+ API 提供商适配器
        ├── api-tester.js           # 测速引擎（TTFT、Token/s）
        ├── ui-components.js        # DOM 渲染（卡片、表格、预览）
        ├── chart-manager.js        # Chart.js 包装器
        └── history-manager.js      # localStorage + 导出功能
```

## 🔧 后端 API

### POST /api/proxy
通用代理端点，用于非流式请求（列表模型、非流式聊天）。

**请求体：**
```json
{
  "targetUrl": "https://api.openai.com/v1/models",
  "method": "GET",
  "headers": {
    "Authorization": "Bearer sk-xxx"
  },
  "body": null
}
```

**响应：** 直接转发上游响应

### POST /api/proxy/stream
SSE 流式代理端点，用于流式聊天完成。

**请求体：**
```json
{
  "targetUrl": "https://api.openai.com/v1/chat/completions",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer sk-xxx"
  },
  "body": {
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }
}
```

**响应：** Server-Sent Events (SSE) 流

## 🛠️ 部署

### 本地开发
```bash
npm install
npm start
```

### Docker 部署（可选）

创建 `Dockerfile`：
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

构建并运行：
```bash
docker build -t api-token-key .
docker run -p 3000:3000 api-token-key
```

### 生产环境建议
- 使用 PM2 或 systemd 管理进程
- 配置反向代理（Nginx）处理 HTTPS
- 设置环境变量控制端口和日志级别
- 定期备份 localStorage 数据（导出 JSON）

## 📝 环境变量（可选）

创建 `.env` 文件：
```
PORT=3000
NODE_ENV=production
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 📞 联系方式

- GitHub: [@qiuxi903](https://github.com/qiuxi903)
- Issues: [GitHub Issues](https://github.com/qiuxi903/API_TOKEN_KEY_WEB/issues)

---

**最后更新：** 2026-05-20
