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
# For quick testing, you can use our shared instance. For daily use, deploy your own instance for better reliability.
export ANTHROPIC_BASE_URL="https://cc.yovy.app"
export ANTHROPIC_API_KEY="your-openrouter-api-key"
export ANTHROPIC_CUSTOM_HEADERS="x-api-key: $ANTHROPIC_API_KEY"
```

**Optional:** Configure specific models (browse models at [openrouter.ai/models](https://openrouter.ai/models)):
```bash
export ANTHROPIC_MODEL="moonshotai/kimi-k2"
export ANTHROPIC_SMALL_FAST_MODEL="google/gemini-2.5-flash"
```

**Step 4:** Reload your shell and run Claude Code:
```bash
source ~/.bashrc
claude
```

That's it! Claude Code will now use OpenRouter's models through y-router.

### Multiple Configurations

To maintain multiple Claude Code configurations for different providers or models, use shell aliases:

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
