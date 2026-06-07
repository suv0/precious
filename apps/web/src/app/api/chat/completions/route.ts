export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  const res = await fetch(`${apiUrl}/api/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: req.headers.get('cookie') ?? '',
    },
    body: JSON.stringify({
      messages: body.messages,
      model: body.model,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(err, { status: res.status });
  }

  const provider = res.headers.get('X-Precious-Provider');
  const model = res.headers.get('X-Precious-Model');
  const failoverFrom = res.headers.get('X-Failover-From');
  const routedVia = res.headers.get('X-Routed-Via');
  const headers = new Headers({
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  if (provider) headers.set('X-Precious-Provider', provider);
  if (model) headers.set('X-Precious-Model', model);
  if (failoverFrom) headers.set('X-Failover-From', failoverFrom);
  if (routedVia) headers.set('X-Routed-Via', routedVia);

  const reader = res.body?.getReader();
  if (!reader) return new Response('No stream', { status: 502 });

  const stream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const chunk = JSON.parse(data);
              const text = chunk.choices?.[0]?.delta?.content;
              if (text) controller.enqueue(new TextEncoder().encode(text));
            } catch {
              // skip
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers });
}
