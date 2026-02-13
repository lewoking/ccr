import { Env } from './env';
import { formatAnthropicToOpenAI } from './formatRequest';
import { streamOpenAIToAnthropic } from './streamResponse';
import { formatOpenAIToAnthropic } from './formatResponse';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key, anthropic-version, anthropic-beta',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return withCors(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }),
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }));
    }

    if (url.pathname !== '/v1/messages') {
      return jsonResponse(
        {
          error: 'Not Found',
          message: 'Use POST /v1/messages with Anthropic-compatible request JSON.',
          allowed_methods: ['POST', 'OPTIONS'],
        },
        404,
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
      );
    }

    try {
      const anthropicRequest = await request.json();
      const openaiRequest = formatAnthropicToOpenAI(anthropicRequest);
      const bearerToken =
        request.headers.get('X-Api-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');

      const baseUrl = env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
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
        );
      }

      const openaiData = await upstreamResponse.json();
      const anthropicResponse = formatOpenAIToAnthropic(openaiData, openaiRequest.model);
      return jsonResponse(anthropicResponse);
    } catch (error) {
      return jsonResponse(
        {
          error: 'Bad Request',
          message: 'Invalid request body. Send valid JSON to POST /v1/messages.',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        400,
      );
    }
  },
};
