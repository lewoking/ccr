# Claude Code Router

按路径转发请求到 OpenRouter / Gemini。

## 路由
- `POST /v1/messages`：仅 `sk-or-v1-*`，转发到 `https://openrouter.ai/api/v1/messages`。
  - `model=claude-*`（无前缀）会自动改为 `anthropic/claude-*`。
- `/api/v1/*`、`/v1/*`（不含 `/v1/messages`）：转发到 OpenRouter。
- `/v1beta/*`：转发到 Gemini。

## Claude Code CLI
```bash
export ANTHROPIC_BASE_URL="https://<worker>"
export ANTHROPIC_API_KEY="sk-or-v1-..."
```
