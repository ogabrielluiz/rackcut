const ALLOWED_URL_PATTERN =
  /^https:\/\/(www\.)?modulargrid\.net\/e\/racks\/view\/\d+$/;

const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2MB

export function isAllowedUrl(url: string): boolean {
  return ALLOWED_URL_PATTERN.test(url);
}

function corsHeaders(allowedOrigin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonError(
  status: number,
  message: string,
  allowedOrigin: string
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(allowedOrigin),
    },
  });
}

export async function handleRequest(
  request: Request,
  allowedOrigin: string
): Promise<Response> {
  const headers = corsHeaders(allowedOrigin);

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers,
    });
  }

  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return jsonError(400, "Missing url parameter", allowedOrigin);
  }

  if (!isAllowedUrl(targetUrl)) {
    return jsonError(400, "URL not allowed", allowedOrigin);
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      headers: {
        "User-Agent": "rackcut-proxy/1.0",
      },
    });
  } catch {
    return jsonError(502, "Failed to fetch target URL", allowedOrigin);
  }

  if (!upstream.ok) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  }

  // Check content-length header first
  const contentLength = upstream.headers.get("content-length");
  if (contentLength !== null && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return jsonError(413, "Response too large", allowedOrigin);
  }

  const body = await upstream.arrayBuffer();

  if (body.byteLength > MAX_BODY_SIZE) {
    return jsonError(413, "Response too large", allowedOrigin);
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      ...headers,
    },
  });
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    return handleRequest(request, allowedOrigin);
  },
};
