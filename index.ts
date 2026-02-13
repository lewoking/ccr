import { Env } from './env';
import { formatAnthropicToOpenAI } from './formatRequest';
import { streamOpenAIToAnthropic } from './streamResponse';
import { formatOpenAIToAnthropic } from './formatResponse';

const BASE_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Api-Key, anthropic-version, anthropic-beta, anthropic-dangerous-direct-browser-access, user-agent, x-stainless-arch, x-stainless-helper-method, x-stainless-lang, x-stainless-os, x-stainless-package-version, x-stainless-retry-count, x-stainless-runtime, x-stainless-runtime-version, x-stainless-timeout',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
};

const DEFAULT_OPENAI_BASE_URL = 'https://openrouter.ai/api/v1';

function withCors(response: Response, request?: Request): Response {
  const headers = new Headers(response.headers);
  Object.entries(BASE_CORS_HEADERS).forEach(([key, value]) => headers.set(key, value));

  const requestedHeaders = request?.headers.get('Access-Control-Request-Headers');
  if (requestedHeaders) {
    headers.set('Access-Control-Allow-Headers', requestedHeaders);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(data: unknown, status = 200, request?: Request): Response {
  return withCors(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }),
    request,
  );
}

function normalizeBaseUrl(baseUrl?: string): string {
  if (!baseUrl) {
    return DEFAULT_OPENAI_BASE_URL;
  }

  const normalized = baseUrl.trim().replace(/\/+$/, '');
  return normalized || DEFAULT_OPENAI_BASE_URL;
}

function resolveUpstreamBaseUrl(env: Env): string {
  return normalizeBaseUrl(env.OPENAI_BASE_URL || env.OPENROUTER_BASE_URL || DEFAULT_OPENAI_BASE_URL);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), request);
    }

    if (url.pathname !== '/v1/messages') {
      return jsonResponse(
        {
          error: 'Not Found',
          message: 'Use POST /v1/messages with Anthropic-compatible request JSON.',
          allowed_methods: ['POST', 'OPTIONS'],
        },
        404,
        request,
      );
    }

    if (request.method !== 'POST') {
      return jsonResponse(
        {
          error: 'Method Not Allowed',
          message: 'This endpoint only supports POST /v1/messages. Use OPTIONS for CORS preflight.',
          allowed_methods: ['POST', 'OPTIONS'],
        },
        405,
        request,
      );
    }

    try {
      const anthropicRequest = await request.json();
      const openaiRequest = formatAnthropicToOpenAI(anthropicRequest);
      const bearerToken =
        request.headers.get('X-Api-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');

      const baseUrl = resolveUpstreamBaseUrl(env);
      const upstreamResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify(openaiRequest),
      });

      if (!upstreamResponse.ok) {
        return withCors(
          new Response(await upstreamResponse.text(), {
            status: upstreamResponse.status,
            headers: {
              'Content-Type': upstreamResponse.headers.get('Content-Type') || 'application/json; charset=utf-8',
            },
          }),
          request,
        );
      }

      if (openaiRequest.stream) {
        const anthropicStream = streamOpenAIToAnthropic(upstreamResponse.body as ReadableStream, openaiRequest.model);
        return withCors(
          new Response(anthropicStream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          }),
          request,
        );
      }

      const openaiData = await upstreamResponse.json();
      const anthropicResponse = formatOpenAIToAnthropic(openaiData, openaiRequest.model);
      return jsonResponse(anthropicResponse, 200, request);
    } catch (error) {
      return jsonResponse(
        {
          error: 'Bad Request',
          message: 'Invalid request body. Send valid JSON to POST /v1/messages.',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        400,
        request,
      );
    }
  },
};
