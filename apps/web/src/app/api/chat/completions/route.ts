import { copyPreciousHeaders, resolveApiUrl } from '../../../../lib/api-url';

export const runtime = 'nodejs';

/** Proxy chat completions so X-Precious-* headers reach the browser (rewrites drop them). */
export async function POST(req: Request): Promise<Response> {
  const apiUrl = resolveApiUrl();
  const body = await req.text();

  const upstream = await fetch(`${apiUrl}/api/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(req.headers.get('cookie') ? { cookie: req.headers.get('cookie')! } : {}),
      ...(req.headers.get('authorization')
        ? { authorization: req.headers.get('authorization')! }
        : {}),
    },
    body,
  });

  const headers = new Headers();
  copyPreciousHeaders(upstream, headers);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
