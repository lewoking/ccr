## Quick Usage


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
    "model": "anthropic/claude-sonnet-4.5",
    "messages": [{"role": "user", "content": "hello"}],
    "max_tokens": 128
  }'
```

## Claude Code / Claude in Excel 配置要点

- Base URL 指向你的 Worker 域名。
- 路径使用 `/v1/messages`。
- API Key 通过 `X-Api-Key` 或 `Authorization: Bearer ...` 传入。
- 网关已处理 OPTIONS 和全量 CORS 头，可直接跨域调用。
- 模型依旧要选择anthropic家的模型，例如：anthropic/claude-sonnet-4.5  别家模型Excel插件可能会死循环。

## License

MIT
