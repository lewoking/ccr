import { Env } from './env';
import { detectProvider } from './providers';

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
const PATH_PROXY_ORIGIN_COOKIE = 'ccr_path_proxy_origin';

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

function getPathProxyTarget(originalUrl: URL): URL | null {
  const target = `${originalUrl.pathname}${originalUrl.search}`;
  if (!target.startsWith('/https://')) {
    return null;
  }

  try {
    const upstreamUrl = new URL(target.slice(1));
    if (upstreamUrl.protocol !== 'https:' || !upstreamUrl.hostname) {
      return null;
    }
    return upstreamUrl;
  } catch {
    return null;
  }
}

function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [cookieName, ...valueParts] = cookie.trim().split('=');
    if (cookieName === name) {
      return valueParts.join('=');
    }
  }
  return null;
}

function getPathProxyOrigin(request: Request): string | null {
  const cookieValue = getCookieValue(request, PATH_PROXY_ORIGIN_COOKIE);
  if (!cookieValue) {
    return null;
  }

  try {
    const upstreamOrigin = new URL(decodeURIComponent(cookieValue));
    if (upstreamOrigin.protocol !== 'https:' || !upstreamOrigin.hostname) {
      return null;
    }
    return upstreamOrigin.origin;
  } catch {
    return null;
  }
}

function getFallbackPathProxyUrl(request: Request): string | null {
  const originalUrl = new URL(request.url);
  const upstreamOrigin = getPathProxyOrigin(request);
  if (!upstreamOrigin) {
    return null;
  }

  return new URL(`${originalUrl.pathname}${originalUrl.search}`, upstreamOrigin).toString();
}

function buildProxyUrl(baseUrl: string, originalUrl: URL): string {
  return `${baseUrl.replace(/\/+$/, '')}${originalUrl.pathname}${originalUrl.search}`;
}

function removeCookieValue(cookieHeader: string, name: string): string {
  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie && !cookie.startsWith(`${name}=`))
    .join('; ');
}

function copyRequestHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const cookieHeader = headers.get('Cookie');
  if (cookieHeader) {
    const forwardedCookies = removeCookieValue(cookieHeader, PATH_PROXY_ORIGIN_COOKIE);
    if (forwardedCookies) {
      headers.set('Cookie', forwardedCookies);
    } else {
      headers.delete('Cookie');
    }
  }

  return headers;
}

async function proxyRawRequestToUrl(
  request: Request,
  upstreamUrl: string,
  pathProxyOrigin?: string,
): Promise<Response> {
  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers: copyRequestHeaders(request),
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'follow',
  });
  const headers = new Headers(upstreamResponse.headers);

  if (pathProxyOrigin) {
    headers.append(
      'Set-Cookie',
      `${PATH_PROXY_ORIGIN_COOKIE}=${encodeURIComponent(pathProxyOrigin)}; Path=/; Secure; HttpOnly; SameSite=Lax`,
    );
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}

async function proxyRawRequest(request: Request, baseUrl: string): Promise<Response> {
  return proxyRawRequestToUrl(request, buildProxyUrl(baseUrl, new URL(request.url)));
}

async function buildOpenRouterMessagesRequest(
  request: Request,
  targetUrl: string,
): Promise<Request> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return new Request(targetUrl, {
      method: request.method,
      headers: copyRequestHeaders(request),
    });
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) {
    return new Request(targetUrl, {
      method: request.method,
      headers: copyRequestHeaders(request),
      body: request.body,
    });
  }

  const payload = await request.clone().json();
  const model = typeof payload?.model === 'string' ? payload.model : '';
  if (model && !model.includes('/') && model.toLowerCase().includes('claude')) {
    payload.model = `anthropic/${model}`;
  }

  return new Request(targetUrl, {
    method: request.method,
    headers: copyRequestHeaders(request),
    body: JSON.stringify(payload),
  });
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), request);
    }

    const pathProxyTarget = getPathProxyTarget(url);
    if (pathProxyTarget) {
      return withCors(
        await proxyRawRequestToUrl(request, pathProxyTarget.toString(), pathProxyTarget.origin),
        request,
      );
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
        if (provider !== 'openrouter') {
          return jsonResponse(
            {
              error: 'Unsupported Provider',
              message: '/v1/messages only supports OpenRouter API keys (sk-or-v1-*).',
            },
            400,
            request,
          );
        }

        const targetUrl = `${OPENROUTER_OFFICIAL_BASE_URL}/api/v1/messages${url.search}`;
        const upstreamRequest = await buildOpenRouterMessagesRequest(request, targetUrl);
        const upstreamResponse = await fetch(upstreamRequest, { redirect: 'follow' });
        return withCors(
          new Response(upstreamResponse.body, {
            status: upstreamResponse.status,
            statusText: upstreamResponse.statusText,
            headers: upstreamResponse.headers,
          }),
          request,
        );
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

    const fallbackPathProxyUrl = getFallbackPathProxyUrl(request);
    if (fallbackPathProxyUrl) {
      return withCors(
        await proxyRawRequestToUrl(request, fallbackPathProxyUrl, new URL(fallbackPathProxyUrl).origin),
        request,
      );
    }

    return jsonResponse(
      {
        error: 'Not Found',
        message: 'Supported paths: /v1/messages, /v1beta/* , /api/v1/* or /v1/*.',
      },
      404,
      request,
    );
  },
};
