# y-router

## ⚠️ ARCHIVED

**This project is archived.** OpenRouter now provides an official integration for Claude Code. You may consider using the official solution:

👉 **[OpenRouter's Official Claude Code Integration Guide](https://openrouter.ai/docs/guides/guides/claude-code-integration)**

---

A Cloudflare Worker that translates between Anthropic's Claude API and OpenAI-compatible APIs, enabling you to use Claude Code with OpenRouter and other OpenAI-compatible providers.

> **Note:** This worker is suitable for testing models other than Anthropic. For Anthropic models (especially for intensive usage exceeding $200), consider using [claude-relay-service](https://github.com/Wei-Shaw/claude-relay-service) for better value.

## Quick Usage

### One-line Install (Recommended)
```bash
bash -c "$(curl -fsSL https://cc.yovy.app/install.sh)"
```

This script will automatically:
- Install Node.js (if needed)
- Install Claude Code
- Configure your environment with OpenRouter or Moonshot
- Set up all necessary environment variables

### Manual Setup

**Step 1:** Install Claude Code
```bash
npm install -g @anthropic-ai/claude-code
```

**Step 2:** Get OpenRouter API key from [openrouter.ai](https://openrouter.ai)

**Step 3:** Configure environment variables in your shell config (`~/.bashrc` or `~/.zshrc`):

```bash
wrangler deploy
```

### 3) 可选配置

默认上游：`https://openrouter.ai/api/v1`

如果要自定义上游：

```bash
wrangler secret put OPENROUTER_BASE_URL
```

## 本地开发

```bash
npm run dev
```

## 请求示例

```bash
curl -X POST "https://<your-worker-domain>/v1/messages" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <your-openrouter-api-key>" \
  -d '{
    "model": "anthropic/claude-sonnet-4",
    "messages": [{"role": "user", "content": "hello"}],
    "max_tokens": 128
  }'
```

## Claude Code / Claude in Excel 配置要点

- Base URL 指向你的 Worker 域名。
- 路径使用 `/v1/messages`。
- API Key 通过 `X-Api-Key` 或 `Authorization: Bearer ...` 传入。
- 网关已处理 OPTIONS 和全量 CORS 头，可直接跨域调用。

## License

MIT
