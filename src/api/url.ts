export function apiUrl(baseUrl: string, endpoint: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  if (base.endsWith('/v1') && endpoint.startsWith('/v1/')) {
    return base + endpoint.slice('/v1'.length);
  }
  return base + endpoint;
}
