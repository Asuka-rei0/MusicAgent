# 环境变量配置指南

## 概述

MusicAgent 使用环境变量管理敏感配置（如 API 密钥），避免将密钥硬编码在源代码中。基于 Vite 的环境变量机制，所有以 `VITE_` 前缀开头的变量会在构建时注入到前端代码中。

## 快速开始

### 1. 创建 `.env` 文件

在项目根目录下复制 `.env.example` 并重命名为 `.env`：

```bash
cp .env.example .env
```

### 2. 填写配置项

编辑 `.env` 文件，填入实际的 API 密钥和配置：

```env
VITE_API_KEY=sk-your-actual-api-key-here
VITE_API_BASE_URL=https://api.deepseek.com/v1
VITE_API_MODEL=deepseek-chat
```

### 3. 重启开发服务器

修改 `.env` 文件后需要重启 Vite 开发服务器才能生效：

```bash
npm run dev
```

## 配置项说明

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `VITE_API_KEY` | 是 | 无 | AI 服务的 API 密钥 |
| `VITE_API_BASE_URL` | 否 | `https://api.deepseek.com/v1` | AI 服务的 API 基础地址 |
| `VITE_API_MODEL` | 否 | `deepseek-chat` | 使用的模型名称 |

## 配置优先级

系统按以下优先级加载 API 配置：

1. **localStorage 中用户保存的配置**（通过设置页面配置）
2. **环境变量（`.env` 文件）**
3. **代码中的默认值**

这意味着用户在设置页面中手动配置的 API 密钥会优先于 `.env` 文件中的配置。

## 支持的 AI 服务提供商

### DeepSeek（默认）

```env
VITE_API_KEY=sk-your-deepseek-key
VITE_API_BASE_URL=https://api.deepseek.com/v1
VITE_API_MODEL=deepseek-chat
```

### OpenAI

```env
VITE_API_KEY=sk-your-openai-key
VITE_API_BASE_URL=https://api.openai.com/v1
VITE_API_MODEL=gpt-3.5-turbo
```

### 其他兼容 OpenAI 接口的服务

```env
VITE_API_KEY=your-api-key
VITE_API_BASE_URL=https://your-provider.com/v1
VITE_API_MODEL=model-name
```

## 安全注意事项

- **切勿将 `.env` 文件提交到版本控制系统**。`.gitignore` 已配置排除 `.env` 文件
- **仅在 `.env.example` 中保留示例值**，不填写真实密钥
- Vite 环境变量以 `VITE_` 前缀的变量会被打包到前端代码中，这意味着它们在浏览器中可见。这是前端应用的固有特性，因此：
  - 建议使用有域名/IP 限制的 API 密钥
  - 考虑部署一个后端代理服务来转发 API 请求，将密钥存储在服务端
- 生产环境部署时，可通过构建命令注入环境变量或在部署平台上配置

## 多环境配置

Vite 支持按环境加载不同的配置文件：

| 文件 | 加载时机 |
|------|---------|
| `.env` | 所有环境 |
| `.env.local` | 所有环境，被 git 忽略 |
| `.env.development` | 开发环境（`npm run dev`） |
| `.env.production` | 生产环境（`npm run build`） |

例如，创建 `.env.development` 使用测试密钥，`.env.production` 使用生产密钥。

## 故障排查

### API 密钥未生效

1. 确认 `.env` 文件位于项目根目录
2. 确认变量名以 `VITE_` 开头
3. 重启开发服务器
4. 在浏览器 DevTools 控制台输入 `import.meta.env` 检查变量是否加载

### 提示"API密钥未配置"

1. 检查 `.env` 文件中 `VITE_API_KEY` 是否有值
2. 确认没有多余的空格或引号
3. 正确格式：`VITE_API_KEY=sk-abc123`（无需引号）
