# Claude Code Router

为 Claude Code / Claude in Excel 提供的 API 网关，支持多个 LLM 服务商（OpenRouter 和 Gemini）。

## 功能特性

- ✅ **多服务商支持**：自动识别 API Key 并路由到相应服务商
- ✅ **智能模型映射**：自动转换 Claude 模型为目标服务商的等价模型
- ✅ **零代码升级**：新模型发布时通过环境变量配置，无需重新部署
- ✅ **OpenRouter 直通**：Claude 模型自动加 `anthropic/` 前缀
- ✅ **Gemini 智能映射**：Claude 模型自动映射到 Gemini 2.5 系列
- ✅ **完整 CORS 支持**：支持浏览器跨域调用

## 服务商支持

| 服务商 | API Key 前缀 | 识别方式 | 模型映射 |
|--------|-----------|--------|--------|
| **OpenRouter** | `sk-or-v1-*` | 自动检测 | Claude → `anthropic/claude-*` |
| **Gemini** | `AI*` | 自动检测 | Claude → Gemini 2.5 系列 |

## 快速开始

### 配置（可选）

#### 自定义 Base URL

```bash
# OpenRouter（默认：https://openrouter.ai/api/v1）
wrangler secret put OPENROUTER_BASE_URL

# Gemini（默认：https://generativelanguage.googleapis.com/v1beta/openai/）
wrangler secret put GEMINI_BASE_URL
```

#### 更新 Gemini 模型映射

当 Gemini 发布新模型版本时，只需更新环境变量（`wrangler.toml`）：

```toml
[env.production]
vars = { 
  GEMINI_MODEL_MAPPING = '{"opus":"gemini-3-pro","sonnet":"gemini-3-flash","haiku":"gemini-3-flash-lite"}'
}
```

默认映射（Gemini 2.5 系列）：
```json
{
  "opus": "gemini-2.5-pro",
  "sonnet": "gemini-2.5-flash",
  "haiku": "gemini-2.5-flash-lite"
}
```

## 使用方式

### OpenRouter 请求

```bash
curl -X POST "https://<your-worker-domain>/v1/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-or-v1-xxxxx" \
  -d '{
    "model": "claude-opus-4",
    "messages": [{"role": "user", "content": "hello"}],
    "max_tokens": 1024
  }'
```

网关自动转换为：
```json
{
  "model": "anthropic/claude-opus-4",
  "messages": [...],
  "max_tokens": 1024
}
```

### Gemini 请求

```bash
curl -X POST "https://<your-worker-domain>/v1/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer AIxxxxx" \
  -d '{
    "model": "claude-opus-4",
    "messages": [{"role": "user", "content": "hello"}],
    "max_tokens": 1024
  }'
```

网关自动转换为：
```json
{
  "model": "gemini-2.5-pro",
  "messages": [...],
  "max_tokens": 1024
}
```

## 模型映射规则

网关自动识别 Claude 模型层级并转换：

| Claude 模型 | OpenRouter | Gemini |
|-----------|-----------|--------|
| `claude-opus-*` | `anthropic/claude-opus-*` | `gemini-2.5-pro` |
| `claude-sonnet-*` | `anthropic/claude-sonnet-*` | `gemini-2.5-flash` |
| `claude-haiku-*` | `anthropic/claude-3.5-haiku` | `gemini-2.5-flash-lite` |

## Claude Code 配置

1. **Base URL**: 指向网关域名
   ```
   https://<your-worker-domain>
   ```

2. **Endpoint**: `/v1/messages`

3. **API Key**: 支持两种传入方式
   - HTTP 头 `X-Api-Key`
   - HTTP 头 `Authorization: Bearer <api-key>`

4. **模型选择**: 直接使用 Claude 模型名
   ```
   claude-opus-4
   claude-sonnet-4
   claude-haiku-3
   ```

## 本地开发

```bash
npm install
npm run dev
```

## 自动部署

代码推送到 `main` 分支时，GitHub Actions 会自动构建并部署到 CloudFlare Workers。

**需要配置的 GitHub Secrets**：
- `CLOUDFLARE_API_TOKEN`: CloudFlare API Token
- `CLOUDFLARE_ACCOUNT_ID`: CloudFlare Account ID

## 工作流程

```
Claude Code 请求
    ↓
读取 API Key
    ↓
检测提供商 (OpenRouter/Gemini)
    ↓
识别模型层级 (opus/sonnet/haiku)
    ↓
转换模型名称
    ↓
转换为 OpenAI 格式
    ↓
转发到目标服务商
    ↓
转换响应为 Claude 格式
    ↓
返回结果
```

## License

MIT
