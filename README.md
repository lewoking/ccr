# y-router

一个可部署到 Cloudflare Workers 的 API 网关：
- 只保留 API 能力（不再提供主页/安装脚本页面）。
- 接收 Anthropic `/v1/messages` 请求格式。
- 转发到 OpenAI 兼容接口（默认 OpenRouter）。
- 将响应转换回 Anthropic 兼容格式。
- 提供完整 CORS（含错误响应），支持 Claude in Excel 等跨域场景。

## Endpoint

- `POST /v1/messages`：主接口
- `OPTIONS *`：CORS 预检

其余路径返回 `404`，并提示正确调用方法。
`GET /v1/messages` 等错误方法返回 `405`，并提示应使用 `POST`。

## CORS

所有响应（成功、4xx、5xx、上游错误）都带有：

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-Api-Key, anthropic-version, anthropic-beta`
- `Access-Control-Max-Age: 86400`

## Deploy

### 1) 安装依赖工具

```bash
npm install -g wrangler
```

### 2) 部署

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
