# Claude Code Router

一个轻量 API 网关：按路径把请求直通到 OpenRouter 或 Gemini。

## 路由
- `POST /v1/messages`：仅支持 OpenRouter Key（`sk-or-v1-*`），原样转发。
- `/api/v1/*`、`/v1/*`（不含 `/v1/messages`）：原样转发到 OpenRouter。
- `/v1beta/*`：原样转发到 Gemini。

## 用法
```bash
# 1) Claude Messages（OpenRouter Key）
curl -X POST "https://<worker>/v1/messages" \
  -H "Authorization: Bearer sk-or-v1-xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"anthropic/claude-sonnet-4","messages":[{"role":"user","content":"hello"}]}'

# 2) OpenRouter 官方路径
curl -X POST "https://<worker>/api/v1/chat/completions" \
  -H "Authorization: Bearer sk-or-v1-xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"hello"}]}'

# 3) Gemini 官方路径
curl -X POST "https://<worker>/v1beta/models/gemini-2.5-flash:generateContent?key=<GEMINI_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"hello"}]}]}'
```
