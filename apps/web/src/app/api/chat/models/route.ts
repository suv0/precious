export const runtime = 'nodejs';

export async function GET(req: Request) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${apiUrl}/api/chat/models`, {
    headers: { Cookie: req.headers.get('cookie') ?? '' },
  });
  const data = await res.text();
  return new Response(data, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
