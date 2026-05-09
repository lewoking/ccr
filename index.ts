import { Env } from './env';
import { formatAnthropicToOpenAI } from './formatRequest';
import { streamOpenAIToAnthropic } from './streamResponse';
import { formatOpenAIToAnthropic } from './formatResponse';
import { detectProvider, resolveProviderConfig, parseGeminiModelMapping } from './providers';

const BASE_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Api-Key, anthropic-version, anthropic-beta, anthropic-dangerous-direct-browser-access, user-agent, x-stainless-arch, x-stainless-helper-method, x-stainless-lang, x-stainless-os, x-stainless-package-version, x-stainless-retry-count, x-stainless-runtime, x-stainless-runtime-version, x-stainless-timeout',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
};

const GEMINI_OFFICIAL_BASE_URL = 'https://generativelanguage.googleapis.com';
const OPENROUTER_OFFICIAL_BASE_URL = 'https://openrouter.ai';

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

function isClaudePath(pathname: string): boolean {
  return pathname === '/v1/messages';
}

function isGeminiPath(pathname: string): boolean {
  // Gemini official REST style: /v1beta/*
  return pathname.startsWith('/v1beta/');
}

function isOpenRouterPath(pathname: string): boolean {
  // OpenRouter official REST style: /api/v1/* or /v1/* (excluding Claude endpoint)
  return pathname.startsWith('/api/v1/') || (pathname.startsWith('/v1/') && pathname !== '/v1/messages');
}

function getPathProxyUrl(originalUrl: URL): string | null {
  const target = `${originalUrl.pathname}${originalUrl.search}`;
  if (!target.startsWith('/https://')) {
    return null;
  }

  try {
    const upstreamUrl = new URL(target.slice(1));
    if (upstreamUrl.protocol !== 'https:' || !upstreamUrl.hostname) {
      return null;
    }
    return upstreamUrl.toString();
  } catch {
    return null;
  }
}

function buildProxyUrl(baseUrl: string, originalUrl: URL): string {
  return `${baseUrl.replace(/\/+$/, '')}${originalUrl.pathname}${originalUrl.search}`;
}

function copyRequestHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  return headers;
}

async function proxyRawRequestToUrl(request: Request, upstreamUrl: string): Promise<Response> {
  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers: copyRequestHeaders(request),
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'follow',
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: upstreamResponse.headers,
  });
}

async function proxyRawRequest(request: Request, baseUrl: string): Promise<Response> {
  return proxyRawRequestToUrl(request, buildProxyUrl(baseUrl, new URL(request.url)));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), request);
    }

    const pathProxyUrl = getPathProxyUrl(url);
    if (pathProxyUrl) {
      return withCors(await proxyRawRequestToUrl(request, pathProxyUrl), request);
    }

    if (isClaudePath(url.pathname)) {
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

        const bearerToken = request.headers.get('X-Api-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');

        if (!bearerToken) {
          return jsonResponse(
            {
              error: 'Unauthorized',
              message: 'API key is required. Provide via Authorization header or X-Api-Key header.',
            },
            401,
            request,
          );
        }

        const provider = detectProvider(bearerToken);
        const providerConfig = resolveProviderConfig(provider, bearerToken);
        const geminiModelMapping = parseGeminiModelMapping(env.GEMINI_MODEL_MAPPING);
        const openaiRequest = formatAnthropicToOpenAI(anthropicRequest, provider, geminiModelMapping);

        const upstreamResponse = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${providerConfig.apiKey}`,
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
    }

    if (isOpenRouterPath(url.pathname)) {
      return withCors(await proxyRawRequest(request, OPENROUTER_OFFICIAL_BASE_URL), request);
    }

    if (isGeminiPath(url.pathname)) {
      return withCors(await proxyRawRequest(request, GEMINI_OFFICIAL_BASE_URL), request);
    }

    return jsonResponse(
      {
        error: 'Not Found',
        message: 'Supported paths: /v1/messages (Claude), /v1beta/* (Gemini official), /api/v1/* or /v1/* except /v1/messages (OpenRouter official).',
      },
      404,
      request,
    );
  },
};
