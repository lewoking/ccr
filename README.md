# Claude Code Router

为 Claude Code / Claude in Excel 提供的 API 网关，支持三种路径模式：Claude 兼容、Gemini 官方、OpenRouter 官方。

## 功能特性

- ✅ **路径识别路由**：按请求路径自动识别 Claude / Gemini / OpenRouter
- ✅ **Claude 兼容转换**：`/v1/messages` 保持 Anthropic 协议，自动转换并转发
- ✅ **官方 API 直通**：Gemini 与 OpenRouter 官方路径仅做网络中转，不改请求结构
- ✅ **多服务商密钥识别**：Claude 路径下按密钥格式自动选择 OpenRouter 或 Gemini(OpenAI兼容)
- ✅ **完整 CORS 支持**：支持浏览器跨域调用

## 路由规则

### 1) Claude 路径

- 路径：`POST /v1/messages`
- 行为：
  - 读取 `Authorization` 或 `X-Api-Key`
  - 按密钥前缀识别上游：
    - `sk-or-v1-*` → OpenRouter OpenAI 兼容
    - `AI*` → Gemini OpenAI 兼容
  - 将 Anthropic 请求转换为 OpenAI Chat Completions
  - 返回再转换回 Anthropic 响应

### 2) Gemini 官方路径

- 路径：`/v1beta/*`
- 行为：原样转发到 `https://generativelanguage.googleapis.com`
- 说明：不做协议与字段转换

### 3) OpenRouter 官方路径

- 路径：`/api/v1/*` 或 `/v1/*`（排除 `/v1/messages`）
- 行为：原样转发到 `https://openrouter.ai`
- 说明：不做协议与字段转换

## 使用示例

### Claude 兼容请求

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

### Gemini 官方请求直通

```bash
curl -X POST "https://<your-worker-domain>/v1beta/models/gemini-2.5-flash:generateContent?key=<GEMINI_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{"parts": [{"text": "hello"}]}]
  }'
```

### OpenRouter 官方请求直通

```bash
curl -X POST "https://<your-worker-domain>/api/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-or-v1-xxxxx" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "hello"}]
  }'
```


## License

MIT
