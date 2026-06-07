export function isLocalMode(): boolean {
  if (process.env.NEXT_PUBLIC_PRECIOUS_MODE === 'local') return true;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  if (
    apiUrl.includes('localhost') ||
    apiUrl.includes('127.0.0.1') ||
    apiUrl === ''
  ) {
    return true;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  return false;
}
