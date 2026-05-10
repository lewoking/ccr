# Claude Code Router

```mermaid
flowchart LR
    A[Claude Code CLI\nANTHROPIC_BASE_URL=https://<worker>] --> B[/POST /v1/messages/]
    C[OpenRouter API\nsk-or-v1-*] --> B
    B -->|model=claude-* 自动补 anthropic/ 前缀| D[https://openrouter.ai/api/v1/messages]

    E[/api/v1/* 或 /v1/*\n(不含 /v1/messages)] --> F[https://openrouter.ai]
    G[/v1beta/*] --> H[https://generativelanguage.googleapis.com]
```

```bash
export ANTHROPIC_BASE_URL="https://<worker>"
export ANTHROPIC_API_KEY="sk-or-v1-..."
```
